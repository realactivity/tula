---
name: prep-my-visit
description: "Prepare an IPS-aligned visit-prep package from patient health data. USE FOR: upcoming visit prep, lab opportunities, and portal snippets. DO NOT USE FOR: diagnosis/treatment, insurance/billing tasks, or PHI transfer outside the workspace."
metadata:
  {
    "openclaw":
      {
        "emoji": "🧭",
        "requires": { "bins": ["node"] }
      }
  }
---

# prep-my-visit

Prepare an IPS-aligned pre-visit package.

## When to Use

✅ Use when:

- Upcoming visit prep request from patient or caregiver
- Pre-visit lab question for an upcoming appointment
- Request for handoff summary, goals list, or portal snippet drafts

## When NOT to Use

❌ Don't use when:

- Any diagnosis, treatment, or medication-change request
- Billing/insurance/prior-auth/EOB request
- Standalone PDF extraction request -> use `med-pdf`
- Standalone portal drafting request -> use `epic-note`
- Any PHI transfer outside `~/.openclaw/workspace/`

## Workflow

1. Resolve visit context and choose template.
2. Capture 1-3 patient goals verbatim.
3. Run lab analysis using [`references/lab-analyzer.md`](references/lab-analyzer.md).
4. Build IPS + Tula extensions using [`references/ips-contract.md`](references/ips-contract.md).
5. Draft provider/patient views and snippets using [`references/workflow.md`](references/workflow.md).
6. Validate outputs with [`references/scripts.md`](references/scripts.md).
7. Persist outputs in `~/.openclaw/workspace/tula/briefs/{visit_id}/`.

## Scripts

Run the commands documented in [`references/scripts.md`](references/scripts.md).

## Examples

See [`references/examples.md`](references/examples.md).

## Privacy

- Keep PHI in `~/.openclaw/workspace/`.
- Never auto-send snippets; patient approval is required.
- Reject insurance/billing/prior-auth/EOB content.

## Troubleshooting

- Missing data: return constrained draft + missing-items list.
- Category B overflow or imperative phrasing: keep top three and rewrite to discuss-with-doctor wording.
