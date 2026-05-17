#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# generate-eval-status.sh — regenerate docs/evals.md from current skill +
# eval state.
# ---------------------------------------------------------------------------
#
# Reads:
#   - skills/*/SKILL.md          (enumeration of skills)
#   - `waza check --format json` (compliance, spec, token counts; fresh)
#   - results/<skill>*.json      (published live-run results; optional)
#
# Writes:
#   - docs/evals.md              (markdown table + methodology notes)
#
# Idempotent — output is stable as long as SKILL.md and results/ haven't
# changed.
#
# Requires: bash, jq, waza (https://github.com/microsoft/waza).
#
# Usage:
#   scripts/generate-eval-status.sh
#
# Inputs (all optional env vars):
#   TULA_DIR        Repo root (default: parent of this script's dir)
#   SKILLS_DIR      Skills root (default: $TULA_DIR/skills)
#   RESULTS_DIR     Live-run results dir (default: $TULA_DIR/results)
#   OUTPUT          Output path (default: $TULA_DIR/docs/evals.md)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TULA_DIR="${TULA_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SKILLS_DIR="${SKILLS_DIR:-$TULA_DIR/skills}"
RESULTS_DIR="${RESULTS_DIR:-$TULA_DIR/results}"
OUTPUT="${OUTPUT:-$TULA_DIR/docs/evals.md}"

# ---------- preflight ------------------------------------------------------

command -v waza >/dev/null 2>&1 || { echo "[gen-eval] waza not on PATH" >&2; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "[gen-eval] jq not on PATH" >&2; exit 1; }
[[ -d "$SKILLS_DIR" ]] || { echo "[gen-eval] $SKILLS_DIR not found" >&2; exit 1; }

mkdir -p "$(dirname "$OUTPUT")"

# ---------- header ---------------------------------------------------------

cat > "$OUTPUT" <<'EOF'
# Skill Evaluation Status

Continuous evaluation status for Tula skills. This page is regenerated
automatically by `scripts/generate-eval-status.sh` on every CI run that
touches `skills/` or `evals/`. Static analysis (compliance, spec
checks, token budgets) is fresh on every run; live eval results come
from manually-published runs in `results/`.

Powered by [Microsoft Waza](https://github.com/microsoft/waza).

| Skill | Compliance | Spec | Tokens | Last live run |
|---|---|---|---|---|
EOF

# ---------- per-skill rows -------------------------------------------------

for skill_md in "$SKILLS_DIR"/*/SKILL.md; do
    name="$(basename "$(dirname "$skill_md")")"

    # Static check via waza
    check_json="$(waza check "$SKILLS_DIR/$name" --format json 2>/dev/null || true)"
    if [[ -z "$check_json" ]]; then
        compliance="—"
        spec_cell="—"
        token_cell="—"
    else
        compliance="$(echo "$check_json" | jq -r '.skills[0].compliance.level // "—"')"
        spec_passed="$(echo "$check_json" | jq -r '.skills[0].specCompliance | map(select(.passed)) | length')"
        spec_total="$(echo "$check_json" | jq -r '.skills[0].specCompliance | length')"
        spec_cell="${spec_passed}/${spec_total}"
        [[ "$spec_passed" == "$spec_total" ]] && spec_cell="${spec_cell} ✓"

        token_count="$(echo "$check_json" | jq -r '.skills[0].tokenBudget.count // empty')"
        token_limit="$(echo "$check_json" | jq -r '.skills[0].tokenBudget.limit // empty')"
        token_exceeded="$(echo "$check_json" | jq -r '.skills[0].tokenBudget.exceeded // false')"
        if [[ -z "$token_count" || -z "$token_limit" ]]; then
            token_cell="—"
        elif [[ "$token_exceeded" == "true" ]]; then
            token_cell="${token_count} / ${token_limit} ⚠"
        else
            token_cell="${token_count} / ${token_limit} ✓"
        fi
    fi

    # Latest live-run results for this skill
    live_cell="—"
    if [[ -d "$RESULTS_DIR" ]]; then
        latest_run="$(ls -t "$RESULTS_DIR/${name}"*.json 2>/dev/null | head -1 || true)"
        if [[ -n "$latest_run" ]]; then
            ts="$(jq -r '.timestamp' "$latest_run" | cut -d'T' -f1)"
            succeeded="$(jq -r '.summary.succeeded' "$latest_run")"
            total="$(jq -r '.summary.total_tests' "$latest_run")"
            model="$(jq -r '.config.model_id // empty' "$latest_run")"
            # Shorten common long model names so the table column doesn't
            # blow up. Anything not in the case below renders as-is.
            case "$model" in
                claude-sonnet-4.6)    model="sonnet-4.6" ;;
                claude-sonnet-4-*)    model="sonnet-4" ;;
                claude-opus-*)        model="opus" ;;
                gpt-4o-mini)          model="gpt-4o-mini" ;;
                gpt-4o)               model="gpt-4o" ;;
            esac
            model_suffix=""
            [[ -n "$model" ]] && model_suffix=", $model"

            if [[ "$succeeded" == "$total" ]]; then
                live_cell="${succeeded}/${total} ✓ (${ts}${model_suffix})"
            else
                live_cell="${succeeded}/${total} ✗ (${ts}${model_suffix})"
            fi
        fi
    fi

    printf "| \`%s\` | %s | %s | %s | %s |\n" \
        "$name" "$compliance" "$spec_cell" "$token_cell" "$live_cell" >> "$OUTPUT"
done

# ---------- footer ---------------------------------------------------------

cat >> "$OUTPUT" <<'EOF'

---

## What this measures

- **Compliance** — Waza's agentskills.io readiness score
  (`High` / `Medium-High` / `Medium` / `Low`). `Medium-High` or better
  is the house target.
- **Spec** — count of agentskills.io spec checks the skill passes
  (`spec-frontmatter`, `spec-name`, `spec-allowed-fields`, and so on).
  9/9 is full pass.
- **Tokens** — total tokens in `SKILL.md` against Waza's 500-token soft
  limit. Tula's house style accepts a higher count when openclaw
  fidelity would suffer (per `skills/AGENTS.md`'s "Token Discipline"
  section). `⚠` marks "exceeds the soft cap but intentional"; `✓` marks
  "within budget."
- **Last live run** — most recent `waza run` output published in
  `results/`. Cells show pass rate, run date, and model used (e.g.,
  `5/5 ✓ (2026-05-17, sonnet-4.6)`). Live eval execution requires
  `executor: copilot-sdk` plus model auth, so it is a deliberate
  publish today rather than a per-PR CI run. Raw run outputs stay
  private; only the pass-rate summary surfaces here.

## What this does NOT measure

- The model's actual answer quality. Evals check task-completion
  signals (output shape, presence/absence of keywords, routing
  behavior, schema validity), not clinical correctness.
- Production behavior under PHI. All evals run against synthetic
  personas. See `evals/*/fixtures/` for the test data.
- Anything inside Aria's closed governance layer — multi-tenant
  isolation, audit emission, cross-actor coordination — which is
  evaluated separately under hospital-scale fixtures.

## See also

- [Eval suites](../evals/) — task definitions and fixtures
- [Skill authoring conventions](../skills/AGENTS.md)
- [Tula deployment guide](deployment-guide.md)
- [Microsoft Waza](https://github.com/microsoft/waza) — the eval framework
EOF

echo "[gen-eval] wrote $OUTPUT"
