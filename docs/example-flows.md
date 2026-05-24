# Example Flows

This page collects concrete agent flows that the live Tula skills support today. The README has the one-paragraph version; this is the longer set of examples.

For broader personal-health use cases (not tied to a single agent flow), see [`docs/use-cases.md`](use-cases.md).

## End-to-end personal-health flow

The headline flow the reference deployment supports, using the five live skills:

1. **Connect a patient portal through SMART on FHIR** (`health-records`). The user kicks off the connect flow from Telegram. The skill generates an ECDH keypair locally, produces a single browser link, the user signs in to MyChart (or another SMART-on-FHIR portal) on their phone, and the chart is streamed back end-to-end encrypted into the workspace memory layer.
2. **Upload a lab report PDF** (`med-pdf`). The user forwards a lab PDF (LabCorp, Quest, MyChart radiology export, etc.) to the agent. The skill extracts the biomarkers, units, reference ranges, and out-of-range flags into structured JSON.
3. **Ask Tula what changed since the last lab result** (`memory-diff`). The skill diffs the new extraction against the prior cache and renders a tiered change summary the user can scan.
4. **Draft a patient portal message to the care team** (`epic-note`). The user describes the topic ("ask about the LDL trend and the new statin"). The skill composes a MyChart-style draft. The user reviews, edits, and submits through their portal manually. The agent never auto-sends.
5. **Generate a daily health pulse** (`myhealth-pulse`). The skill aggregates configured signal feeds (recent records, recent lab changes, recent portal messages, recent notes) into a single daily digest, written to the workspace memory.

Continuous evaluation runs across each of these skills under [`evals/`](../evals/), and the same skill layer becomes part of Aria's governed patient-agent infrastructure at hospital scale. See [`docs/aria-commercial-platform.md`](aria-commercial-platform.md).

## Lab follow-up flow

1. The user receives a lab notification from the portal and forwards the lab PDF to Tula via email.
2. `med-pdf` extracts the values.
3. `memory-diff` flags out-of-range values and compares them to prior labs cached in the workspace.
4. The user asks Tula to prepare a portal message about the flagged values.
5. `epic-note` composes a triage-first draft that names the specific result, the trend, and the question.
6. The user reviews and submits the draft through their portal.

## Medication refill flow

1. The user notices a refill is needed and asks Tula to draft a refill request.
2. `epic-note` pulls medication and provider context from `MEMORY.md` and the cached health-records pull.
3. The skill produces a structured refill request including medication name, dose, last-fill date (if known), and pharmacy.
4. The user reviews, edits, and submits the request through their portal.

## Symptom summary flow

A deliberately conservative flow. The agent does **not** do triage. It prepares context for the user to bring to a clinician.

1. The user describes a symptom they want to discuss with their care team.
2. The skill summarizes the symptom, surfaces relevant context from `MEMORY.md` (recent labs, recent meds, recent visits), and prepares a portal-message draft framed around what the user wants the clinician to know.
3. The skill explicitly does not output a diagnosis, severity grade, or treatment recommendation.
4. If the user's prompt contains red-flag language (chest pain, stroke symptoms, severe shortness of breath, etc.), the skill redirects the user to call 911 or local emergency services and does not produce a portal message. See [`docs/safety-and-disclaimer.md`](safety-and-disclaimer.md).

## Caregiver coordination flow

The agent supports a caregiver running point on a loved one's care, with the same architecture as the patient flow, configured for the caregiver's view.

1. The caregiver forwards the patient's labs, imaging reports, and portal messages to the agent.
2. The agent maintains a longitudinal `MEMORY.md` for the patient under the caregiver's account, including conditions, meds, providers, appointments, and recent trends.
3. The caregiver asks the agent to prepare summaries before clinical encounters, to track medication changes between visits, and to draft portal messages on the patient's behalf when the patient consents.
4. The agent never sends a portal message on behalf of the patient. Drafts go to the caregiver for human review and submit.

This is the same skill layer that supports the patient directly; it just runs under the caregiver's account, with the patient's consent.

## Daily journaling flow (in progress)

Planned via the `patient-journal` skill:

1. The agent prompts the user via Telegram with a short daily check-in.
2. The user replies with a short voice or text note.
3. The skill stores the note in `memory/YYYY-MM-DD.md` with metadata.
4. Over time, `memory-diff` and `myhealth-pulse` include these notes in their longitudinal scan.

The skill is documented and in progress; see [`docs/roadmap.md`](roadmap.md).

## Voice flow (planned)

Documented in [`docs/voice-integration.md`](voice-integration.md). The flow uses Twilio and the `@openclaw/voice-call` plugin to give the agent a real phone number. The user can call the agent from any phone and have a conversation about their health. The voice layer is implemented; the integration with the Tula skill layer is on the roadmap.

## See also

- [`README.md`](../README.md), the front-door summary
- [`docs/use-cases.md`](use-cases.md), broader personal-health use cases
- [`docs/architecture.md`](architecture.md), the system architecture and skill composition
- [`docs/safety-and-disclaimer.md`](safety-and-disclaimer.md), the safety boundaries the flows respect
- [`docs/voice-integration.md`](voice-integration.md), the planned voice integration
- [`docs/roadmap.md`](roadmap.md), what is live, in progress, and planned
