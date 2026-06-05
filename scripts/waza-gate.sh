#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# waza-gate.sh - Fail CI when any skill has spec or link errors.
# ---------------------------------------------------------------------------
#
# Runs `waza check --format json` on every skill under skills/ and exits
# non-zero if any skill has:
#   - a spec check with passed=false
#   - links.passed=false (including scope escapes in README.md)
#
# Token budget and compliance advisories do NOT fail the gate (per
# skills/AGENTS.md token discipline).
#
# Usage:
#   scripts/waza-gate.sh
#
# Inputs (optional env vars):
#   TULA_DIR     Repo root (default: parent of scripts/)
#   SKILLS_DIR   Skills root (default: $TULA_DIR/skills)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TULA_DIR="${TULA_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SKILLS_DIR="${SKILLS_DIR:-$TULA_DIR/skills}"

command -v waza >/dev/null 2>&1 || { echo "[waza-gate] waza not on PATH" >&2; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "[waza-gate] jq not on PATH" >&2; exit 1; }
[[ -d "$SKILLS_DIR" ]] || { echo "[waza-gate] $SKILLS_DIR not found" >&2; exit 1; }

failures=0

echo "[waza-gate] Checking skills under $SKILLS_DIR"

for skill_md in "$SKILLS_DIR"/*/SKILL.md; do
    name="$(basename "$(dirname "$skill_md")")"
    [[ "$name" == "AGENTS.md" ]] && continue

    check_json="$(waza check "$SKILLS_DIR/$name" --format json 2>/dev/null || true)"
    if [[ -z "$check_json" ]]; then
        echo "[waza-gate] FAIL $name: waza check produced no output"
        failures=$((failures + 1))
        continue
    fi

    # Spec checks with passed=false are hard failures.
    spec_failures="$(echo "$check_json" | jq -r '
        .skills[0].specCompliance[]
        | select(.passed == false)
        | "\(.name): \(.summary // "failed")"
    ' 2>/dev/null || true)"
    if [[ -n "$spec_failures" ]]; then
        echo "[waza-gate] FAIL $name: spec check(s) failed:"
        echo "$spec_failures" | sed 's/^/  /'
        failures=$((failures + 1))
    fi

    # Broken or out-of-scope links are hard failures.
    links_passed="$(echo "$check_json" | jq -r '.skills[0].links.passed // "true"')"
    if [[ "$links_passed" != "true" ]]; then
        echo "[waza-gate] FAIL $name: link errors:"
        echo "$check_json" | jq -r '
            .skills[0].links.scopeEscapes[]?
            | "  \(.source) -> \(.target) (\(.reason))"
        ' 2>/dev/null || true
        echo "$check_json" | jq -r '
            .skills[0].links.broken[]?
            | "  broken: \(.source) -> \(.target)"
        ' 2>/dev/null || true
        failures=$((failures + 1))
    fi

    if [[ -z "$spec_failures" && "$links_passed" == "true" ]]; then
        spec_passed="$(echo "$check_json" | jq -r '.skills[0].specCompliance | map(select(.passed)) | length')"
        spec_total="$(echo "$check_json" | jq -r '.skills[0].specCompliance | length')"
        echo "[waza-gate] OK   $name (${spec_passed}/${spec_total} spec, links ok)"
    fi
done

if [[ "$failures" -gt 0 ]]; then
    echo "[waza-gate] $failures skill(s) failed the gate"
    exit 1
fi

echo "[waza-gate] All skills passed spec and link checks"
exit 0
