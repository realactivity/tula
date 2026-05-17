# Examples

Four realistic outputs covering the common cases. All examples use the
synthetic patient persona "Dylan Meyer" (he/him, age 51) — fictional
patient with hypertension, prediabetes, and an elevated apoB. His PCP in
the fixtures is the synthetic Dr. Dave Matthews.

## Since last week (default 7d window)

Input: `What's changed in my health since last week?`

```
**Tier 1 — Signal**

- **HbA1c improved 6.0 → 5.8** (memory/2026-05-10.md) — first sub-6.0
  reading since tracking began. Lifestyle changes working.
- **Home BP trending down** — 138/88 → 122/78 across 10 days
  (memory/2026-05-10.md, MEMORY.md). Lisinopril effect or measurement
  noise; one more week will tell.

**Tier 2 — Notable**

- **apoB recheck still pending** — last value 130 from 2026-04-25;
  Dr. Dave Matthews recommended 6-week recheck (memory/2026-04-30.md).
  Window closes ~2026-06-11.
- **New pulse mention**: "USCDI v4 inflection point" article from
  healthcareitnews.com (.myhealth-pulse-cache/2026-05-15.json), matches
  primary topics.

8 routine entries (memory notes, calendar items, low-relevance pulse links)

Powered by memory-diff — window: 7d, sources: memory/, MEMORY.md, .myhealth-pulse-cache/
```

## Since starting a medication

Input: `What's changed since I started lisinopril?`

```
**Tier 1 — Signal**

- **Home BP dropped** 138/88 (2026-04-30, day-of-start) → 122/78
  (2026-05-10) → 120/76 (2026-05-16). 18-point systolic drop over 2.5
  weeks (memory/, MEMORY.md).
- **HbA1c improved** 6.0 (2026-04-25, pre-lisinopril) → 5.8 (2026-05-10).
  Likely lifestyle-driven; lisinopril doesn't affect glucose.
- **No reported side effects** in any memory note since start.

**Tier 2 — Notable**

- **No follow-up visit scheduled yet** with Dr. Dave Matthews for a
  med-tolerance check; standard practice is 2–4 weeks post-start.
- **apoB still elevated** at 130 (2026-04-25); not lisinopril-related but
  is the next-priority biomarker per the PCP plan (memory/2026-04-30.md).

2 routine entries (calendar items)

Powered by memory-diff — window: since 2026-04-30 (16 days), sources: memory/, MEMORY.md
```

## Post-visit summary

Input: `Summarize what's new since my last PCP visit.`

```
**Tier 1 — Signal**

- **Lisinopril 10mg started** at 2026-04-30 visit with Dr. Dave Matthews
  (memory/2026-04-30.md).
- **PCP plan** added: 6-week apoB recheck, lifestyle changes for ApoB
  (Mediterranean dietary pattern), BP self-monitoring 2x/day for first
  month.
- **A1c recheck scheduled** for 2026-07-15.

**Tier 2 — Notable**

- **Home BP data captured** since the visit — 10 measurements logged,
  trending down (see "since started lisinopril" diff for the curve).
- **No labs since the visit** beyond the standalone A1c.

5 routine entries

Powered by memory-diff — window: since 2026-04-30 (16 days), sources: memory/, MEMORY.md
```

## Empty window

Input: `What's changed in the last hour?`

```
No changes in the last 1h — last entry: 2026-05-16 09:42 from memory/2026-05-16.md.

Powered by memory-diff — window: 1h, sources: memory/, MEMORY.md, .myhealth-pulse-cache/
```
