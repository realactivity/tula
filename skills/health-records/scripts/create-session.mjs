#!/usr/bin/env node
/**
 * create-session.mjs
 *
 * Step 1 of the health-records skill: create an end-to-end-encrypted
 * SMART-on-FHIR session against the health-skillz backend.
 *
 * What this script does:
 *   1. Generates a fresh ECDH P-256 keypair *locally* in this Node process.
 *      The PRIVATE key never leaves this VM.
 *   2. Sends only the PUBLIC key to the backend at $BASE_URL/api/session.
 *   3. Backend returns a sessionId + a userUrl (which Paul opens in a browser
 *      to log in to his patient portal via SMART OAuth).
 *   4. We print the sessionId, userUrl, and privateKeyJwk to stdout as JSON.
 *
 * Why this design (E2E crypto):
 *   The backend collects FHIR data from Paul's patient portal on its server,
 *   then encrypts it under the PUBLIC key we sent it. Only the holder of the
 *   matching PRIVATE key (us, on this VM) can decrypt it. The backend
 *   operator cannot read Paul's records, even if compromised.
 *
 * Output (JSON to stdout):
 *   {
 *     "sessionId":     "abc123...",                       // pass to finalize-session
 *     "userUrl":       "https://.../connect/abc123...",   // show this link to Paul
 *     "pollUrl":       "https://.../api/poll/abc123...",  // diagnostic only
 *     "privateKeyJwk": { "kty": "EC", ... }               // SAVE THIS — needed to decrypt
 *   }
 *
 * Errors go to stderr; exit code 1 on failure.
 *
 * Ported from Joshua Mandel's TypeScript original (bun) to Node ESM.
 * Requires Node 18+ for the global `fetch` and Web Crypto API.
 */

// Backend base URL. Override via $HEALTH_SKILLZ_BASE_URL if Paul ever wants to
// point at a self-hosted instance.
const BASE_URL = process.env.HEALTH_SKILLZ_BASE_URL || 'https://health-skillz.joshuamandel.com';

async function main() {
  // ── 1. Generate ECDH keypair locally ────────────────────────────────────
  // P-256 is the curve mandated by the health-skillz protocol. extractable=true
  // because we need to serialize the private key out to disk (or stdout) so
  // the finalize step can re-import it.
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,                          // extractable
    ['deriveBits', 'deriveKey']    // we'll derive a shared secret on decrypt
  );

  // Export both halves as JWK. We only SEND the public half.
  const publicKeyJwk  = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  // ── 2. POST the public key to create a server-side session ──────────────
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: publicKeyJwk }),
    });
  } catch (err) {
    console.error(JSON.stringify({ error: `Network error talking to ${BASE_URL}: ${err.message}` }));
    process.exit(1);
  }

  if (!res.ok) {
    console.error(JSON.stringify({ error: `Failed to create session: HTTP ${res.status}` }));
    process.exit(1);
  }

  const { sessionId, userUrl, pollUrl } = await res.json();

  // ── 3. Emit everything the caller needs as a single JSON object ─────────
  // The agent reads this, saves privateKeyJwk for later, and shows userUrl
  // to Paul. The pollUrl is included for debugging; finalize-session.mjs
  // computes its own poll URL from sessionId.
  console.log(JSON.stringify({ sessionId, userUrl, pollUrl, privateKeyJwk }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
