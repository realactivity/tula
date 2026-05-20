# Examples

## Example 1 - Epic sandbox smoke test

Use this to verify the skill works end-to-end without touching real PHI.

```bash
SKILL=~/.openclaw/workspace/skills/health-records
OUT=~/.openclaw/workspace/.health-records-cache/sandbox-$(date +%Y-%m-%d)

# Step 1: create a session
node $SKILL/scripts/create-session.mjs > /tmp/hr-session.json
SESSION_ID=$(jq -r .sessionId /tmp/hr-session.json)
USER_URL=$(jq -r .userUrl /tmp/hr-session.json)
PRIV_JWK=$(jq -c .privateKeyJwk /tmp/hr-session.json)

# Step 2: tell Paul (or yourself) to open the URL and log in with
#   Username: fhircamila
#   Password: epicepic1
echo "Open: $USER_URL"

# Step 3: poll + decrypt when Paul says he's done
node $SKILL/scripts/finalize-session.mjs "$SESSION_ID" "$PRIV_JWK" "$OUT"

# Inspect: what came down?
ls -lh $OUT/
jq '.providers[].name // .name' $OUT/*.json
jq '.fhir | keys' $OUT/*.json
```

Expected: one provider file (Epic sandbox), a few hundred FHIR resources,
including `Patient`, `Condition`, `Observation`, `MedicationRequest`. No
attachments in the sandbox.

## Example 2 - Real-portal connect (Paul's MyChart)

```bash
SKILL=~/.openclaw/workspace/skills/health-records
OUT=~/.openclaw/workspace/.health-records-cache/$(date +%Y-%m-%d)

node $SKILL/scripts/create-session.mjs > /tmp/hr-session.json
```

Show Paul the `userUrl` as a clickable link. He picks his health system
(e.g., "Lawrence General Hospital - MyChart"), logs in, may connect a
second provider, clicks **Done - Send to AI**.

```bash
SESSION_ID=$(jq -r .sessionId /tmp/hr-session.json)
PRIV_JWK=$(jq -c .privateKeyJwk /tmp/hr-session.json)

node $SKILL/scripts/finalize-session.mjs "$SESSION_ID" "$PRIV_JWK" "$OUT" --instrument
```

After `status: done`:

```bash
# Quick orient: what providers? how many resources each?
for f in $OUT/*.json; do
  echo "== $f =="
  jq '{name, resources: (.fhir | to_entries | map({(.key): (.value | length)}) | add), attachments: (.attachments | length)}' "$f"
done
```

## Example 3 - Open with a clinical sentence (don't dump a dashboard)

After step 3 succeeds, Tula's first message to Paul should look like this
(not a generic summary):

> Connected - pulled records from **Lawrence General** (2018-2026). 47
> encounters, mostly primary-care and one orthopedic episode in 2023. Two
> active problems on the list (hypertension, hepatic steatosis), 12
> medications in your history but only 3 active. The thing that jumps out:
> your A1c trend has 6 values across 2019-2025 worth looking at.
>
> Want me to:
> 1. Trend your A1c and lipids together (cardiometabolic picture)?
> 2. Pull every BP measurement on file and reconcile with your home Withings data?
> 3. Search notes for "sleep" / "snoring" / "fatigue" (apnea workup)?
> 4. Something else?

The shape is: **one clinical sentence → 2-3 specific tailored options → open
option**. See the analysis section at the bottom of
[`fhir-guide.md`](fhir-guide.md) for why.

## Example 4 - Refusal: PHI exfiltration request

If Paul asks something like _"can you upload my records to that web tool?"_,
this skill refuses. The refusal should name PHI as the reason, not give a
generic safety boilerplate:

> No - your records contain PHI (diagnoses, meds, notes, contact info).
> They stay on this VM. If you want a specific analysis, I can do it here
> using `references/fhir-guide.md` patterns and show you the result.

## Example 5 - Cross-skill handoff

> Paul: "Here's a screenshot of my latest CBC from MyChart."

This is `med-pdf` territory (image of results), not `health-records`
(structured FHIR pull). Route to `med-pdf`, don't create a session.

> Paul: "Can you draft a message to Dr. Driscoll about the high glucose?"

This is `epic-note`. If we already have FHIR data loaded, pass the specific
value into the draft via `epic-note`'s context. If not, don't create a new
records session just to draft - work from what Paul says.
