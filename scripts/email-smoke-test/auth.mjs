// auth.mjs — Device-code OAuth against Microsoft Graph using msal-node
// directly with a chmod-600 file cache. No native deps, no keychain
// daemon, no libsecret. Works on a headless Ubuntu VM out of the box.
//
// Reads TULA_CLIENT_ID and TULA_TENANT_ID from the environment. First
// run triggers a device-code prompt; subsequent runs refresh silently
// from ~/.tula/msal-cache.json until the refresh token expires
// (typically 90 days of inactivity).

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PublicClientApplication, LogLevel } from '@azure/msal-node';

const TULA_DIR = path.join(os.homedir(), '.tula');
const CACHE_PATH = path.join(TULA_DIR, 'msal-cache.json');

// Graph scopes the smoke test needs. Mail.Send is intentionally NOT here
// (Phase 5). offline_access is what unlocks refresh tokens.
export const GRAPH_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
];

async function ensureTulaDir() {
  await fs.mkdir(TULA_DIR, { recursive: true, mode: 0o700 });
  try {
    await fs.chmod(TULA_DIR, 0o700);
  } catch {
    // Best-effort; chmod is a no-op on Windows.
  }
}

// MSAL ICachePlugin implementation that reads/writes a single JSON file.
// MSAL hands us a "tokenCache" object whose serialize()/deserialize()
// methods do the heavy lifting; we just persist the bytes.
const filePersistencePlugin = {
  beforeCacheAccess: async (cacheContext) => {
    if (existsSync(CACHE_PATH)) {
      const data = await fs.readFile(CACHE_PATH, 'utf-8');
      cacheContext.tokenCache.deserialize(data);
    }
  },
  afterCacheAccess: async (cacheContext) => {
    if (cacheContext.cacheHasChanged) {
      await ensureTulaDir();
      await fs.writeFile(CACHE_PATH, cacheContext.tokenCache.serialize(), {
        mode: 0o600,
      });
    }
  },
};

export async function buildPca() {
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

  await ensureTulaDir();

  return new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    cache: {
      cachePlugin: filePersistencePlugin,
    },
    system: {
      loggerOptions: {
        loggerCallback: () => {},
        piiLoggingEnabled: false,
        logLevel: LogLevel.Warning,
      },
    },
  });
}

// Acquire an access token. Tries silent refresh first; falls back to
// device-code flow if no usable cached account exists.
export async function getAccessToken(pca) {
  const tokenCache = pca.getTokenCache();
  const accounts = await tokenCache.getAllAccounts();

  if (accounts.length > 0) {
    try {
      const result = await pca.acquireTokenSilent({
        account: accounts[0],
        scopes: GRAPH_SCOPES,
      });
      if (result?.accessToken) return result;
    } catch {
      // Silent refresh failed (token expired beyond refresh, account
      // revoked, etc.). Fall through to device-code flow.
    }
  }

  const result = await pca.acquireTokenByDeviceCode({
    scopes: GRAPH_SCOPES,
    deviceCodeCallback: (info) => {
      const expires = new Date(Date.now() + info.expiresIn * 1000).toISOString();
      console.log('');
      console.log('  Open this URL in any browser:');
      console.log(`    ${info.verificationUri}`);
      console.log('  Enter this code:');
      console.log(`    ${info.userCode}`);
      console.log(`  (expires at ${expires})`);
      console.log('');
    },
  });

  if (!result?.accessToken) {
    throw new Error('Device code flow returned no access token.');
  }
  return result;
}
