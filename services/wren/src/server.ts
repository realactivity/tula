import { Database } from "bun:sqlite";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve, relative } from "path";

// Import HTML for Bun's fullstack server - serves the React SPA
import homepage from "./index.html";

// Import skill builder
import { buildAgentSkill, buildLocalSkill } from "../skill/build-skill";

// Load config
const configPath = process.env.CONFIG_PATH || "./config.json";
const config = JSON.parse(readFileSync(configPath, "utf-8"));

if (process.env.BASE_URL) {
  config.server.baseURL = process.env.BASE_URL;
}

const baseURL = config.server.baseURL.replace(/\/$/, "");
const port = Number(process.env.PORT) || config.server.port || 8000;
const isProduction = process.env.NODE_ENV === "production";
const ENABLE_TEST_PROVIDER =
  process.env.ENABLE_TEST_PROVIDER === "true" ||
  process.env.ENABLE_TEST_PROVIDER === "1" ||
  !isProduction;
const ENABLE_RANDOM_BIN_ENDPOINT =
  process.env.ENABLE_RANDOM_BIN_ENDPOINT === "true" ||
  process.env.ENABLE_RANDOM_BIN_ENDPOINT === "1";
const TEST_PROVIDER_SIZES_MB = [1, 10, 50, 100] as const;
const TEST_PROVIDER_SIZE_SET = new Set<number>(TEST_PROVIDER_SIZES_MB);
const RANDOM_BIN_MAX_MB = 100;
const STATIC_BRANDS_ROOT = resolve("./static/brands");
const UPLOAD_CHUNK_SIZE_BYTES =
  Number.isFinite(Number(process.env.UPLOAD_CHUNK_SIZE_BYTES)) &&
  Number(process.env.UPLOAD_CHUNK_SIZE_BYTES) > 0
    ? Math.floor(Number(process.env.UPLOAD_CHUNK_SIZE_BYTES))
    : 5 * 1024 * 1024;
const MAX_CIPHERTEXT_BASE64_LENGTH = Math.ceil((UPLOAD_CHUNK_SIZE_BYTES * 2) / 3) * 4;
const MAX_REQUEST_BODY_SIZE = Math.max(16 * 1024 * 1024, MAX_CIPHERTEXT_BASE64_LENGTH + 512 * 1024);
const allowedCorsOrigin = new URL(baseURL).origin;
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self'${isProduction ? "" : " 'unsafe-eval' 'unsafe-inline'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https: http:${isProduction ? "" : " ws: wss:"}`,
].join("; ");
const securityHeaders = {
  "Content-Security-Policy": contentSecurityPolicy,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function withSecurityHeaders(headers: HeadersInit = {}): Headers {
  const merged = new Headers(headers);
  for (const [key, value] of Object.entries(securityHeaders)) {
    if (!merged.has(key)) merged.set(key, value);
  }
  return merged;
}

// Initialize SQLite database
const db = new Database("./data/wren.db", { create: true });
db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at INTEGER DEFAULT (unixepoch()),
    providers TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    public_key TEXT,
    encrypted_data TEXT,
    finalize_token TEXT
  )
`);

// Migrations
const migrations = [
  "ALTER TABLE sessions ADD COLUMN providers TEXT DEFAULT '[]'",
  "ALTER TABLE sessions ADD COLUMN public_key TEXT",
  "ALTER TABLE sessions ADD COLUMN encrypted_data TEXT",
  "ALTER TABLE sessions ADD COLUMN finalize_token TEXT",
  "ALTER TABLE sessions ADD COLUMN simulate_error TEXT",
  "ALTER TABLE sessions ADD COLUMN attempt_meta TEXT",
];
for (const sql of migrations) {
  try { db.run(sql); } catch (e) { /* Column already exists */ }
}

// Cleanup expired sessions (every 5 min)
const timeoutMs = (config.session?.timeoutMinutes || 60) * 60 * 1000;
setInterval(() => {
  const cutoff = Math.floor((Date.now() - timeoutMs) / 1000);
  db.run("DELETE FROM sessions WHERE created_at < ?", [cutoff]);
}, 5 * 60 * 1000);

// Vacuum hourly to reclaim space
setInterval(() => {
  db.run("VACUUM");
}, 60 * 60 * 1000);

// Generate session ID
function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

type AttemptMeta = {
  attemptId: string;
  selectedProviderKeys: string[];
  status: "active" | "finalized";
  createdAt: string;
};

function parseAttemptMeta(raw: string | null | undefined): AttemptMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.attemptId !== "string") return null;
    if (!Array.isArray(parsed.selectedProviderKeys)) return null;
    if (parsed.status !== "active" && parsed.status !== "finalized") return null;
    return {
      attemptId: parsed.attemptId,
      selectedProviderKeys: parsed.selectedProviderKeys.filter((x: unknown): x is string => typeof x === "string"),
      status: parsed.status,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// Build skill zip (agent version with scripts)
async function buildSkillZip(): Promise<Response> {
  const scriptsDir = "./skill/health-record-assistant/scripts";
  const refsDir = "./skill/health-record-assistant/references";

  const { $ } = await import("bun");
  const tempDir = `/tmp/skill-build-${Date.now()}`;

  try {
    await $`mkdir -p ${tempDir}/health-record-assistant/references ${tempDir}/health-record-assistant/scripts`;

    // Build SKILL.md from partials
    const skillMd = buildAgentSkill(baseURL);
    await Bun.write(`${tempDir}/health-record-assistant/SKILL.md`, skillMd);

    // Copy references
    if (existsSync(refsDir)) {
      for (const file of readdirSync(refsDir)) {
        let content = readFileSync(join(refsDir, file), "utf-8");
        content = content.replaceAll("{{BASE_URL}}", baseURL);
        await Bun.write(`${tempDir}/health-record-assistant/references/${file}`, content);
      }
    }

    // Copy scripts (agent-only)
    if (existsSync(scriptsDir)) {
      for (const file of readdirSync(scriptsDir)) {
        let content = readFileSync(join(scriptsDir, file), "utf-8");
        content = content.replaceAll("{{BASE_URL}}", baseURL);
        await Bun.write(`${tempDir}/health-record-assistant/scripts/${file}`, content);
      }
    }

    await $`cd ${tempDir} && zip -r skill.zip health-record-assistant/`;
    const zipData = await Bun.file(`${tempDir}/skill.zip`).arrayBuffer();
    await $`rm -rf ${tempDir}`;

    return new Response(zipData, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=health-record-assistant.zip",
      },
    });
  } catch (e) {
    console.error("Error building skill zip:", e);
    await $`rm -rf ${tempDir}`.catch(() => {});
    return new Response("Failed to build skill", { status: 500 });
  }
}

// CORS headers
const corsHeaders = {
  ...securityHeaders,
  "Access-Control-Allow-Origin": allowedCorsOrigin,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
};

// Build vendor configs from config.brands
function getVendors() {
  const vendors: Record<string, any> = {};
  for (const brand of config.brands || []) {
    // Use brand name as vendor key to keep sandbox/prod separate
    const vendorName = brand.name;
    const brandFile = brand.file?.replace('./brands/', '/static/brands/') || `/static/brands/${brand.name}.json`;
    
    vendors[vendorName] = {
      clientId: brand.clientId,
      scopes: brand.scopes || 'patient/*.rs',
      brandFiles: [brandFile],
      tags: brand.tags || [],
      redirectUrl: brand.redirectURL || `${baseURL}/connect/callback`,
    };
  }

  if (ENABLE_TEST_PROVIDER) {
    for (const size of TEST_PROVIDER_SIZES_MB) {
      vendors[`__test_${size}mb__`] = {
        clientId: 'test',
        scopes: 'patient/*.rs',
        brandFiles: [`/test/${size}mb/brand.json`],
        tags: ['test'],
        redirectUrl: `${baseURL}/connect/callback`,
        testProvider: true,
        testSizeMB: size,
      };
    }
  }

  return vendors;
}

// Main server with Bun routes
const server = Bun.serve({
  port,
  development: process.env.NODE_ENV !== 'production',
  maxRequestBodySize: MAX_REQUEST_BODY_SIZE,

  routes: {
    // SPA routes - all handled by React Router
    "/": homepage,
    // Records hub
    "/records": homepage,
    "/records/": homepage,
    "/records/add": homepage,
    "/records/add/": homepage,
    "/records/callback": homepage,
    "/records/callback/": homepage,
    "/records/redaction": homepage,
    "/records/redaction/": homepage,
    "/records/browser": homepage,
    "/records/browser/": homepage,
    // AI session
    "/connect/:sessionId": homepage,
    // OAuth callback (shared)
    "/connect/callback": homepage,

  },

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const requestOrigin = req.headers.get("Origin");

    if (path.startsWith("/api/") && requestOrigin && requestOrigin !== allowedCorsOrigin) {
      return new Response("CORS origin not allowed", { status: 403 });
    }

    // CORS preflight
    if (req.method === "OPTIONS") {
      if (requestOrigin && requestOrigin !== allowedCorsOrigin) {
        return new Response("CORS origin not allowed", { status: 403 });
      }
      return new Response(null, { headers: corsHeaders });
    }

    // API: Create session
    if (path === "/api/session" && req.method === "POST") {
      let publicKey: string | null = null;
      let simulateError: string | null = null;
      try {
        const body = await req.json() as { publicKey?: any; simulateError?: string };
        if (body.publicKey) {
          publicKey = JSON.stringify(body.publicKey);
        }
        // Optional: simulate errors for testing (500, timeout, badresp, disconnect)
        if (body.simulateError && ['500', 'timeout', 'badresp', 'disconnect'].includes(body.simulateError)) {
          simulateError = body.simulateError;
        }
      } catch (e) {}

      if (!publicKey) {
        return Response.json({
          error: "public_key_required",
          error_description: "E2E encryption required. Provide publicKey (ECDH P-256 JWK)."
        }, { status: 400, headers: corsHeaders });
      }

      const sessionId = generateSessionId();
      db.run("INSERT INTO sessions (id, public_key, simulate_error) VALUES (?, ?, ?)", [sessionId, publicKey, simulateError]);
      console.log(`Created session: ${sessionId}${simulateError ? ` (simulating ${simulateError} error)` : ''}`);

      return Response.json({
        sessionId,
        userUrl: `${baseURL}/connect/${sessionId}`,
        pollUrl: `${baseURL}/api/poll/${sessionId}`,
      }, { headers: corsHeaders });
    }

    // API: Poll for data
    if (path.startsWith("/api/poll/") && req.method === "GET") {
      const sessionId = path.replace("/api/poll/", "");
      const timeout = Math.min(parseInt(url.searchParams.get("timeout") || "30"), 60) * 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const row = db.query("SELECT status, encrypted_data FROM sessions WHERE id = ?").get(sessionId) as any;
        if (!row) {
          return new Response("Session not found", { status: 404, headers: corsHeaders });
        }

        const encryptedData = row.encrypted_data ? JSON.parse(row.encrypted_data) : [];
        if (row.status === "finalized" && encryptedData.length > 0) {
          // Return metadata (IVs, keys) but not ciphertext - use /api/chunks for binary data
          const providers = encryptedData
            .filter((p: any) => p.version === 3 && Array.isArray(p.chunks))
            .map((p: any, i: number) => ({
              providerIndex: i,
              version: 3,
              totalChunks: p.chunks.length,
              chunks: p.chunks.map((c: any) => ({
                index: c.index,
                ephemeralPublicKey: c.ephemeralPublicKey,
                iv: c.iv,
              }))
            }));
          return Response.json({
            ready: true,
            providerCount: encryptedData.length,
            providers
          }, { headers: corsHeaders });
        }

        await new Promise(r => setTimeout(r, 500));
      }

      const row = db.query("SELECT status, encrypted_data FROM sessions WHERE id = ?").get(sessionId) as any;
      if (!row) return new Response("Session not found", { status: 404, headers: corsHeaders });
      const encryptedData = row.encrypted_data ? JSON.parse(row.encrypted_data) : [];

      return Response.json({
        ready: false,
        status: row.status,
        providerCount: encryptedData.length,
      }, { headers: corsHeaders });
    }

    // API: Binary chunks endpoint - efficient download without base64 overhead
    // GET /api/chunks/{sessionId}/meta - returns chunk metadata (small JSON)
    // GET /api/chunks/{sessionId}/{providerIndex}/{chunkIndex} - returns raw binary ciphertext
    if (path.startsWith("/api/chunks/") && req.method === "GET") {
      const parts = path.replace("/api/chunks/", "").split("/");
      const sessionId = parts[0];
      
      const row = db.query("SELECT status, encrypted_data FROM sessions WHERE id = ?").get(sessionId) as any;
      if (!row) return new Response("Session not found", { status: 404, headers: corsHeaders });
      if (row.status !== "finalized") return new Response("Session not finalized", { status: 400, headers: corsHeaders });
      
      const providers = row.encrypted_data ? JSON.parse(row.encrypted_data) : [];
      if (providers.length === 0) return new Response("No data", { status: 404, headers: corsHeaders });
      
      // GET /api/chunks/{sessionId}/meta
      if (parts[1] === "meta") {
        // Return metadata without ciphertext
        const meta = providers
          .filter((p: any) => p.version === 3 && Array.isArray(p.chunks))
          .map((p: any, i: number) => ({
            providerIndex: i,
            version: 3,
            totalChunks: p.chunks.length,
            chunks: p.chunks.map((c: any) => ({
              index: c.index,
              ephemeralPublicKey: c.ephemeralPublicKey,
              iv: c.iv,
            }))
          }));
        return Response.json({ providers: meta }, { headers: corsHeaders });
      }
      
      // GET /api/chunks/{sessionId}/{providerIndex}/{chunkIndex}
      const providerIndex = parseInt(parts[1]);
      const chunkIndex = parseInt(parts[2]);
      
      if (isNaN(providerIndex) || providerIndex >= providers.length) {
        return new Response("Invalid provider index", { status: 400, headers: corsHeaders });
      }
      
      const provider = providers[providerIndex];
      if (provider.version !== 3 || !provider.chunks) {
        return new Response("Provider is not chunked", { status: 400, headers: corsHeaders });
      }
      
      const chunk = provider.chunks.find((c: any) => c.index === chunkIndex);
      if (!chunk) {
        return new Response("Chunk not found", { status: 404, headers: corsHeaders });
      }
      
      // Return raw binary ciphertext (decode from base64)
      const ciphertext = Uint8Array.from(atob(chunk.ciphertext), c => c.charCodeAt(0));
      return new Response(ciphertext, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/octet-stream",
          "Content-Length": ciphertext.length.toString(),
        }
      });
    }

    // API: Start upload attempt (locks selected provider set for deterministic resume/finalize)
    if (path.startsWith("/api/upload/start/") && req.method === "POST") {
      const sessionId = path.replace("/api/upload/start/", "");
      let body: any = {};
      try { body = await req.json(); } catch (e) {}

      const row = db.query("SELECT status, finalize_token FROM sessions WHERE id = ?").get(sessionId) as any;
      if (!row) return new Response("Session not found", { status: 404, headers: corsHeaders });
      if (row.status === "finalized") {
        return Response.json({ success: false, error: "session_finalized" }, { status: 400, headers: corsHeaders });
      }
      if (!body.finalizeToken || typeof body.finalizeToken !== "string" || body.finalizeToken.length < 16) {
        return Response.json({ success: false, error: "missing_finalize_token" }, { status: 400, headers: corsHeaders });
      }
      if (!Array.isArray(body.selectedProviderKeys) || body.selectedProviderKeys.length === 0) {
        return Response.json({ success: false, error: "missing_selected_provider_keys" }, { status: 400, headers: corsHeaders });
      }
      const selectedProviderKeys = body.selectedProviderKeys
        .filter((x: unknown): x is string => typeof x === "string")
        .map((k: string) => k.trim())
        .filter(Boolean);
      if (selectedProviderKeys.length === 0) {
        return Response.json({ success: false, error: "invalid_selected_provider_keys" }, { status: 400, headers: corsHeaders });
      }

      if (row.finalize_token && row.finalize_token !== body.finalizeToken) {
        return Response.json({ success: false, error: "token_mismatch" }, { status: 403, headers: corsHeaders });
      }

      const attemptMeta: AttemptMeta = {
        attemptId: crypto.randomUUID(),
        selectedProviderKeys,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      db.run(
        "UPDATE sessions SET encrypted_data = '[]', status = 'pending', finalize_token = ?, attempt_meta = ? WHERE id = ?",
        [body.finalizeToken, JSON.stringify(attemptMeta), sessionId]
      );

      return Response.json({
        success: true,
        attemptMeta,
        pendingChunks: {},
      }, { headers: corsHeaders });
    }

    // API: Reset upload state for a session (discard partial chunks + attempt lock)
    if (path.startsWith("/api/upload/reset/") && req.method === "POST") {
      const sessionId = path.replace("/api/upload/reset/", "");
      let body: any = {};
      try { body = await req.json(); } catch (e) {}

      const row = db.query("SELECT status, finalize_token FROM sessions WHERE id = ?").get(sessionId) as any;
      if (!row) return new Response("Session not found", { status: 404, headers: corsHeaders });
      if (row.status === "finalized") {
        return Response.json({ success: false, error: "session_finalized" }, { status: 400, headers: corsHeaders });
      }
      if (!body.finalizeToken || typeof body.finalizeToken !== "string" || body.finalizeToken.length < 16) {
        return Response.json({ success: false, error: "missing_finalize_token" }, { status: 400, headers: corsHeaders });
      }
      if (row.finalize_token && row.finalize_token !== body.finalizeToken) {
        return Response.json({ success: false, error: "token_mismatch" }, { status: 403, headers: corsHeaders });
      }

      db.run(
        "UPDATE sessions SET encrypted_data = '[]', status = 'pending', attempt_meta = NULL, finalize_token = ? WHERE id = ?",
        [body.finalizeToken, sessionId]
      );
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // API: Receive encrypted EHR data (also sets finalizeToken on first call)
    if (path === "/api/receive-ehr" && req.method === "POST") {
      try {
        const data = await req.json() as any;
        
        // Validate common fields
        if (!data.sessionId) {
          return Response.json({ success: false, error: "missing_session_id" }, { status: 400, headers: corsHeaders });
        }
        if (!data.finalizeToken || typeof data.finalizeToken !== "string" || data.finalizeToken.length < 16) {
          return Response.json({ success: false, error: "missing_finalize_token" }, { status: 400, headers: corsHeaders });
        }
        
        // Only v3 (chunked) uploads are supported
        if (data.version !== 3) {
          return Response.json({ success: false, error: "unsupported_version", error_description: "Only version 3 (chunked) uploads are supported" }, { status: 400, headers: corsHeaders });
        }
        if (!data.chunk || typeof data.chunk !== "object") {
          return Response.json({ success: false, error: "missing_chunk_fields" }, { status: 400, headers: corsHeaders });
        }

        const chunkIndex = data.chunk.index;
        if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 1_000_000) {
          return Response.json({ success: false, error: "invalid_chunk_index" }, { status: 400, headers: corsHeaders });
        }
        if (!data.chunk.ephemeralPublicKey || typeof data.chunk.ephemeralPublicKey !== "object") {
          return Response.json({ success: false, error: "missing_chunk_ephemeral_public_key" }, { status: 400, headers: corsHeaders });
        }
        if (typeof data.chunk.iv !== "string" || typeof data.chunk.ciphertext !== "string") {
          return Response.json({ success: false, error: "missing_chunk_fields" }, { status: 400, headers: corsHeaders });
        }
        if (data.chunk.ciphertext.length === 0 || data.chunk.iv.length === 0) {
          return Response.json({ success: false, error: "missing_chunk_fields" }, { status: 400, headers: corsHeaders });
        }

        if (data.chunk.ciphertext.length > MAX_CIPHERTEXT_BASE64_LENGTH) {
          return Response.json(
            { success: false, error: "chunk_too_large", maxCiphertextBase64Chars: MAX_CIPHERTEXT_BASE64_LENGTH },
            { status: 400, headers: corsHeaders }
          );
        }
        if (data.chunk.iv.length > 64) {
          return Response.json({ success: false, error: "invalid_chunk_iv" }, { status: 400, headers: corsHeaders });
        }

        if (!data.attemptId || typeof data.attemptId !== "string") {
          return Response.json({ success: false, error: "missing_attempt_id" }, { status: 400, headers: corsHeaders });
        }
        // totalChunks: -1 means "unknown, more coming", positive means final count
        if (
          !Number.isInteger(data.totalChunks) ||
          data.totalChunks > 1_000_000 ||
          (data.totalChunks < 1 && data.totalChunks !== -1)
        ) {
          return Response.json({ success: false, error: "invalid_total_chunks" }, { status: 400, headers: corsHeaders });
        }
        if (data.totalChunks > 0 && chunkIndex >= data.totalChunks) {
          return Response.json({ success: false, error: "chunk_index_out_of_bounds" }, { status: 400, headers: corsHeaders });
        }

        const row = db.query("SELECT encrypted_data, status, finalize_token, simulate_error, attempt_meta FROM sessions WHERE id = ?").get(data.sessionId) as any;
        if (!row) return Response.json({ success: false, error: "session_not_found" }, { status: 404, headers: corsHeaders });
        if (row.status === "finalized") return Response.json({ success: false, error: "session_finalized" }, { status: 400, headers: corsHeaders });

        // Test error simulation (set via simulateError when creating session)
        if (row.simulate_error) {
          const simErr = row.simulate_error;
          const errorId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          console.log(`[TEST] Simulating ${simErr} error for session ${data.sessionId}, errorId: ${errorId}`);
          
          if (simErr === '500') {
            return Response.json({ success: false, error: "simulated_server_error", errorId }, { status: 500, headers: corsHeaders });
          }
          if (simErr === 'timeout') {
            await new Promise(r => setTimeout(r, 35000));
            return Response.json({ success: false, error: "simulated_timeout", errorId }, { status: 504, headers: corsHeaders });
          }
          if (simErr === 'badresp') {
            return new Response("not valid json {{{", { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (simErr === 'disconnect') {
            throw new Error("Simulated connection reset");
          }
        }

        // Verify or set the finalize token
        if (row.finalize_token && row.finalize_token !== data.finalizeToken) {
          return Response.json({ success: false, error: "token_mismatch" }, { status: 403, headers: corsHeaders });
        }

        const attemptMeta = parseAttemptMeta(row.attempt_meta);
        if (!attemptMeta || attemptMeta.status !== "active") {
          return Response.json({ success: false, error: "no_active_attempt" }, { status: 400, headers: corsHeaders });
        }
        if (attemptMeta.attemptId !== data.attemptId) {
          return Response.json({ success: false, error: "stale_attempt_id" }, { status: 409, headers: corsHeaders });
        }

        const existing = row.encrypted_data ? JSON.parse(row.encrypted_data) : [];

        // Find or create provider entry keyed by providerKey
        if (!data.providerKey) {
          return Response.json({ success: false, error: "missing_provider_key" }, { status: 400, headers: corsHeaders });
        }
        if (!attemptMeta.selectedProviderKeys.includes(data.providerKey)) {
          return Response.json({ success: false, error: "provider_not_in_attempt" }, { status: 400, headers: corsHeaders });
        }
        const chunkGroupId = `chunked_${data.providerKey}`;
        let providerEntry = existing.find((e: any) => e._chunkGroupId === chunkGroupId);
        
        if (!providerEntry) {
          providerEntry = {
            _chunkGroupId: chunkGroupId,
            version: 3,
            totalChunks: data.totalChunks, // -1 if unknown
            chunks: [],
          };
          existing.push(providerEntry);
        } else if (data.totalChunks > 0) {
          // Update totalChunks when we finally know it
          providerEntry.totalChunks = data.totalChunks;
        }
        
        // Add chunk (avoid duplicates)
        if (!providerEntry.chunks.find((c: any) => c.index === chunkIndex)) {
          providerEntry.chunks.push({
            index: chunkIndex,
            ephemeralPublicKey: data.chunk.ephemeralPublicKey,
            iv: data.chunk.iv,
            ciphertext: data.chunk.ciphertext,
          });
        }
        
        // Sort chunks by index
        providerEntry.chunks.sort((a: any, b: any) => a.index - b.index);
        
        const receivedChunks = providerEntry.chunks.length;
        const knownTotal = providerEntry.totalChunks > 0 ? providerEntry.totalChunks : '?';
        const isComplete = providerEntry.totalChunks > 0 && receivedChunks === providerEntry.totalChunks;
        
        // Mark complete but keep _chunkGroupId so retries find
        // the existing entry instead of creating a duplicate.
        if (isComplete) {
          providerEntry._complete = true;
        }
        
        console.log(`Received chunk ${chunkIndex + 1}/${knownTotal} for ${data.sessionId} (${receivedChunks}/${knownTotal} complete)`);

        db.run("UPDATE sessions SET encrypted_data = ?, status = 'collecting', finalize_token = ? WHERE id = ?",
          [JSON.stringify(existing), data.finalizeToken, data.sessionId]);

        return Response.json({
          success: true,
          attemptId: attemptMeta.attemptId,
          providerCount: existing.length,
          redirectTo: `${baseURL}/connect/${data.sessionId}?provider_added=true`
        }, { headers: corsHeaders });
      } catch (e) {
        const errorId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        console.error(`[SERVER ERROR] ${errorId}:`, e);
        return Response.json({ success: false, error: "processing_error", errorId }, { status: 500, headers: corsHeaders });
      }
    }

    // API: Finalize session (requires finalize token that only the browser knows)
    if (path.startsWith("/api/finalize/") && req.method === "POST") {
      const sessionId = path.replace("/api/finalize/", "");
      let body: any = {};
      try { body = await req.json(); } catch (e) {}

      const row = db.query("SELECT status, encrypted_data, finalize_token, attempt_meta FROM sessions WHERE id = ?").get(sessionId) as any;
      if (!row) return new Response("Session not found", { status: 404, headers: corsHeaders });
      if (!row.finalize_token) {
        return Response.json({ error: "not_claimed", error_description: "Session must be claimed by a browser first" }, { status: 400, headers: corsHeaders });
      }
      if (body.finalizeToken !== row.finalize_token) {
        return Response.json({ error: "invalid_token", error_description: "Valid finalizeToken required" }, { status: 403, headers: corsHeaders });
      }
      if (row.status === "finalized") return Response.json({ success: true, alreadyFinalized: true }, { headers: corsHeaders });
      if (!body.attemptId || typeof body.attemptId !== "string") {
        return Response.json({ error: "missing_attempt_id", error_description: "attemptId is required" }, { status: 400, headers: corsHeaders });
      }

      const attemptMeta = parseAttemptMeta(row.attempt_meta);
      if (!attemptMeta || attemptMeta.status !== "active") {
        return Response.json({ error: "no_active_attempt", error_description: "No active upload attempt for this session" }, { status: 400, headers: corsHeaders });
      }
      if (attemptMeta.attemptId !== body.attemptId) {
        return Response.json({ error: "stale_attempt_id", error_description: "attemptId does not match active attempt" }, { status: 409, headers: corsHeaders });
      }

      const encryptedData = row.encrypted_data ? JSON.parse(row.encrypted_data) : [];
      if (encryptedData.length === 0) return new Response("No providers connected", { status: 400, headers: corsHeaders });

      // Verify only providers locked for this attempt
      const incomplete: string[] = [];
      for (const providerKey of attemptMeta.selectedProviderKeys) {
        const chunkGroupId = `chunked_${providerKey}`;
        const p = encryptedData.find((entry: any) => entry._chunkGroupId === chunkGroupId);
        if (!p) {
          incomplete.push(`provider ${providerKey}: 0/? chunks`);
          continue;
        }
        if (!p.chunks || !Array.isArray(p.chunks)) {
          incomplete.push(`provider ${providerKey}: missing chunks array`);
          continue;
        }
        if (p.totalChunks > 0 && p.chunks.length !== p.totalChunks) {
          incomplete.push(`provider ${providerKey}: ${p.chunks.length}/${p.totalChunks} chunks`);
        } else if (p.totalChunks <= 0) {
          incomplete.push(`provider ${providerKey}: total chunk count unknown`);
        }
      }
      if (incomplete.length > 0) {
        return Response.json(
          { success: false, error: "incomplete_upload", details: incomplete },
          { status: 400, headers: corsHeaders }
        );
      }

      const finalizedAttemptMeta: AttemptMeta = { ...attemptMeta, status: "finalized" };
      db.run("UPDATE sessions SET status = 'finalized', attempt_meta = ? WHERE id = ?", [JSON.stringify(finalizedAttemptMeta), sessionId]);
      console.log(`Finalized session ${sessionId}`);
      return Response.json({ success: true, providerCount: encryptedData.length }, { headers: corsHeaders });
    }

    // API: Get session info
    if (path.startsWith("/api/session/") && req.method === "GET") {
      const sessionId = path.replace("/api/session/", "");
      const row = db.query("SELECT status, public_key, encrypted_data, attempt_meta, finalize_token FROM sessions WHERE id = ?").get(sessionId) as any;
      if (!row) return new Response("Session not found", { status: 404, headers: corsHeaders });

      const encryptedData = row.encrypted_data ? JSON.parse(row.encrypted_data) : [];
      const attemptMeta = parseAttemptMeta(row.attempt_meta);
      
      // Include per-provider chunk upload progress for incomplete v3 uploads
      let pendingChunks: Record<string, { receivedChunks: number[]; totalChunks: number }> | null = null;
      for (const entry of encryptedData) {
        if (!entry._chunkGroupId || entry._complete) continue;
        if (!pendingChunks) pendingChunks = {};
        // Strip the "chunked_" prefix to recover the providerKey
        const providerKey = entry._chunkGroupId.replace(/^chunked_/, '');
        if (attemptMeta && attemptMeta.selectedProviderKeys.length > 0 && !attemptMeta.selectedProviderKeys.includes(providerKey)) {
          continue;
        }
        pendingChunks[providerKey] = {
          receivedChunks: entry.chunks?.map((c: any) => c.index) || [],
          totalChunks: entry.totalChunks || -1,
        };
      }
      
      return Response.json({
        sessionId,
        publicKey: row.public_key ? JSON.parse(row.public_key) : null,
        status: row.status,
        providerCount: encryptedData.length,
        pendingChunks,
        attemptMeta,
        hasFinalizeToken: Boolean(row.finalize_token),
      }, { headers: corsHeaders });
    }

    // API: Get vendor configs (for local collection without a session)
    if (path === "/api/vendors" && req.method === "GET") {
      return Response.json(getVendors(), { headers: corsHeaders });
    }

    // Skill markdown (agent version)
    if (path === "/health-record-assistant.md") {
      const content = buildAgentSkill(baseURL);
      return new Response(content, { headers: { "Content-Type": "text/markdown" } });
    }

    // Local skill template (for browser-side zip creation)
    if (path === "/api/skill-template") {
      const skillMd = buildLocalSkill();
      const refsDir = "./skill/health-record-assistant/references";
      const references: Record<string, string> = {};
      
      if (existsSync(refsDir)) {
        for (const file of readdirSync(refsDir)) {
          references[file] = readFileSync(join(refsDir, file), "utf-8");
        }
      }
      
      return Response.json({
        skillMd,
        references,
      }, { headers: corsHeaders });
    }

    // Skill zip (agent version)
    if (path === "/skill.zip") {
      return await buildSkillZip();
    }

    // API: Log client-side error (non-sensitive diagnostic info only)
    if (path === "/api/log-error" && req.method === "POST") {
      try {
        const body = await req.json() as {
          sessionId?: string;
          errorCode?: string;
          httpStatus?: number;
          context?: string;
          userAgent?: string;
        };
        
        // Sanitize and log - no sensitive data
        const logEntry = {
          time: new Date().toISOString(),
          sessionId: body.sessionId?.slice(0, 32) || 'unknown',
          errorCode: String(body.errorCode || 'unknown').slice(0, 100),
          httpStatus: typeof body.httpStatus === 'number' ? body.httpStatus : null,
          context: String(body.context || '').slice(0, 200),
          userAgent: String(body.userAgent || '').slice(0, 200),
        };
        
        console.log(`[CLIENT ERROR]`, JSON.stringify(logEntry));
        
        return Response.json({ logged: true, errorId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, { headers: corsHeaders });
      } catch (e) {
        return Response.json({ logged: false }, { status: 400, headers: corsHeaders });
      }
    }

    // Test provider routes (gated and fixed-size allowlisted)
    const testMatch = ENABLE_TEST_PROVIDER
      ? path.match(/^\/test\/(\d+)mb\/(.*)$/)
      : null;
    if (testMatch) {
      const sizeMB = parseInt(testMatch[1], 10);
      if (!TEST_PROVIDER_SIZE_SET.has(sizeMB)) {
        return new Response("Test provider size not allowed", { status: 404, headers: corsHeaders });
      }
      const subPath = testMatch[2];

      // Brand file
      if (subPath === 'brand.json') {
        return Response.json({
          items: [{
            id: `test-synthetic-${sizeMB}mb`,
            displayName: `🧪 Test Data Generator (${sizeMB} MB)`,
            brandName: `Test Data ${sizeMB}MB`,
            itemType: 'brand',
            brandId: `test-${sizeMB}mb`,
            endpoints: [{
              url: `${baseURL}/test/${sizeMB}mb/fhir`,
              name: 'FHIR R4',
              connectionType: 'hl7-fhir-rest',
            }],
            searchName: `test data generator ${sizeMB}mb synthetic`,
          }],
          processedTimestamp: new Date().toISOString(),
        }, { headers: corsHeaders });
      }

      // SMART configuration
      if (subPath === 'fhir/.well-known/smart-configuration') {
        return Response.json({
          authorization_endpoint: `${baseURL}/test/${sizeMB}mb/authorize`,
          token_endpoint: `${baseURL}/test/${sizeMB}mb/token`,
          capabilities: ['launch-standalone', 'client-public', 'permission-patient'],
        }, { headers: corsHeaders });
      }

      // FHIR metadata
      if (subPath === 'fhir/metadata') {
        return Response.json({
          resourceType: 'CapabilityStatement',
          status: 'active',
          kind: 'instance',
          fhirVersion: '4.0.1',
          format: ['json'],
          rest: [{
            mode: 'server',
            security: {
              extension: [{
                url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
                extension: [
                  { url: 'authorize', valueUri: `${baseURL}/test/${sizeMB}mb/authorize` },
                  { url: 'token', valueUri: `${baseURL}/test/${sizeMB}mb/token` },
                ]
              }]
            }
          }]
        }, { headers: corsHeaders });
      }

      // OAuth authorize
      if (subPath === 'authorize') {
        const state = url.searchParams.get('state');
        const redirectUri = url.searchParams.get('redirect_uri');

        if (!state || !redirectUri) {
          return new Response('Missing state or redirect_uri', { status: 400 });
        }

        const code = `test_${sizeMB}mb_${Date.now()}`;
        return Response.redirect(`${redirectUri}?code=${code}&state=${state}`, 302);
      }

      // OAuth token
      if (subPath === 'token' && req.method === 'POST') {
        return Response.json({
          access_token: `test_token_${sizeMB}mb`,
          token_type: 'Bearer',
          expires_in: 3600,
          patient: `test-patient-${sizeMB}mb`,
          scope: 'patient/*.rs',
        }, { headers: corsHeaders });
      }

      // FHIR resources
      if (subPath.startsWith('fhir/')) {
        const resourcePath = subPath.replace('fhir/', '');

        // Patient resource
        if (resourcePath.startsWith('Patient/')) {
          return Response.json({
            resourceType: 'Patient',
            id: 'test-patient',
            name: [{ given: ['Test'], family: 'Patient' }],
            birthDate: '1990-01-01',
          }, { headers: corsHeaders });
        }

        // Only generate big data for DocumentReference (single resource type)
        // Other resource types return empty to avoid multiplying the data
        if (!resourcePath.startsWith('DocumentReference')) {
          return Response.json({
            resourceType: 'Bundle',
            type: 'searchset',
            total: 0,
            entry: [],
          }, { headers: corsHeaders });
        }

        // Generate synthetic bundle of requested size as DocumentReferences with inline data
        const targetBytes = sizeMB * 1024 * 1024;
        const entries: any[] = [];
        let currentSize = 100;
        let resourceId = 0;

        while (currentSize < targetBytes) {
          const paddingSize = Math.min(50000, targetBytes - currentSize); // 50KB chunks
          const docRef = {
            resourceType: 'DocumentReference',
            id: `test-doc-${resourceId++}`,
            status: 'current',
            type: { coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summary of episode note' }] },
            content: [{
              attachment: {
                contentType: 'text/plain',
                // Use random bytes so data doesn't compress
                data: Buffer.from(crypto.getRandomValues(new Uint8Array(paddingSize))).toString('base64'),
              }
            }],
          };
          entries.push({ resource: docRef });
          currentSize += JSON.stringify(docRef).length + 50;
        }

        console.log(`[TEST] Generated ${sizeMB}MB synthetic data: ${entries.length} DocumentReferences, ~${Math.round(currentSize/1024/1024)}MB`);

        return Response.json({
          resourceType: 'Bundle',
          type: 'searchset',
          total: entries.length,
          entry: entries,
        }, { headers: corsHeaders });
      }
    }

    // Health check
    if (path === "/health") {
      return new Response("ok", { headers: withSecurityHeaders() });
    }

    // Debug: random binary data endpoint (opt-in only)
    const randomMatch = ENABLE_RANDOM_BIN_ENDPOINT
      ? path.match(/^\/random\/(\d+(?:\.\d+)?)\.MB\.bin$/)
      : null;
    if (randomMatch) {
      const sizeMB = parseFloat(randomMatch[1]);
      if (!Number.isFinite(sizeMB) || sizeMB <= 0 || sizeMB > RANDOM_BIN_MAX_MB) {
        return new Response("Requested size is out of bounds", { status: 400, headers: corsHeaders });
      }
      const bytes = Math.floor(sizeMB * 1024 * 1024);
      const data = crypto.getRandomValues(new Uint8Array(bytes));
      return new Response(data, {
        headers: { ...corsHeaders, "Content-Type": "application/octet-stream" }
      });
    }

    // Static brand assets only: /static/brands/*
    if (path.startsWith("/static/brands/")) {
      const encodedRelativePath = path.slice("/static/brands/".length);
      let decodedRelativePath = "";
      try {
        decodedRelativePath = decodeURIComponent(encodedRelativePath);
      } catch {
        return new Response("Not found", { status: 404 });
      }
      const staticFilePath = resolve(STATIC_BRANDS_ROOT, decodedRelativePath);
      const rel = relative(STATIC_BRANDS_ROOT, staticFilePath);
      if (!rel || rel.startsWith("..") || !existsSync(staticFilePath)) {
        return new Response("Not found", { status: 404 });
      }

      const file = Bun.file(staticFilePath);
      const mtime = file.lastModified;
      const etag = `"${mtime}-${file.size}"`;

      const ifNoneMatch = req.headers.get("If-None-Match");
      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers: withSecurityHeaders({ "ETag": etag }) });
      }

      const acceptEncoding = req.headers.get("Accept-Encoding") || "";

      if (acceptEncoding.includes("gzip") && staticFilePath.endsWith(".json")) {
        const content = await file.arrayBuffer();
        const compressed = Bun.gzipSync(new Uint8Array(content));
        return new Response(compressed, {
          headers: withSecurityHeaders({
            "Cache-Control": "public, max-age=86400",
            "Content-Encoding": "gzip",
            "Content-Type": "application/json",
            "ETag": etag,
          }),
        });
      }

      return new Response(file, {
        headers: withSecurityHeaders({
          "Cache-Control": "public, max-age=86400",
          "ETag": etag,
        }),
      });
    }

    // JWKS endpoints - serve both keysets under .well-known/
    if (path.startsWith("/.well-known/") && path.endsWith(".json")) {
      const filename = path.replace("/.well-known/", "");
      const allowed = [
        "jwks.json",
        "jwks-intentionally-publishing-private-keys-which-are-not-sensitive-in-this-architecture.json",
      ];
      if (allowed.includes(filename)) {
        const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        console.log(`[JWKS] ${new Date().toISOString()} | ${sourceIp} | ${path}`);
        const jwksPath = `./data/${filename}`;
        if (existsSync(jwksPath)) {
          return new Response(readFileSync(jwksPath, "utf-8"), {
            headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", ...corsHeaders },
          });
        }
        return new Response('{"keys":[]}', { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // Legacy URL redirects
    if (path === "/ehr-connect/callback") {
      return Response.redirect(`${baseURL}/connect/callback${url.search}`, 302);
    }
    if (path === "/collect" || path === "/connections") {
      return Response.redirect(`${baseURL}/`, 302);
    }

    return new Response("Not found", { status: 404, headers: withSecurityHeaders() });
  },
});

console.log(`Wren server running on http://localhost:${port}`);
console.log(`Base URL: ${baseURL}`);
