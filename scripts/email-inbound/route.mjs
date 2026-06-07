// route.mjs — Phase D: Routes classification + materialized files to skills.
// Per inbound-email-router-build-spec.md §9.
//
// Input:
//   classification: { route: 'med-pdf' | 'wearable-ingest' | 'unclassified', confidence, reason }
//   files: array of { name, path, contentType, size, isInline }  (from download-attachments)
//   messageContext: { id, sanitizedId, subject, fromAddress, receivedDateTime }
//
// Output (always):
//   {
//     success: boolean,
//     skill?: string,
//     filesCreated?: string[],
//     cacheDir?: string,
//     memoryUpdated?: boolean,
//     summary?: string,
//     error?: string,
//     classification
//   }
//
// For med-pdf: actually invokes the med-pdf skill's extract.mjs on the first suitable attachment.
// For wearable-ingest: stubs (skill not built yet).
// For unclassified: logs and returns success with note.

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MED_PDF_EXTRACT = path.join(
  process.env.HOME || '/home/azureuser',
  '.openclaw/workspace/skills/med-pdf/scripts/extract.mjs'
);

function sanitizeForSlug(str) {
  return (str || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function runMedPdfExtract(attachmentPath, outDir) {
  await fs.mkdir(outDir, { recursive: true, mode: 0o700 });

  return new Promise((resolve, reject) => {
    const args = [MED_PDF_EXTRACT, attachmentPath, outDir];
    const child = spawn('node', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim(), outDir });
      } else {
        reject(new Error(`med-pdf extract exited with code ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn med-pdf extract: ${err.message}`));
    });
  });
}

export async function route(classification, files = [], messageContext = {}) {
  const { route: routeName, confidence, reason } = classification || {};
  const { id: messageId, sanitizedId, subject, fromAddress, receivedDateTime } = messageContext;

  const result = {
    success: false,
    skill: null,
    filesCreated: [],
    cacheDir: null,
    memoryUpdated: false,
    summary: '',
    classification,
    error: null,
  };

  if (!routeName) {
    result.error = 'No route in classification';
    return result;
  }

  // Prefer PDF for med-pdf when available; otherwise take first usable image/PDF.
  let chosenAttachment = files.find(f => f.path && !f.skipped && f.name.toLowerCase().endsWith('.pdf'));
  if (!chosenAttachment) {
    chosenAttachment = files.find(f => f.path && !f.skipped);
  }
  const attachmentPath = chosenAttachment?.path;
  const attachmentName = chosenAttachment?.name || 'unknown';

  try {
    if (routeName === 'med-pdf') {
      if (!attachmentPath) {
        result.error = 'No usable attachment for med-pdf';
        return result;
      }

      const slug = sanitizeForSlug(subject || 'inbound');
      const timestamp = (receivedDateTime || new Date().toISOString()).slice(0, 10);
      const cacheDir = path.join(
        process.env.HOME || '/home/azureuser',
        '.openclaw/workspace/.med-pdf-cache',
        `inbound-${sanitizedId || slug}-${timestamp}`
      );

      console.log(`[route] med-pdf: extracting ${attachmentName} → ${cacheDir}`);

      const extractResult = await runMedPdfExtract(attachmentPath, cacheDir);

      // Discover what was created (text + any page images)
      const created = [];
      try {
        const entries = await fs.readdir(cacheDir);
        for (const e of entries) {
          if (e === 'text.txt' || e.endsWith('.png') || e.endsWith('.json')) {
            created.push(path.join(cacheDir, e));
          }
        }
      } catch {}

      result.success = true;
      result.skill = 'med-pdf';
      result.cacheDir = cacheDir;
      result.filesCreated = created;
      result.summary = `med-pdf extract completed for ${attachmentName} (${created.length} artifacts)`;
      result.memoryUpdated = false; // Phase D: extraction only; persistence in later phase or by skill

      console.log(`[route] med-pdf success. Cache: ${cacheDir}`);
      return result;
    }

    if (routeName === 'wearable-ingest') {
      // Skill does not exist yet (see build spec). Cache only.
      result.success = true;
      result.skill = 'wearable-ingest';
      result.summary = 'Routed to wearable-ingest (skill not yet implemented — attachment cached only)';
      result.filesCreated = files.filter(f => f.path).map(f => f.path);
      console.log(`[route] wearable-ingest stub for ${subject || messageId}`);
      return result;
    }

    if (routeName === 'unclassified') {
      result.success = true;
      result.skill = 'unclassified';
      result.summary = `Unclassified (${confidence}): ${reason}. Attachment(s) left in .inbound-inbox for manual review.`;
      result.filesCreated = files.filter(f => f.path).map(f => f.path);
      console.log(`[route] unclassified: ${reason}`);
      return result;
    }

    result.error = `Unknown route: ${routeName}`;
    return result;

  } catch (err) {
    result.success = false;
    result.error = err.message || String(err);
    console.error(`[route] Error routing to ${routeName}:`, err.message);
    return result;
  }
}
