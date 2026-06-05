// SMART on FHIR OAuth implementation with PKCE + confidential client (private_key_jwt)

export interface PKCE {
  codeVerifier: string;
  codeChallenge: string;
}

export interface SMARTConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  capabilities?: string[];
}

export interface BuildAuthUrlParams {
  fhirBaseUrl: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  pkce: PKCE;
  sessionId?: string; // Include in state for cross-origin redirect recovery
}

export interface BuildAuthUrlResult {
  authUrl: string;
  state: string;
  tokenEndpoint: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  patient?: string; // Patient ID
  id_token?: string;
  refresh_token?: string; // Returned when offline_access scope is granted
}

/**
 * Generate PKCE code verifier and challenge.
 * Uses S256 method (SHA-256 hash, base64url encoded).
 */
export async function generatePKCE(): Promise<PKCE> {
  // Generate random code verifier (43-128 chars)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64UrlEncode(array);

  // Generate code challenge (SHA-256 hash of verifier)
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = base64UrlEncode(new Uint8Array(hash));

  return { codeVerifier, codeChallenge };
}

/**
 * Generate a random state parameter.
 * Optionally prefix with sessionId for recovery after cross-origin redirects.
 */
export function generateState(sessionId?: string): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const random = base64UrlEncode(array);
  // Encode sessionId in state so we can recover it after redirect
  // Format: sessionId.randomState
  return sessionId ? `${sessionId}.${random}` : random;
}

/**
 * Parse session ID from state parameter.
 */
export function parseSessionFromState(state: string): { sessionId: string | null; nonce: string } {
  const dotIndex = state.indexOf('.');
  if (dotIndex > 0) {
    return {
      sessionId: state.substring(0, dotIndex),
      nonce: state.substring(dotIndex + 1),
    };
  }
  return { sessionId: null, nonce: state };
}

/**
 * Fetch SMART configuration from the FHIR server.
 */
export async function fetchSMARTConfiguration(
  fhirBaseUrl: string
): Promise<SMARTConfiguration> {
  // Normalize base URL
  const base = fhirBaseUrl.replace(/\/+$/, '');

  // Try .well-known/smart-configuration first
  try {
    const response = await fetch(`${base}/.well-known/smart-configuration`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Fall through to capability statement
  }

  // Fall back to capability statement
  const capResponse = await fetch(`${base}/metadata`, {
    headers: { Accept: 'application/fhir+json' },
  });

  if (!capResponse.ok) {
    throw new Error(`Failed to fetch SMART configuration: ${capResponse.status}`);
  }

  const cap = await capResponse.json();

  // Extract OAuth endpoints from capability statement
  const rest = cap.rest?.[0];
  const security = rest?.security;
  const oauth = security?.extension?.find(
    (e: any) => e.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris'
  );

  if (!oauth) {
    throw new Error('SMART OAuth configuration not found in capability statement');
  }

  const authEndpoint = oauth.extension?.find((e: any) => e.url === 'authorize')?.valueUri;
  const tokenEndpoint = oauth.extension?.find((e: any) => e.url === 'token')?.valueUri;

  if (!authEndpoint || !tokenEndpoint) {
    throw new Error('Missing OAuth endpoints in capability statement');
  }

  return {
    authorization_endpoint: authEndpoint,
    token_endpoint: tokenEndpoint,
  };
}

/**
 * Build the authorization URL for SMART on FHIR.
 */
export async function buildAuthorizationUrl(
  params: BuildAuthUrlParams
): Promise<BuildAuthUrlResult> {
  const { fhirBaseUrl, clientId, scopes, redirectUri, pkce, sessionId } = params;

  // Fetch SMART configuration
  const config = await fetchSMARTConfiguration(fhirBaseUrl);

  // Generate state (includes sessionId for cross-origin redirect recovery)
  const state = generateState(sessionId);

  // Append offline_access + launch/patient to resource scopes
  // offline_access triggers refresh token issuance for confidential clients
  const allScopes = ensureScopes(scopes, ['offline_access', 'launch/patient']);

  // Build authorization URL
  const authUrl = new URL(config.authorization_endpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', allScopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('aud', fhirBaseUrl);
  authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return {
    authUrl: authUrl.toString(),
    state,
    tokenEndpoint: config.token_endpoint,
  };
}

/**
 * Exchange authorization code for access token.
 * Uses private_key_jwt client authentication to get refresh tokens.
 */
export async function exchangeCodeForToken(
  code: string,
  tokenEndpoint: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const { createClientAssertion } = await import('./client-assertion');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
  });

  // Sign a JWT client assertion - this is what makes us a "confidential" client
  const assertion = await createClientAssertion(clientId, tokenEndpoint);
  body.set('client_assertion', assertion);

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${text}`);
  }

  return await response.json();
}

/**
 * Use a refresh token to get a new access token.
 * Returns the full token response - caller MUST save any new refresh_token
 * (Epic uses rolling refresh tokens, old one is invalidated).
 */
export async function refreshAccessToken(
  tokenEndpoint: string,
  clientId: string,
  refreshToken: string
): Promise<TokenResponse> {
  const { createClientAssertion } = await import('./client-assertion');

  const assertion = await createClientAssertion(clientId, tokenEndpoint);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${text}`);
  }

  return await response.json();
}

/**
 * Ensure specific scopes are included in the scope string.
 */
function ensureScopes(scopes: string, required: string[]): string {
  const existing = new Set(scopes.split(/\s+/).filter(Boolean));
  for (const s of required) {
    existing.add(s);
  }
  return Array.from(existing).join(' ');
}

/**
 * Base64url encode a Uint8Array.
 */
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
