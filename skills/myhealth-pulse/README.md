# myhealth-pulse

`myhealth-pulse` aggregates a user's health-related signal feeds (social,
web, and future wearables/portal adapters) into a curated, scored daily
digest. Personal data is **referenced** from an external profile file, never
embedded in the skill.

The goal: one orchestration skill that monitors configured signals and
surfaces only what clears the relevance threshold for this user.

## Why this skill exists

Health information is scattered across X, Brave, PubMed, wearables, and
portals. Users want a heartbeat skill that runs on a schedule and respects
privacy: no PHI in outbound queries, no auto-posting, no clinical judgment.

This skill is the reference implementation of Tula's **"Personal Data:
Reference, Don't Embed"** pattern documented in `skills/AGENTS.md` in the repo root).

Common failure modes it prevents:

- agent puts chart data into a web search query
- agent fabricates a profile when none exists
- agent runs a full digest when the user shared a PDF (wrong skill)

## What it produces

Primary output is a **scored digest** in chat, ending with:

`Powered by myhealth-pulse - feeds: <names>`

Cache for diffs and deduplication:

`~/.openclaw/workspace/.myhealth-pulse-cache/<YYYY-MM-DD>.json`

Profile resolves from
[`references/profile-schema.md`](references/profile-schema.md) (skill config ->
`MYHEALTH_PULSE_PROFILE` env -> `memory/profile.yaml`).

## Safety model

`myhealth-pulse` is constrained by design:

- **no PHI in outbound queries** - personalization is identity and topics only
- profile lives outside the repo; never commit real handles or providers
- no auto-post, auto-reply, or DMs unless explicitly configured
- declines chart/PDF/portal-message tasks (hand off to sibling skills)
- partial runs OK - one adapter failure should not kill the whole digest

## Skill structure

- Runtime instructions: [`SKILL.md`](SKILL.md)
- Profile schema: [`references/profile-schema.md`](references/profile-schema.md)
- Feed adapters and scoring: [`references/feeds.md`](references/feeds.md)
- Output examples: [`references/examples.md`](references/examples.md)

## Local quality checks

From repo root:

```powershell
waza check skills/myhealth-pulse
bash scripts/waza-gate.sh
```

Fixture profile for local reasoning:

`evals/myhealth-pulse/fixtures/profile.yaml` (synthetic **Dylan Meyer** persona).

## Use with OpenClaw

1. Create a profile on the VM:

```yaml
# ~/.openclaw/workspace/memory/profile.yaml
version: 1
identity:
  display_name: "Your Name"
  short_name: "Your"
topics:
  primary: ["Topic A", "Topic B"]
feeds:
  enabled: ["social-x", "web-brave"]
  thresholds:
    keep_score: 70
    max_items: 8
```

2. Deploy and verify:

```bash
~/tula/scripts/deploy-skills.sh --skill myhealth-pulse
openclaw skills list
```

3. Invoke:

- "Run myhealth-pulse"
- "Daily pulse"
- "Anything new in my feeds this week?"

Requires underlying OpenClaw plugins for enabled adapters (e.g. X, Brave).

## Waza evaluation suite

**Status:** live ([Patient Agent Eval Standard v0.1](../../evals/README.md))

Suite path: `evals/myhealth-pulse/` (6 tasks including golden digest)

Full scenario map: [`evals/myhealth-pulse/README.md`](../../evals/myhealth-pulse/README.md) (repo root).

```powershell
waza check skills/myhealth-pulse
waza run evals/myhealth-pulse/eval.mock.yaml --skip-graders -v
waza run evals/myhealth-pulse/eval.yaml -v
```

### Interpreting results

- Anti-trigger failures mean the skill is absorbing sibling-skill work.
- **Golden digest** validates signature line and adapter names without PHI leak.

## Release gate

Before production release:

- pass `waza check skills/myhealth-pulse`
- pass `bash scripts/waza-gate.sh`
- pass `waza run evals/myhealth-pulse/eval.mock.yaml --skip-graders -v`
- pass live `waza run evals/myhealth-pulse/eval.yaml -v`
- confirm real profile.yaml on VM with intentional topics (no PHI in topics)
