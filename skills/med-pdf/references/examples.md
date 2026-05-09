# Worked Examples

Two end-to-end runs that cover the common cases.

## Quest / LabCorp downloaded PDF (text-extractable)

```bash
mkdir -p ~/.openclaw/workspace/.med-pdf-cache/labs_2026_04
node {baseDir}/scripts/extract.mjs labs_2026_04.pdf ~/.openclaw/workspace/.med-pdf-cache/labs_2026_04
# stdout shows hasText:true → skip OCR
node {baseDir}/scripts/parse_labs.mjs ~/.openclaw/workspace/.med-pdf-cache/labs_2026_04
```

Then read the resulting JSON, scan `abnormal[]` for flags, compare against
prior runs in `~/.openclaw/workspace/memory/`, and append a dated note in
`memory/YYYY-MM-DD.md`.

## MyChart / Epic CT chest export (image-only PDF)

```bash
mkdir -p ~/.openclaw/workspace/.med-pdf-cache/chest_ct_2023
node {baseDir}/scripts/extract.mjs /path/to/file.pdf ~/.openclaw/workspace/.med-pdf-cache/chest_ct_2023
# stdout shows hasText:false → use the image tool to transcribe pageN.png
# Save the verbatim transcription as:
#   ~/.openclaw/workspace/.med-pdf-cache/chest_ct_2023/text.txt
node {baseDir}/scripts/parse_imaging.mjs ~/.openclaw/workspace/.med-pdf-cache/chest_ct_2023
```

Then surface the impression, compare against any prior chest imaging in
memory, flag any new or progressing findings, and write a dated note.

## Mixed document (lab panel with embedded imaging summary)

Run both parsers on the same `outDir`:

```bash
node {baseDir}/scripts/parse_labs.mjs ~/.openclaw/workspace/.med-pdf-cache/visit_2026_03
node {baseDir}/scripts/parse_imaging.mjs ~/.openclaw/workspace/.med-pdf-cache/visit_2026_03
```

Each parser operates on the same `text.txt`; they don't interfere.
