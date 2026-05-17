# Clinical Significance Tiers

Rubric for classifying changes the skill finds in memory. Three tiers, each
with concrete signals. The rubric is intentionally a subset of
`med-pdf/references/healthspan-priorities.md` reframed for *change
detection* rather than priority surfacing. When the two files drift,
healthspan-priorities is the authority on absolute thresholds; this file
is the authority on what constitutes a tier-worthy change.

(Future reconciliation: when the user dashboard app ships, both files will
be regenerated from a shared rule set the user can tune. For now, edit by
hand and accept the drift risk.)

## Tier 1 — Signal (always surface)

Changes a user needs to know about today.

### Lab / biomarker changes

- **New abnormal value** in any tracked marker: apoB, Lp(a), LDL-C,
  non-HDL, hs-CRP, HbA1c, fasting insulin, ALT, AST, GGT, eGFR, UACR,
  TSH, total testosterone, vitamin D 25-OH, B12.
- **>20% change in any tracked marker** compared to the most recent
  prior value, regardless of whether the value crosses an abnormal
  threshold.
- **Abnormal-to-normal resolution** of any prior abnormal marker —
  celebrate progress.
- **First-ever** entry of any of: CAC score, Lp(a), apoB, fasting
  insulin, UACR.

### Medication changes

- **New medication started** — name, dose, indication if available.
- **Medication discontinued** — name, why (if noted).
- **Dose change** — old dose → new dose.

### Diagnosis / condition changes

- **New active condition** — added to problem list.
- **Condition resolved** — moved off active list.
- **Status change** — "uncontrolled" → "controlled", or vice versa.

### Imaging / procedure findings

- **New finding mentioned in any imaging report** (CT, MRI, US, X-ray,
  mammogram, DEXA, echo, PET) — especially nodules, calcifications,
  steatosis, lymphadenopathy.
- **Worsening or growth** of a previously-noted finding.

### Visits / referrals

- **New visit completed** since the reference point.
- **New referral placed** to a specialist.
- **New diagnostic order** placed but not yet resulted.

## Tier 2 — Notable (surface unless prompt is narrow)

Worth mentioning but not urgent.

- **Stable abnormality continuing** without change (e.g., apoB still
  elevated, no change since last reading).
- **Mild trend** that doesn't yet meet the 20% threshold but is moving in
  one direction over ≥3 readings.
- **New appointment scheduled** in the next 30 days.
- **New pulse-cache entries** matching one of the user's primary topics
  (from `myhealth-pulse` profile).
- **Routine refill** of an existing medication.
- **Resolved Tier 2 from a prior diff** — keep visible for one cycle so
  the user sees the closure.

## Tier 3 — Noise (collapse to count)

Don't list individually; emit a single line like
`12 routine entries (memory notes, calendar items, low-relevance pulse links)`.

- Routine memory-note entries with no clinical content.
- Calendar items unrelated to health.
- Pulse items below the user's `keep_score` threshold.
- File timestamps from cache rewrites with no content delta.
- Repeat entries of an already-Tier-1-or-2 item.

## What's NOT a change

Don't tier these:

- The agent reading or re-organizing memory — that's a meta-event, not a
  health event.
- Routine cache rebuilds (`.med-pdf-cache/` re-extractions of the same PDF).
- The same fact appearing in multiple sources within the window — that's a
  source overlap, not a new event. Surface once with the highest-precedence
  source.
