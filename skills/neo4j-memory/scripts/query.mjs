#!/usr/bin/env node
// query.mjs — Execute a Cypher query against the Neo4j health graph.
//
// Usage:
//   node query.mjs --cypher "<cypher statement>" [--limit 50]
//
// Outputs JSON to stdout. See references/graph-schema.md for node labels,
// properties, and common query patterns.

import { createRequire } from 'node:module';
import { resolveConfig } from './config.mjs';

function parseArgs(argv) {
  const flags = { limit: 50 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cypher') flags.cypher = argv[++i];
    else if (argv[i] === '--limit') flags.limit = parseInt(argv[++i], 10);
    else if (argv[i].startsWith('--cypher=')) flags.cypher = argv[i].slice(9);
    else if (argv[i].startsWith('--limit=')) flags.limit = parseInt(argv[i].slice(8), 10);
  }
  return flags;
}

function serializeValue(neo4j, val) {
  if (val === null || val === undefined) return null;
  if (neo4j.isInt(val)) return val.toNumber();
  if (typeof val === 'object' && val.properties) return serializeRecord(neo4j, val.properties);
  if (typeof val === 'object' && typeof val.toString === 'function' &&
      (val.constructor?.name === 'Date' || val.constructor?.name === 'DateTime' ||
       val.constructor?.name === 'LocalDateTime')) {
    return val.toString();
  }
  return val;
}

function serializeRecord(neo4j, props) {
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = serializeValue(neo4j, v);
  }
  return out;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (!flags.cypher) {
    console.error('Usage: query.mjs --cypher "<cypher statement>"');
    process.exit(2);
  }

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
    const result = await session.run(flags.cypher);
    const rows = result.records.slice(0, flags.limit).map(rec => {
      const obj = {};
      for (const key of rec.keys) {
        obj[key] = serializeValue(neo4j, rec.get(key));
      }
      return obj;
    });
    console.log(JSON.stringify({ ok: true, count: rows.length, rows }));
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
