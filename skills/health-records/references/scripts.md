# Scripts

## `check-backend.mjs`

Pre-flight connectivity check before starting a SMART session.

### Invocation

```bash
node {baseDir}/scripts/check-backend.mjs
```

Checks:

- `GET /health`
- `GET /api/vendors`

Output:

```json
{
  "baseUrl": "https://example",
  "health": { "ok": true, "status": 200 },
  "vendors": { "ok": true, "status": 200, "count": 5 }
}
```

Returns non-zero if either endpoint fails.

## `create-session.mjs`

Generates an ECDH P-256 keypair locally and registers a session with the
health-skillz backend.

### Invocation

```bash
node {baseDir}/scripts/create-session.mjs
```

No positional args. Honors `HEALTH_SKILLZ_BASE_URL` if set; defaults to
`https://health-skillz.joshuamandel.com`.

### Output (single JSON object on stdout)

```json
{
  "sessionId": "abc123...",
  "userUrl":   "https://health-skillz.joshuamandel.com/connect/abc123...",
  "pollUrl":   "https://health-skillz.joshuamandel.com/api/poll/abc123...",
  "privateKeyJwk": { "kty": "EC", "crv": "P-256", "d": "...", "x": "...", "y": "..." }
}
```

### What to keep

- **`sessionId`** - needed for `finalize-session.mjs`.
- **`privateKeyJwk`** - needed for decryption. Keep it in agent memory for the
  session; never write it to a memory file, never echo it back to Paul.
- **`userUrl`** - show to Paul as a single clickable link.

## `finalize-session.mjs`

Polls the backend until ready, then downloads, decrypts, and decompresses
records into one JSON file per provider.

### Invocation

```bash
node {baseDir}/scripts/finalize-session.mjs <sessionId> '<privateKeyJwk>' <outputDir> [options]
```

Quote the JWK - it contains `{}` and quotes that the shell will mangle.

### Options

| Flag | Default | Purpose |
|---|---|---|
| `--prefetch-chunks <n>` | 8 | In-flight chunk downloads. Bump to 16 on a fast link if memory allows. |
| `--max-attempts <n>` | 60 | Poll attempts before timeout (~30 min at 30s long-poll). |
| `--poll-timeout-seconds <n>` | 30 | Long-poll timeout per request. Lower = chattier; higher = gentler. |
| `--spool-dir <path>` | `<outputDir>/.spool` | Temp dir for encrypted chunks. Auto-cleaned. |
| `--instrument` | off | Emit per-stage memory/progress NDJSON. Use when debugging. |

Env: `FINALIZE_INSTRUMENT=1` is equivalent to `--instrument`.
Env: `HEALTH_SKILLZ_BASE_URL` overrides the backend.

### Output (NDJSON to stdout)

```
{"status":"polling","sessionId":"..."}
{"status":"waiting","sessionStatus":"collecting","providerCount":1,"attempt":1}
{"status":"ready","providerCount":2,"attempts":7}
{"status":"decrypting","providerCount":2,"prefetchChunks":8}
{"status":"wrote_file","file":"./out/unitypoint-health.json","provider":"UnityPoint Health","bytes":3142918,"chunks":42,"elapsedMs":2103.7}
{"status":"wrote_file","file":"./out/mayo-clinic.json","provider":"Mayo Clinic","bytes":1247330,"chunks":18,"elapsedMs":912.4}
{"status":"done","files":["./out/unitypoint-health.json","./out/mayo-clinic.json"],"elapsedMs":3072.1}
```

Read line-by-line; the agent can show progress to Paul off the `waiting`
lines and stop once `status: done` is seen.

### Per-provider JSON file shape

See [`fhir-guide.md`](fhir-guide.md). One file per provider, each with:

```ts
{
  name: string,
  fhirBaseUrl: string,
  connectedAt: string,        // ISO timestamp
  fhir: { Patient: [...], Condition: [...], Observation: [...], ... },
  attachments: [ ... ]        // grouped by source DocumentReference / DiagnosticReport
}
```

### Filename slugging

Output filenames come from the provider's display name:

- `"UnityPoint Health"` → `unitypoint-health.json`
- `"Mayo Clinic"` → `mayo-clinic.json`
- Collisions (two providers with same name) get `-2`, `-3` suffixes.
- Empty/missing name falls back to `provider-N.json`.

### Exit codes

- `0` - success, all providers written.
- `1` - bad args, network failure, decryption failure, or timeout.

Errors print as JSON on stderr (`{"error": "..."}`).
