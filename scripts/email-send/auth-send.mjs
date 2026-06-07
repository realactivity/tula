// auth-send.mjs — Separate MSAL client for Mail.Send only.
// MUST use a different Entra app registration than the inbound router.
// Token cache lives at ~/.tula/msal-send-cache.json (never mix with inbound cache).

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PublicClientApplication, LogLevel } from '@azure/msal-node';

const TULA_DIR = path.join(os.homedir(), '.tula');
const CACHE_PATH = path.join(TULA_DIR, 'msal-send-cache.json');

export const SEND_GRAPH_SCOPES = [
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
];

async function ensureTulaDir() {
  await fs.mkdir(TULA_DIR, { recursive: true, mode: 0o700 });
  try { await fs.chmod(TULA_DIR, 0o700); } catch {}
}

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
      await fs.writeFile(CACHE_PATH, cacheContext.tokenCache.serialize(), { mode: 0o600 });
    }
  },
};

export async function buildPcaForSend() {
  const clientId = process.env.TULA_SEND_CLIENT_ID;
  const tenantId = process.env.TULA_SEND_TENANT_ID;

  if (!clientId) throw new Error('TULA_SEND_CLIENT_ID is required (separate Entra app for Mail.Send).');
  if (!tenantId) throw new Error('TULA_SEND_TENANT_ID is required.');

  await ensureTulaDir();

  return new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    cache: { cachePlugin: filePersistencePlugin },
    system: {
      loggerOptions: { loggerCallback: () => {}, piiLoggingEnabled: false, logLevel: LogLevel.Warning },
    },
  });
}

export async function getSendToken(pca) {
  const tokenCache = pca.getTokenCache();
  const accounts = await tokenCache.getAllAccounts();

  if (accounts.length > 0) {
    try {
      const result = await pca.acquireTokenSilent({ account: accounts[0], scopes: SEND_GRAPH_SCOPES });
      if (result?.accessToken) return result;
    } catch {}
  }

  const result = await pca.acquireTokenByDeviceCode({
    scopes: SEND_GRAPH_SCOPES,
    deviceCodeCallback: (info) => {
      const expires = new Date(Date.now() + info.expiresIn * 1000).toISOString();
      console.log('\n  [SEND] Open this URL:', info.verificationUri);
      console.log('  [SEND] Enter code:', info.userCode, `(expires ${expires})\n`);
    },
  });

  if (!result?.accessToken) throw new Error('Device code flow returned no access token for send app.');
  return result;
}