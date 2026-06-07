#!/usr/bin/env node
// test-route.mjs — Phase D validation: exercises route.mjs against real materialized artifacts.
//
// Usage (after a Phase B dry-run that captured files):
//   source ~/.tula/inbound.env
//   node test-route.mjs --use-health-report
//   node test-route.mjs --use-garmin

import fs from 'node:fs/promises';
import path from 'node:path';
import { classifyFromMetadata } from './classify.mjs';
import { route } from './route.mjs';
import { writeAudit } from './audit.mjs';

function parseArgs(argv) {
  const opts = { useHealthReport: false, useGarmin: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--use-health-report') opts.useHealthReport = true;
    if (argv[i] === '--use-garmin') opts.useGarmin = true;
  }
  return opts;
}

async function findBestInboxDir(opts) {
  const inboxRoot = path.join(process.env.HOME, '.openclaw/workspace/.inbound-inbox');
  const entries = await fs.readdir(inboxRoot, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  if (dirs.length === 0) throw new Error('No .inbound-inbox directories found. Run poller --dry-run first.');

  // If targeting Health report, look for a dir that contains medical_report.PDF
  if (opts.useHealthReport) {
    for (const d of dirs) {
      const attDir = path.join(inboxRoot, d, 'attachments');
      try {
        const files = await fs.readdir(attDir);
        if (files.some(f => f.toLowerCase().includes('medical_report') || f.toLowerCase().endsWith('.pdf'))) {
          return path.join(inboxRoot, d);
        }
      } catch {}
    }
  }

  // Fallback: most recently named dir (or last one)
  dirs.sort();
  return path.join(inboxRoot, dirs[dirs.length - 1]);
}

async function loadMetadataAndFiles(dir) {
  const metaPath = path.join(dir, 'metadata.json');
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));

  const attDir = path.join(dir, 'attachments');
  let attFiles = [];
  try {
    const names = await fs.readdir(attDir);
    attFiles = await Promise.all(names.map(async (name) => {
      const p = path.join(attDir, name);
      const st = await fs.stat(p);
      const lower = name.toLowerCase();
      return {
        name,
        path: p,
        contentType: lower.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        size: st.size,
        isInline: false,
      };
    }));
  } catch {}

  return { meta, attFiles };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('=== Phase D Route Test ===');

  const inboxDir = await findBestInboxDir(opts);
  console.log('Using inbox dir:', inboxDir);

  const { meta, attFiles } = await loadMetadataAndFiles(inboxDir);
  console.log('Message:', meta.subject, '| from:', meta.from?.address || meta.from);

  const classification = classifyFromMetadata(meta, attFiles);
  console.log('Classification:', classification);

  const messageContext = {
    id: meta.id,
    sanitizedId: path.basename(inboxDir),
    subject: meta.subject,
    fromAddress: meta.from?.address || meta.from?.emailAddress?.address,
    receivedDateTime: meta.receivedDateTime,
  };

  const result = await route(classification, attFiles, messageContext);

  console.log('\nRoute result:');
  console.log(JSON.stringify(result, null, 2));

  // Phase E: full audit + daily note + FHIR AuditEvent
  if (result.success) {
    const auditInfo = await writeAudit({
      messageContext,
      classification,
      routeResult: result,
      attachments: attFiles,
    });
    console.log('\nAudit info:', auditInfo);
  } else {
    console.log('\nSkipping audit (route was not successful)');
  }

  if (result.success && result.cacheDir) {
    console.log('\nCache dir contents:');
    try {
      const contents = await fs.readdir(result.cacheDir);
      console.log(contents);
    } catch (e) {
      console.log('(could not read cache dir)');
    }
  }

  console.log('\nPhase D route test complete.');
}

main().catch(err => {
  console.error('Unhandled:', err?.stack ?? err);
  process.exit(1);
});
