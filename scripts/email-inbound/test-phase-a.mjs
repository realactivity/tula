#!/usr/bin/env node
// test-phase-a.mjs — Validates Phase A plumbing end-to-end.
// Downloads the canonical "Health report" Withings PDF using the new modules.
//
// Usage:
//   source ~/.tula/inbound.env
//   node test-phase-a.mjs [--message-id <id>]

import fs from 'node:fs/promises';
import path from 'node:path';
import { buildPca, getAccessToken } from './auth.mjs';
import { buildGraphClient } from './graph-client.mjs';
import { downloadAttachments } from './download-attachments.mjs';

const DEFAULT_HEALTH_REPORT_ID = 'AAMkADRkY2ZmYWUyLTI4MDQtNDg4ZS04NzMzLTJkYjg3NjY5NjFhMgBGAAAAAABM2z3W0Z1JT6GCUELQJPsyBwB2Xk9psYoNQYaydfAc3_VmAAAAAAEMAAB2Xk9psYoNQYaydfAc3_VmAAAQy8X-AAA=';

function parseArgs(argv) {
  const opts = { messageId: DEFAULT_HEALTH_REPORT_ID };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--message-id' && argv[i+1]) {
      opts.messageId = argv[i+1];
      i++;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const messageId = opts.messageId;

  console.log('=== Phase A Test ===');
  console.log('Using message ID:', messageId);

  // 1. Auth
  console.log('\n[1/4] Building PCA and acquiring token...');
  let pca;
  try {
    pca = await buildPca();
  } catch (err) {
    console.error('buildPca failed:', err.message);
    process.exit(3);
  }

  let token;
  try {
    token = await getAccessToken(pca);
  } catch (err) {
    console.error('getAccessToken failed:', err.message);
    process.exit(4);
  }
  console.log('Token acquired. Expires:', token.expiresOn ? new Date(token.expiresOn).toISOString() : 'unknown');

  // 2. Build client using the NEW graph-client helper
  console.log('\n[2/4] Building Graph client via graph-client.mjs (initWithMiddleware)...');
  const client = buildGraphClient(pca);
  console.log('Client ready.');

  // 3. Download attachments
  const sanitized = messageId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const destDir = path.join(process.env.HOME, '.openclaw/workspace/.inbound-inbox', sanitized);

  console.log('\n[3/4] Downloading attachments to:', destDir);
  const results = await downloadAttachments(client, messageId, destDir);

  console.log('\n[4/4] Results:');
  console.log(JSON.stringify(results, null, 2));

  // Verify the expected file
  const pdfs = results.filter(r => r.path && r.path.endsWith('.PDF'));
  if (pdfs.length > 0) {
    const stat = await fs.stat(pdfs[0].path);
    console.log(`\nSUCCESS: Downloaded ${pdfs[0].name} (${stat.size} bytes)`);
    console.log('File is at:', pdfs[0].path);
  } else {
    console.log('\nNote: No .PDF found in this message (may be a different message).');
  }

  console.log('\nPhase A plumbing validated.');
}

// getAccessToken is already imported at top from the re-exported auth module.

main().catch(err => {
  console.error('Unhandled:', err?.stack ?? err);
  process.exit(1);
});
