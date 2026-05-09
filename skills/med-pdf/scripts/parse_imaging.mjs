#!/usr/bin/env node
// parse_imaging.mjs — Extract structured sections from radiology / imaging
// reports (CT, MRI, X-ray, ultrasound, mammogram, DEXA, echo).
//
// Usage:
//   node parse_imaging.mjs <text.txt | extracted-dir>
//
// Outputs JSON to stdout:
//   {
//     studyType, examDescription, technique, indication, comparison,
//     findings: { lungs_pleura, mediastinum_vascular, lymph_nodes,
//                 bones_soft_tissues, upper_abdomen, ... raw },
//     impression: [string, ...],
//     orderedBy, resultedOn, status,
//     patient: { name, dob, mrn },  // PHI — handle locally only
//     raw
//   }
//
// Strategy: section-header splitter. Radiology reports have a stable layout
// with capitalized headers ending in colons. We grab the body after each
// header until the next header. Robust to MyChart/Epic exports and most
// hospital templates.

import fs from 'node:fs';
import path from 'node:path';

const SECTION_HEADERS = [
  ['examDescription', /EXAM\s*DESCRIPTION\s*:?/i],
  ['technique', /TECHNIQUE\s*:?/i],
  ['comparison', /COMPARISON\s*:?/i],
  ['indication', /(?:INDICATION|CLINICAL\s*HISTORY|HISTORY|REASON\s*FOR\s*EXAM)\s*:?/i],
  ['findings', /FINDINGS\s*:?/i],
  ['impression', /(?:IMPRESSION|CONCLUSION|ASSESSMENT)\s*:?/i],
  ['recommendations', /RECOMMENDATIONS?\s*:?/i],
  ['addendum', /ADDENDUM\s*:?/i],
  // Soft stops — used to bound preceding sections, not exposed in output.
  ['_orderedBy', /Ordered\s*By\s*:?/i],
  ['_resultedOn', /Resulted\s*On\s*:?/i],
  ['_status', /Result\s*Status\s*:?/i],
  ['_phi', /Patient\s*PHI\s*Disclaimer/i],
];

const FINDINGS_SUBHEADERS = [
  ['lungs_pleura', /LUNGS?\s*\/?\s*(?:PLEURA|AIRWAYS?)?\s*:/i],
  ['mediastinum_vascular', /MEDIASTINUM\s*\/?\s*VASCULAR?\s*:/i],
  ['heart', /(?:HEART|CARDIAC)\s*:/i],
  ['lymph_nodes', /LYMPH\s*NODES?\s*:/i],
  ['bones_soft_tissues', /BONES?\s*\/?\s*SOFT\s*TISSUES?\s*:/i],
  ['upper_abdomen', /(?:UPPER\s*)?ABDOMEN\s*:/i],
  ['pelvis', /PELVIS\s*:/i],
  ['liver', /LIVER\s*:/i],
  ['spleen', /SPLEEN\s*:/i],
  ['kidneys', /KIDNEYS?\s*:/i],
  ['pancreas', /PANCREAS\s*:/i],
  ['adrenals', /ADRENAL[S]?\s*:/i],
  ['gallbladder', /GALLBLADDER\s*:/i],
  ['airways', /AIRWAYS?\s*:/i],
  ['vasculature', /VASCULATURE\s*:/i],
];

const STUDY_TYPE_RE = /\b(CT|MRI|X-?ray|XR|Ultrasound|US|Mammogram|Echo(?:cardiogram)?|DEXA|DXA|PET|Nuclear|Fluoroscopy)\b[^\n]*/i;

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

function splitSections(text) {
  // Find header positions, then slice body until the next header.
  const positions = [];
  for (const [key, re] of SECTION_HEADERS) {
    const r = new RegExp(re.source, 'gi');
    let m;
    while ((m = r.exec(text)) !== null) {
      positions.push({ key, start: m.index, end: m.index + m[0].length });
    }
  }
  positions.sort((a, b) => a.start - b.start);
  const sections = {};
  for (let i = 0; i < positions.length; i++) {
    const { key, end } = positions[i];
    const stop = i + 1 < positions.length ? positions[i + 1].start : text.length;
    const body = text.slice(end, stop).trim().replace(/\n{3,}/g, '\n\n');
    if (key.startsWith('_')) continue; // soft stop — used only to bound text
    if (sections[key]) sections[key] += '\n\n' + body;
    else sections[key] = body;
  }
  return sections;
}

function splitFindings(findingsText) {
  if (!findingsText) return { raw: '' };
  const positions = [];
  for (const [key, re] of FINDINGS_SUBHEADERS) {
    const r = new RegExp(re.source, 'gi');
    let m;
    while ((m = r.exec(findingsText)) !== null) {
      positions.push({ key, start: m.index, end: m.index + m[0].length });
    }
  }
  positions.sort((a, b) => a.start - b.start);
  if (positions.length === 0) return { raw: findingsText };
  const out = { raw: findingsText };
  for (let i = 0; i < positions.length; i++) {
    const { key, end } = positions[i];
    const stop = i + 1 < positions.length ? positions[i + 1].start : findingsText.length;
    out[key] = findingsText.slice(end, stop).trim();
  }
  return out;
}

function parseImpression(impressionText) {
  if (!impressionText) return [];
  const lines = impressionText.split(/\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  let current = '';
  for (const line of lines) {
    if (/^(?:\d+\.|\d+\)|[-•*])\s+/.test(line)) {
      if (current) items.push(current.trim());
      current = line.replace(/^(?:\d+\.|\d+\)|[-•*])\s+/, '');
    } else if (current) {
      current += ' ' + line;
    } else {
      current = line;
    }
  }
  if (current) items.push(current.trim());
  return items;
}

function parsePatient(text) {
  const out = {};
  const nameM = text.match(/(?:Patient|Name|Legal\s*Name)\s*:?\s*([A-Z][A-Za-z .'-]+(?:\s+[A-Z][A-Za-z .'-]+)+)/);
  if (nameM) out.name = nameM[1].trim();
  const dobM = text.match(/DOB\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (dobM) out.dob = dobM[1];
  const mrnM = text.match(/MRN\s*:?\s*([A-Z0-9-]+)/i);
  if (mrnM) out.mrn = mrnM[1];
  return out;
}

function parseMeta(text) {
  const out = {};
  const orderedM = text.match(/Ordered\s*By\s*:?\s*([^\n]+)/i);
  if (orderedM) out.orderedBy = orderedM[1].trim();
  const resultedM = text.match(/Resulted\s*On\s*:?\s*([^\n]+)/i);
  if (resultedM) out.resultedOn = resultedM[1].trim();
  const statusM = text.match(/Result\s*Status\s*:?\s*([^\n]+)/i);
  if (statusM) out.status = statusM[1].trim();
  return out;
}

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: parse_imaging.mjs <text.txt | extracted-dir>');
  process.exit(2);
}

const text = readInput(arg);
const studyMatch = text.match(STUDY_TYPE_RE);
const sections = splitSections(text);

const result = {
  studyType: studyMatch ? studyMatch[0].trim() : null,
  examDescription: sections.examDescription || null,
  technique: sections.technique || null,
  indication: sections.indication || null,
  comparison: sections.comparison || null,
  findings: splitFindings(sections.findings || ''),
  impression: parseImpression(sections.impression || ''),
  recommendations: sections.recommendations || null,
  addendum: sections.addendum || null,
  patient: parsePatient(text),
  ...parseMeta(text),
};

console.log(JSON.stringify(result, null, 2));
