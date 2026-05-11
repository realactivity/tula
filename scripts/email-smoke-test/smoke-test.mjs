#!/usr/bin/env node
// smoke-test.mjs — Phase 1 smoke test for the email-router.
//
// Usage:
//   TULA_CLIENT_ID=<guid> TULA_TENANT_ID=<guid> node smoke-test.mjs [--auth-only] [--top N]
//
// Authenticates against Microsoft Graph via device-code flow (silent on
// second run thanks to the MSAL cache under ~/.tula/), then lists the N
// most recent messages in aria@realactivity.com's INBOX. Prints subject,
// sender, and received timestamp.
//
// Exit codes:
//   0 — success
//   2 — bad CLI args
//   3 — missing env vars
//   4 — Graph call failed

import { Client } from '@microsoft/microsoft-graph-client';
import { buildCredential, getAccessToken, GRAPH_SCOPES } from './auth.mjs';

function parseArgs(argv) {
  const opts = { authOnly: false, top: 5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--auth-only') opts.authOnly = true;
    else if (a === '--top') {
      const next = argv[i + 1];
      const n = parseInt(next, 10);
      if (!Number.isFinite(n) || n < 1 || n > 50) {
        console.error('--top expects an integer between 1 and 50');
        process.exit(2);
      }
      opts.top = n;
      i++;
    } else if (a === '-h' || a === '--help') {
      console.log('Usage: node smoke-test.mjs [--auth-only] [--top N]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

function buildGraphClient(credential) {
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await getAccessToken(credential);
        return token.token;
      },
    },
    defaultVersion: 'v1.0',
  });
}

function formatRow({ subject, from, receivedDateTime }) {
  const fromAddr = from?.emailAddress?.address ?? '(unknown)';
  const fromName = from?.emailAddress?.name ?? '';
  const when = receivedDateTime ?? '(no timestamp)';
  const subj = subject ?? '(no subject)';
  return `  ${when}  ${fromName ? `${fromName} <${fromAddr}>` : fromAddr}\n    ${subj}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let credential;
  try {
    credential = buildCredential();
  } catch (err) {
    console.error(err.message);
    process.exit(3);
  }

  console.log('Acquiring access token for Microsoft Graph...');
  console.log(`  Scopes: ${GRAPH_SCOPES.join(', ')}`);

  let token;
  try {
    token = await getAccessToken(credential);
  } catch (err) {
    console.error('Auth failed:', err.message ?? err);
    process.exit(4);
  }

  const expiresOn = token.expiresOnTimestamp
    ? new Date(token.expiresOnTimestamp).toISOString()
    : 'unknown';
  console.log(`Token acquired. Expires at ${expiresOn}.`);

  if (opts.authOnly) {
    console.log('--auth-only: skipping Graph call.');
    return;
  }

  const client = buildGraphClient(credential);

  console.log('\nFetching identity (/me)...');
  let me;
  try {
    me = await client.api('/me').select('displayName,userPrincipalName,mail').get();
  } catch (err) {
    console.error('Graph /me call failed:', err.message ?? err);
    process.exit(4);
  }
  console.log(`  Signed in as: ${me.displayName} <${me.mail ?? me.userPrincipalName}>`);

  console.log(`\nFetching ${opts.top} most recent messages from INBOX...`);
  let messages;
  try {
    messages = await client
      .api('/me/mailFolders/Inbox/messages')
      .top(opts.top)
      .select('subject,from,receivedDateTime')
      .orderby('receivedDateTime DESC')
      .get();
  } catch (err) {
    console.error('Graph /me/mailFolders/Inbox/messages call failed:', err.message ?? err);
    process.exit(4);
  }

  const items = messages.value ?? [];
  if (items.length === 0) {
    console.log('  (inbox is empty)');
    return;
  }

  console.log('');
  for (const msg of items) {
    console.log(formatRow(msg));
  }
  console.log(`\nOK — ${items.length} message(s) listed.`);
}

main().catch((err) => {
  console.error('Unhandled error:', err?.stack ?? err);
  process.exit(1);
});
