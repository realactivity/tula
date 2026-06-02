#!/usr/bin/env bash
# Deterministic, no-quota validation of the prep-my-visit scripts.
# Runs each validator against known-good and known-bad fixtures and asserts
# the expected exit code (0 = pass, 1 = blocking failure). Also smoke-renders
# the example briefs to PDF. Exits non-zero if any assertion fails.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$ROOT/skills/prep-my-visit"
SCRIPTS="$SKILL/scripts"
FIX="$ROOT/evals/prep-my-visit/fixtures"
EX="$SKILL/references/examples"
fails=0

expect() { # <expected-exit> <label> <cmd...>
  local want="$1" label="$2"; shift 2
  "$@" >/dev/null 2>&1
  local got=$?
  if [ "$got" -eq "$want" ]; then
    echo "  ok   [$label] exit=$got"
  else
    echo "  FAIL [$label] expected exit=$want got=$got"
    fails=$((fails + 1))
  fi
}

echo "IPS section validator"
expect 0 "valid composition" node "$SCRIPTS/validate_ips_sections.mjs" "$FIX/ips/composition.valid.json"
expect 1 "missing required section" node "$SCRIPTS/validate_ips_sections.mjs" "$FIX/ips/composition.bad-missing-section.json"

echo "Lab opportunities validator"
expect 0 "valid labs" node "$SCRIPTS/validate_lab_opportunities.mjs" "$FIX/labs/labs.valid.json"
expect 1 "category B overflow" node "$SCRIPTS/validate_lab_opportunities.mjs" "$FIX/labs/labs.bad-categoryb-overflow.json"
expect 1 "imperative language" node "$SCRIPTS/validate_lab_opportunities.mjs" "$FIX/labs/labs.bad-imperative.json"
expect 1 "missing citation" node "$SCRIPTS/validate_lab_opportunities.mjs" "$FIX/labs/labs.bad-missing-citation.json"
expect 1 "category C without opt-in" node "$SCRIPTS/validate_lab_opportunities.mjs" "$FIX/labs/labs.bad-categoryc-no-optin.json"

echo "Snippet limits validator"
expect 0 "valid snippet" node "$SCRIPTS/enforce_snippet_limits.mjs" "$FIX/snippets/snippets.valid.json"
expect 1 "snippet too long" node "$SCRIPTS/enforce_snippet_limits.mjs" "$FIX/snippets/snippets.bad-too-long.json"
expect 1 "billing drift" node "$SCRIPTS/enforce_snippet_limits.mjs" "$FIX/snippets/snippets.bad-billing.json"

echo "PDF renderer smoke (example briefs)"
out="$(mktemp -d)"
for f in cardiology-followup pcp-annual urgent-same-day; do
  expect 0 "render $f" python3 "$SCRIPTS/render_visit_brief.py" \
    --bundle "$EX/$f.json" --labs "$EX/$f.labs.json" --out "$out/$f"
  for pdf in provider.pdf patient.pdf; do
    if [ -s "$out/$f/$pdf" ]; then
      echo "  ok   [$f/$pdf present]"
    else
      echo "  FAIL [$f/$pdf missing or empty]"
      fails=$((fails + 1))
    fi
  done
done
rm -rf "$out"

echo
if [ "$fails" -eq 0 ]; then
  echo "All deterministic script checks passed."
  exit 0
fi
echo "$fails check(s) failed."
exit 1
