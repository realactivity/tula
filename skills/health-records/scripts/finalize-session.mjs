#!/usr/bin/env node
/**
 * finalize-session.mjs
 *
 * Step 2 of the health-records skill: poll the backend until Paul has
 * finished the OAuth dance in his browser, then download, decrypt, and
 * decompress his FHIR records into one JSON file per connected provider.
 *
 * Usage:
 *   node finalize-session.mjs <sessionId> '<privateKeyJwk>' <outputDir> [opts]
 *
 * Options:
 *   --prefetch-chunks <n>       In-flight chunk downloads (default: 8)
 *   --max-attempts <n>          Poll attempts before timeout (default: 60)
 *   --poll-timeout-seconds <n>  Long-poll timeout per request (default: 30)
 *   --spool-dir <path>          Staging dir for chunks (default: <out>/.spool)
 *   --instrument                Emit memory/progress diagnostics to stdout
 *
 * Environment:
 *   FINALIZE_INSTRUMENT=1       Same as --instrument
 *   HEALTH_SKILLZ_BASE_URL=...  Override backend (default: hosted instance)
 *
 * ── How the wire protocol works (v3) ───────────────────────────────────────
 *
 *   1. Poll /api/poll/<sid>: backend long-polls; eventually returns
 *      { ready: true, providers: [ {providerIndex, name, chunks: [...]} ] }.
 *
 *   2. For each provider, download its chunks in parallel (bounded by
 *      --prefetch-chunks) from /api/chunks/<sid>/<pi>/<ci>.
 *
 *   3. Each chunk's meta contains an `ephemeralPublicKey` (the backend's
 *      one-time ECDH pubkey for that chunk) and an AES-GCM `iv`. We:
 *        a. Import the ephemeral pubkey.
 *        b. ECDH-derive a 256-bit shared secret with our private key.
 *        c. Use that secret as an AES-GCM key.
 *        d. Decrypt the chunk ciphertext.
 *
 *   4. Concatenate decrypted chunks into a gzip stream, decompress on the fly,
 *      stream the result to disk. Atomic rename when complete.
 *
 *   5. Sniff the first 1MB of each provider's JSON to find its `name`,
 *      slugify it, and use that for the final filename.
 *
 * ── Memory discipline ──────────────────────────────────────────────────────
 *
 *   We never hold a whole provider's decrypted JSON in RAM. Chunks land on
 *   disk as encrypted blobs, then stream through decrypt → gunzip → file.
 *   This matters because a heavy user can have 300MB+ of FHIR data once
 *   decompressed, and we run on a 2GB Azure VM.
 *
 * ── Output (NDJSON to stdout) ──────────────────────────────────────────────
 *
 *   {"status":"polling","sessionId":"..."}
 *   {"status":"waiting","sessionStatus":"collecting","providerCount":1,"attempt":1}
 *   {"status":"ready","providerCount":2,"attempts":7}
 *   {"status":"decrypting","providerCount":2,"prefetchChunks":8}
 *   {"status":"wrote_file","file":"./out/unitypoint-health.json",...}
 *   {"status":"done","files":[...],"elapsedMs":12345.6}
 *
 * Ported from Joshua Mandel's TypeScript original (bun) to Node ESM.
 * Requires Node 18+ for global fetch, Web Crypto, and DecompressionStream.
 */

import { mkdirSync, renameSync } from 'fs';
import { open, rm } from 'fs/promises';
import { join } from 'path';

// ── Constants ──────────────────────────────────────────────────────────────

const BASE_URL = process.env.HEALTH_SKILLZ_BASE_URL || 'https://health-skillz.joshuamandel.com';

const DEFAULT_PREFETCH_CHUNKS = 8;   // 8 concurrent downloads = good throughput, modest RAM
const DEFAULT_MAX_ATTEMPTS = 60;     // ~30 min at 30s long-poll: plenty for OAuth + portal scrape
const DEFAULT_POLL_TIMEOUT_SECONDS = 30;

// ── CLI parsing ────────────────────────────────────────────────────────────

function usageAndExit(message) {
  if (message) console.error(message);
  console.error(
    'Usage: node finalize-session.mjs <sessionId> <privateKeyJwk> <outputDir>\n' +
    '       [--prefetch-chunks N] [--max-attempts N] [--poll-timeout-seconds N]\n' +
    '       [--spool-dir PATH] [--instrument]'
  );
  process.exit(1);
}

function parseNumber(raw, flag) {
  const n = Number(raw);
  if (!Number.isFinite(n)) usageAndExit(`Invalid value for ${flag}: ${raw}`);
  return n;
}

function parseBoolEnv(raw) {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function parseCli(argv) {
  const sessionId = argv[2];
  const privateKeyJwkStr = argv[3];
  const outputDir = argv[4];
  if (!sessionId || !privateKeyJwkStr || !outputDir) usageAndExit();

  let privateKeyJwk;
  try { privateKeyJwk = JSON.parse(privateKeyJwkStr); }
  catch { usageAndExit('privateKeyJwk must be valid JSON.'); }

  const options = {
    prefetchChunks: DEFAULT_PREFETCH_CHUNKS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    pollTimeoutSeconds: DEFAULT_POLL_TIMEOUT_SECONDS,
    spoolDir: join(outputDir, '.spool'),
    instrument: parseBoolEnv(process.env.FINALIZE_INSTRUMENT),
  };

  // Walk remaining args. Each --flag consumes the next token as its value,
  // except --instrument which is a bare boolean.
  const extra = argv.slice(5);
  for (let i = 0; i < extra.length; i++) {
    const arg = extra[i];
    const takeValue = (flag) => {
      const v = extra[i + 1];
      if (!v || v.startsWith('--')) usageAndExit(`Missing value for ${flag}`);
      i++;
      return v;
    };
    switch (arg) {
      case '--prefetch-chunks':
        options.prefetchChunks = Math.max(1, Math.floor(parseNumber(takeValue(arg), arg))); break;
      case '--max-attempts':
        options.maxAttempts = Math.max(1, Math.floor(parseNumber(takeValue(arg), arg))); break;
      case '--poll-timeout-seconds':
        options.pollTimeoutSeconds = Math.max(1, Math.floor(parseNumber(takeValue(arg), arg))); break;
      case '--spool-dir':
        options.spoolDir = takeValue(arg); break;
      case '--instrument':
        options.instrument = true; break;
      default:
        usageAndExit(`Unknown option: ${arg}`);
    }
  }

  return { sessionId, privateKeyJwk, outputDir, options };
}

// ── Small helpers ──────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Decode standard base64 (not base64url) to Uint8Array. Used for the AES-GCM IV.
function toBase64Bytes(input) {
  return Uint8Array.from(Buffer.from(input, 'base64'));
}

// Emit instrumentation NDJSON lines when --instrument or env flag is set.
// Includes process memory so we can confirm we're not leaking provider JSON.
function logInstrumentation(stage, enabled, extra = {}) {
  if (!enabled) return;
  const m = process.memoryUsage();
  console.log(JSON.stringify({
    status: 'instrument',
    stage,
    rssMB: +(m.rss / 1024 / 1024).toFixed(2),
    heapUsedMB: +(m.heapUsed / 1024 / 1024).toFixed(2),
    externalMB: +(m.external / 1024 / 1024).toFixed(2),
    ...extra,
  }));
}

// Retry GETs with exponential backoff. We only retry on network errors,
// 5xx, and 429 (rate-limit). 4xx other than 429 fail fast.
async function fetchWithRetry(url, retries = 5) {
  let delay = 500;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < retries) await sleep(delay);
    delay = Math.min(4000, delay * 2);
  }
  throw lastErr instanceof Error ? lastErr : new Error('Fetch failed');
}

// ── Poll loop ──────────────────────────────────────────────────────────────

/**
 * Long-poll /api/poll/<sid> until the backend says { ready: true } or we hit
 * --max-attempts. Each poll request itself blocks up to
 * --poll-timeout-seconds on the server, so the polling rate is gentle.
 *
 * Returns the final poll payload, which contains `providers[]` metadata.
 */
async function pollUntilReady(sessionId, options) {
  console.log(JSON.stringify({ status: 'polling', sessionId }));
  let attempts = 0;

  while (attempts < options.maxAttempts) {
    attempts++;
    const url = `${BASE_URL}/api/poll/${sessionId}?timeout=${options.pollTimeoutSeconds}`;
    try {
      const res = await fetchWithRetry(url, 4);
      if (!res.ok) {
        console.log(JSON.stringify({ status: 'error', error: `Poll failed: ${res.status}` }));
        process.exit(1);
      }
      const body = await res.json();
      if (body.ready) {
        console.log(JSON.stringify({ status: 'ready', providerCount: body.providerCount || 0, attempts }));
        return body;
      }
      // Throttle "waiting" lines so we don't spam stdout once per second.
      if (attempts % 5 === 1) {
        console.log(JSON.stringify({
          status: 'waiting',
          sessionStatus: body.status,
          providerCount: body.providerCount || 0,
          attempt: attempts,
        }));
      }
    } catch (err) {
      if (attempts % 3 === 1) {
        console.log(JSON.stringify({
          status: 'waiting',
          sessionStatus: 'retrying',
          error: err instanceof Error ? err.message : String(err),
          attempt: attempts,
        }));
      }
      await sleep(500);
    }
  }

  console.log(JSON.stringify({ status: 'timeout', message: 'Session not finalized within time limit' }));
  process.exit(1);
}

// ── File I/O helpers ───────────────────────────────────────────────────────

// Pipe a Web ReadableStream<Uint8Array> to a file. Returns total bytes written.
// Avoids buffering the whole stream in memory.
async function writeStreamToFile(stream, filePath) {
  const fh = await open(filePath, 'w');
  const reader = stream.getReader();
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      // Loop on partial writes — fh.write can write fewer bytes than asked.
      let written = 0;
      while (written < value.byteLength) {
        const r = await fh.write(value, written, value.byteLength - written);
        written += r.bytesWritten;
      }
    }
  } finally {
    await fh.close();
  }
  return total;
}

// Write a Uint8Array atomically (no partial-write looping needed for typed arrays
// in current Node, but we play it safe).
async function writeBytesToFile(bytes, filePath) {
  const fh = await open(filePath, 'w');
  try {
    let written = 0;
    while (written < bytes.byteLength) {
      const r = await fh.write(bytes, written, bytes.byteLength - written);
      written += r.bytesWritten;
    }
  } finally {
    await fh.close();
  }
  return bytes.byteLength;
}

// Read an entire file into a Uint8Array. Used for re-reading a downloaded
// chunk from spool before we decrypt it. Files here are bounded (~1MB) so
// reading all at once is fine.
async function readFileToUint8Array(filePath) {
  const fh = await open(filePath, 'r');
  try {
    const stats = await fh.stat();
    const total = Number(stats.size);
    const buf = new Uint8Array(total);
    let offset = 0;
    while (offset < buf.byteLength) {
      const r = await fh.read(buf, offset, buf.byteLength - offset, offset);
      if (!r.bytesRead) break;
      offset += r.bytesRead;
    }
    return offset === buf.byteLength ? buf : buf.subarray(0, offset);
  } finally {
    await fh.close();
  }
}

// ── Crypto ─────────────────────────────────────────────────────────────────

/**
 * Decrypt one chunk of a provider's encrypted payload.
 *
 * For each chunk the backend uses a fresh ECDH ephemeral keypair. We:
 *   1. Import its ephemeral public key.
 *   2. Derive a 256-bit shared secret with our long-lived private key.
 *   3. Use that secret directly as the AES-256 key (no HKDF — that's the
 *      protocol spec, intentionally simple; security comes from the
 *      ephemeral keypair + per-chunk IV).
 *   4. AES-GCM decrypt the ciphertext with the chunk's IV.
 *
 * Forward secrecy: even if our private key leaks later, an attacker who
 * captured ciphertext can't decrypt it without the backend's ephemeral
 * private keys, which the backend discarded after sending.
 */
async function decryptChunk(privateKey, ciphertext, chunkMeta) {
  const ephemeralPub = await crypto.subtle.importKey(
    'jwk',
    chunkMeta.ephemeralPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPub },
    privateKey,
    256
  );
  const aesKey = await crypto.subtle.importKey(
    'raw', sharedSecret, { name: 'AES-GCM' }, false, ['decrypt']
  );
  const iv = toBase64Bytes(chunkMeta.iv);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, aesKey, ciphertext
  );
  return new Uint8Array(plaintext);
}

// ── Chunk download ─────────────────────────────────────────────────────────

// Stream a single encrypted chunk to disk. We don't decrypt until consumption
// time, so memory stays bounded by prefetch-chunks * chunk-size, not total.
async function downloadChunkToFile(sessionId, providerIndex, chunkIndex, chunkPath) {
  const url = `${BASE_URL}/api/chunks/${sessionId}/${providerIndex}/${chunkIndex}`;
  const res = await fetchWithRetry(url, 5);
  if (!res.ok) throw new Error(`Failed to fetch chunk ${chunkIndex}: HTTP ${res.status}`);
  if (res.body) {
    // Modern fetch gives us a ReadableStream — stream it straight to disk.
    await writeStreamToFile(res.body, chunkPath);
    return;
  }
  // Fallback for environments without streamed bodies.
  await writeBytesToFile(new Uint8Array(await res.arrayBuffer()), chunkPath);
}

// ── Per-provider pipeline ──────────────────────────────────────────────────

/**
 * Download → decrypt → gunzip → write one provider's JSON to disk.
 *
 * Concurrency model:
 *   - Up to `prefetchChunks` downloads are in-flight at any moment.
 *   - The decrypted stream pulls chunks in order; as soon as chunk N's
 *     download finishes, we decrypt it and emit its plaintext bytes,
 *     deleting the encrypted spool file immediately.
 *   - DecompressionStream concatenates plaintext chunks into one gzip
 *     stream and we write the inflated JSON to disk.
 *
 * Returns { tempPath, bytesWritten, chunkCount, elapsedMs }.
 */
async function decryptV3ProviderToFile(sessionId, privateKey, providerMeta, outputPath, options) {
  const providerIndex = providerMeta.providerIndex;
  // Chunks may arrive in any order in the metadata array; sort by .index so
  // we concat them in the right order before gunzip.
  const sortedChunks = [...(providerMeta.chunks || [])].sort((a, b) => a.index - b.index);
  const chunkDir = join(options.spoolDir, `provider-${providerIndex}-chunks`);
  mkdirSync(chunkDir, { recursive: true });

  let scheduleCursor = 0;          // next chunk index to start downloading
  let consumeCursor = 0;           // next chunk index to feed into decrypt
  let downloaded = 0;
  const inFlight = new Map();      // chunkIndex -> Promise<localPath>

  // Top up the in-flight download queue. Called both at startup and after
  // each chunk is consumed (so we maintain steady pipeline depth).
  const schedule = () => {
    while (scheduleCursor < sortedChunks.length && inFlight.size < options.prefetchChunks) {
      const meta = sortedChunks[scheduleCursor++];
      const chunkPath = join(chunkDir, `chunk-${meta.index}.bin`);
      const task = (async () => {
        await downloadChunkToFile(sessionId, providerIndex, meta.index, chunkPath);
        downloaded++;
        if (options.instrument && downloaded % 10 === 0) {
          logInstrumentation('download_progress', true, {
            providerIndex,
            downloadedChunks: downloaded,
            totalChunks: sortedChunks.length,
          });
        }
        return chunkPath;
      })();
      inFlight.set(meta.index, task);
    }
  };

  schedule();
  const t0 = performance.now();

  // Build a ReadableStream of *decrypted* plaintext bytes. The DecompressionStream
  // downstream will inflate these from gzip.
  const decryptedStream = new ReadableStream({
    async pull(controller) {
      if (consumeCursor >= sortedChunks.length) { controller.close(); return; }
      schedule(); // keep the download pipeline full while we work

      const nextMeta = sortedChunks[consumeCursor];
      const pending = inFlight.get(nextMeta.index);
      if (!pending) throw new Error(`Missing in-flight chunk ${nextMeta.index}`);
      inFlight.delete(nextMeta.index);

      const chunkPath = await pending;
      const ciphertext = await readFileToUint8Array(chunkPath);
      // Delete the encrypted file as soon as we've loaded it — no point
      // keeping PHI ciphertext on disk for longer than necessary.
      await rm(chunkPath, { force: true });
      const plaintext = await decryptChunk(privateKey, ciphertext, nextMeta);
      controller.enqueue(plaintext);
      consumeCursor++;

      if (options.instrument && consumeCursor % 10 === 0) {
        logInstrumentation('chunk_progress', true, {
          providerIndex,
          processedChunks: consumeCursor,
          totalChunks: sortedChunks.length,
          inFlight: inFlight.size,
        });
      }
      schedule();
    }
  });

  try {
    const gunzipped = decryptedStream.pipeThrough(new DecompressionStream('gzip'));
    const bytesWritten = await writeStreamToFile(gunzipped, outputPath);
    return {
      tempPath: outputPath,
      bytesWritten,
      chunkCount: sortedChunks.length,
      elapsedMs: performance.now() - t0,
    };
  } finally {
    // Always clean up our chunk directory, even on partial failure.
    await rm(chunkDir, { recursive: true, force: true });
  }
}

// ── Filename derivation ────────────────────────────────────────────────────

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Peek at the first 1MB of a decrypted provider file to extract its `name`
// field (top-level JSON property set by the backend). We avoid JSON.parse on
// the whole file — providers can be 100MB+.
async function extractProviderName(filePath) {
  const maxBytes = 1024 * 1024;
  const fh = await open(filePath, 'r');
  const head = new Uint8Array(maxBytes);
  const { bytesRead } = await fh.read(head, 0, maxBytes, 0);
  await fh.close();
  if (!bytesRead) return null;
  const text = new TextDecoder().decode(head.subarray(0, bytesRead));
  // Match the first top-level "name": "..." in the JSON. The regex tolerates
  // escaped quotes inside the string.
  const m = text.match(/"name"\s*:\s*"((?:\\.|[^"\\])+)"/);
  if (!m) return null;
  try { return JSON.parse(`"${m[1]}"`); }
  catch { return m[1]; }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { sessionId, privateKeyJwk, outputDir, options } = parseCli(process.argv);

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(options.spoolDir, { recursive: true });

  const meta = await pollUntilReady(sessionId, options);
  logInstrumentation('poll_ready', options.instrument, { providerCount: meta.providerCount || 0 });

  // Re-import our private key for ECDH derivation. Using keyUsages=['deriveBits']
  // matches what we'll do in decryptChunk.
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );

  console.log(JSON.stringify({
    status: 'decrypting',
    providerCount: meta.providers?.length || 0,
    prefetchChunks: options.prefetchChunks,
  }));

  const files = [];
  // Multiple providers may share the same display name (e.g., two Epic-based
  // health systems both surfacing as "Epic"). Track collisions to suffix
  // later ones with -2, -3, etc.
  const usedNames = new Map();
  const activeStart = performance.now();

  for (const providerMeta of meta.providers || []) {
    const providerIndex = providerMeta.providerIndex ?? files.length;
    // Write to a .tmp first; rename to the real path only on success so we
    // never leave a half-decrypted file at the canonical name.
    const tempPath = join(options.spoolDir, `provider-${providerIndex}.json.tmp`);
    logInstrumentation('provider_start', options.instrument, { providerIndex });

    const result = await decryptV3ProviderToFile(
      sessionId, privateKey, providerMeta, tempPath, options
    );

    const providerName =
      (await extractProviderName(result.tempPath)) || `provider-${providerIndex + 1}`;
    const baseSlug = slugify(providerName) || `provider-${providerIndex + 1}`;
    const count = usedNames.get(baseSlug) || 0;
    usedNames.set(baseSlug, count + 1);
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    const finalPath = join(outputDir, `${slug}.json`);

    renameSync(result.tempPath, finalPath);
    files.push(finalPath);

    console.log(JSON.stringify({
      status: 'wrote_file',
      file: finalPath,
      provider: providerName,
      bytes: result.bytesWritten,
      chunks: result.chunkCount,
      elapsedMs: +result.elapsedMs.toFixed(1),
    }));
    logInstrumentation('provider_done', options.instrument, {
      providerIndex, bytes: result.bytesWritten, chunks: result.chunkCount,
    });
  }

  // Spool dir should be empty by now (all chunks deleted, tempfiles renamed),
  // but rm -rf as a belt-and-braces cleanup.
  await rm(options.spoolDir, { recursive: true, force: true });

  console.log(JSON.stringify({
    status: 'done',
    files,
    elapsedMs: +(performance.now() - activeStart).toFixed(1),
  }));
  logInstrumentation('done', options.instrument, {
    totalFiles: files.length,
    totalElapsedMs: +(performance.now() - activeStart).toFixed(1),
  });
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
