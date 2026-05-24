#!/usr/bin/env node
import fs from "node:fs/promises";
import process from "node:process";

const PATTERNS = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  dob: /\b(?:DOB[:\s]*)?(?:19|20)\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])\b/gi,
  mrn: /\b(?:MRN[:\s#-]*)?[A-Z0-9]{6,12}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g
};

function redactText(text, counts) {
  let result = text;
  for (const [type, regex] of Object.entries(PATTERNS)) {
    let localCount = 0;
    result = result.replace(regex, () => {
      localCount += 1;
      return `[REDACTED_${type.toUpperCase()}]`;
    });
    counts[type] = (counts[type] || 0) + localCount;
  }
  return result;
}

function redactObject(value, counts) {
  if (typeof value === "string") {
    return redactText(value, counts);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item, counts));
  }
  if (value && typeof value === "object") {
    const next = {};
    for (const [key, v] of Object.entries(value)) {
      next[key] = redactObject(v, counts);
    }
    return next;
  }
  return value;
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    console.error("Usage: node redact_phi_for_eval.mjs <input.json> <output.json>");
    process.exit(1);
  }

  const counts = {};
  let parsed;

  try {
    const raw = await fs.readFile(inputPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(JSON.stringify({ status: "error", error: err.message }, null, 2));
    process.exit(1);
  }

  const redacted = redactObject(parsed, counts);
  await fs.writeFile(outputPath, JSON.stringify(redacted, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        status: "ok",
        counts,
        warnings: [
          "Pre-eval redaction only.",
          "Manual spot check required before treating fixture as de-identified."
        ]
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", error: err.message }, null, 2));
  process.exit(1);
});
