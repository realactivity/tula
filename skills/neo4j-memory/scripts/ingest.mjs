#!/usr/bin/env node
// ingest.mjs — Write workspace health data into the Neo4j graph.
//
// Usage:
//   node ingest.mjs --source health-records  --file <fhir.json>
//   node ingest.mjs --source med-pdf-labs    --file <outDir | labs.json>
//   node ingest.mjs --source med-pdf-imaging --file <outDir | imaging.json>
//
// Idempotent: uses MERGE. Skips files already in the ingest log (same path +
// same mtime). Outputs stats JSON to stdout.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { createRequire } from 'node:module';
import { resolveConfig } from './config.mjs';

// ---------- arg parsing -----------------------------------------------------

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') flags.source = argv[++i];
    else if (argv[i] === '--file') flags.file = argv[++i];
    else if (argv[i].startsWith('--source=')) flags.source = argv[i].slice(9);
    else if (argv[i].startsWith('--file=')) flags.file = argv[i].slice(7);
  }
  return flags;
}

// ---------- ingest log -------------------------------------------------------

function logPath(workspacePath) {
  return path.join(workspacePath, '.neo4j-memory-cache', 'ingest-log.json');
}

function readLog(logFile) {
  if (!fs.existsSync(logFile)) return [];
  try { return JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch { return []; }
}

function appendLog(logFile, entry) {
  const log = readLog(logFile);
  log.push(entry);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
}

function alreadyIngested(log, filePath, mtime) {
  return log.some(e => e.file === filePath && e.mtime === mtime);
}

// ---------- ID helpers -------------------------------------------------------

function makeId(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

function fileMtime(filePath) {
  try { return fs.statSync(filePath).mtimeMs.toString(); } catch { return '0'; }
}

// ---------- FHIR R4 parser --------------------------------------------------

function parseFhirBundle(json, filePath) {
  const observations = [];
  const conditions = [];
  const medications = [];

  for (const entry of (json.entry ?? [])) {
    const r = entry.resource ?? entry;
    if (!r?.resourceType) continue;

    if (r.resourceType === 'Observation') {
      const coding = r.code?.coding?.[0] ?? {};
      const qty = r.valueQuantity ?? {};
      const interp = r.interpretation?.[0]?.coding?.[0]?.code ?? 'N';
      const date = r.effectiveDateTime ?? r.effectivePeriod?.start ?? '';

      observations.push({
        id: makeId('obs', coding.code ?? coding.display ?? '', date, filePath),
        code: coding.code ?? '',
        display: coding.display ?? r.code?.text ?? '',
        value: qty.value != null ? String(qty.value) : (r.valueString ?? ''),
        unit: qty.unit ?? '',
        referenceRangeLow: r.referenceRange?.[0]?.low?.value ?? null,
        referenceRangeHigh: r.referenceRange?.[0]?.high?.value ?? null,
        effectiveDate: date,
        abnormal: !['N', 'NEG', 'NL', 'NORM'].includes(interp.toUpperCase()),
        source: 'health-records',
      });
    }

    if (r.resourceType === 'Condition') {
      const coding = r.code?.coding?.[0] ?? {};
      conditions.push({
        id: makeId('cond', coding.code ?? coding.display ?? r.code?.text ?? ''),
        code: coding.code ?? '',
        system: coding.system ?? '',
        display: coding.display ?? r.code?.text ?? '',
        status: r.clinicalStatus?.coding?.[0]?.code ?? 'unknown',
        onsetDate: r.onsetDateTime ?? '',
        source: 'health-records',
      });
    }

    if (r.resourceType === 'MedicationStatement' || r.resourceType === 'MedicationRequest') {
      const med = r.medicationCodeableConcept ?? r.medication?.concept ?? {};
      const coding = med.coding?.[0] ?? {};
      medications.push({
        id: makeId('med', coding.code ?? coding.display ?? med.text ?? ''),
        code: coding.code ?? '',
        display: coding.display ?? med.text ?? '',
        status: r.status ?? 'unknown',
        startDate: r.effectivePeriod?.start ?? r.effectiveDateTime ?? '',
        stopDate: r.effectivePeriod?.end ?? '',
        source: 'health-records',
      });
    }
  }

  return { observations, conditions, medications };
}

// ---------- med-pdf parsers -------------------------------------------------

function parseMedPdfLabs(json, slug) {
  return (json.labs ?? []).map(lab => ({
    id: makeId('lab', slug, lab.name ?? '', lab.effectiveDate ?? lab.date ?? ''),
    code: '',
    display: lab.name ?? '',
    value: String(lab.value ?? ''),
    unit: lab.unit ?? '',
    referenceRangeLow: null,
    referenceRangeHigh: null,
    effectiveDate: lab.effectiveDate ?? lab.date ?? '',
    abnormal: lab.abnormal ?? false,
    source: 'med-pdf',
  }));
}

function parseMedPdfImaging(json, slug) {
  return [{
    id: makeId('img', slug, json.studyType ?? '', json.resultedOn ?? ''),
    studyType: json.studyType ?? 'Unknown',
    impression: (json.impression ?? []).join(' '),
    examDescription: json.examDescription ?? '',
    effectiveDate: json.resultedOn ?? '',
    source: 'med-pdf',
    sourceSlug: slug,
  }];
}

// ---------- Neo4j write helpers ---------------------------------------------

async function mergeNodes(session, label, nodes, docId) {
  let written = 0;
  for (const node of nodes) {
    await session.run(
      `MERGE (n:${label} {id: $id})
       ON CREATE SET n += $props, n.createdAt = datetime()
       ON MATCH  SET n.updatedAt = datetime()
       WITH n
       MATCH (d:DocumentReference {id: $docId})
       MERGE (n)-[:FROM_DOCUMENT]->(d)`,
      { id: node.id, props: node, docId }
    );
    written++;
  }
  return written;
}

async function mergeDiagnosticReports(session, reports, docId) {
  let written = 0;
  for (const r of reports) {
    await session.run(
      `MERGE (n:DiagnosticReport {id: $id})
       ON CREATE SET n += $props, n.createdAt = datetime()
       ON MATCH  SET n.updatedAt = datetime()
       WITH n
       MATCH (d:DocumentReference {id: $docId})
       MERGE (n)-[:FROM_DOCUMENT]->(d)`,
      { id: r.id, props: r, docId }
    );
    written++;
  }
  return written;
}

// ---------- main ------------------------------------------------------------

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (!flags.source || !flags.file) {
    console.error('Usage: ingest.mjs --source <type> --file <path>');
    console.error('Sources: health-records, med-pdf-labs, med-pdf-imaging');
    process.exit(2);
  }

  const filePath = path.resolve(flags.file);
  if (!fs.existsSync(filePath)) {
    console.error(JSON.stringify({ ok: false, error: `Not found: ${filePath}` }));
    process.exit(1);
  }

  const cfg = resolveConfig();
  const log = readLog(logPath(cfg.workspacePath));
  const mtime = fileMtime(filePath);

  if (alreadyIngested(log, filePath, mtime)) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: 'already ingested', file: filePath }));
    return;
  }

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
    // Resolve the actual JSON file path (handles directory input for med-pdf)
    let jsonPath = filePath;
    if (fs.statSync(filePath).isDirectory()) {
      if (flags.source === 'med-pdf-labs') jsonPath = path.join(filePath, 'labs.json');
      else if (flags.source === 'med-pdf-imaging') jsonPath = path.join(filePath, 'imaging.json');
    }

    if (!fs.existsSync(jsonPath)) {
      console.error(JSON.stringify({ ok: false, error: `JSON file not found: ${jsonPath}` }));
      process.exit(1);
    }

    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const slug = path.basename(path.dirname(jsonPath));
    const docId = makeId('doc', flags.source, filePath);

    // Create DocumentReference first (anchor for all relationships)
    await session.run(
      `MERGE (d:DocumentReference {id: $id})
       ON CREATE SET d.sourceType = $sourceType, d.path = $path, d.date = datetime(), d.createdAt = datetime()`,
      { id: docId, sourceType: flags.source, path: filePath }
    );

    let nodesWritten = 0;

    if (flags.source === 'health-records') {
      const { observations, conditions, medications } = parseFhirBundle(json, filePath);
      nodesWritten += await mergeNodes(session, 'Observation', observations, docId);
      nodesWritten += await mergeNodes(session, 'Condition', conditions, docId);
      nodesWritten += await mergeNodes(session, 'Medication', medications, docId);
    } else if (flags.source === 'med-pdf-labs') {
      const obs = parseMedPdfLabs(json, slug);
      nodesWritten += await mergeNodes(session, 'Observation', obs, docId);
    } else if (flags.source === 'med-pdf-imaging') {
      const reports = parseMedPdfImaging(json, slug);
      nodesWritten += await mergeDiagnosticReports(session, reports, docId);
    } else {
      console.error(JSON.stringify({ ok: false, error: `Unknown source: ${flags.source}` }));
      process.exit(2);
    }

    appendLog(logPath(cfg.workspacePath), {
      file: filePath,
      source: flags.source,
      ingestedAt: new Date().toISOString(),
      mtime,
      nodesWritten,
    });

    console.log(JSON.stringify({ ok: true, source: flags.source, file: filePath, nodesWritten, skipped: false }));
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
