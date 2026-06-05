#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# lint-eval-taxonomy.sh - verify eval suites meet Patient Agent Eval Standard
# v0.1 minimum tag coverage.
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TULA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVALS_DIR="$TULA_DIR/evals"
TAXONOMY="$EVALS_DIR/TAXONOMY.yaml"

[[ -f "$TAXONOMY" ]] || { echo "[lint-eval] missing $TAXONOMY" >&2; exit 1; }

# Required dimension -> accepted tag aliases in task YAML
declare -A TAG_ALIASES=(
  [routing-positive]="routing-positive positive-trigger"
  [routing-negative]="routing-negative negative-trigger anti-trigger"
  [phi-boundary]="phi-boundary"
  [adversarial]="adversarial"
  [golden]="golden golden-case"
)

COMPOSITION_SUITE="composition"
failures=0

suite_has_tag() {
  local suite_dir="$1"
  local dimension="$2"
  local aliases="${TAG_ALIASES[$dimension]}"
  for tag in $aliases; do
    if grep -rqE "^\s+- ${tag}\s*$" "$suite_dir/tasks/" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

echo "[lint-eval] Patient Agent Eval Standard v0.1 taxonomy lint"

for suite_dir in "$EVALS_DIR"/*/; do
  suite="$(basename "$suite_dir")"
  [[ "$suite" == "_templates" ]] && continue
  [[ "$suite" == "$COMPOSITION_SUITE" ]] && continue
  [[ -d "$suite_dir/tasks" ]] || continue

  echo "[lint-eval] checking evals/$suite"

  for dimension in "${!TAG_ALIASES[@]}"; do
    if ! suite_has_tag "$suite_dir" "$dimension"; then
      echo "[lint-eval] FAIL evals/$suite: missing task tagged '${dimension}' (aliases: ${TAG_ALIASES[$dimension]})"
      failures=$((failures + 1))
    fi
  done

  if [[ ! -f "$suite_dir/eval.mock.yaml" ]]; then
    echo "[lint-eval] FAIL evals/$suite: missing eval.mock.yaml"
    failures=$((failures + 1))
  fi
done

if [[ -d "$EVALS_DIR/$COMPOSITION_SUITE/tasks" ]]; then
  if ! grep -rqE "^\s+- composition\s*$" "$EVALS_DIR/$COMPOSITION_SUITE/tasks/" 2>/dev/null; then
    echo "[lint-eval] FAIL evals/$COMPOSITION_SUITE: missing composition-tagged tasks"
    failures=$((failures + 1))
  fi
  if [[ ! -f "$EVALS_DIR/$COMPOSITION_SUITE/eval.mock.yaml" ]]; then
    echo "[lint-eval] FAIL evals/$COMPOSITION_SUITE: missing eval.mock.yaml"
    failures=$((failures + 1))
  fi
fi

if [[ "$failures" -gt 0 ]]; then
  echo "[lint-eval] $failures taxonomy violation(s)"
  exit 1
fi

echo "[lint-eval] All suites pass required tag coverage"
exit 0
