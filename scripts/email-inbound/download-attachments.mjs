// download-attachments.mjs — Reusable helper to fetch and materialize attachments.
// Follows the exact patterns discovered in the live "Health report" trace.
//
// Input: client (Graph), messageId (raw Graph ID), destDir (filesystem path)
// Output: array of { name, contentType, size, path, isInline }
//
// Handles:
// - fileAttachment with inline contentBytes (base64)
// - Sanitizes filenames (no path traversal)
// - Size logging + basic cap warning
// - Future: streaming $value fallback for very large attachments

import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_INLINE_SIZE = 25 * 1024 * 1024; // 25 MB warning threshold

function sanitizeFilename(name) {
  if (!name) return 'attachment.bin';
  // Remove path separators and control chars
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

export async function downloadAttachments(client, messageId, destDir) {
  await fs.mkdir(destDir, { recursive: true, mode: 0o700 });

  const attachmentsApi = client.api(`/me/messages/${encodeURIComponent(messageId)}/attachments`);
  let attachments;
  try {
    attachments = await attachmentsApi.get();
  } catch (err) {
    throw new Error(`Failed to list attachments for message ${messageId}: ${err.message ?? err}`);
  }

  const items = attachments?.value ?? [];
  const results = [];

  for (const att of items) {
    const name = sanitizeFilename(att.name || `attachment-${att.id}`);
    const outPath = path.join(destDir, name);
    const isInline = !!att.isInline;
    const contentType = att.contentType || 'application/octet-stream';
    const size = att.size || 0;

    if (att['@odata.type'] === '#microsoft.graph.fileAttachment' && att.contentBytes) {
      if (size > MAX_INLINE_SIZE) {
        console.warn(`[download] Large attachment (${(size/1024/1024).toFixed(1)} MB): ${name}`);
      }

      const buffer = Buffer.from(att.contentBytes, 'base64');
      await fs.writeFile(outPath, buffer, { mode: 0o600 });
      console.log(`[download] Wrote ${name} (${buffer.length} bytes) → ${outPath}`);

      results.push({
        name: att.name,
        contentType,
        size: buffer.length,
        path: outPath,
        isInline,
      });
    } else {
      // itemAttachment, referenceAttachment, or no contentBytes yet
      console.log(`[download] Skipped non-file or empty attachment: ${name} (${att['@odata.type']})`);
      results.push({
        name: att.name,
        contentType,
        size,
        path: null,
        isInline,
        skipped: true,
        odataType: att['@odata.type'],
      });
    }
  }

  return results;
}
