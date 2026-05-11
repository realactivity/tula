// auth.mjs — Device-code OAuth against Microsoft Graph with persistent
// token cache. Reads TULA_CLIENT_ID and TULA_TENANT_ID from the environment,
// caches MSAL state under ~/.tula/ so subsequent runs are silent.
//
// First run: prints a code + URL the user opens on any browser.
// Subsequent runs: refreshes silently from the cache (until the refresh
// token expires, typically 90 days of inactivity).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DeviceCodeCredential, useIdentityPlugin } from '@azure/identity';
import { cachePersistencePlugin } from '@azure/identity-cache-persistence';

useIdentityPlugin(cachePersistencePlugin);

const TULA_DIR = path.join(os.homedir(), '.tula');
const CACHE_NAME = 'aria-graph';

// The Graph scopes the smoke test needs. Mail.Send is intentionally NOT
// here — that's a Phase 5 capability. `offline_access` is added by MSAL
// implicitly when a refresh token is wanted; we list it for clarity.
export const GRAPH_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
];

function ensureTulaDir() {
  if (!fs.existsSync(TULA_DIR)) {
    fs.mkdirSync(TULA_DIR, { recursive: true, mode: 0o700 });
  }
  try {
    fs.chmodSync(TULA_DIR, 0o700);
  } catch {
    // Best-effort; on Windows chmod is a no-op.
  }
}

export function buildCredential() {
  const clientId = process.env.TULA_CLIENT_ID;
  const tenantId = process.env.TULA_TENANT_ID;

  if (!clientId) {
    throw new Error(
      'TULA_CLIENT_ID is not set. Export the Entra app Application (client) ID:\n' +
        '  export TULA_CLIENT_ID=<guid-from-entra>'
    );
  }
  if (!tenantId) {
    throw new Error(
      'TULA_TENANT_ID is not set. Export the Entra Directory (tenant) ID:\n' +
        '  export TULA_TENANT_ID=<guid-from-entra>'
    );
  }

  ensureTulaDir();

  return new DeviceCodeCredential({
    clientId,
    tenantId,
    // No GUI / keychain on a headless Ubuntu VM. The cache file lives in
    // ~/.tula/ which is chmod 700 (and the file itself ends up chmod 600
    // via MSAL's defaults). This is the documented headless pattern.
    tokenCachePersistenceOptions: {
      enabled: true,
      name: CACHE_NAME,
      unsafeAllowUnencryptedStorage: true,
    },
    userPromptCallback: (info) => {
      console.log('');
      console.log('  Open this URL in any browser:');
      console.log(`    ${info.verificationUri}`);
      console.log('  Enter this code:');
      console.log(`    ${info.userCode}`);
      console.log(`  (expires in ${info.expiresOn ? new Date(info.expiresOn).toISOString() : 'unknown'})`);
      console.log('');
    },
  });
}

// Triggers the device-code flow if no cached refresh token is usable, or
// silently refreshes if one is.
export async function getAccessToken(credential) {
  const token = await credential.getToken(GRAPH_SCOPES);
  if (!token || !token.token) {
    throw new Error('Failed to acquire access token (credential returned null).');
  }
  return token;
}
