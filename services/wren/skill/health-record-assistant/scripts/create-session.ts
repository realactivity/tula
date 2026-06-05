#!/usr/bin/env bun
// Create a new health record session with E2E encryption keypair

const BASE_URL = '{{BASE_URL}}';

const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveBits', 'deriveKey']
);

const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

const res = await fetch(`${BASE_URL}/api/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ publicKey: publicKeyJwk })
});

if (!res.ok) {
  console.error(JSON.stringify({ error: `Failed to create session: ${res.status}` }));
  process.exit(1);
}

const { sessionId, userUrl, pollUrl } = await res.json();

console.log(JSON.stringify({
  sessionId,
  userUrl,
  pollUrl,
  privateKeyJwk
}, null, 2));
