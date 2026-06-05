/**
 * Client assertion (private_key_jwt) for confidential client OAuth.
 *
 * The private key is intentionally public - it ships to every browser.
 * Security comes from PKCE + per-user refresh tokens, not the key.
 * The key just satisfies Epic's "confidential client" checkbox so
 * they'll issue refresh tokens.
 */

const PRIVATE_JWKS_PATH =
  '/.well-known/jwks-intentionally-publishing-private-keys-which-are-not-sensitive-in-this-architecture.json';

interface JWKSResponse {
  keys: JsonWebKey[];
}

interface SigningKeyInfo {
  key: CryptoKey;
  kid: string;
  alg: string;
}

// Cache the imported signing key
let cachedSigningKey: SigningKeyInfo | null = null;

// Map JWA alg to WebCrypto import/sign params
const algMap: Record<string, { import: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams; sign: AlgorithmIdentifier | RsaPssParams | EcdsaParams }> = {
  RS256: {
    import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    sign: { name: 'RSASSA-PKCS1-v1_5' },
  },
  RS384: {
    import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
    sign: { name: 'RSASSA-PKCS1-v1_5' },
  },
  ES256: {
    import: { name: 'ECDSA', namedCurve: 'P-256' },
    sign: { name: 'ECDSA', hash: 'SHA-256' },
  },
  ES384: {
    import: { name: 'ECDSA', namedCurve: 'P-384' },
    sign: { name: 'ECDSA', hash: 'SHA-384' },
  },
  ES512: {
    import: { name: 'ECDSA', namedCurve: 'P-521' },
    sign: { name: 'ECDSA', hash: 'SHA-512' },
  },
};

/**
 * Fetch the private JWKS and import the first signing key into WebCrypto.
 * Keys are sorted RS* first in the JWKS, so the first key is preferred.
 * Cached after first call.
 */
async function getSigningKey(): Promise<SigningKeyInfo> {
  if (cachedSigningKey) return cachedSigningKey;

  const resp = await fetch(PRIVATE_JWKS_PATH);
  if (!resp.ok) {
    throw new Error(`Failed to fetch private JWKS: ${resp.status}`);
  }
  const jwks: JWKSResponse = await resp.json();
  const jwk = jwks.keys[0];
  if (!jwk) throw new Error('No keys in private JWKS');

  const kid = (jwk as any).kid as string;
  const alg = (jwk as any).alg as string;

  const params = algMap[alg];
  if (!params) throw new Error(`Unsupported algorithm: ${alg}`);

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    params.import,
    false,
    ['sign']
  );

  cachedSigningKey = { key, kid, alg };
  return cachedSigningKey;
}

/**
 * Create a signed JWT client_assertion for the given token endpoint.
 *
 * JWT claims per SMART spec:
 *   iss = sub = clientId
 *   aud = tokenEndpoint
 *   jti = random unique id
 *   iat, nbf = now
 *   exp = now + 5 min
 */
export async function createClientAssertion(
  clientId: string,
  tokenEndpoint: string
): Promise<string> {
  const { key, kid, alg } = await getSigningKey();

  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();

  const header = { alg, typ: 'JWT', kid };

  const payload = {
    iss: clientId,
    sub: clientId,
    aud: tokenEndpoint,
    jti,
    iat: now,
    nbf: now,
    exp: now + 300, // 5 minutes
  };

  const headerB64 = base64UrlEncodeJSON(header);
  const payloadB64 = base64UrlEncodeJSON(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const params = algMap[alg];
  const signature = await crypto.subtle.sign(
    params.sign,
    key,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64 = base64UrlEncodeBytes(new Uint8Array(signature));
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function base64UrlEncodeJSON(obj: unknown): string {
  const json = JSON.stringify(obj);
  return base64UrlEncodeBytes(new TextEncoder().encode(json));
}

function base64UrlEncodeBytes(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
