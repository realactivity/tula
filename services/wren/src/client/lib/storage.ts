// OAuth state persistence for cross-origin redirect flow
// Uses sessionStorage (keyed by state nonce, cleared after use)

const OAUTH_KEY_PREFIX = 'health_skillz_oauth_';

export interface OAuthState {
  sessionId: string;
  publicKeyJwk: JsonWebKey | null;
  codeVerifier: string;
  tokenEndpoint: string;
  fhirBaseUrl: string;
  clientId: string;
  redirectUri: string;
  providerName: string;
}

// === OAuth State Storage (keyed by state nonce) ===

export function saveOAuthState(stateNonce: string, oauth: OAuthState): void {
  sessionStorage.setItem(OAUTH_KEY_PREFIX + stateNonce, JSON.stringify(oauth));
}

export function loadOAuthState(stateNonce: string): OAuthState | null {
  const raw = sessionStorage.getItem(OAUTH_KEY_PREFIX + stateNonce);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearOAuthState(stateNonce: string): void {
  sessionStorage.removeItem(OAUTH_KEY_PREFIX + stateNonce);
}

// === Finalize Token Storage (keyed by session ID) ===
// Persists the per-session finalize token so it survives page reloads.

const FINALIZE_TOKEN_PREFIX = 'health_skillz_finalize_';
const SESSION_SELECTION_PREFIX = 'health_skillz_selected_';
const SESSION_ATTEMPT_PREFIX = 'health_skillz_attempt_';

export function saveFinalizeToken(sessionId: string, token: string): void {
  sessionStorage.setItem(FINALIZE_TOKEN_PREFIX + sessionId, token);
}

export function loadFinalizeToken(sessionId: string): string | null {
  return sessionStorage.getItem(FINALIZE_TOKEN_PREFIX + sessionId);
}

export function clearFinalizeToken(sessionId: string): void {
  sessionStorage.removeItem(FINALIZE_TOKEN_PREFIX + sessionId);
}

// === Session-scoped selection persistence ===

export function saveSessionSelection(sessionId: string, connectionIds: string[]): void {
  sessionStorage.setItem(SESSION_SELECTION_PREFIX + sessionId, JSON.stringify(connectionIds));
}

export function loadSessionSelection(sessionId: string): string[] | null {
  const raw = sessionStorage.getItem(SESSION_SELECTION_PREFIX + sessionId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

export function clearSessionSelection(sessionId: string): void {
  sessionStorage.removeItem(SESSION_SELECTION_PREFIX + sessionId);
}

// === Session-scoped upload attempt ID persistence ===

export function saveUploadAttemptId(sessionId: string, attemptId: string): void {
  sessionStorage.setItem(SESSION_ATTEMPT_PREFIX + sessionId, attemptId);
}

export function loadUploadAttemptId(sessionId: string): string | null {
  return sessionStorage.getItem(SESSION_ATTEMPT_PREFIX + sessionId);
}

export function clearUploadAttemptId(sessionId: string): void {
  sessionStorage.removeItem(SESSION_ATTEMPT_PREFIX + sessionId);
}
