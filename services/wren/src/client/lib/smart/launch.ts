/**
 * Shared OAuth launch flow - single code path for both directory-based
 * connect and reconnect from a saved connection.
 *
 * Generates PKCE, builds the authorization URL, persists OAuth state
 * for the callback, and redirects to the EHR's authorize endpoint.
 */

import { buildAuthorizationUrl, generatePKCE } from './oauth';
import { saveOAuthState } from '../storage';

export interface LaunchOAuthParams {
  fhirBaseUrl: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  sessionId: string;
  publicKeyJwk: JsonWebKey | null;
  providerName: string;
}

/**
 * Start the SMART on FHIR OAuth flow.
 * This function does not return - it redirects the browser.
 * Throws if SMART discovery or PKCE generation fails.
 */
export async function launchOAuth(params: LaunchOAuthParams): Promise<never> {
  const {
    fhirBaseUrl,
    clientId,
    scopes,
    redirectUri,
    sessionId,
    publicKeyJwk,
    providerName,
  } = params;

  // Generate PKCE
  const pkce = await generatePKCE();

  // Build authorization URL (sessionId encoded in state for cross-origin recovery)
  const { authUrl, state, tokenEndpoint } = await buildAuthorizationUrl({
    fhirBaseUrl,
    clientId,
    scopes,
    redirectUri,
    pkce,
    sessionId,
  });

  // Save OAuth state keyed by state nonce (survives cross-origin redirect)
  saveOAuthState(state, {
    sessionId,
    publicKeyJwk,
    codeVerifier: pkce.codeVerifier,
    tokenEndpoint,
    fhirBaseUrl,
    clientId,
    redirectUri,
    providerName,
  });

  // Redirect to authorization server
  window.location.href = authUrl;

  // Never resolves - browser is navigating away
  return new Promise(() => {});
}
