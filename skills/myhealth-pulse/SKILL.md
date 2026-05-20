---
name: myhealth-pulse
description: "Aggregates a user's health-related signal feeds (social, web, wearables, portal, calendar) into a curated, scored digest. Personal data is referenced from an external profile file, never embedded. USE FOR: 'run myhealth-pulse', scheduled daily/weekly pulses, mention digests. DO NOT USE FOR: PDFs (med-pdf), clinician messages (epic-note), chart data (health-records), or anything that puts PHI in outbound queries."
metadata:
  {
    "openclaw":
      {
        "emoji": "❤️"
      }
  }
---

# myhealth-pulse

## When to Use

✅ Use when:

- User says "run myhealth-pulse", "check my health feeds", "daily pulse"
- Scheduled invocation - daily, weekly, or per-feed cadence from the profile
- User asks for mentions, alerts, or a topic digest across configured feeds
- A new feed adapter was enabled and the user wants a unified view

## When NOT to Use

❌ Don't use when:

- User shares a PDF, screenshot, or image → use `med-pdf`
- User asks about their chart, labs, meds → use `health-records`
- User wants to draft a clinician message → use `epic-note`
- User asks for medical advice - decline politely; this is aggregation, not clinical judgment
- Anything that would put PHI into an outbound query string

## Setup

**Profile.** Resolve from the precedence in
[`references/profile-schema.md`](references/profile-schema.md#where-the-profile-lives)
(skill config → env var → `~/.openclaw/workspace/memory/profile.yaml`).
The skill never contains the profile. If none resolves, return one line
saying so and stop. Don't fabricate.

**Feed adapters.** Each `profile.feeds.enabled` entry maps to an adapter
in [`references/feeds.md`](references/feeds.md#available-adapters). The
agent must have the adapter's underlying tool available. Missing tool →
skip that feed with a one-line note in the output.

## Workflow

1. **Load and validate the profile.** Resolve the path, parse YAML,
   validate against the schema. Refuse on missing or malformed profile.

2. **Resolve enabled adapters.** For each `profile.feeds.enabled` entry,
   look up the contract in
   [`references/feeds.md`](references/feeds.md#available-adapters). Drop
   adapters whose tool isn't available; remember which were dropped.

3. **Build and call.** Substitute profile fields into each adapter's
   query template. Apply the active window (`daily` for ad-hoc,
   `weekly` for "weekly pulse") via the adapter's native time filter.
   Call all adapters in parallel.

4. **Score and filter.** Apply the shared rubric in
   [`references/feeds.md`](references/feeds.md#scoring). Keep items at
   or above `profile.feeds.thresholds.keep_score`. Cap at `max_items`.
   Dedupe by URL and near-identical title.

5. **Synthesize.** Render per the output shape in
   [`references/feeds.md`](references/feeds.md#output-shape). End with
   one trailing line listing active adapters:
   `Powered by myhealth-pulse - feeds: <names>`. Append
   `(unavailable: <names>)` if any were dropped.

6. **Low-signal case.** If nothing makes the threshold, return one line:
   `Quiet period in your feeds - nothing above the relevance threshold in the last <window>.`
   Suggest one not-yet-enabled adapter from
   [`references/feeds.md`](references/feeds.md#roadmap-adapters). Don't
   pad.

7. **Cache for diffs.** Write the rendered digest plus item URLs to
   `~/.openclaw/workspace/.myhealth-pulse-cache/<YYYY-MM-DD>.json`. Next
   run reads it to down-weight already-seen items.

## Examples

See [`references/examples.md`](references/examples.md) for daily digest,
mention alert, low-signal, and partial-run cases.

## Privacy

The risk surface is what gets *sent*, not what comes back.

- No PHI in outbound queries. Personalization is identity and topic
  fields in the profile - never anything from `health-records`,
  `med-pdf`, or memory notes.
- Profile lives outside the skill repo. In single-user Tula:
  `~/.openclaw/workspace/memory/profile.yaml`. In multi-tenant runtimes:
  resolved per-tenant. Never in source control with the skill.
- Cache stays under `~/.openclaw/workspace/.myhealth-pulse-cache/`.
  Multi-tenant runtimes get isolation from the workspace mount.
- Don't auto-post, auto-reply, or DM. The digest stays in chat unless a
  notification channel is configured in the profile and the agent has
  the corresponding tool.

## Troubleshooting

- **No profile resolves** → stop, name the three paths checked, exit.
- **One adapter errored** → partial digest with a one-line note
  (`feeds: social-x (web-brave unavailable)`). Don't fail the whole run.
- **All items <threshold** → low-signal output (Workflow step 6).
- **Adding a feed** → document the adapter in
  [`references/feeds.md`](references/feeds.md#adding-a-new-adapter),
  add it to `profile.feeds.enabled`, ensure the tool is available.
  SKILL.md doesn't change.
