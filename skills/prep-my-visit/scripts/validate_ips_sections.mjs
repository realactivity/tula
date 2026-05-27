#!/usr/bin/env node
import fs from "node:fs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node validate_ips_sections.mjs <composition.json>");
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: ["invalid_json"], detail: String(error) }));
  process.exit(1);
}

const requiredSections = ["Problem List", "Allergies and Intolerances", "Medication Summary"];
const tulaExtensions = ["Patient Story", "Pre-Visit Lab Opportunities", "Delta Since Last Visit With This Provider"];
const knownOptional = ["Immunizations", "Diagnostic Results", "History of Procedures", "Medical Devices", "Vital Signs", "Plan of Care", "Social History", "Alerts", "Functional Status", "History of Past Problems"];

const sections = Array.isArray(payload?.sections)
  ? payload.sections
  : Array.isArray(payload?.section)
    ? payload.section.map((item) => item?.title ?? item?.code?.text).filter(Boolean)
    : [];

const errors = [];
const warnings = [];

for (const sectionName of requiredSections) {
  if (!sections.includes(sectionName)) {
    errors.push(`missing_required_section:${sectionName}`);
  }
}

for (const extensionName of tulaExtensions) {
  if (!sections.includes(extensionName)) {
    warnings.push(`missing_tula_extension:${extensionName}`);
  }
}

for (const sectionName of sections) {
  if (!requiredSections.includes(sectionName) && !tulaExtensions.includes(sectionName) && !knownOptional.includes(sectionName)) {
    warnings.push(`unknown_section:${sectionName}`);
  }
}

const result = { ok: errors.length === 0, errors, warnings };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
