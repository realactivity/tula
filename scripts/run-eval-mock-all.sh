#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run-eval-mock-all.sh - run mock Waza lanes for all eval suites (CI gate).
# ---------------------------------------------------------------------------
#
# Usage:
#   scripts/run-eval-mock-all.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TULA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVALS_DIR="$TULA_DIR/evals"

command -v waza >/dev/null 2>&1 || { echo "[eval-mock] waza not on PATH" >&2; exit 1; }

echo "[eval-mock] Running taxonomy lint"
bash "$SCRIPT_DIR/lint-eval-taxonomy.sh"

failures=0

for mock in "$EVALS_DIR"/*/eval.mock.yaml; do
  [[ -f "$mock" ]] || continue
  suite="$(basename "$(dirname "$mock")")"
  echo "[eval-mock] waza run $mock --skip-graders"
  # Mock executor returns stub output; graders require a live model. This lane
  # validates spec load, task/fixture wiring, and skill binding only.
  if waza run "$mock" --skip-graders -v; then
    echo "[eval-mock] OK   evals/$suite"
  else
    echo "[eval-mock] FAIL evals/$suite"
    failures=$((failures + 1))
  fi
done

if [[ "$failures" -gt 0 ]]; then
  echo "[eval-mock] $failures suite(s) failed mock lane"
  exit 1
fi

echo "[eval-mock] All mock lanes passed"
exit 0
