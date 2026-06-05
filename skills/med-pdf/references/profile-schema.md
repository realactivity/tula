# Profile Schema

Personalization for `med-pdf` lives outside the skill. The skill reads
identity fields from the workspace profile for addressing; it never embeds
a real user's name or medical history in source.

## Where the profile lives

Resolution order, first hit wins:

1. `skills.entries.med-pdf.profile` in `openclaw.json`
2. `MED_PDF_PROFILE` env var (absolute path)
3. `~/.openclaw/workspace/memory/profile.yaml` (default; shared with
   other Tula skills)

If no profile resolves, use neutral second-person ("you") in responses.
Do not fabricate a name.

## Schema (keys this skill reads)

```yaml
version: 1

identity:
  display_name: "Your Full Name"   # optional
  short_name: "Your"               # optional
  pronouns: "they/them"            # optional
```

## What does NOT belong in the profile

- Lab values, imaging findings, or document content
- Provider names, MRNs, or insurance IDs
- Paths to real PDF files on disk

Parsed document content lives under
`~/.openclaw/workspace/.med-pdf-cache/` after extraction.

## Eval fixtures

Eval suites use the synthetic persona **Dylan Meyer**. See
`evals/med-pdf/fixtures/`.
