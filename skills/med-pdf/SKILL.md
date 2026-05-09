---
name: med-pdf
description: "Reads medical PDFs (labs, radiology, MyChart/Epic exports, discharge summaries, pathology) and turns them into structured JSON Tula can reason over. USE FOR: Paul sharing a health-related PDF, image, or screenshot, or asking to compare results across visits. DO NOT USE FOR: non-medical PDFs, generating new clinical reports, or sending PHI outside the workspace."
metadata:
  {
    "openclaw":
      {
        "emoji": "🩺",
        "requires": { "bins": ["node"] }
      }
  }
---

# med-pdf

## When to Use

✅ Use when:

- Paul sends a medical PDF (labs, radiology, discharge, pathology)
- Paul shares a screenshot/image of clinical results
- Paul asks to compare results across visits or trend a value
- A MyChart/Epic export needs parsing before reasoning

## When NOT to Use

❌ Don't use when:

- The PDF is non-medical (insurance, EOB, billing)
- Paul wants to author a clinical message → use `epic-note`
- Anything that would send PHI outside the workspace

## Workflow

1. **Extract** — `node {baseDir}/scripts/extract.mjs <input.pdf> <outDir>`
   - `outDir` must be inside `~/.openclaw/workspace/`. Suggested:
     `~/.openclaw/workspace/.med-pdf-cache/<slug>/`.
   - Outputs `text.txt`, `pageN.png`, `meta.json`. Stdout JSON has
     `numPages`, `hasText`, `textChars`.

2. **Branch on `hasText`:**
   - `true` → skip OCR, feed `text.txt` to parsers.
   - `false` → image-only (MyChart/Epic). Use the `image` tool on
     `pageN.png` for verbatim transcription. Save as `text.txt`, continue.

3. **Parse:**
   - Imaging → `node {baseDir}/scripts/parse_imaging.mjs <outDir>`
   - Labs → `node {baseDir}/scripts/parse_labs.mjs <outDir>`
   - Both can run on a mixed document.

4. **Reason.** Pull abnormal flags, compare to prior values, surface what
   matters for healthspan — see
   [`references/healthspan-priorities.md`](references/healthspan-priorities.md).
   Don't just summarize.

5. **Persist.** Append to `~/.openclaw/workspace/memory/YYYY-MM-DD.md` and
   update trends in `MEMORY.md`. PHI stays in workspace memory only.

## Scripts

See [`references/scripts.md`](references/scripts.md) for per-script flags,
output schemas, and dictionary maintenance for `parse_labs.mjs`.

## Examples

See [`references/examples.md`](references/examples.md) for end-to-end runs
(text-extractable Quest/LabCorp PDF, image-only MyChart CT export).

## Privacy

Medical PDFs contain PHI (name, DOB, MRN, providers).

- Cache stays under `~/.openclaw/workspace/.med-pdf-cache/`. Don't copy out.
- Never send raw PDFs or PHI to web search or external services.
- The `image` tool is acceptable — same trust boundary as the assistant.
- Redact MRN if a summary might leave the workspace.

## Troubleshooting

- `parse_labs.mjs` returns mostly `unmatchedLines` → text wasn't transcribed
  well. Re-run `extract.mjs` with `--scale=3.0` and re-OCR.
- A labeled value sits in `unmatchedLines` → add an alias to the dictionary
  in `parse_labs.mjs`. See
  [`references/scripts.md`](references/scripts.md#maintaining-the-dictionary).
- `hasText: true` but parsing yields garbage → PDF has hidden Unicode
  ligatures; force OCR with `--images-only`.
