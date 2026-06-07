// audit.mjs — Phase E: Persistence + Full Audit for inbound email router.
// Per inbound-email-router-build-spec.md §10.
//
// Writes:
// - .inbound-processed/{sanitizedId}.json (full structured audit)
// - Appends one line to memory/YYYY-MM-DD.md
// - Optional: lightweight FHIR AuditEvent under tula/fhir/AuditEvent/
//
// Designed to be called after successful route().
// Idempotent: if the processed file already exists, we still append to daily note only on first success.

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const PROCESSED_DIR = path.join(process.env.HOME || '/home/azureuser', '.openclaw/workspace/.inbound-processed');
const MEMORY_DIR = path.join(process.env.HOME || '/home/azureuser', '.openclaw/workspace/memory');
const FHIR_AUDIT_DIR = path.join(process.env.HOME || '/home/azureuser', '.openclaw/workspace/tula/fhir/AuditEvent');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
}

export async function writeAudit({ messageContext, classification, routeResult, attachments = [] }) {
  const { id: messageId, sanitizedId, subject, fromAddress, receivedDateTime } = messageContext || {};
  const processedAt = new Date().toISOString();

  if (!sanitizedId) {
    throw new Error('sanitizedId is required for audit');
  }

  await ensureDir(PROCESSED_DIR);

  const auditPath = path.join(PROCESSED_DIR, `${sanitizedId}.json`);

  // Check if we already audited this exact message (idempotency)
  let alreadyAudited = false;
  try {
    await fs.access(auditPath);
    alreadyAudited = true;
  } catch {}

  const auditRecord = {
    messageId,
    sanitizedId,
    subject: subject || '(no subject)',
    from: fromAddress || 'unknown',
    receivedDateTime,
    processedAt,
    classification,
    attachments: attachments.map(a => ({
      name: a.name,
      size: a.size,
      contentType: a.contentType,
      path: a.path,
    })),
    skillResult: {
      success: routeResult?.success,
      skill: routeResult?.skill,
      summary: routeResult?.summary,
      cacheDir: routeResult?.cacheDir,
      filesCreated: routeResult?.filesCreated || [],
      error: routeResult?.error || null,
    },
    outcome: routeResult?.success ? 'success' : 'error',
  };

  // Always write/overwrite the audit record (latest state)
  await fs.writeFile(auditPath, JSON.stringify(auditRecord, null, 2), { mode: 0o600 });
  console.log(`[audit] Wrote processed record: ${auditPath}`);

  // Append to today's daily note (only if this is the first time we processed it)
  if (!alreadyAudited) {
    const date = processedAt.slice(0, 10);
    const notePath = path.join(MEMORY_DIR, `${date}.md`);
    await ensureDir(MEMORY_DIR);

    const line = `- Inbound: processed "${subject || '(no subject)'}" from ${fromAddress || 'unknown'} → ${routeResult?.skill || 'unclassified'} (${routeResult?.summary || ''})`;

    await fs.appendFile(notePath, line + '\n', { encoding: 'utf-8' });
    console.log(`[audit] Appended to daily note: ${notePath}`);
  } else {
    console.log(`[audit] Already audited this message (daily note not duplicated)`);
  }

  // Optional: lightweight FHIR AuditEvent (flat file, provider-prefixed style)
  try {
    await ensureDir(FHIR_AUDIT_DIR);
    const fhirAudit = {
      resourceType: 'AuditEvent',
      id: `inbound-${sanitizedId}`,
      type: { code: '110100', display: 'Health Data Ingestion' },
      action: 'C', // Create
      recorded: processedAt,
      outcome: routeResult?.success ? '0' : '8', // 0=success, 8=error per FHIR
      agent: [{ who: { display: 'Tula Inbound Router' } }],
      source: { observer: { display: 'aria@realactivity.com' } },
      entity: [{
        what: { reference: `DocumentReference/inbound-${sanitizedId}` },
        type: { code: '2', display: 'Health Data' },
        description: subject || 'Inbound health email',
      }],
      // Minimal extension for our internal classification
      _classification: classification,
    };

    const fhirPath = path.join(FHIR_AUDIT_DIR, `inbound-${sanitizedId}.json`);
    await fs.writeFile(fhirPath, JSON.stringify(fhirAudit, null, 2), { mode: 0o600 });
    console.log(`[audit] Wrote FHIR AuditEvent: ${fhirPath}`);
  } catch (e) {
    console.warn('[audit] FHIR AuditEvent write skipped:', e.message);
  }

  return {
    auditPath,
    alreadyAudited,
    dailyNoteAppended: !alreadyAudited,
  };
}
