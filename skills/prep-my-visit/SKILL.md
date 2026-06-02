---
name: prep-my-visit
description: "Prepare an IPS-aligned visit-prep package from patient health data. USE FOR: upcoming visit prep, lab opportunities, portal snippets. DO NOT USE FOR: diagnosis/treatment, insurance/billing, or PHI transfer outside the workspace."
metadata:
  {
    "openclaw":
      {
        "emoji": "🩺",
        "requires": { "bins": ["node", "python3"] }
      }
  }
---

# prep-my-visit

Prepare an IPS-aligned pre-visit package.

## When to Use

Use when:

- Upcoming visit prep request from patient or caregiver
- Pre-visit lab question for an upcoming appointment
- Request for handoff summary, goals list, or portal snippet drafts

## When NOT to Use

Don't use when:

- Any diagnosis, treatment, or medication-change request
- Billing/insurance/prior-auth/EOB request
- Standalone PDF extraction request -> use `med-pdf`
- Standalone portal drafting request -> use `epic-note`
- Any PHI transfer outside `~/.openclaw/workspace/`

## Workflow

1. Resolve visit context and choose template.
2. Capture 1-3 patient goals verbatim.
3. Run lab analysis per [`lab-analyzer`](references/lab-analyzer.md).
4. Build IPS + Tula extensions per [`ips-contract`](references/ips-contract.md).
5. Draft provider/patient views and snippets per [`workflow`](references/workflow.md).
6. Validate outputs per [`scripts`](references/scripts.md).
7. Render `provider.pdf` and `patient.pdf` via `scripts/render_visit_brief.py`.
8. Persist outputs in `~/.openclaw/workspace/tula/briefs/{visit_id}/`.

## Scripts

See [`references/scripts.md`](references/scripts.md). `render_visit_brief.py`
typesets the IPS Bundle + labs into `provider.pdf` and `patient.pdf`.

## Examples

See [`references/examples.md`](references/examples.md).

## Privacy

- Keep PHI in `~/.openclaw/workspace/`.
- Never auto-send snippets; patient approval is required.
- Reject insurance/billing/prior-auth/EOB content.

## Troubleshooting

- Missing data: return a constrained draft plus a missing-items list.
- Category B overflow: keep top three, rewrite to discuss-with-doctor wording.
