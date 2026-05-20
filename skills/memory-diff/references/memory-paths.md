# Memory Paths

Sources the skill scans, in precedence order. Higher-precedence sources win
when the same fact appears in multiple places.

## Read order

| # | Path | Shape | Notes |
|---|---|---|---|
| 1 | `~/.openclaw/workspace/.health-records-cache/<YYYY-MM-DD>/<provider>.json` | FHIR R4 JSON | Highest precedence. Structured, dated, provider-attributed. Read these for labs, conditions, medications, immunizations. |
| 2 | `~/.openclaw/workspace/.med-pdf-cache/<slug>/` | `labs.json`, `imaging.json`, `text.txt` | Extracted from user-shared PDFs. Use `labs[].abnormal[]` and `imaging.impression[]` as primary signals. |
| 3 | `~/.openclaw/workspace/memory/<YYYY-MM-DD>.md` | Dated agent notes | Free-text daily notes the agent writes. Scan for headers like `## Labs`, `## Symptoms`, `## Meds`, `## Visits`. |
| 4 | `~/.openclaw/workspace/MEMORY.md` | Persistent agent memory | Single file. Treat as the "current state" snapshot - active conditions, current meds, known trends. |
| 5 | `~/.openclaw/workspace/.myhealth-pulse-cache/<YYYY-MM-DD>.json` | Rendered pulse digest + item URLs | Lowest precedence for clinical facts; highest for "what's relevant in the user's topic world right now". |

## Window filtering

The skill operates on a time window resolved from the prompt:

- "last week" → 7d
- "last month" → 30d
- "since <ISO date>" → that date
- "since I started <med>" → scan source #3 and #4 for the start date of
  that med; window = (start_date, now)
- "since my <provider> visit" → scan source #3 and #4 for the most recent
  visit to that provider; window = (visit_date, now)

For sources #1 and #5, dated directories/files make windowing trivial. For
sources #2, #3, #4: use file `mtime` for the modified-within-window check;
use document-internal dates for the dated-within-window check.

## What NOT to read

- `~/.openclaw/workspace/.openclaw/` - runtime state, not memory.
- `~/.openclaw/workspace/state/` - session state, not memory.
- Any file under `~/.openclaw/workspace/skills/` - that's deployed skill
  code, not user data.
- The skill's own cache (`~/.openclaw/workspace/.memory-diff-cache/`) -
  reading this risks diff-of-diff infinite-loop framing; touch only when
  the user explicitly asks "what changed since my last memory-diff run".

## Composition with other skills

Other skills can invoke `memory-diff` as a sub-step:

- `health-records` after a fresh pull → "what changed in this pull vs.
  the prior one in `.health-records-cache/`"
- `med-pdf` after parsing → "how do today's labs compare to the most
  recent prior values in memory"
- `myhealth-pulse` daily → "any new pulse-relevant findings in chart
  memory since yesterday's digest"

Each composition is opt-in by the calling skill - `memory-diff` doesn't
push itself into other skills' workflows.
