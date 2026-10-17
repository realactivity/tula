# Connection Schema

The Neo4j connection config is a YAML file external to this skill. The skill
reads it; the skill does not contain it. This keeps the repo generic and
makes the skill deployable in multi-tenant runtimes (Aria) without code
changes — only the resolved path differs per agent instance.

## Where the config lives

Resolution order, first hit wins:

1. `skills.entries.neo4j-memory.config` in `openclaw.json` — used by
   multi-tenant runtimes to inject a per-patient config path.
2. `NEO4J_MEMORY_CONFIG` env var — absolute path to the YAML file; useful
   for testing and CI.
3. `~/.openclaw/workspace/memory/neo4j.yaml` — default for single-user Tula.

The same skill code and the same scripts run in personal Tula and in Aria.
Only the resolved path changes. In Aria, the runtime injects a per-patient
config so each agent connects to its own isolated database.

## Schema (v1)

```yaml
version: 1

# Neo4j connection URI.
# AuraDB Free (cloud):    neo4j+s://<id>.databases.neo4j.io
# Local Community Edition: bolt://localhost:7687
uri: neo4j+s://xxxxxxxx.databases.neo4j.io

# Database name. Omit to use the default ("neo4j").
# For Aria multi-tenant: set to "patient_<id>" for hard per-patient isolation
# (requires Neo4j 4.0+ or AuraDB, which supports multiple databases).
database: neo4j

# Neo4j username (typically "neo4j" for AuraDB Free).
username: neo4j

# Name of the env var that holds the password. Never put the password itself
# in this file — the file may be read-accessible to other processes.
password_env: NEO4J_MEMORY_PASSWORD
```

Set the password before running any script:

```bash
export NEO4J_MEMORY_PASSWORD="your-auradb-password"
```

For persistence across sessions, add it to `~/.openclaw/workspace/.env` or
the system-level env config on the VM.

## Personal Tula vs. multi-tenant

| Aspect | Personal Tula | Multi-tenant (Aria) |
|---|---|---|
| Config path | `~/.openclaw/workspace/memory/neo4j.yaml` | resolved per-agent via `openclaw.json` |
| Who sets it | the user, by hand | provisioned by the Aria identity service |
| Database | single `neo4j` database | `patient_<id>` per agent — hard isolation |
| Password env | set in shell profile or `.env` | injected per-agent by the runtime |
| Skill code | identical | identical |

Aria's isolation guarantee comes from per-agent credentials that only have
access to that patient's database. The skill is unaware of which deployment
it's running in. That's the point.

## What does NOT belong in this file

- The password itself — always use `password_env`
- Patient identity, conditions, medications, or any PHI
- Skill logic, routing rules, or topic lists

Those live in their respective workspace memory files.
