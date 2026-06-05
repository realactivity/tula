#!/usr/bin/env bun
/**
 * Generate key pairs for signing OAuth client assertions.
 * Writes:
 *   data/jwks.json       - public-only JWKS (served at .well-known/jwks.json)
 *   data/jwks-intentionally-publishing-private-keys-which-are-not-sensitive-in-this-architecture.json
 *                         - full JWKS including private parameters
 *
 * The private keys are NOT secret for this use case: they ship to end-user
 * browsers that sign client_assertion JWTs for confidential-client OAuth.
 *
 * Keys generated:
 *   - EC P-384  (alg: ES384)
 *   - RSA 2048  (alg: RS256)
 *   - RSA 2048  (alg: RS384)
 */
import { generateKeyPairSync, randomUUID } from "crypto";
import { mkdirSync, writeFileSync, existsSync } from "fs";

const outDir = "./data";
const pubPath = `${outDir}/jwks.json`;
const fullPath = `${outDir}/jwks-intentionally-publishing-private-keys-which-are-not-sensitive-in-this-architecture.json`;

if (existsSync(fullPath)) {
  console.log(`${fullPath} already exists - skipping generation.`);
  console.log("Delete it first if you want to rotate keys.");
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });

// --- EC P-384 key (ES384) ---
const ec = generateKeyPairSync("ec", { namedCurve: "P-384" });
const ecKid = randomUUID();

const ecPrivJwk = {
  ...ec.privateKey.export({ format: "jwk" }),
  kid: ecKid,
  alg: "ES384",
  use: "sig",
  key_ops: ["sign"],
};

const ecPubJwk = { ...ecPrivJwk };
delete (ecPubJwk as any).d;
ecPubJwk.key_ops = ["verify"];

// --- RSA 2048 key (RS256) ---
const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const rsaKid = randomUUID();

const rsaPrivJwk = {
  ...rsa.privateKey.export({ format: "jwk" }),
  kid: rsaKid,
  alg: "RS256",
  use: "sig",
  key_ops: ["sign"],
};

const rsaPubJwk = { ...rsaPrivJwk };
// Strip private RSA components
for (const k of ["d", "p", "q", "dp", "dq", "qi"]) {
  delete (rsaPubJwk as any)[k];
}
rsaPubJwk.key_ops = ["verify"];

// --- RSA 2048 key (RS384) ---
const rsa384 = generateKeyPairSync("rsa", { modulusLength: 2048 });
const rsa384Kid = randomUUID();

const rsa384PrivJwk = {
  ...rsa384.privateKey.export({ format: "jwk" }),
  kid: rsa384Kid,
  alg: "RS384",
  use: "sig",
  key_ops: ["sign"],
};

const rsa384PubJwk = { ...rsa384PrivJwk };
for (const k of ["d", "p", "q", "dp", "dq", "qi"]) {
  delete (rsa384PubJwk as any)[k];
}
rsa384PubJwk.key_ops = ["verify"];

// --- Write JWKS ---
const fullJwks = { keys: [ecPrivJwk, rsaPrivJwk, rsa384PrivJwk] };
const pubJwks = { keys: [ecPubJwk, rsaPubJwk, rsa384PubJwk] };

writeFileSync(pubPath, JSON.stringify(pubJwks, null, 2) + "\n");
writeFileSync(fullPath, JSON.stringify(fullJwks, null, 2) + "\n");

console.log(`Generated EC P-384 key pair   (kid: ${ecKid})`);
console.log(`Generated RSA 2048 RS256 key  (kid: ${rsaKid})`);
console.log(`Generated RSA 2048 RS384 key  (kid: ${rsa384Kid})`);
console.log(`  Full (with private keys): ${fullPath}`);
console.log(`  Public only:              ${pubPath}`);
