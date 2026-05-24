---
name: health-records
description: "Pulls Paul's medical records from patient portals (Epic MyChart, Oracle/Cerner) via end-to-end-encrypted SMART on FHIR, into per-provider JSON files Tula can reason over. USE FOR: connecting or refreshing records, trending labs across visits, listing meds/conditions/allergies, searching clinical notes. DO NOT USE FOR: parsing a PDF (use med-pdf), drafting clinician messages (use epic-note), or sending PHI outside the workspace."
metadata:
  {
    "openclaw":
      {
        "emoji": "🔗",
        "homepage": "https://github.com/jmandel/health-skillz",
        "requires": { "bins": ["node"] }
      }
  }
---

# health-records

## When to Use

✅ Use when:

- Paul asks to connect, link, refresh, or pull records from a patient portal
- Trending a lab, vital, or medication across multiple visits
- "What does my chart say about X" (problems, meds, allergies, immunizations)
- Searching clinical notes for a topic, symptom, or referral

## When NOT to Use

❌ Don't use when:

- Paul sends a PDF or screenshot → use `med-pdf`
- Paul wants to draft a clinician message → use `epic-note`
- Records already pulled this session - read the existing JSON
- Anything that would send PHI to an external service

## Workflow

1. **Check backend first** - `node {baseDir}/scripts/check-backend.mjs`
   - Confirms `/health` and `/api/vendors` are reachable.
   - If self-hosted, set `HEALTH_SKILLZ_BASE_URL` before this step.

2. **Create session** - `node {baseDir}/scripts/create-session.mjs`
   - Outputs JSON: `sessionId`, `userUrl`, `privateKeyJwk`.
   - **Save `privateKeyJwk`** for step 3. Never echo it back.

3. **Show the link.** Present `userUrl` to Paul as a single markdown link
   labeled "Connect your health records". Don't narrate the crypto. Wait
   for Paul to finish the OAuth flow; he may connect multiple providers.

4. **Finalize & decrypt** -
   `node {baseDir}/scripts/finalize-session.mjs <sessionId> '<privateKeyJwk>' <outDir>`
   - `outDir` inside `~/.openclaw/workspace/`. Suggested:
     `~/.openclaw/workspace/.health-records-cache/<YYYY-MM-DD>/`.
   - NDJSON progress on stdout; final line is `{"status":"done",...}`.
   - One JSON file per provider, slugified by name.

5. **Reason.** Open with one clinical sentence (scope, span, what stands
   out), then 2-3 specific directions tied to *what's actually there* -
   not a generic dashboard. See
   [`references/fhir-guide.md`](references/fhir-guide.md) for resource
   shapes, LOINC codes, and the analysis philosophy.

6. **Persist.** Update `MEMORY.md` with new facts (active conditions,
   current meds, key lab trends). Records JSON stays in the cache dir.

## Scripts

See [`references/scripts.md`](references/scripts.md) for full flags, output
schemas, and instrumentation flags.

## Examples

See [`references/examples.md`](references/examples.md) for the Epic sandbox
walkthrough (`fhircamila / epicepic1`) and a real-portal connect.

## Privacy

A full FHIR export is more sensitive than any single PDF - diagnoses, meds,
notes, contact info, everything in one place.

- Decryption is local. Backend operator cannot read the data (E2E encrypted
  under a key only this skill holds).
- Cache stays under `~/.openclaw/workspace/.health-records-cache/`. Never
  copy out, paste into web tools, or include in summaries leaving the workspace.
- Never echo `privateKeyJwk` to Paul or to memory files. Treat as a password.
- If a summary must leave the workspace, redact MRN and provider IDs.

## Troubleshooting

- **Timeout** → Paul didn't finish in the browser. Re-run from step 1.
- **Decryption fails** → wrong/truncated `privateKeyJwk`. Start over.
- **Provider file >50MB** → long history. Use `fhir-guide.md` search
  patterns; never `JSON.parse` the whole file into chat context.
- **`fetch is not defined`** → need Node 18+ (Node 22 verified).
- **Backend down** → run `check-backend.mjs`; set `HEALTH_SKILLZ_BASE_URL` to a reachable self-hosted instance.

## Acknowledgments

This skill is a derivative of Joshua Mandel's
[`jmandel/health-skillz`](https://github.com/jmandel/health-skillz), used
under the MIT License. The wire protocol design (ECDH P-256 + AES-GCM
chunked streaming), the FHIR R4 resource access patterns, the LOINC quick
reference, and the "open with a clinical sentence, not a generic dashboard"
analysis philosophy all originate in his TypeScript / Bun implementation.

What this skill adds on top:

- Node ESM port of the scripts so they run under OpenClaw's bundled Node 22
  with no Bun runtime dependency.
- Re-shaping to openclaw skill conventions (frontmatter, progressive
  disclosure into `references/`, body-section order per the repo-level
  `skills/AGENTS.md`).
- Tula-specific PHI guardrails - refuse external upload, confine outputs
  to `~/.openclaw/workspace/`, never echo `privateKeyJwk`.
- Waza-evaluable test harness under `evals/health-records/`.

The hosted backend at `health-skillz.joshuamandel.com` is also Josh's. Set
`HEALTH_SKILLZ_BASE_URL` to point at a self-hosted instance if you'd rather
not depend on it. See [`LICENSE`](LICENSE) in this directory for full terms.
