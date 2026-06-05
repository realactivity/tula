# Wren

Wren is RealActivity's self-hostable **SMART on FHIR records relay** - the
backend that powers Tula's [`health-records`](../../skills/health-records/)
skill. It runs the patient-portal OAuth flow, receives end-to-end-encrypted
record chunks from the browser, and serves them back to the agent for local
decryption. The server only ever stores ciphertext it cannot read.

Wren is a near-upstream fork of Joshua Mandel's
[`jmandel/health-skillz`](https://github.com/jmandel/health-skillz) (MIT). It
**speaks the same wire protocol**, so the open `health-records` skill points at
a Wren instance with zero code changes - just set `HEALTH_SKILLZ_BASE_URL`.

> **Why Wren exists:** so a Tula deployment can run the records pull on
> infrastructure the operator controls, with their own Epic client
> registration, instead of depending on a third-party hosted relay.

## License

MIT - see [`LICENSE`](LICENSE). This component is **not** under the Tula
repository's Apache-2.0 license; it retains upstream MIT terms. Attribution and
provenance are in [`NOTICE`](NOTICE). The original upstream docs are preserved
as [`UPSTREAM-README.md`](UPSTREAM-README.md) and
[`UPSTREAM-AGENTS.md`](UPSTREAM-AGENTS.md).

## Quick start

```bash
cd services/wren
bun install
cp config.json.example config.local.json
# Edit config.local.json: set server.baseURL and brands[].clientId

bun run setup           # build:brands + build:skill + generate-jwks
mkdir -p static data
ln -snf "$(pwd)/brands" static/brands

CONFIG_PATH=./config.local.json bun run dev
```

Health check: `curl -sS http://localhost:3000/health`

## Configuration

The server reads `CONFIG_PATH` (defaults to `./config.json`). Verify in your
selected config:

1. `server.port`
2. `server.baseURL`
3. `brands[].clientId` - your own Epic (or other SMART) client ID
4. `brands[].redirectURL` (or default `${baseURL}/connect/callback`)

### Your own Epic registration

To pull from real hospitals, Wren needs **your** SMART on FHIR client, not a
borrowed one. Register a patient-facing, USCDI, production-ready app at
<https://fhir.epic.com/Developer/Apps>, set the redirect URI to your Wren
callback, request `patient/*.rs`, and put the issued client ID in your config.
Use **direct JWKS upload (RSA keys only)** at each organization rather than a
JWK Set URL - see `UPSTREAM-README.md` and the upstream Epic notes for the
hard-won details.

## Relationship to Tula

- `services/wren/` (this) - the relay/server (MIT, self-hosted by the operator).
- `skills/health-records/` - the agent-side client skill (MIT) that talks to it.

The two are decoupled over HTTP; the skill targets any reachable relay via
`HEALTH_SKILLZ_BASE_URL`.

## Trademark

"Wren" and "RealActivity" are trademarks of RealActivity. Wren is not
affiliated with, endorsed by, or derived from Epic Systems Corporation.
