// graph-client.mjs — Single, correct Graph client builder.
// MANDATORY: Use Client.initWithMiddleware (not Client.init).
// This is the ONLY place the client should be constructed for inbound.
//
// See smoke-test.mjs for the exact working pattern that survived live testing.

import { Client } from '@microsoft/microsoft-graph-client';
import { buildPca, getAccessToken } from './auth.mjs';

/**
 * Build a Microsoft Graph client using the proven initWithMiddleware pattern.
 * @param {object} pca - MSAL PublicClientApplication from buildPca()
 * @returns {import('@microsoft/microsoft-graph-client').Client}
 */
export function buildGraphClient(pca) {
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const result = await getAccessToken(pca);
        return result.accessToken;
      },
    },
    defaultVersion: 'v1.0',
  });
}
