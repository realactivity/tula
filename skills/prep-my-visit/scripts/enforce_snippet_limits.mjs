#!/usr/bin/env node
import fs from "node:fs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node enforce_snippet_limits.mjs <snippets.json>");
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: ["invalid_json"], detail: String(error) }));
  process.exit(1);
}

const snippets = Array.isArray(payload?.snippets) ? payload.snippets : [];
const errors = [];
const warnings = [];
const bannedTerms = [
  /\binsurance\b/i,
  /\bbilling\b/i,
  /\bprior auth\b/i,
  /\bEOB\b/i,
  /\bpayor\b/i,
];

if (snippets.length === 0) {
  warnings.push("no_snippets_found");
}

for (const [index, item] of snippets.entries()) {
  const text = String(item?.text ?? "");
  if (text.length > 500) {
    errors.push(`snippet_too_long:${index}:${text.length}`);
  }

  if (!/review before sending|approve before sending|patient review required/i.test(text)) {
    warnings.push(`snippet_missing_approval_language:${index}`);
  }

  for (const pattern of bannedTerms) {
    if (pattern.test(text)) {
      errors.push(`snippet_contains_non_health_domain_content:${index}`);
      break;
    }
  }
}

const result = { ok: errors.length === 0, errors, warnings };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
