# Examples

## Setup (first time)

```bash
# 1. Install driver alongside openclaw's packages
sudo npm install --prefix /usr/lib/node_modules/openclaw neo4j-driver

# 2. Create config (AuraDB Free example)
cat > ~/.openclaw/workspace/memory/neo4j.yaml <<'EOF'
version: 1
uri: neo4j+s://a1b2c3d4.databases.neo4j.io
database: neo4j
username: neo4j
password_env: NEO4J_MEMORY_PASSWORD
EOF

export NEO4J_MEMORY_PASSWORD="your-password-here"

# 3. Initialize schema
node ~/.openclaw/workspace/skills/neo4j-memory/scripts/schema-init.mjs
# → { "ok": true, "constraints": 5, "indexes": 3 }
```

---

## Ingest after `health-records` pull

After `health-records` runs and writes FHIR JSON to
`~/.openclaw/workspace/.health-records-cache/2026-05-18/`:

```bash
BASE=~/.openclaw/workspace/skills/neo4j-memory

# Ingest each provider file
node $BASE/scripts/ingest.mjs \
  --source health-records \
  --file ~/.openclaw/workspace/.health-records-cache/2026-05-18/epic.json
# → { "ok": true, "source": "health-records", "nodesWritten": 42, "skipped": false }

node $BASE/scripts/ingest.mjs \
  --source health-records \
  --file ~/.openclaw/workspace/.health-records-cache/2026-05-18/labcorp.json
# → { "ok": true, "source": "health-records", "nodesWritten": 18, "skipped": false }

# Re-run same file — deduplicates automatically
node $BASE/scripts/ingest.mjs \
  --source health-records \
  --file ~/.openclaw/workspace/.health-records-cache/2026-05-18/epic.json
# → { "ok": true, "skipped": true, "reason": "already ingested" }
```

---

## Ingest after `med-pdf` run

After `med-pdf` parses a LabCorp PDF and writes to
`~/.openclaw/workspace/.med-pdf-cache/labcorp-2026-05-10/`:

```bash
BASE=~/.openclaw/workspace/skills/neo4j-memory
SLUG=~/.openclaw/workspace/.med-pdf-cache/labcorp-2026-05-10

# Ingest lab values (pass the outDir — script finds labs.json inside)
node $BASE/scripts/ingest.mjs --source med-pdf-labs --file $SLUG
# → { "ok": true, "source": "med-pdf-labs", "nodesWritten": 22, "skipped": false }

# If there's also an imaging report in the same slug
node $BASE/scripts/ingest.mjs --source med-pdf-imaging --file $SLUG
# → { "ok": true, "source": "med-pdf-imaging", "nodesWritten": 1, "skipped": false }
```

---

## Glucose trend query

Paul asks: "How has my fasting glucose trended over the last 6 months?"

```bash
node ~/.openclaw/workspace/skills/neo4j-memory/scripts/query.mjs --cypher "
MATCH (o:Observation)
WHERE o.display =~ '(?i)glucose'
  AND o.effectiveDate >= '2025-11-18'
RETURN o.effectiveDate AS date, o.value AS value, o.unit AS unit, o.abnormal AS abnormal
ORDER BY o.effectiveDate
"
```

Response:
```json
{
  "ok": true,
  "count": 4,
  "rows": [
    { "date": "2025-12-02", "value": "98",  "unit": "mg/dL", "abnormal": false },
    { "date": "2026-02-14", "value": "104", "unit": "mg/dL", "abnormal": false },
    { "date": "2026-04-01", "value": "109", "unit": "mg/dL", "abnormal": false },
    { "date": "2026-05-10", "value": "118", "unit": "mg/dL", "abnormal": true  }
  ]
}
```

Reasoning output to Paul: "Your fasting glucose has climbed steadily over 6
months — 98 → 104 → 109 → 118 mg/dL. The May value (118) crossed the
pre-diabetic threshold (≥100 mg/dL fasting). That's a Tier 1 signal worth
discussing with your provider. The trend started before it became abnormal,
which gives you a window for intervention."

---

## Active conditions query

Paul asks: "What conditions are in my chart?"

```bash
node ~/.openclaw/workspace/skills/neo4j-memory/scripts/query.mjs --cypher "
MATCH (c:Condition)
RETURN c.display AS condition, c.status AS status, c.onsetDate AS since
ORDER BY c.status, c.onsetDate
"
```

---

## Check ingest log

To see what's been loaded into the graph:

```bash
cat ~/.openclaw/workspace/.neo4j-memory-cache/ingest-log.json | \
  node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); \
  JSON.parse(d).forEach(e=>console.log(e.ingestedAt, e.source, e.file.split('/').pop()))"
```
