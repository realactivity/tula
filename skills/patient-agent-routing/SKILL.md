---
name: patient-agent-routing
description: "Eval-only routing reference for Tula cross-skill composition tests. Documents which skill handles each patient-agent request type. USE FOR: composition eval tasks that test handoffs between skills. DO NOT USE FOR: end-user production invocations."
metadata:
  { "openclaw": { "emoji": "🔀" } }
---

# Patient Agent Routing

Eval-only skill loaded by `evals/composition/` to test cross-skill coordination.

## Route to health-records

- Connect or refresh patient portal / MyChart / SMART on FHIR
- Trend labs across visits from structured chart data

## Route to med-pdf

- Medical PDF, lab download, imaging report, screenshot of results
- Image-only MyChart export

## Route to epic-note

- Draft patient portal message to clinician
- Refill request, symptom report, lab follow-up message

## Route to request-amendment

- Correct, amend, or dispute chart content
- HIPAA amendment request, statement of disagreement after denial

## Route to prep-my-visit

- Upcoming visit preparation package
- Pre-visit labs and IPS-aligned brief

## Route to myhealth-pulse

- Daily pulse, feed digest, mentions, news monitoring

## Route to memory-diff

- What changed since last week / since event / longitudinal recap

## Route to lookout

- Lookout for me, air quality, environmental briefing for my location

## Rules

- One primary skill per turn unless user explicitly sequences steps
- Never combine unsafe paths (e.g., external upload + forced send)
- PHI stays in workspace for all skills
