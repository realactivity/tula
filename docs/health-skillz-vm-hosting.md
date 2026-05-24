# health-skillz on OpenClaw VM

Run Joshua Mandel's `health-skillz` REST layer directly on the same VM that
runs OpenClaw, and point Tula's `health-records` skill to your local hosted
endpoint.

This is the fastest path to VM-local endpoint ownership without rewriting the
FHIR OAuth/session protocol.

## Deployment model

- OpenClaw keeps running as-is under systemd.
- `health-skillz` runs as a sibling systemd service on the same VM.
- Access should stay private-first (Tailscale preferred).
- Tula skill scripts use `HEALTH_SKILLZ_BASE_URL` to target your endpoint.

## 0) Preflight

Run on the VM:

```bash
cd ~/tula
chmod +x scripts/health-skillz-vm-preflight.sh
BASE_URL="https://<your-tailnet-or-private-hostname>" scripts/health-skillz-vm-preflight.sh
```

Checks:

- Node/Bun/zip/git/systemd availability
- port availability
- Tailscale presence/status (if installed)
- `BASE_URL` sanity

## 1) Install and start service

Run on the VM:

```bash
cd ~/tula
chmod +x scripts/install-health-skillz-vm.sh
BASE_URL="https://<your-hostname>" \
CLIENT_ID="<epic-client-id>" \
scripts/install-health-skillz-vm.sh
```

The installer:

- clones/pulls `jmandel/health-skillz` into `~/health-skillz`
- runs `bun install`, `build:brands`, and JWKS generation
- writes `config.openclaw.json`
- creates `/etc/systemd/system/health-skillz.service`
- enables and starts the service
- performs local `/health` check

## 2) OAuth and callback registration

For Epic SMART app registration, set values that exactly match your host:

- Redirect URI: `https://<your-hostname>/connect/callback`
- JWKS URL: `https://<your-hostname>/.well-known/jwks.json`

If these do not match runtime config, OAuth will fail.

## 3) Wire Tula to local endpoint

For one-off shell sessions:

```bash
export HEALTH_SKILLZ_BASE_URL="https://<your-hostname>"
```

For persistent daemon-level config (recommended), use:

```bash
cd ~/tula
chmod +x scripts/set-openclaw-health-skillz-env.sh
scripts/set-openclaw-health-skillz-env.sh "https://<your-hostname>"
```

This sets a systemd drop-in override so `HEALTH_SKILLZ_BASE_URL` survives
OpenClaw restarts and VM reboots.

Tula scripts already honor this variable:

- [`skills/health-records/scripts/create-session.mjs`](../skills/health-records/scripts/create-session.mjs)
- [`skills/health-records/scripts/finalize-session.mjs`](../skills/health-records/scripts/finalize-session.mjs)

## 4) Security hardening

- Keep service private-first with Tailscale.
- Keep VM public inbound limited to SSH (and tunnel/VPN architecture).
- Do not expose `health-skillz` directly on public interface unless you have
  explicit reverse-proxy and access controls in place.
- Monitor service logs:

```bash
journalctl -u health-skillz --since '1 hour ago'
```

See also:

- [`security-model.md`](security-model.md)
- [`deployment-guide.md`](deployment-guide.md)

## 5) Acceptance gates

Use these checks before declaring go-live:

```bash
curl -fsS "http://127.0.0.1:8000/health"
curl -fsS "http://127.0.0.1:8000/api/vendors"
```

Functional checks:

1. create session succeeds and returns `sessionId` + `userUrl`
2. OAuth callback completes in browser
3. finalize session writes decryptable per-provider JSON files
4. no direct public exposure of REST service ports

## Rollback

If local backend fails, switch Tula back to hosted default:

```bash
unset HEALTH_SKILLZ_BASE_URL
```

Then restart OpenClaw if the variable was set in daemon env.

## Optional next step: incremental endpoint porting into Tula

After stable VM operations, start by porting low-risk read endpoints in
`apps/agent-studio`:

- health probe endpoint
- vendors passthrough/read endpoint

Keep OAuth-heavy and chunk/session flows on the proven `health-skillz` server
until parity tests pass.
