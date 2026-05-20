# Scripts Reference

All scripts live in `{baseDir}/scripts/`. Run them from anywhere - they take
absolute paths.

## extract.mjs

```
node {baseDir}/scripts/extract.mjs <input.pdf> [outDir] [--scale=2.0] [--text-only] [--images-only]
```

- Runs `pdfjs-dist` for text extraction AND `@napi-rs/canvas` for page rendering.
- The `hasText` heuristic in `meta.json` is `>200` non-whitespace characters
  across the doc. Trust it - it correctly distinguishes text-bearing PDFs
  (Quest, LabCorp, faxed reports) from image-only ones (MyChart/Epic exports
  where text is rendered as outlined vector paths).
- `--scale=2.0` is the default page-render scale for OCR. Bump higher for
  small print, lower for speed.
- `--text-only` skips page rendering when you know the PDF is text-extractable.
- `--images-only` skips text extraction when you know it'll fail (legacy MyChart).

### Output schema (stdout JSON)

```json
{
  "numPages": 4,
  "hasText": false,
  "textChars": 12,
  "pages": [
    { "page": 1, "textChars": 0, "imagePath": ".../page1.png" },
    { "page": 2, "textChars": 0, "imagePath": ".../page2.png" }
  ]
}
```

### Output files (in `outDir`)

- `text.txt` - concatenated text (empty if `hasText: false`)
- `pageN.png` - rendered page images
- `pageN.text.txt` - per-page extracted text
- `meta.json` - full extraction metadata

## parse_labs.mjs

```
node {baseDir}/scripts/parse_labs.mjs <text.txt | extracted-dir>
```

Outputs JSON with `labs[]`, `abnormal[]`, `unmatchedLines[]`, `stats`.

- Scans line-by-line against an alias dictionary covering ~50 healthspan-
  relevant labs: lipids, metabolic, liver, kidney, thyroid, hormones,
  vitamins, CBC, inflammation.
- Flag derivation order: numeric range first (most reliable), then explicit
  `H` / `L` token. Word-boundary aware so units like `U/L` and `mg/dL` don't
  trigger false positives.

### Maintaining the dictionary

**Always check `unmatchedLines` after a run.** When something looks like a
labeled numeric value but wasn't matched, add it to the alias dictionary in
the script. The dictionary is the parser's intelligence - keep it growing.

## parse_imaging.mjs

```
node {baseDir}/scripts/parse_imaging.mjs <text.txt | extracted-dir>
```

Section-header splitter for radiology reports. Returns:

- `studyType` (CT, MRI, X-ray, US, mammogram, DEXA, echo, PET)
- `examDescription`, `technique`, `indication`, `comparison`
- `findings.{lungs_pleura, mediastinum_vascular, lymph_nodes, bones_soft_tissues, upper_abdomen, ...}`
- `impression[]`, `recommendations`, `addendum`
- `patient`, `orderedBy`, `resultedOn`, `status`

Works on standard hospital templates and MyChart/Epic radiology exports.

## Both parsers

- Accept either a `text.txt` file OR a directory containing `text.txt`.
- Emit JSON to stdout.
- Exit 0 on success, non-zero on parse error.
