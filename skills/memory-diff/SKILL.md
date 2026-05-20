---
name: memory-diff
description: "Surfaces what changed in the user's health since a reference point (date, named event, 'since last X'). Reads workspace memory from med-pdf, health-records, myhealth-pulse, and dated notes; tiers changes by clinical significance. USE FOR: 'what changed', post-visit summaries, longitudinal questions, weekly check-ins. DO NOT USE FOR: news/social (myhealth-pulse), PDFs (med-pdf), chart data (health-records), drafting (epic-note)."
metadata:
  {
    "openclaw":
      {
        "emoji": "📈"
      }
  }
---

# memory-diff

## When to Use

✅ Use when:

- User asks "what's changed in my health since <last week / last month / since X>"
- Post-visit or post-lab summaries - "what's new since my last appointment"
- Scheduled weekly or monthly longitudinal check-ins
- "Since I started <med>" or "since my referral to <provider>" recaps
- Another skill needs a "what's new" sub-step (e.g., after `health-records` refresh)

## When NOT to Use

❌ Don't use when:

- User wants news or social signal → use `myhealth-pulse`
- User shares a PDF, screenshot, or image → use `med-pdf`
- User asks for raw chart data → use `health-records`
- User wants to draft a clinician message → use `epic-note`
- User asks for medical advice - decline politely; this reads memory, not clinical judgment

## Setup

No external tools, no API keys. The skill reads from the local workspace only.

Memory sources, in precedence order (full contract in
[`references/memory-paths.md`](references/memory-paths.md)):

- `~/.openclaw/workspace/.health-records-cache/<date>/` - structured FHIR JSON
- `~/.openclaw/workspace/.med-pdf-cache/<slug>/` - extracted JSON from PDFs
- `~/.openclaw/workspace/memory/*.md` - dated agent notes
- `~/.openclaw/workspace/MEMORY.md` - persistent agent memory
- `~/.openclaw/workspace/.myhealth-pulse-cache/<date>.json` - pulse digests

## Workflow

1. **Resolve the reference point.** Default: 7 days ago. Parse named anchors
   from the prompt:
   - Calendar phrases: "last week" (7d), "last month" (30d), "last 90 days"
   - Event anchors: "since I started <med>", "since my <provider> visit" -
     scan memory for the matching event date
   - Absolute dates: "since 2026-04-01"
   - If ambiguous, ask one clarifying question, then proceed.

2. **Enumerate within the window.** For each source above, list files
   modified or dated within the window. Don't load everything into context -
   stream-scan headers and key sections.

3. **Classify each change.** Apply the rubric in
   [`references/clinical-significance.md`](references/clinical-significance.md):
   - **Tier 1 - signal.** New abnormal lab, med change, new diagnosis,
     >20% trend change in a tracked marker, new imaging finding,
     abnormal-to-normal resolution.
   - **Tier 2 - notable.** Stable abnormality continuing, mild trend, new
     appointment scheduled, new pulse mentions of relevant topics.
   - **Tier 3 - noise.** Routine entries, unchanged trends, low-relevance
     pulse items. Collapsed to a one-line count.

4. **Synthesize.** Tier 1 first (always shown), Tier 2 second (always
   shown), Tier 3 collapsed (`12 routine entries`). End with one trailing
   line:
   `Powered by memory-diff - window: <resolved>, sources: <names>`.

5. **Empty window.** If nothing in any tier, return one line:
   `No changes in <window> - last entry: <date> from <source>.`
   Don't fabricate filler entries.

6. **Cache the rendering.** Write to
   `~/.openclaw/workspace/.memory-diff-cache/<YYYY-MM-DD>.md`. The next
   run can diff-of-diff if asked ("what's new since I last asked you this").

## Examples

See [`references/examples.md`](references/examples.md) for since-last-week,
since-a-med-change, post-visit, and empty-window outputs.

## Privacy

- All reads are workspace-local; nothing outbound, ever.
- Output stays in the chat. Don't auto-forward, auto-summarize externally,
  or include in any outbound notification unless explicitly configured.
- Cache stays under `~/.openclaw/workspace/.memory-diff-cache/`. Don't
  copy out.

## Troubleshooting

- **Ambiguous anchor** → ask one clarifying question, then proceed. Don't
  guess.
- **Conflicting facts across sources** → surface both with source
  attribution. Don't silently pick a winner.
- **Cache directory missing on first run** → create it, no error.
- **Tuning the tiers** → in v1, thresholds live in
  [`references/clinical-significance.md`](references/clinical-significance.md).
  A forthcoming user dashboard app will let the user tune these through a
  profile mechanism (same shape as
  `myhealth-pulse/references/profile-schema.md`). Until then, edit the
  references file directly.
