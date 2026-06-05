#!/usr/bin/env bun
// Finalize a health record session: poll until ready, decrypt, and write provider files.
// v3 payloads use a disk-queue strategy with bounded concurrent chunk downloads.
//
// Usage:
// bun scripts/finalize-session.ts <sessionId> '<privateKeyJwk>' <outputDir> [options]
//
// Options:
// --prefetch-chunks <n>      Number of encrypted chunks to keep downloading ahead (default: 8)
// --max-attempts <n>         Poll attempts before timeout (default: 60)
// --poll-timeout-seconds <n> Long-poll timeout per poll request (default: 30)
// --spool-dir <path>         Temporary directory for chunk/file staging (default: <outputDir>/.spool)
// --instrument               Enable optional profiling/instrumentation logs
//
// Environment:
// FINALIZE_INSTRUMENT=1      Enable instrumentation without --instrument

import { mkdirSync, renameSync } from 'fs';
import { open, rm } from 'fs/promises';
import { join } from 'path';

const BASE_URL = '{{BASE_URL}}';

const DEFAULT_PREFETCH_CHUNKS = 8;
const DEFAULT_MAX_ATTEMPTS = 60;
const DEFAULT_POLL_TIMEOUT_SECONDS = 30;

type JsonObject = Record<string, unknown>;

interface CliOptions {
  prefetchChunks: number;
  maxAttempts: number;
  pollTimeoutSeconds: number;
  spoolDir: string;
  instrument: boolean;
}

interface ProviderWriteResult {
  tempPath: string;
  bytesWritten: number;
  chunkCount: number;
  elapsedMs: number;
}

function usageAndExit(message?: string): never {
  if (message) console.error(message);
  console.error(
    'Usage: bun scripts/finalize-session.ts <sessionId> <privateKeyJwk> <outputDir> [--prefetch-chunks N] [--max-attempts N] [--poll-timeout-seconds N] [--spool-dir PATH] [--instrument]'
  );
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseNumber(raw: string, flag: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) usageAndExit(`Invalid value for ${flag}: ${raw}`);
  return value;
}

function parseBoolEnv(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseCli(argv: string[]): {
  sessionId: string;
  privateKeyJwk: JsonObject;
  outputDir: string;
  options: CliOptions;
} {
  const sessionId = argv[2];
  const privateKeyJwkStr = argv[3];
  const outputDir = argv[4];

  if (!sessionId || !privateKeyJwkStr || !outputDir) usageAndExit();

  let privateKeyJwk: JsonObject;
  try {
    privateKeyJwk = JSON.parse(privateKeyJwkStr) as JsonObject;
  } catch {
    usageAndExit('privateKeyJwk must be valid JSON.');
  }

  const options: CliOptions = {
    prefetchChunks: DEFAULT_PREFETCH_CHUNKS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    pollTimeoutSeconds: DEFAULT_POLL_TIMEOUT_SECONDS,
    spoolDir: join(outputDir, '.spool'),
    instrument: parseBoolEnv(process.env.FINALIZE_INSTRUMENT)
  };

  const extraArgs = argv.slice(5);
  for (let i = 0; i < extraArgs.length; i++) {
    const arg = extraArgs[i];
    const takeValue = (flag: string): string => {
      const value = extraArgs[i + 1];
      if (!value || value.startsWith('--')) usageAndExit(`Missing value for ${flag}`);
      i++;
      return value;
    };

    switch (arg) {
      case '--prefetch-chunks':
        options.prefetchChunks = Math.max(1, Math.floor(parseNumber(takeValue(arg), arg)));
        break;
      case '--max-attempts':
        options.maxAttempts = Math.max(1, Math.floor(parseNumber(takeValue(arg), arg)));
        break;
      case '--poll-timeout-seconds':
        options.pollTimeoutSeconds = Math.max(1, Math.floor(parseNumber(takeValue(arg), arg)));
        break;
      case '--spool-dir':
        options.spoolDir = takeValue(arg);
        break;
      case '--instrument':
        options.instrument = true;
        break;
      default:
        usageAndExit(`Unknown option: ${arg}`);
    }
  }

  return { sessionId, privateKeyJwk, outputDir, options };
}

function toBase64Bytes(input: string): Uint8Array {
  return Uint8Array.from(atob(input), c => c.charCodeAt(0));
}

function logInstrumentation(stage: string, enabled: boolean, extra: JsonObject = {}): void {
  if (!enabled) return;
  const mem = process.memoryUsage();
  console.log(
    JSON.stringify({
      status: 'instrument',
      stage,
      rssMB: Number((mem.rss / 1024 / 1024).toFixed(2)),
      heapUsedMB: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      externalMB: Number((mem.external / 1024 / 1024).toFixed(2)),
      ...extra
    })
  );
}

async function fetchJsonWithRetry(url: string, retries = 5): Promise<Response> {
  let delayMs = 500;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < retries) await sleep(delayMs);
    delayMs = Math.min(4000, delayMs * 2);
  }
  throw lastErr instanceof Error ? lastErr : new Error('Fetch failed');
}

async function pollUntilReady(sessionId: string, options: CliOptions): Promise<any> {
  console.log(JSON.stringify({ status: 'polling', sessionId }));
  let attempts = 0;

  while (attempts < options.maxAttempts) {
    attempts++;
    const pollUrl = `${BASE_URL}/api/poll/${sessionId}?timeout=${options.pollTimeoutSeconds}`;
    try {
      const pollRes = await fetchJsonWithRetry(pollUrl, 4);
      if (!pollRes.ok) {
        console.log(JSON.stringify({ status: 'error', error: `Poll failed: ${pollRes.status}` }));
        process.exit(1);
      }

      const pollResult = (await pollRes.json()) as any;
      if (pollResult.ready) {
        console.log(
          JSON.stringify({ status: 'ready', providerCount: pollResult.providerCount || 0, attempts })
        );
        return pollResult;
      }

      if (attempts % 5 === 1) {
        console.log(
          JSON.stringify({
            status: 'waiting',
            sessionStatus: pollResult.status,
            providerCount: pollResult.providerCount || 0,
            attempt: attempts
          })
        );
      }
    } catch (err) {
      if (attempts % 3 === 1) {
        console.log(
          JSON.stringify({
            status: 'waiting',
            sessionStatus: 'retrying',
            error: err instanceof Error ? err.message : String(err),
            attempt: attempts
          })
        );
      }
      await sleep(500);
    }
  }

  console.log(JSON.stringify({ status: 'timeout', message: 'Session not finalized within time limit' }));
  process.exit(1);
}

async function writeStreamToFile(stream: ReadableStream<Uint8Array>, filePath: string): Promise<number> {
  const fh = await open(filePath, 'w');
  const reader = stream.getReader();
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      let written = 0;
      while (written < value.byteLength) {
        const result = await fh.write(value, written, value.byteLength - written);
        written += result.bytesWritten;
      }
    }
  } finally {
    await fh.close();
  }
  return total;
}

async function writeBytesToFile(bytes: Uint8Array, filePath: string): Promise<number> {
  const fh = await open(filePath, 'w');
  try {
    let written = 0;
    while (written < bytes.byteLength) {
      const result = await fh.write(bytes, written, bytes.byteLength - written);
      written += result.bytesWritten;
    }
  } finally {
    await fh.close();
  }
  return bytes.byteLength;
}

async function readFileToUint8Array(filePath: string): Promise<Uint8Array> {
  const fh = await open(filePath, 'r');
  try {
    const stats = await fh.stat();
    const totalSize = Number(stats.size);
    const out = new Uint8Array(totalSize);
    let offset = 0;
    while (offset < out.byteLength) {
      const result = await fh.read(out, offset, out.byteLength - offset, offset);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    return offset === out.byteLength ? out : out.subarray(0, offset);
  } finally {
    await fh.close();
  }
}

async function decryptChunk(
  privateKey: CryptoKey,
  ciphertext: Uint8Array,
  chunkMeta: any
): Promise<Uint8Array> {
  const ephemeralPublicKey = await crypto.subtle.importKey(
    'jwk',
    chunkMeta.ephemeralPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPublicKey },
    privateKey,
    256
  );

  const aesKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = toBase64Bytes(chunkMeta.iv);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
  return new Uint8Array(decrypted);
}

async function fetchChunkCiphertext(
  sessionId: string,
  providerIndex: number,
  chunkIndex: number
): Promise<Uint8Array> {
  const url = `${BASE_URL}/api/chunks/${sessionId}/${providerIndex}/${chunkIndex}`;
  const res = await fetchJsonWithRetry(url, 5);
  if (!res.ok) throw new Error(`Failed to fetch chunk ${chunkIndex}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function downloadChunkToFile(
  sessionId: string,
  providerIndex: number,
  chunkIndex: number,
  chunkPath: string
): Promise<void> {
  const url = `${BASE_URL}/api/chunks/${sessionId}/${providerIndex}/${chunkIndex}`;
  const res = await fetchJsonWithRetry(url, 5);
  if (!res.ok) throw new Error(`Failed to fetch chunk ${chunkIndex}: HTTP ${res.status}`);
  if (res.body) {
    await writeStreamToFile(res.body as ReadableStream<Uint8Array>, chunkPath);
    return;
  }
  await writeBytesToFile(new Uint8Array(await res.arrayBuffer()), chunkPath);
}

async function decryptV3ProviderToFile(
  sessionId: string,
  privateKey: CryptoKey,
  providerMeta: any,
  outputPath: string,
  options: CliOptions
): Promise<ProviderWriteResult> {
  const providerIndex = providerMeta.providerIndex;
  const sortedChunks = [...(providerMeta.chunks || [])].sort((a: any, b: any) => a.index - b.index);
  const chunkDir = join(options.spoolDir, `provider-${providerIndex}-chunks`);
  mkdirSync(chunkDir, { recursive: true });

  let scheduleCursor = 0;
  let consumeCursor = 0;
  let downloaded = 0;
  const inFlight = new Map<number, Promise<string>>();

  const schedule = () => {
    while (scheduleCursor < sortedChunks.length && inFlight.size < options.prefetchChunks) {
      const chunkMeta = sortedChunks[scheduleCursor++];
      const chunkPath = join(chunkDir, `chunk-${chunkMeta.index}.bin`);
      const task = (async () => {
        await downloadChunkToFile(sessionId, providerIndex, chunkMeta.index, chunkPath);
        downloaded++;
        if (options.instrument && downloaded % 10 === 0) {
          logInstrumentation('download_progress', true, {
            providerIndex,
            downloadedChunks: downloaded,
            totalChunks: sortedChunks.length
          });
        }
        return chunkPath;
      })();
      inFlight.set(chunkMeta.index, task);
    }
  };

  schedule();
  const t0 = performance.now();

  const decryptedStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (consumeCursor >= sortedChunks.length) {
        controller.close();
        return;
      }
      schedule();

      const nextMeta = sortedChunks[consumeCursor];
      const pending = inFlight.get(nextMeta.index);
      if (!pending) throw new Error(`Missing in-flight chunk file ${nextMeta.index}`);
      inFlight.delete(nextMeta.index);

      const chunkPath = await pending;
      const ciphertext = await readFileToUint8Array(chunkPath);
      await rm(chunkPath, { force: true });
      const decrypted = await decryptChunk(privateKey, ciphertext, nextMeta);
      controller.enqueue(decrypted);
      consumeCursor++;

      if (options.instrument && consumeCursor % 10 === 0) {
        logInstrumentation('chunk_progress', true, {
          providerIndex,
          processedChunks: consumeCursor,
          totalChunks: sortedChunks.length,
          inFlight: inFlight.size
        });
      }

      schedule();
    }
  });

  try {
    const decompressedStream = decryptedStream.pipeThrough(new DecompressionStream('gzip'));
    const bytesWritten = await writeStreamToFile(decompressedStream, outputPath);
    const elapsedMs = performance.now() - t0;
    return { tempPath: outputPath, bytesWritten, chunkCount: sortedChunks.length, elapsedMs };
  } finally {
    await rm(chunkDir, { recursive: true, force: true });
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function extractProviderName(filePath: string): Promise<string | null> {
  const maxBytes = 1024 * 1024;
  const fh = await open(filePath, 'r');
  const head = new Uint8Array(maxBytes);
  const { bytesRead } = await fh.read(head, 0, maxBytes, 0);
  await fh.close();

  if (!bytesRead) return null;
  const clipped = head.subarray(0, bytesRead);
  const text = new TextDecoder().decode(clipped);
  const match = text.match(/"name"\s*:\s*"((?:\\.|[^"\\])+)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

const { sessionId, privateKeyJwk, outputDir, options } = parseCli(process.argv);

mkdirSync(outputDir, { recursive: true });
mkdirSync(options.spoolDir, { recursive: true });

const meta = await pollUntilReady(sessionId, options);
logInstrumentation('poll_ready', options.instrument, { providerCount: meta.providerCount || 0 });

const privateKey = await crypto.subtle.importKey(
  'jwk',
  privateKeyJwk,
  { name: 'ECDH', namedCurve: 'P-256' },
  false,
  ['deriveBits']
);

console.log(
  JSON.stringify({
    status: 'decrypting',
    providerCount: meta.providers?.length || 0,
    prefetchChunks: options.prefetchChunks
  })
);

const files: string[] = [];
const usedNames = new Map<string, number>();
const activeStart = performance.now();

for (const providerMeta of meta.providers || []) {
  const providerIndex = providerMeta.providerIndex ?? files.length;
  const tempPath = join(options.spoolDir, `provider-${providerIndex}.json.tmp`);
  logInstrumentation('provider_start', options.instrument, { providerIndex });

  const writeResult =
    await decryptV3ProviderToFile(sessionId, privateKey, providerMeta, tempPath, options);

  const providerName =
    (await extractProviderName(writeResult.tempPath)) || `provider-${providerIndex + 1}`;
  const baseSlug = slugify(providerName) || `provider-${providerIndex + 1}`;
  const count = usedNames.get(baseSlug) || 0;
  usedNames.set(baseSlug, count + 1);
  const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
  const finalPath = join(outputDir, `${slug}.json`);

  renameSync(writeResult.tempPath, finalPath);
  files.push(finalPath);

  console.log(
    JSON.stringify({
      status: 'wrote_file',
      file: finalPath,
      provider: providerName,
      bytes: writeResult.bytesWritten,
      chunks: writeResult.chunkCount,
      elapsedMs: Number(writeResult.elapsedMs.toFixed(1))
    })
  );
  logInstrumentation('provider_done', options.instrument, {
    providerIndex,
    bytes: writeResult.bytesWritten,
    chunks: writeResult.chunkCount
  });
}

await rm(options.spoolDir, { recursive: true, force: true });

console.log(
  JSON.stringify({
    status: 'done',
    files,
    elapsedMs: Number((performance.now() - activeStart).toFixed(1))
  })
);
logInstrumentation('done', options.instrument, {
  totalFiles: files.length,
  totalElapsedMs: Number((performance.now() - activeStart).toFixed(1))
});
