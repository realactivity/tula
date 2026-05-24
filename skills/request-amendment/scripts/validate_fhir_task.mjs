#!/usr/bin/env node
import fs from "node:fs/promises";
import process from "node:process";

const REQUIRED_FIELDS = ["resourceType", "status", "intent", "input", "authoredOn"];
const ALLOWED_STATUS = new Set([
  "draft",
  "requested",
  "received",
  "accepted",
  "rejected",
  "ready",
  "cancelled",
  "in-progress",
  "on-hold",
  "failed",
  "completed",
  "entered-in-error"
]);
const ALLOWED_INTENT = new Set(["proposal", "plan", "order"]);

function hasInputSourceReference(input) {
  if (!Array.isArray(input)) {
    return false;
  }

  return input.some((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const str = JSON.stringify(entry).toLowerCase();
    return (
      str.includes("excerpt") ||
      str.includes("reference") ||
      str.includes("record") ||
      str.includes("documentreference")
    );
  });
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node validate_fhir_task.mjs <task.json>");
    process.exit(1);
  }

  const errors = [];
  const warnings = [];
  let payload;

  try {
    const raw = await fs.readFile(path, "utf8");
    payload = JSON.parse(raw);
  } catch (err) {
    errors.push(`Unable to read/parse JSON: ${err.message}`);
    console.log(JSON.stringify({ valid: false, errors, warnings, summary: "parse_failed" }, null, 2));
    process.exit(0);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in payload)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (payload.resourceType !== "Task") {
    errors.push("resourceType must be Task.");
  }

  if (typeof payload.status === "string" && !ALLOWED_STATUS.has(payload.status)) {
    errors.push(`Unsupported status value: ${payload.status}`);
  }

  if (typeof payload.intent === "string" && !ALLOWED_INTENT.has(payload.intent)) {
    errors.push(`Unsupported intent value: ${payload.intent}`);
  }

  if (!hasInputSourceReference(payload.input)) {
    warnings.push("input does not clearly contain source excerpt/reference evidence.");
  }

  if (!payload.for) {
    warnings.push("Missing 'for' patient reference.");
  }

  if (!payload.owner) {
    warnings.push("Missing 'owner' target organization.");
  }

  const valid = errors.length === 0;
  console.log(
    JSON.stringify(
      {
        valid,
        errors,
        warnings,
        summary: valid ? "ok" : "invalid"
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ valid: false, errors: [err.message], warnings: [], summary: "runtime_error" }, null, 2));
  process.exit(1);
});
