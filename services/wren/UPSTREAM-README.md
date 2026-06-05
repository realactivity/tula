# Health Skillz

Health Skillz helps people collect SMART on FHIR records from patient portals, review/export them locally, and optionally share them with AI using end-to-end encrypted upload.

## Documentation

- Design and architecture: `docs/design/DESIGN.md`
- Environment/runbook notes: `AGENTS.md`

This README intentionally stays high-level. API contracts, data structures, security model, and protocol details are documented in `docs/design/DESIGN.md`.

## Try It Now

A live instance is available at **[health-skillz.joshuamandel.com](https://health-skillz.joshuamandel.com)**.

1. Download the skill: [health-record-assistant.zip](https://health-skillz.joshuamandel.com/skill.zip)
2. Install in Claude: Settings -> Skills -> Upload zip
3. Ask: "Can you look at my health records?"

Epic sandbox test credentials:

- Username: `fhircamila`
- Password: `epicepic1`

## Local Development

### Prerequisites

- Bun
- A SMART on FHIR client registration (or sandbox client IDs)

### Quick Start

```bash
git clone https://github.com/jmandel/health-skillz
cd health-skillz

bun install
cp config.json.example config.local.json
# Edit config.local.json with your base URL and client IDs

bun run setup
mkdir -p static data
ln -snf "$(pwd)/brands" static/brands

CONFIG_PATH=./config.local.json bun run dev
```

Health check:

```bash
curl -sS http://localhost:8000/health
```

If you use a different port, update the URL accordingly.

## Configuration (High-Level)

The server reads `CONFIG_PATH` (defaults to `./config.json`).

Minimum fields you should verify in the selected config file:

1. `server.port`
2. `server.baseURL`
3. `brands[].clientId`
4. `brands[].redirectURL` (or default `${baseURL}/connect/callback`)

Run examples:

```bash
CONFIG_PATH=./config.local.json bun run dev
CONFIG_PATH=./config.local.json bun run start
```

## SMART App Registration

For Epic:

1. Register at <https://fhir.epic.com/Developer/Apps>
2. Set redirect URI to your deployed callback (typically `${baseURL}/connect/callback`)
3. Request scopes like `patient/*.rs`
4. Put the issued client ID in your config

## Common Commands

```bash
bun run dev            # watch mode
bun run start          # production-style local run
bun run build:brands   # fetch/build provider directory assets
bun run build:skill    # package skill zip
bun run generate-jwks  # generate JWKS files
bun run setup          # brands + skill + jwks
```

## Project Layout (High-Level)

```text
src/        Bun server + React client
skill/      Skill templates, scripts, references
scripts/    Build and maintenance scripts
docs/       Design and planning docs
static/     Served static assets (e.g., brands)
data/       Local runtime data (SQLite, generated files)
```

## License

MIT
