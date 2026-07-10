---
name: neo4j-memory
description: "Persists health data from workspace caches into a Neo4j knowledge graph and queries it for longitudinal analysis. USE FOR: indexing health-records or med-pdf output into the graph, trend questions ('how has my glucose trended?', 'what active conditions do I have?'), and post-ingest summaries. DO NOT USE FOR: pulling fresh portal data (use health-records), parsing PDFs (use med-pdf), news/social (use myhealth-pulse), or when Neo4j is not configured — fall back to memory-diff instead."
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "requires": { "bins": ["node"] }
      }
  }
---

# neo4j-memory

Turns flat workspace cache files into a queryable health knowledge graph.

## When to Use

✅ Use when:

- Paul asks to "save", "index", or "persist" health data to the graph
- Paul asks a trend question: "how has my glucose trended?", "what active conditions do I have?"
- After `health-records` or `med-pdf` runs, to ingest new files into the graph
- `memory-diff` gives an incomplete answer — the graph has higher precision for structured facts

## When NOT to Use

❌ Don't use when:

- Paul shares a PDF or screenshot → use `med-pdf` first, then ingest
- Paul wants fresh portal data → use `health-records` first, then ingest
- Paul wants news or social signal → use `myhealth-pulse`
- Neo4j is not configured → tell Paul, route to `memory-diff`, stop

## Setup

1. Install the driver on the VM:
   `sudo npm install --prefix /usr/lib/node_modules/openclaw neo4j-driver`
2. Create connection config — see
   [`references/connection-schema.md`](references/connection-schema.md)
3. Initialize schema (once per database):
   `node {baseDir}/scripts/schema-init.mjs`

## Workflow

### Ingest mode

1. **Resolve config** via the precedence chain in
   [`references/connection-schema.md`](references/connection-schema.md).
   If not found, tell Paul to complete setup and stop.

2. **Ingest cache files.** Run ingest on every FHIR and parsed-PDF file in
   the workspace caches — the script deduplicates automatically via the
   ingest log at `~/.openclaw/workspace/.neo4j-memory-cache/ingest-log.json`:

   - Health-records FHIR:
     `node {baseDir}/scripts/ingest.mjs --source health-records --file <path.json>`
   - Med-pdf labs:
     `node {baseDir}/scripts/ingest.mjs --source med-pdf-labs --file <outDir>`
   - Med-pdf imaging:
     `node {baseDir}/scripts/ingest.mjs --source med-pdf-imaging --file <outDir>`

3. **Report** — nodes written, files skipped (already ingested), any errors.

### Query mode

1. **Resolve config.** If missing, route to `memory-diff` and say so.
2. **Translate to Cypher.** Use the schema in
   [`references/graph-schema.md`](references/graph-schema.md).
3. **Execute:** `node {baseDir}/scripts/query.mjs --cypher "<query>"`
4. **Reason over results.** Surface trends, flag abnormal values, compare to
   prior entries. Don't return raw rows.

## Scripts

See [`references/scripts.md`](references/scripts.md) for flags, output
schemas, and Cypher examples.

## Examples

See [`references/examples.md`](references/examples.md) for
ingest-after-health-records, ingest-after-med-pdf, and trend query runs.

## Privacy

PHI written to Neo4j leaves the local VM when using AuraDB (cloud-hosted).
Confirm this aligns with your use case before setup. To keep all data on the
VM, run Neo4j Community Edition locally (`bolt://localhost:7687`) — same
driver, same skill, different `uri`.

Never forward graph results to external services, web search, or outbound
notifications. PHI stays in the graph and in chat only.

## Troubleshooting

- **Connection refused** → verify `uri`, `username`, and the password env var;
  see [`references/connection-schema.md`](references/connection-schema.md)
- **`schema-init.mjs` errors on re-run** → idempotent by design; `IF NOT
  EXISTS` guards every constraint and index
- **Query returns empty** → confirm ingest ran:
  `cat ~/.openclaw/workspace/.neo4j-memory-cache/ingest-log.json`
- **`neo4j-driver` not found** → re-run setup step 1
