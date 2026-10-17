// config.mjs — Resolve Neo4j connection config from workspace or env.
// Imported by schema-init.mjs, ingest.mjs, and query.mjs.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ??
  path.join(os.homedir(), '.openclaw', 'workspace');

export function resolveConfig() {
  const configPath =
    process.env.NEO4J_MEMORY_CONFIG ??
    path.join(WORKSPACE, 'memory', 'neo4j.yaml');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Neo4j config not found at ${configPath}. ` +
      'See skills/neo4j-memory/references/connection-schema.md for setup.'
    );
  }

  const cfg = parseYaml(fs.readFileSync(configPath, 'utf8'));

  if (!cfg.uri) throw new Error('neo4j.yaml missing required field: uri');
  if (!cfg.username) throw new Error('neo4j.yaml missing required field: username');

  const passwordEnv = cfg.password_env ?? 'NEO4J_MEMORY_PASSWORD';
  const password = process.env[passwordEnv];
  if (!password) {
    throw new Error(
      `Neo4j password env var not set: ${passwordEnv}. ` +
      `Run: export ${passwordEnv}="your-password"`
    );
  }

  return {
    uri: cfg.uri,
    database: cfg.database ?? 'neo4j',
    username: cfg.username,
    password,
    workspacePath: WORKSPACE,
  };
}

// Minimal key: value YAML parser for the neo4j.yaml config shape.
// Handles quoted values and # comments. No nesting needed.
function parseYaml(text) {
  const result = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}
