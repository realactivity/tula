#!/usr/bin/env node
// schema-init.mjs — Create Neo4j constraints and indexes for neo4j-memory.
//
// Usage:
//   node schema-init.mjs
//
// Idempotent — IF NOT EXISTS guards every statement. Safe to re-run.

import { createRequire } from 'node:module';
import { resolveConfig } from './config.mjs';

const CONSTRAINTS = [
  'CREATE CONSTRAINT obs_id       IF NOT EXISTS FOR (n:Observation)       REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT condition_id IF NOT EXISTS FOR (n:Condition)          REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT medication_id IF NOT EXISTS FOR (n:Medication)        REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT report_id    IF NOT EXISTS FOR (n:DiagnosticReport)  REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT docref_id    IF NOT EXISTS FOR (n:DocumentReference) REQUIRE n.id IS UNIQUE',
];

const INDEXES = [
  'CREATE INDEX obs_code     IF NOT EXISTS FOR (n:Observation) ON (n.code)',
  'CREATE INDEX obs_date     IF NOT EXISTS FOR (n:Observation) ON (n.effectiveDate)',
  'CREATE INDEX obs_abnormal IF NOT EXISTS FOR (n:Observation) ON (n.abnormal)',
];

async function main() {
  const cfg = resolveConfig();

  const _require = createRequire('/usr/lib/node_modules/openclaw/index.js');
  let neo4j;
  try {
    neo4j = _require('neo4j-driver');
  } catch {
    console.error(JSON.stringify({
      ok: false,
      error: 'neo4j-driver not found. Run: sudo npm install --prefix /usr/lib/node_modules/openclaw neo4j-driver',
    }));
    process.exit(1);
  }

  const driver = neo4j.driver(cfg.uri, neo4j.auth.basic(cfg.username, cfg.password));
  const session = driver.session({ database: cfg.database });

  try {
    for (const stmt of [...CONSTRAINTS, ...INDEXES]) {
      await session.run(stmt);
    }
    console.log(JSON.stringify({
      ok: true,
      constraints: CONSTRAINTS.length,
      indexes: INDEXES.length,
    }));
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
