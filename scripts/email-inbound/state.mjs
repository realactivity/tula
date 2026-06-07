// state.mjs — Checkpoint and processed message tracking for inbound poller.
// State lives at ~/.tula/inbound-state.json (chmod 600).
// Message ID is the single source of truth for idempotency.

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const STATE_PATH = path.join(os.homedir(), '.tula', 'inbound-state.json');

async function ensureTulaDir() {
  const tulaDir = path.join(os.homedir(), '.tula');
  await fs.mkdir(tulaDir, { recursive: true, mode: 0o700 });
  try { await fs.chmod(tulaDir, 0o700); } catch {}
}

export async function loadState() {
  await ensureTulaDir();
  try {
    const data = await fs.readFile(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      lastSeenReceivedDateTime: parsed.lastSeenReceivedDateTime || null,
      processedIds: Array.isArray(parsed.processedIds) ? parsed.processedIds : [],
    };
  } catch {
    // No state yet or corrupt — start fresh (safe default)
    return { lastSeenReceivedDateTime: null, processedIds: [] };
  }
}

export async function saveState(state) {
  await ensureTulaDir();
  // Write temp then rename for atomicity
  const tmp = STATE_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await fs.rename(tmp, STATE_PATH);
}

/**
 * Sanitize a Graph message ID for use as a filesystem directory name.
 * Message IDs contain = / + _ - and are long.
 * We use a truncated base64url-style version + keep the full raw ID in metadata.
 */
export function sanitizeMessageId(rawId) {
  if (!rawId) return 'unknown';
  // Remove characters unsafe for filenames, keep it reasonably short for dirs
  return rawId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
}

export async function isProcessed(state, messageId) {
  return state.processedIds.includes(messageId);
}

export async function markProcessed(state, messageId, receivedDateTime) {
  if (!state.processedIds.includes(messageId)) {
    state.processedIds.push(messageId);
  }
  // Advance the monotonic checkpoint only if this is newer
  if (receivedDateTime) {
    if (!state.lastSeenReceivedDateTime || receivedDateTime > state.lastSeenReceivedDateTime) {
      state.lastSeenReceivedDateTime = receivedDateTime;
    }
  }
}
