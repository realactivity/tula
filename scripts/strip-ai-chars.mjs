#!/usr/bin/env node
// Replace AI-typical Unicode characters with ASCII equivalents in given files.
// Usage: node scripts/strip-ai-chars.mjs <file...>

import fs from "node:fs";

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

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node strip-ai-chars.mjs <file...>");
  process.exit(1);
}

let totalChanges = 0;
for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  let cleaned = original;
  const counts = {};
  for (const [from, to] of REPLACEMENTS) {
    const before = cleaned.length;
    const matches = (cleaned.match(new RegExp(from, "g")) || []).length;
    if (matches > 0) {
      cleaned = cleaned.split(from).join(to);
      counts[from.codePointAt(0).toString(16)] = matches;
      totalChanges += matches;
    }
  }
  if (cleaned !== original) {
    fs.writeFileSync(file, cleaned);
    const summary = Object.entries(counts)
      .map(([cp, n]) => `U+${cp.toUpperCase()}=${n}`)
      .join(" ");
    console.log(`${file}: ${summary}`);
  } else {
    console.log(`${file}: clean`);
  }
}
console.log(`---\ntotal replacements: ${totalChanges}`);
