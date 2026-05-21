#!/usr/bin/env node
// Replace AI-typical Unicode characters with ASCII equivalents.
// Usage:
//   node scripts/strip-ai-chars.mjs <file|dir...>           # default exts: md,mdx,ts,tsx,js,jsx,mjs,cjs
//   node scripts/strip-ai-chars.mjs --ext md,mdx <dir...>   # restrict to extensions
//   node scripts/strip-ai-chars.mjs --dry <file|dir...>     # report only
//
// Directories are walked recursively. Standard build/vendor dirs are skipped
// (node_modules, .next, .turbo, dist, build, out, .git, coverage, agent-transcripts, .cache).
// This script never modifies itself.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const REPLACEMENTS = [
  ["\u2014", "-"], // em dash —
  ["\u2013", "-"], // en dash –
  ["\u2212", "-"], // minus −
  ["\u201C", '"'], // left double quote “
  ["\u201D", '"'], // right double quote ”
  ["\u201E", '"'], // double low-9 quote „
  ["\u2018", "'"], // left single quote ‘
  ["\u2019", "'"], // right single quote ’
  ["\u201A", "'"], // single low-9 quote ‚
  ["\u2026", "..."], // ellipsis …
  ["\u00A0", " "], // non-breaking space
  ["\u2009", " "], // thin space
  ["\u200B", ""], // zero-width space
  ["\u200C", ""], // zero-width non-joiner
  ["\u200D", ""], // zero-width joiner
  ["\uFEFF", ""], // BOM
  ["\u2022", "*"], // bullet •
];

const DEFAULT_EXTS = ["md", "mdx", "ts", "tsx", "js", "jsx", "mjs", "cjs"];

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "out",
  ".git",
  "coverage",
  "agent-transcripts",
  ".cache",
]);

const { values, positionals } = parseArgs({
  options: {
    ext: { type: "string" },
    dry: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

if (positionals.length === 0) {
  console.error(
    "usage: node scripts/strip-ai-chars.mjs [--ext md,tsx,...] [--dry] <file|dir...>"
  );
  process.exit(1);
}

const allowedExts = new Set(
  (values.ext ? values.ext.split(",") : DEFAULT_EXTS).map((e) =>
    e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`
  )
);

const selfPath = path.resolve(fileURLToPath(import.meta.url));

const targets = [];
for (const arg of positionals) {
  const abs = path.resolve(arg);
  if (!fs.existsSync(abs)) {
    console.error(`skip (not found): ${arg}`);
    continue;
  }
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    walk(abs);
  } else {
    targets.push(abs);
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
    } else if (entry.isFile() && allowedExts.has(path.extname(entry.name).toLowerCase())) {
      targets.push(p);
    }
  }
}

let totalChanges = 0;
let changedFiles = 0;
let scannedFiles = 0;

for (const file of targets) {
  if (path.resolve(file) === selfPath) continue; // never rewrite self
  scannedFiles++;
  const original = fs.readFileSync(file, "utf8");
  let cleaned = original;
  const counts = {};
  for (const [from, to] of REPLACEMENTS) {
    const matches = (cleaned.match(new RegExp(from, "g")) || []).length;
    if (matches > 0) {
      cleaned = cleaned.split(from).join(to);
      counts[from.codePointAt(0).toString(16)] = matches;
      totalChanges += matches;
    }
  }
  if (cleaned !== original) {
    changedFiles++;
    if (!values.dry) fs.writeFileSync(file, cleaned);
    const summary = Object.entries(counts)
      .map(([cp, n]) => `U+${cp.toUpperCase()}=${n}`)
      .join(" ");
    const rel = path.relative(process.cwd(), file);
    console.log(`${values.dry ? "[dry] " : ""}${rel}: ${summary}`);
  }
}

console.log(
  `---\nscanned: ${scannedFiles} files, changed: ${changedFiles}, replacements: ${totalChanges}${
    values.dry ? " (dry run)" : ""
  }`
);
