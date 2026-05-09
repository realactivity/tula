# Skills Authoring Conventions

This folder is the source of truth for skills that ship to the openclaw
runtime on the Ubuntu VM. Skills are authored and tested here in `tula/`,
then deployed to `~/.openclaw/workspace/skills/` on the agent host.

## Priority Rule (read this first)

When refactoring or authoring a skill:

1. **openclaw runtime compatibility comes first.** A skill must be parsed and
   used correctly by openclaw. If a Waza recommendation conflicts with
   openclaw's spec or house style, openclaw wins.
2. **Waza checks are secondary polish.** Apply Waza recommendations only when
   they don't reduce openclaw fidelity (e.g., progressive disclosure into
   `references/` is good for both; awkward routing tags that don't fit
   openclaw's style are not).

The reference template is `med-pdf/`. New skills should follow its shape.

## Frontmatter (openclaw spec)

Required:

- `name` — snake_case, single-line
- `description` — short, action-led, single-line. Lead with a verb. Include
  trigger guidance inline (`USE FOR: ...` / `DO NOT USE FOR: ...`) when
  trigger specificity matters; otherwise keep prose.

Optional `metadata.openclaw` keys (single-line JSON object, multi-line layout
is tolerated as long as the JSON parses):

| Key | Purpose |
|---|---|
| `emoji` | Icon for the macOS Skills UI |
| `homepage` | Website link in the macOS Skills UI |
| `requires.bins` | Binaries that must exist on `PATH` (e.g., `["node"]`) |
| `requires.anyBins` | At least one of these must exist |
| `requires.env` | Env vars that must be present (in process or config) |
| `requires.config` | `openclaw.json` paths that must be truthy |
| `os` | Platform filter, e.g., `["linux"]` |
| `always` | Bypass gates (rare) |
| `primaryEnv` | Env var associated with `apiKey` |
| `userInvocable` | Expose as a slash command |

Don't use Waza-only fields like `type` or `license` — they aren't in the
agentskills.io / openclaw spec and add noise.

## Body Sections (openclaw house style)

Match the canonical openclaw skills (e.g., `skills/github`) — in this order:

1. `# <Skill Name>` (Title Case)
2. One-line summary
3. `## When to Use` — `✅` bullet list of trigger conditions
4. `## When NOT to Use` — `❌` bullet list of anti-triggers
5. `## Setup` — installation/auth, if applicable
6. `## Workflow` — numbered, agent-directed steps. This is the operational core.
7. `## Scripts` (or `## Common Commands`) — per-script details, ideally
   linked to a `references/` module if long
8. `## Examples` — concrete bash, with real paths. Long examples go to
   `references/examples.md`.
9. `## Privacy` — PHI/data handling, when relevant
10. `## Notes` — gotchas, rate limits, alias maintenance

## Voice

- Second person, agent-directed: "For any PDF Paul sends..."
- Imperative and terse: "Always check `unmatchedLines`."
- Real paths and real commands. No abstractions or pseudocode.
- Opinions are fine: "Trust the heuristic." "Don't just summarize."

## Path Conventions

- `{baseDir}` — placeholder for the skill folder path. Use this in
  instructions when referencing scripts: `node {baseDir}/scripts/foo.mjs`.
- `~/.openclaw/workspace/` — agent's workspace at runtime.
- Reference modules live in `references/` and are linked with relative
  markdown links: `[scripts](references/scripts.md)`.
- Skill scripts live in `scripts/`. Prefer Node ESM (`.mjs`) for portability.

## Token Discipline (Waza polish, not openclaw requirement)

- Aim for SKILL.md under 500 tokens (Waza's hard cap).
- Push long content into `references/`. The agent reads SKILL.md every
  invocation; it follows links to references only when needed.
- 2–3 reference modules is the sweet spot.

## Validation

Before deploying to the VM:

```powershell
waza check skills/<skill-name>
```

Acceptable outcomes:

- `Spec Compliance: 9/9 passes` — required.
- `Token Budget: under 500` — preferred, not required if openclaw fidelity
  would suffer.
- `Compliance Score: Medium-High` or better — preferred.

If Waza flags routing-clarity tags (`**UTILITY SKILL**`, `INVOKES:`) and
adding them would clash with openclaw's house style, **skip them**. The
priority rule above governs.

## Deployment

Skills are deployed to `~/.openclaw/workspace/skills/` on the VM via
`scp`/`rsync`. Don't deploy `evals/` — that stays in `tula/` and runs
locally.

## Adding a New Skill

```powershell
waza new skill <name>
```

Then refactor the scaffolded SKILL.md to match `med-pdf/` style. Default
Waza scaffolds use Waza-leaning conventions; rewrite to openclaw house style.
