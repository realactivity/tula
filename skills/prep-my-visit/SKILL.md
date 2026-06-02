---
name: prep-my-visit
description: "Prepares an IPS-aligned pre-visit package (provider + patient brief, lab opportunities, portal-snippet drafts) from workspace health data. USE FOR: upcoming visit prep, pre-visit lab questions, handoff summaries. DO NOT USE FOR: diagnosis/treatment/medication changes, insurance/billing/prior-auth, PDF extraction (use med-pdf), standalone portal drafting (use epic-note), or PHI transfer outside the workspace."
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

## When to Use

- Upcoming visit prep request from patient or caregiver
- Pre-visit lab question for an upcoming appointment
- Request for handoff summary, goals list, or portal snippet drafts

## When NOT to Use

- Any diagnosis, treatment, or medication-change request
- Billing/insurance/prior-auth/EOB request
- Standalone PDF extraction -> use `med-pdf`
- Standalone portal drafting -> use `epic-note`
- Any PHI transfer outside `~/.openclaw/workspace/`

## Workflow

1. Resolve visit context, choose template, capture 1-3 goals verbatim.
2. Run lab analysis and build IPS + Tula extensions per
   [`visit-prep-guide`](references/visit-prep-guide.md).
3. Draft provider/patient views and snippets; validate per
   [`scripts`](references/scripts.md).
4. Render `provider.pdf` and `patient.pdf` via `scripts/render_visit_brief.py`.
5. Persist outputs in `~/.openclaw/workspace/tula/briefs/{visit_id}/`.

## Scripts

See [`references/scripts.md`](references/scripts.md).

## Examples

See [`references/examples.md`](references/examples.md).

## Privacy

- Keep PHI in `~/.openclaw/workspace/`; never auto-send snippets.
- Reject insurance/billing/prior-auth/EOB content.

## Troubleshooting

- Missing data: return a constrained draft plus a missing-items list.
- Category B overflow: keep top three, rewrite to discuss-with-doctor wording.
