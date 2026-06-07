/**
 * Server-only FHIR filesystem store.
 *
 * Reads raw Epic FHIR JSON from disk (the directory produced by health-records-pull
 * and the email-router skill). This module MUST NOT be imported from client components.
 *
 * The public surface is intentionally tiny:
 *   - fhirDir()
 *   - readType<T>(resourceType)
 *
 * All heavy mapping to UI view types happens in lib/data/mappers.
 */

import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Root directory containing the FHIR resource type subdirectories
 * (Observation/, MedicationRequest/, Patient/, etc.).
 *
 * Override with TULA_FHIR_DIR for tests or alternate datasets.
 * Default matches the live location on the VM:
 *   ~/.openclaw/workspace/tula/fhir
 */
export function fhirDir(): string {
  const env = process.env.TULA_FHIR_DIR;
  if (env && env.trim()) {
    return path.resolve(env);
  }
  return path.join(os.homedir(), ".openclaw", "workspace", "tula", "fhir");
}

// ---------------------------------------------------------------------------
// Internal: tolerant directory reader
// ---------------------------------------------------------------------------

/** Simple mtime-based cache. Keyed by absolute directory path. */
const dirCache = new Map<
  string,
  { mtimeMs: number; files: string[] }
>();

function listJsonFiles(dir: string): string[] {
  const stat = fs.statSync(dir, { throwIfNoEntry: false });
  if (!stat || !stat.isDirectory()) {
    return [];
  }

  const cached = dirCache.get(dir);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.files;
  }

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const jsonFiles = entries
    .filter((name) => name.endsWith(".json") && !name.startsWith("."))
    // Skip any in-flight write temp files the router might create
    .filter((name) => !name.endsWith(".tmp") && !name.includes(".tmp."))
    .map((name) => path.join(dir, name));

  dirCache.set(dir, { mtimeMs: stat.mtimeMs, files: jsonFiles });
  return jsonFiles;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read and parse every *.json file under <fhirDir()>/<type>/.
 *
 * - Skips non-.json, dotfiles, and *.tmp* names.
 * - Each file is read + JSON.parse inside its own try/catch.
 * - Malformed or unreadable files are silently skipped (we never want a
 *   single bad resource to take down the whole dashboard).
 * - Returns plain JS objects typed as T (caller decides how loose).
 *
 * This is intentionally synchronous. The Next.js server component / route
 * that calls it is already on the server; we keep the surface simple.
 */
export function readType<T = any>(type: string): T[] {
  const base = fhirDir();
  const typeDir = path.join(base, type);

  const files = listJsonFiles(typeDir);
  const out: T[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw) as T;
      out.push(parsed);
    } catch {
      // Intentionally swallow per-file errors. A single corrupt JSON
      // must not 500 the patient portal.
    }
  }

  return out;
}

/**
 * Convenience: read a single resource by id from a type directory.
 * Returns undefined if not found or unreadable.
 */
export function readOne<T = any>(type: string, id: string): T | undefined {
  const base = fhirDir();
  const file = path.join(base, type, `${id}.json`);
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** For tests / diagnostics only. */
export function _clearCacheForTests() {
  dirCache.clear();
}
