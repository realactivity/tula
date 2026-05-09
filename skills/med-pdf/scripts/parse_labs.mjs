#!/usr/bin/env node
// parse_labs.mjs — Find lab values in extracted text and flag out-of-range.
//
// Usage:
//   node parse_labs.mjs <text.txt | extracted-dir>
//
// Outputs JSON to stdout:
//   { labs: [ { name, alias, value, unit, refLow, refHigh, flag, raw, line } ],
//     unmatchedLines: [ ... ],
//     stats: { totalLines, matched } }
//
// Strategy: line-based heuristic match against an alias dictionary. We grab
// the first numeric value on the line + a unit if present; reference ranges
// follow common patterns ("3.5-5.0", "<200", ">40", "(70-99 mg/dL)").
//
// This is intentionally permissive: it favors recall and surfaces unmatched
// lines so the agent can decide what else to extract.

import fs from 'node:fs';
import path from 'node:path';

const LAB_DICT = [
  // Lipid panel
  { key: 'total_cholesterol', aliases: ['total cholesterol', 'cholesterol, total', 'cholesterol total'], unit: 'mg/dL' },
  { key: 'ldl_c', aliases: ['ldl', 'ldl-c', 'ldl cholesterol', 'ldl, calculated', 'ldl direct'], unit: 'mg/dL' },
  { key: 'hdl_c', aliases: ['hdl', 'hdl-c', 'hdl cholesterol'], unit: 'mg/dL' },
  { key: 'triglycerides', aliases: ['triglycerides', 'trigs', 'tg'], unit: 'mg/dL' },
  { key: 'non_hdl', aliases: ['non-hdl', 'non hdl cholesterol'], unit: 'mg/dL' },
  { key: 'apob', aliases: ['apolipoprotein b', 'apo b', 'apob'], unit: 'mg/dL' },
  { key: 'lp_a', aliases: ['lp(a)', 'lipoprotein (a)', 'lipoprotein a'], unit: 'nmol/L|mg/dL' },

  // Glucose / metabolic
  { key: 'glucose_fasting', aliases: ['glucose, fasting', 'fasting glucose', 'glucose'], unit: 'mg/dL' },
  { key: 'hba1c', aliases: ['hemoglobin a1c', 'hba1c', 'a1c', 'glycohemoglobin'], unit: '%' },
  { key: 'insulin_fasting', aliases: ['insulin, fasting', 'fasting insulin', 'insulin'], unit: 'uIU/mL|mIU/L' },
  { key: 'homa_ir', aliases: ['homa-ir', 'homa ir'], unit: '' },
  { key: 'c_peptide', aliases: ['c-peptide', 'c peptide'], unit: 'ng/mL' },

  // Liver
  { key: 'alt', aliases: ['alt', 'sgpt', 'alanine aminotransferase'], unit: 'U/L' },
  { key: 'ast', aliases: ['ast', 'sgot', 'aspartate aminotransferase'], unit: 'U/L' },
  { key: 'ggt', aliases: ['ggt', 'gamma-glutamyl transferase', 'gamma gt'], unit: 'U/L' },
  { key: 'alk_phos', aliases: ['alkaline phosphatase', 'alk phos'], unit: 'U/L' },
  { key: 'bilirubin_total', aliases: ['bilirubin, total', 'total bilirubin'], unit: 'mg/dL' },
  { key: 'albumin', aliases: ['albumin'], unit: 'g/dL' },

  // Kidney
  { key: 'creatinine', aliases: ['creatinine'], unit: 'mg/dL' },
  { key: 'egfr', aliases: ['egfr', 'estimated gfr', 'gfr estimated'], unit: 'mL/min/1.73m2' },
  { key: 'bun', aliases: ['bun', 'blood urea nitrogen', 'urea nitrogen'], unit: 'mg/dL' },
  { key: 'cystatin_c', aliases: ['cystatin c', 'cystatin-c'], unit: 'mg/L' },
  { key: 'uacr', aliases: ['urine albumin/creatinine', 'albumin/creatinine ratio', 'uacr'], unit: 'mg/g' },

  // Inflammation / cardio
  { key: 'hs_crp', aliases: ['hs-crp', 'high sensitivity crp', 'c-reactive protein, hs', 'hscrp'], unit: 'mg/L' },
  { key: 'crp', aliases: ['crp', 'c-reactive protein'], unit: 'mg/L' },
  { key: 'esr', aliases: ['esr', 'sedimentation rate'], unit: 'mm/hr' },
  { key: 'homocysteine', aliases: ['homocysteine'], unit: 'umol/L' },
  { key: 'fibrinogen', aliases: ['fibrinogen'], unit: 'mg/dL' },

  // Thyroid
  { key: 'tsh', aliases: ['tsh', 'thyroid stimulating hormone'], unit: 'uIU/mL|mIU/L' },
  { key: 'free_t4', aliases: ['free t4', 'free thyroxine', 'ft4'], unit: 'ng/dL' },
  { key: 'free_t3', aliases: ['free t3', 'ft3'], unit: 'pg/mL' },
  { key: 'tpo_ab', aliases: ['tpo antibody', 'thyroid peroxidase antibody', 'anti-tpo'], unit: 'IU/mL' },

  // Hormones
  { key: 'testosterone_total', aliases: ['testosterone, total', 'total testosterone'], unit: 'ng/dL' },
  { key: 'testosterone_free', aliases: ['testosterone, free', 'free testosterone'], unit: 'pg/mL' },
  { key: 'shbg', aliases: ['shbg', 'sex hormone binding globulin'], unit: 'nmol/L' },
  { key: 'estradiol', aliases: ['estradiol', 'e2'], unit: 'pg/mL' },
  { key: 'dhea_s', aliases: ['dhea-s', 'dheas', 'dhea sulfate'], unit: 'ug/dL' },
  { key: 'cortisol', aliases: ['cortisol'], unit: 'ug/dL' },
  { key: 'igf_1', aliases: ['igf-1', 'insulin-like growth factor 1'], unit: 'ng/mL' },
  { key: 'psa', aliases: ['psa', 'prostate specific antigen'], unit: 'ng/mL' },

  // Vitamins / minerals
  { key: 'vit_d_25oh', aliases: ['vitamin d, 25-hydroxy', '25-hydroxy vitamin d', 'vitamin d 25-oh', '25-oh vitamin d', 'vitamin d, 25-oh', 'vitamin d, total', 'vitamin d', '25(oh)d', '25 oh vitamin d'], unit: 'ng/mL' },
  { key: 'vit_b12', aliases: ['vitamin b12', 'b12', 'cobalamin'], unit: 'pg/mL' },
  { key: 'folate', aliases: ['folate', 'folic acid'], unit: 'ng/mL' },
  { key: 'ferritin', aliases: ['ferritin'], unit: 'ng/mL' },
  { key: 'iron', aliases: ['iron, serum', 'serum iron', 'iron'], unit: 'ug/dL' },
  { key: 'tibc', aliases: ['tibc', 'total iron binding capacity'], unit: 'ug/dL' },
  { key: 'transferrin_sat', aliases: ['transferrin saturation', 'iron saturation', '% saturation'], unit: '%' },
  { key: 'magnesium', aliases: ['magnesium'], unit: 'mg/dL' },
  { key: 'zinc', aliases: ['zinc'], unit: 'ug/dL' },
  { key: 'sodium', aliases: ['sodium'], unit: 'mmol/L' },
  { key: 'potassium', aliases: ['potassium'], unit: 'mmol/L' },
  { key: 'calcium', aliases: ['calcium'], unit: 'mg/dL' },

  // CBC
  { key: 'wbc', aliases: ['wbc', 'white blood cell count', 'leukocytes'], unit: 'k/uL' },
  { key: 'rbc', aliases: ['rbc', 'red blood cell count'], unit: 'M/uL' },
  { key: 'hemoglobin', aliases: ['hemoglobin', 'hgb', 'hb'], unit: 'g/dL' },
  { key: 'hematocrit', aliases: ['hematocrit', 'hct'], unit: '%' },
  { key: 'mcv', aliases: ['mcv', 'mean corpuscular volume'], unit: 'fL' },
  { key: 'platelets', aliases: ['platelets', 'platelet count'], unit: 'k/uL' },
  { key: 'rdw', aliases: ['rdw', 'red cell distribution width'], unit: '%' },
  { key: 'neutrophils_pct', aliases: ['neutrophils %', 'neutrophil %'], unit: '%' },
  { key: 'lymphocytes_pct', aliases: ['lymphocytes %', 'lymphocyte %'], unit: '%' },

  // Other healthspan favorites
  { key: 'uric_acid', aliases: ['uric acid'], unit: 'mg/dL' },
  { key: 'gdf15', aliases: ['gdf-15', 'gdf15'], unit: 'pg/mL' },
  { key: 'nt_probnp', aliases: ['nt-probnp', 'nt probnp', 'pro-bnp'], unit: 'pg/mL' },
  { key: 'troponin', aliases: ['troponin', 'troponin i', 'troponin t'], unit: 'ng/L|ng/mL' },
];

const RANGE_RE = /(?:reference\s*range|ref\s*range|ref\.?|range)?\s*[:\-]?\s*(?:\(?\s*([<>])?\s*([0-9]+(?:\.[0-9]+)?)\s*[-–to]+\s*([0-9]+(?:\.[0-9]+)?)\s*\)?|\(?\s*<\s*([0-9]+(?:\.[0-9]+)?)\s*\)?|\(?\s*>\s*([0-9]+(?:\.[0-9]+)?)\s*\)?)/i;
const VALUE_RE = /([<>]=?)?\s*([0-9]+(?:\.[0-9]+)?)/;
// Flag must be surrounded by whitespace (not adjacent to /, like in 'U/L'
// or 'mg/dL'). We require explicit space/tab boundaries on both sides.
const FLAG_RE = /(?:^|[\s])(H|HIGH|L|LOW|HH|LL|CRITICAL|ABNORMAL)(?=[\s)]|$)/;
const UNIT_RE = /([a-zA-Z%/μµ]+(?:\/[a-zA-Z0-9.²]+)?)/;

function findLab(line) {
  const lower = line.toLowerCase();
  for (const lab of LAB_DICT) {
    for (const alias of lab.aliases) {
      const idx = lower.indexOf(alias);
      if (idx === -1) continue;
      // alias must appear as a label, not embedded in a longer word
      const before = idx === 0 ? '' : lower[idx - 1];
      const afterIdx = idx + alias.length;
      const after = afterIdx >= lower.length ? '' : lower[afterIdx];
      if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
      return { lab, alias, aliasIdx: idx };
    }
  }
  return null;
}

function parseLine(line) {
  const m = findLab(line);
  if (!m) return null;
  const tail = line.slice(m.aliasIdx + m.alias.length);
  const valMatch = tail.match(VALUE_RE);
  if (!valMatch) return null;
  const value = parseFloat(valMatch[2]);
  const cmp = valMatch[1] || null;

  // Look for unit right after the value
  const afterVal = tail.slice(tail.indexOf(valMatch[0]) + valMatch[0].length);
  const unitMatch = afterVal.match(UNIT_RE);
  const unit = unitMatch ? unitMatch[1] : null;

  // Range
  const rangeMatch = tail.match(RANGE_RE);
  let refLow = null, refHigh = null;
  if (rangeMatch) {
    if (rangeMatch[2] && rangeMatch[3]) {
      refLow = parseFloat(rangeMatch[2]);
      refHigh = parseFloat(rangeMatch[3]);
    } else if (rangeMatch[4]) {
      refHigh = parseFloat(rangeMatch[4]);
    } else if (rangeMatch[5]) {
      refLow = parseFloat(rangeMatch[5]);
    }
  }

  // Derive flag from numeric range first (most reliable signal)
  let flag = null;
  if (refLow != null && value < refLow) flag = 'LOW';
  else if (refHigh != null && value > refHigh) flag = 'HIGH';

  // If no range, fall back to explicit H/L token in the line
  if (!flag) {
    const flagMatch = tail.match(FLAG_RE);
    if (flagMatch) {
      const f = flagMatch[1].toUpperCase();
      if (f === 'H' || f === 'HIGH') flag = 'HIGH';
      else if (f === 'L' || f === 'LOW') flag = 'LOW';
      else if (f === 'HH') flag = 'CRITICAL_HIGH';
      else if (f === 'LL') flag = 'CRITICAL_LOW';
      else flag = 'ABNORMAL';
    }
  }

  return {
    name: m.lab.key,
    alias: m.alias,
    value,
    cmp,
    unit,
    refLow,
    refHigh,
    flag,
    line,
  };
}

function readInput(arg) {
  const p = path.resolve(arg);
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    const f = path.join(p, 'text.txt');
    if (!fs.existsSync(f)) throw new Error(`No text.txt in ${p} — run extract.mjs first`);
    return fs.readFileSync(f, 'utf8');
  }
  return fs.readFileSync(p, 'utf8');
}

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: parse_labs.mjs <text.txt | extracted-dir>');
  process.exit(2);
}

const text = readInput(arg);
const lines = text.split(/\r?\n/);
const labs = [];
const unmatched = [];
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const parsed = parseLine(trimmed);
  if (parsed) labs.push(parsed);
  else if (/[0-9]/.test(trimmed) && trimmed.length < 200) unmatched.push(trimmed);
}

console.log(JSON.stringify({
  labs,
  abnormal: labs.filter(l => l.flag),
  unmatchedLines: unmatched.slice(0, 50),
  stats: { totalLines: lines.length, matched: labs.length, unmatchedNumeric: unmatched.length },
}, null, 2));
