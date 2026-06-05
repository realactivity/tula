# Agent Notes for health-skillz

## Purpose

This file documents **general** runbook guidance for running and debugging this project across environments.

## Configuration Discipline

Always be explicit about config selection.

- The server reads `CONFIG_PATH` (defaults to `./config.json` if omitted).
- Different config files may point at different base URLs and OAuth client IDs.
- Do not assume defaults are safe for your current environment.

Typical startup pattern:

```bash
CONFIG_PATH=./config.<env>.json bun run start
```

Before starting, verify these fields in the selected config:

- `server.port`
- `server.baseURL`
- `brands[].clientId`
- `brands[].redirectURL` (or rely on server default to `${baseURL}/connect/callback`)

## Running the Server

Development:

```bash
CONFIG_PATH=./config.<env>.json bun run dev
```

Production-style local run:

```bash
CONFIG_PATH=./config.<env>.json bun run start
```

Health check:

```bash
curl -sS http://localhost:<port>/health
```

## Provider Directory Assets (`/static/brands/...`)

`/records/add` depends on vendor brand files being reachable at the paths returned by `/api/vendors` (usually under `/static/brands/`).

You can satisfy this in either way:

1. Generate brand files in `./brands`:

```bash
bun run build:brands
```

2. Make them available to static routing:

Option A: If files already exist in `./brands`, symlink for convenience:

```bash
mkdir -p static
ln -snf "$(pwd)/brands" static/brands
```

Option B: Copy files directly into `./static/brands`.

Either approach is fine; symlink is convenience, not a requirement.

## Quick Diagnostics for "Failed to fetch" on `/records/add`

1. Check server is up:

```bash
curl -sS http://localhost:<port>/health
```

2. Check vendor config endpoint:

```bash
curl -sS http://localhost:<port>/api/vendors
```

3. Check at least one brand file URL returned by vendors:

```bash
curl -sS -I http://localhost:<port>/static/brands/epic-sandbox.json
```

Expected:

- `/health` responds
- `/api/vendors` returns vendor entries
- Brand file URL returns `200`

If `/api/vendors` works but brand files fail, it is an asset-path issue (missing files/symlink/copy).

## OAuth Callback Consistency

Ensure configured callback URLs match your running base URL and registered OAuth app settings.

Common pitfall:

- App runs at `localhost`, but OAuth redirect URI registered/configured points at a deployed domain (or old path).
