# Scripts Reference

All scripts live in `{baseDir}/scripts/`. Run them from anywhere — they take
absolute paths. All scripts read connection config via the precedence chain
in [`connection-schema.md`](connection-schema.md).

## config.mjs

Shared config loader imported by the other three scripts. Not invoked
directly. Exports `resolveConfig()` which returns
`{ uri, database, username, password, workspacePath }`.

Reads `~/.openclaw/workspace/memory/neo4j.yaml` (or the path from
`NEO4J_MEMORY_CONFIG` env var). The `password` value is resolved from the
env var named by `password_env` in the config file.

## schema-init.mjs

```
node {baseDir}/scripts/schema-init.mjs
```

Creates Neo4j uniqueness constraints and indexes. Idempotent — uses
`IF NOT EXISTS` guards on every statement. Safe to re-run at any time.

### Output (stdout JSON)

```json
{ "ok": true, "constraints": 5, "indexes": 3 }
```

Run this once after setup, and again after any schema changes (new node
labels or indexes added to future versions).

## ingest.mjs

```
node {baseDir}/scripts/ingest.mjs --source <type> --file <path>
```

Writes health data from a workspace cache file into the Neo4j graph using
`MERGE` — fully idempotent. Tracks processed files in an ingest log at
`~/.openclaw/workspace/.neo4j-memory-cache/ingest-log.json` and skips
files that have already been ingested (same path + same mtime).

### Source types

| `--source` | `--file` | What it reads |
|---|---|---|
| `health-records` | Path to a FHIR R4 JSON file under `.health-records-cache/` | Observations, Conditions, MedicationStatements |
| `med-pdf-labs` | Path to a `labs.json` file OR its parent `<outDir>` | Lab values from `parse_labs.mjs` output |
| `med-pdf-imaging` | Path to an `imaging.json` file OR its parent `<outDir>` | Radiology reports from `parse_imaging.mjs` output |

### Output (stdout JSON)

```json
{ "ok": true, "source": "health-records", "file": "/path/to/file.json",
  "nodesWritten": 14, "skipped": false }
```

When a file was already ingested and hasn't changed:

```json
{ "ok": true, "skipped": true, "reason": "already ingested",
  "file": "/path/to/file.json" }
```

### Ingest log

Located at `~/.openclaw/workspace/.neo4j-memory-cache/ingest-log.json`.
Each entry records the file path, source type, ingest timestamp, file mtime,
and nodes written. The log is append-only; ingest.mjs never removes entries.

## query.mjs

```
node {baseDir}/scripts/query.mjs --cypher "<cypher statement>" [--limit 50]
```

Executes a read-only Cypher query against the graph and returns results as
JSON. Use the patterns in [`graph-schema.md`](graph-schema.md) to build
queries.

### Flags

| Flag | Default | Notes |
|---|---|---|
| `--cypher` | required | Cypher query string |
| `--limit` | 50 | Max rows to return |

### Output (stdout JSON)

```json
{
  "ok": true,
  "count": 3,
  "rows": [
    { "date": "2026-01-15", "value": "95", "unit": "mg/dL", "abnormal": false },
    { "date": "2026-03-02", "value": "108", "unit": "mg/dL", "abnormal": false },
    { "date": "2026-05-10", "value": "118", "unit": "mg/dL", "abnormal": true }
  ]
}
```

### Note on write queries

`query.mjs` does not block write queries, but the skill should only use it
for reads. Writes go through `ingest.mjs`, which manages deduplication and
the ingest log.
