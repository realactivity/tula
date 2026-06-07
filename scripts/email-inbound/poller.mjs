#!/usr/bin/env node
// poller.mjs — Full inbound email router poller (Phase F automation ready).
// Per inbound-email-router-build-spec.md Phases B + F.
//
// Now wires the complete pipeline on real runs:
//   materialize → classify → route (to skill) → audit (daily note + processed + FHIR)
//
// Usage examples:
//   source ~/.tula/inbound.env
//   node poller.mjs --dry-run --top 10
//   node poller.mjs --once
//   node poller.mjs --once --message-id <full-graph-id>
//   node poller.mjs --since 2026-06-05T00:00:00Z --top 20

import fs from 'node:fs/promises';
import path from 'node:path';
import { buildPca } from './auth.mjs';
import { buildGraphClient } from './graph-client.mjs';
import { downloadAttachments } from './download-attachments.mjs';
import { loadState, saveState, sanitizeMessageId, isProcessed, markProcessed } from './state.mjs';
import { classifyFromMetadata } from './classify.mjs';
import { route } from './route.mjs';
import { writeAudit } from './audit.mjs';

function parseArgs(argv) {
  const opts = {
    once: true,
    dryRun: false,
    top: 10,
    since: null,
    messageId: null,
    force: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--once') opts.once = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--top') {
      const n = parseInt(argv[++i], 10);
      if (Number.isFinite(n) && n > 0 && n <= 50) opts.top = n;
    } else if (a === '--since' && argv[i + 1]) {
      opts.since = argv[++i];
    } else if (a === '--message-id' && argv[i + 1]) {
      opts.messageId = argv[++i];
    } else if (a === '--force') {
      opts.force = true;
    } else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
Inbound poller (full pipeline)

Options:
  --dry-run           Do everything except mutate state/memory/FHIR. Safe for testing.
  --once              Single pass (default for cron/systemd timer). Exit after one run.
  --top N             Fetch N most recent messages (default 10, max 50).
  --since <ISO>       Only consider messages after this timestamp (client-side).
  --message-id <id>   Process exactly this one message (for targeted re-test).
  --force             Re-process even if already in processedIds (testing only).
  -h, --help          This help.

Examples:
  node poller.mjs --dry-run --top 5
  node poller.mjs --once
  node poller.mjs --message-id "<full graph id>" --dry-run
`);
}

async function fetchMessages(client, top) {
  const res = await client
    .api('/me/mailFolders/Inbox/messages')
    .top(top)
    .select('id,subject,from,receivedDateTime,hasAttachments,bodyPreview')
    .orderby('receivedDateTime DESC')
    .get();

  return res.value || [];
}

async function materializeMetadata(message, sanitizedId, destDir) {
  await fs.mkdir(destDir, { recursive: true, mode: 0o700 });

  const metadata = {
    id: message.id,
    subject: message.subject || '(no subject)',
    from: message.from?.emailAddress || {},
    receivedDateTime: message.receivedDateTime,
    hasAttachments: !!message.hasAttachments,
    bodyPreview: message.bodyPreview || '',
    processedAt: new Date().toISOString(),
  };

  const metaPath = path.join(destDir, 'metadata.json');
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
  return metaPath;
}

async function appendDailyNote(message, action, dryRun) {
  const date = new Date().toISOString().slice(0, 10);
  const notePath = path.join(process.env.HOME, '.openclaw/workspace/memory', `${date}.md`);
  const line = `- Inbound: ${action} "${message.subject || '(no subject)'}" from ${message.from?.emailAddress?.address || 'unknown'} (id: ${message.id.slice(0, 16)}...)`;

  try {
    await fs.appendFile(notePath, line + '\n', { encoding: 'utf-8' });
    if (!dryRun) {
      console.log(`[poller] Appended to daily note: ${notePath}`);
    }
  } catch (e) {
    console.warn('[poller] Could not append to daily note:', e.message);
  }
}

async function processOneMessage(client, message, state, opts) {
  const id = message.id;
  const sanitized = sanitizeMessageId(id);
  const inboxDir = path.join(process.env.HOME, '.openclaw/workspace/.inbound-inbox', sanitized);

  const already = await isProcessed(state, id);

  if (already && !opts.force) {
    console.log(`[poller] SKIP (already processed): ${message.subject} (${id.slice(0, 20)}...)`);
    return 'skipped';
  }

  console.log(`[poller] ${opts.dryRun ? '[DRY] ' : ''}Processing: ${message.subject} | ${message.receivedDateTime}`);

  // 1. Materialize metadata
  await materializeMetadata(message, sanitized, inboxDir);

  // 2. Download attachments (Phase A helper)
  let attachments = [];
  if (message.hasAttachments) {
    const attDir = path.join(inboxDir, 'attachments');
    attachments = await downloadAttachments(client, id, attDir);
  }

  const messageContext = {
    id: message.id,
    sanitizedId: sanitized,
    subject: message.subject,
    fromAddress: message.from?.emailAddress?.address,
    receivedDateTime: message.receivedDateTime,
  };

  let classification = null;
  let routeResult = null;

  if (!opts.dryRun) {
    // Full pipeline (Phases C + D + E)
    classification = classifyFromMetadata(message, attachments);
    console.log(`[poller] Classified as: ${classification.route} (${classification.confidence}) - ${classification.reason}`);

    routeResult = await route(classification, attachments, messageContext);

    if (routeResult.success) {
      await writeAudit({
        messageContext,
        classification,
        routeResult,
        attachments,
      });
    } else {
      console.log(`[poller] Route failed, skipping audit for this message. Error: ${routeResult.error}`);
      // Still mark as processed? For now, do NOT mark failed ones so they can retry.
      // Per spec: leave out of processedIds on error so next run can retry.
      return 'error';
    }

    // Mark processed + save state only on success
    await markProcessed(state, id, message.receivedDateTime);
    await saveState(state);
  } else {
    // Dry-run: still classify and simulate route so user sees what would happen
    classification = classifyFromMetadata(message, attachments);
    console.log(`[poller] [DRY] Would classify as: ${classification.route} (${classification.confidence}) - ${classification.reason}`);
    console.log(`[poller] [DRY] Would route to skill + write audit + mark processed + save state`);
  }

  console.log(`[poller] ${opts.dryRun ? '[DRY] ' : ''}Materialized + processed to ${inboxDir} (${attachments.length} attachments)`);
  return 'processed';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('=== Inbound Poller (full pipeline) ===');
  if (opts.dryRun) console.log('*** DRY RUN MODE — no state/memory/FHIR changes ***');

  // Load creds + auth
  let pca;
  try {
    pca = await buildPca();
  } catch (err) {
    console.error('buildPca failed:', err.message);
    process.exit(3);
  }

  const client = buildGraphClient(pca);

  // Load state
  const state = await loadState();
  console.log(`Loaded state: ${state.processedIds.length} processed, lastSeen=${state.lastSeenReceivedDateTime || 'none'}`);

  let messages = [];

  if (opts.messageId) {
    console.log(`Fetching single message by ID...`);
    try {
      const msg = await client.api(`/me/messages/${encodeURIComponent(opts.messageId)}`)
        .select('id,subject,from,receivedDateTime,hasAttachments,bodyPreview')
        .get();
      messages = [msg];
    } catch (err) {
      console.error('Failed to fetch specific message:', err.message);
      process.exit(4);
    }
  } else {
    messages = await fetchMessages(client, opts.top);
  }

  console.log(`Fetched ${messages.length} candidate message(s).`);

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process oldest → newest for monotonic checkpoint
  const toProcess = [...messages].reverse();

  for (const msg of toProcess) {
    const received = msg.receivedDateTime;

    if (opts.since && received && received < opts.since) {
      console.log(`[poller] SKIP (older than --since): ${msg.subject}`);
      continue;
    }

    if (!opts.messageId && !opts.force && state.lastSeenReceivedDateTime && received && received <= state.lastSeenReceivedDateTime) {
      skippedCount++;
      continue;
    }

    const result = await processOneMessage(client, msg, state, opts);
    if (result === 'processed') processedCount++;
    else if (result === 'skipped') skippedCount++;
    else if (result === 'error') errorCount++;
  }

  console.log(`\nSummary: fetched=${messages.length}, processed=${processedCount}, skipped=${skippedCount}, errors=${errorCount}`);
  console.log('Poller run complete.');

  if (opts.once) {
    // Exit cleanly for cron / systemd timer
  }
}

main().catch(err => {
  console.error('Unhandled error in poller:', err?.stack ?? err);
  process.exit(1);
});
