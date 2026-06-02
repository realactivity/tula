# prep-my-visit evals

Evaluation assets for the `prep-my-visit` skill.

## Layout

- `eval.yaml` - live suite (copilot-sdk), 21 tasks in `tasks/*.yaml`
- `eval.mock.yaml` - no-quota structural smoke suite (mock engine), `tasks-mock/*.yaml`
- `run_script_checks.sh` - deterministic validator + renderer checks against `fixtures/`
- `fixtures/` - known-good and known-bad inputs for the deterministic checks

## Running

Live behavioral suite (needs Copilot quota):

```bash
waza run evals/prep-my-visit/eval.yaml -v
```

No-quota structural smoke (harness, skill loading, grader wiring):

```bash
waza run evals/prep-my-visit/eval.mock.yaml -v
```

Deterministic script + policy checks (no quota, no model):

```bash
bash evals/prep-my-visit/run_script_checks.sh
```

## Live scenario map (`tasks/`)

Functional / positive triggers:

- `func-cardiology-followup` - recognizes follow-up prep flow
- `func-pcp-annual-labs` - discuss-with-doctor lab framing
- `func-urgent-sameday` - compressed urgent flow
- `func-handoff-summary` - provider + patient views and a reviewable snippet
- `func-goals-capture` - captures patient goals verbatim
- `func-specialist-first-visit` - first-visit depth, no speculation
- `func-caregiver-proxy` - caregiver proxy flow, patient stays subject

Lab analyzer:

- `lab-category-a-standing-order` - pending standing order detection
- `lab-category-b-citation` - discuss-with-doctor + named citation, no imperatives
- `lab-category-c-optin` - direct-to-consumer only with explicit opt-in

IPS / FHIR structure:

- `ips-required-sections` - Problem List / Allergies / Medication Summary
- `ips-tula-extensions` - Patient Story, Lab Opportunities, Delta

PDF rendering / persistence:

- `pdf-renders-both-views` - provider.pdf and patient.pdf
- `pdf-persist-path` - artifacts stay in the workspace briefs path

Safety boundaries:

- `safety-no-diagnosis` - never diagnoses
- `safety-no-treatment-change` - never changes meds/treatment
- `safety-phi-boundary` - no PHI transfer outside the workspace
- `safety-no-auto-send` - never auto-sends a portal snippet
- `safety-no-billing` - declines insurance/billing/prior-auth/EOB

Skill routing:

- `route-to-med-pdf` - standalone PDF extraction defers to med-pdf
- `route-to-epic-note` - standalone portal drafting defers to epic-note

## Deterministic checks (`run_script_checks.sh`)

Asserts validator exit codes (0 = pass, 1 = blocking failure) over `fixtures/`,
covering both pass and fail paths:

- IPS sections: valid composition vs. missing required section
- Lab opportunities: valid vs. Category B overflow, imperative language,
  missing citation, Category C without opt-in
- Snippet limits: valid vs. over-length, billing drift
- Renderer: all three example briefs produce non-empty provider/patient PDFs

## Quota note

The live suite (`eval.yaml`) is the certification path. It is structurally
valid - waza discovers all 21 tasks and wires the copilot-sdk engine - but
running it requires Copilot quota. When quota is unavailable, use
`eval.mock.yaml` and `run_script_checks.sh` for structural and policy
validation, and treat live certification as pending.
