#!/usr/bin/env node
import fs from "node:fs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node validate_lab_opportunities.mjs <lab-opportunities.json>");
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: ["invalid_json"], detail: String(error) }));
  process.exit(1);
}

const errors = [];
const warnings = [];
const categoryA = Array.isArray(payload?.categoryA) ? payload.categoryA : [];
const categoryB = Array.isArray(payload?.categoryB) ? payload.categoryB : [];
const categoryC = Array.isArray(payload?.categoryC) ? payload.categoryC : [];
const dtcOptIn = Boolean(payload?.dtcOptIn);

if (categoryB.length > 3) {
  errors.push("category_b_exceeds_limit");
}

const imperativePatterns = [
  /\b(get|schedule|order|buy)\b.{0,20}\b(test|lab|panel)\b/i,
  /\byou should\b/i,
];

for (const [index, item] of categoryB.entries()) {
  const citation = item?.citation ?? {};
  const rationale = String(item?.rationale ?? "");
  const guidance = String(item?.guidance ?? "");

  if (!citation?.guideline || !citation?.version) {
    errors.push(`category_b_missing_citation:${index}`);
  }

  if (!/ask your doctor|discuss with (your )?doctor/i.test(guidance)) {
    errors.push(`category_b_missing_discuss_with_doctor_language:${index}`);
  }

  if (imperativePatterns.some((pattern) => pattern.test(`${rationale} ${guidance}`))) {
    errors.push(`category_b_imperative_language:${index}`);
  }
}

if (categoryC.length > 0 && !dtcOptIn) {
  errors.push("category_c_without_opt_in");
}

if (categoryA.length === 0 && categoryB.length === 0 && categoryC.length === 0) {
  warnings.push("no_lab_opportunities");
}

const result = { ok: errors.length === 0, errors, warnings };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
