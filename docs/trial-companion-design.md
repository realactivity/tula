# Trial Companion: design proposal for a patient-owned clinical trial agent

**Status: design proposal. Nothing on this page is a shipped capability.**
Tula ships the records pull, document parsing, visit prep, portal drafting,
longitudinal memory, and the SMART Health Check-in wallet that this design
reuses. The trial-specific skill, content pack, and handoff flow described
here are proposed work, to be built only against a scoped pilot with a named
study, a research site, and an IRB-approved content pack. The name "Trial
Companion" is descriptive and unclaimed.

Audience: research sites, sponsors, patient advocates, and contributors who
want to see how a patient-facing clinical trial agent can be built so that
it works for the participant first and still pays for itself on the sponsor
and site side.

---

## 1. Summary

Most clinical trial technology is bought by the sponsor and pointed at the
participant: eConsent, ePRO, reminders, and recruitment portals that live
inside one study and disappear when the study ends. The participant gets a
login, not an agent.

Trial Companion inverts that. The participant keeps their own agent (Tula on
their own machine, or My Aria issued and governed by a healthcare
organization on Aria). The agent already holds their longitudinal record,
pulled through SMART on FHIR from their patient portal. A study adds a
**content pack** (IRB-approved study information, structured eligibility
criteria, the visit schedule, contacts, and translations). The agent then
helps the participant do three things, in their language and at their
reading level:

| Step | What the participant gets | What the site gets |
|---|---|---|
| **Understand** | Plain-language explanation of the approved study materials, with citations back to the approved text, plus a list of questions to bring to the research team | Fewer first-contact questions that the consent form already answers; a participant who arrives prepared |
| **Prepare** | A private self-check of their own record against the study's structured criteria ("worth asking about", "probably not a fit", "missing information"), a records-gathering list, and a practical barrier checklist (transport, time off work, language, caregiving, devices) | Fewer screen failures caused by missing records; barriers surfaced before the screening visit, not after |
| **Connect** | A handoff package the participant approves item by item and sends to the site through SMART Health Check-in, the same consented exchange Tula's wallet already passes conformance tests for | Structured, patient-approved records and screening answers delivered into the site's own workflow, replacing the clipboard and the fax |

The sponsor funds the program. The site (or an independent governance
operator) governs the agent. The participant owns it. That three-party
split is the design's core idea, and it is what makes a sponsor-funded tool
trustworthy to a participant.

---

## 2. Why a patient-owned trial agent

**The participant's problem.** Consent forms run long and read at a
college level. Eligibility depends on records the participant has to chase
across portals. Practical barriers (a two-hour drive, no time off, no
interpreter, a caregiver who cannot come) decide whether someone enrolls
and whether they stay. After the study, participants rarely get their own
data or a plain-language summary of what was learned.

**The sponsor's problem.** Enrollment runs late on most trials. Screen
failures waste site time and participant goodwill. Dropouts cost replacement
participants and statistical power. Diversity commitments are hard to meet
when the first barrier is logistics, not interest. Each of these has a
dollar value that a sponsor already tracks; the pilot measures section
below says which ones a companion can plausibly move.

**The site's problem.** Research coordinators spend hours per participant
on pre-screening, records collection, scheduling, and answering questions
the consent form already answers. Coordinator turnover is high and the
work is repetitive.

**The trust problem.** A participant-facing app branded and operated by the
sponsor has a built-in conflict: the sponsor benefits from enrollment and
retention, and the participant knows it. A patient-owned agent that is
governed by someone other than the sponsor, that only ever shares what the
participant approves item by item, and that stays with the participant
after the study, resolves that conflict structurally rather than with a
privacy notice.

---

## 3. Design principles

These extend the Tula [principles](principles.md) and
[safety boundaries](safety-and-disclaimer.md); none of them are relaxed here.

1. **The participant owns the agent and the data.** The record lives in the
   participant's workspace. Nothing leaves it except a package the
   participant approved item by item.
2. **Approved content only.** The agent explains, translates, and
   paraphrases the IRB-approved content pack. It never generates new claims
   about the investigational product, its safety, its efficacy, or the
   participant's chances of benefit. Every explanation cites the approved
   section it came from.
3. **No eligibility determinations, no medical advice.** The self-check is
   information for the participant to discuss with the study team.
   Eligibility is decided by the investigator. Symptom questions route to
   the participant's clinician or the study team, never to a model answer.
4. **Drafts are drafts.** Messages to clinicians or coordinators are
   drafted and shown; the participant sends them.
5. **Standards-based handoff.** The site receives FHIR R4 resources and a
   QuestionnaireResponse through SMART Health Check-in, not screenshots or
   a proprietary export.
6. **Independent governance.** Identity, consent ledger, audit, model
   routing, and escalation policy run under a governance plane the sponsor
   does not operate. The sponsor sees aggregate, de-identified program
   metrics; it does not see participants.
7. **Open evaluation.** The skill ships with a Waza suite under the
   [Patient Agent Eval Standard v0.1](../evals/README.md), and pilot results
   are published in the same shape.
8. **A human is always reachable.** Every screen names the study
   coordinator and the participant's own care team. Anything that looks
   like an emergency redirects to emergency services.
9. **Health data only.** No insurance, billing, or coverage content, per
   Tula policy. Study-related logistics support is about getting to the
   visit, not about who pays for it.

---

## 4. Participant journey and scope

Version 0.1 scope is the middle of the journey. The bookends are listed so
the design does not paint itself into a corner.

| Phase | In v0.1 | What the agent does | Existing Tula pieces |
|---|---|---|---|
| Discover | No | Surface studies the participant asked about, from public registries, in plain language | `myhealth-pulse` feed model; ClinicalTrials.gov API |
| **Understand** | **Yes** | Explain approved materials; build the participant's question list | New `trial-companion` skill; `prep-my-visit` question-capture pattern |
| **Prepare** | **Yes** | Self-check against structured criteria using the local record; records-gathering list; barrier checklist | `health-records`, `med-pdf`, `memory-diff`, `request-amendment` |
| **Connect** | **Yes** | Item-by-item approved handoff to the site; scheduling prep | `apps/check-in-wallet` (SMART Health Check-in); `epic-note` draft pattern |
| Participate | No | Visit prep for each study visit, symptom and AE escalation to the site, diary reminders | `prep-my-visit`, `memory-diff` |
| Return | No | Receive individual results and the plain-language summary into the participant's own record; keep them after the study ends | `med-pdf`, workspace memory |

Scope is deliberately pre-enrollment in v0.1 because that is where the
regulatory surface is smallest (no study data capture, no eConsent of
record, no adverse-event system of record) and where the site and sponsor
pain is most measurable.

---

## 5. Three-party trust model

| Party | Holds | Sees | Never sees |
|---|---|---|---|
| **Participant** (Tula or My Aria workspace) | Full longitudinal record, study content pack, self-check results, barrier checklist, draft handoff, consent ledger | Everything about themselves, including an audit view of what was shared with whom and when | Other participants; sponsor internals |
| **Site** (research coordinator, investigator) | Patient-approved handoff packages inside the site's own systems; the IRB-approved content pack it submitted | Exactly the items the participant approved, with the participant's identity, because the site is where screening happens | The participant's workspace, chat history, or declined items |
| **Governance operator** (Aria instance run by the site, a health system, or an independent operator) | Identity, consent ledger, audit log, model routing, evaluation results, escalation policy | Governance signals (eval pass rate, record fidelity, audit completeness, content fidelity); break-glass access under policy | Participant content in normal operation |
| **Sponsor** | The content pack it authored; aggregate program metrics | Counts and rates: comprehension scores, barrier categories, self-check outcomes, handoff completion, language coverage, time to first coordinator contact, all de-identified and thresholded | Participant identity, free text, record contents, or anything below the de-identification threshold |

Self-hosted Tula users can run the whole flow with no governance operator
at all; the handoff still goes through the same consented exchange. The
governance operator exists so that an organization can issue agents to
people who will not run a VM, and so that a sponsor can fund a program
without operating it.

---

## 6. Architecture

```
Participant's agent (Tula skills on OpenClaw; self-hosted, or My Aria on Aria)
  |
  |-- health-records  -- SMART on FHIR pull via Wren (patient's own portal access)
  |-- med-pdf         -- outside labs, imaging, letters the portal does not have
  |-- memory-diff     -- what changed since the last pull (labs trending into or out of range)
  |-- request-amendment -- fix record errors that would distort a self-check
  |-- prep-my-visit   -- IPS-aligned brief and question list, reused for the screening visit
  |-- epic-note       -- draft a message to the participant's own clinician about joining
  |-- trial-companion (proposed) -- understand / prepare / connect against a study content pack
  |
  |-- Workspace memory  ~/.openclaw/workspace/
  |     |-- .health-records-cache/        FHIR R4 pulls
  |     |-- tula/studies/<study-id>/      content pack (versioned, signed by the site)
  |     |-- tula/studies/<study-id>/self-check.json
  |     |-- tula/studies/<study-id>/handoff/  item-by-item consent ledger + sent package
  |
  v  (participant approves each item)
SMART Health Check-in exchange (browser postMessage, encrypted to the site's key)
  |
  v
Research site verifier page (EHR check-in, CTMS intake, or a static site page)
  |-- FHIR R4 Bundle (Patient, Condition, MedicationRequest, AllergyIntolerance,
  |     Observation for named labs, Procedure, Immunization as requested)
  |-- QuestionnaireResponse (the study's pre-screening questionnaire)
  |-- Consent ledger reference (what was shared, what was declined, timestamp)
  |
  v
Site workflow (coordinator review, eligibility decision, scheduling)  -- unchanged systems of record

Governance plane (Aria, when an organization issues the agents)
  |-- identity and caregiver proxy, consent ledger, append-only audit
  |-- BAA-tier model routing; open-weight option for air-gapped deployments
  |-- continuous evals (Patient Agent Eval Standard) + content-fidelity checks
  |-- escalation policy (symptom, adverse-event, distress, emergency)
  |-- aggregate, de-identified program dashboard for the sponsor
```

**What is reused as-is.** The records pull, the wallet's consent screen and
response builder, the IPS-aligned brief, the portal-draft pattern, and the
eval harness.

**What is new.** The `trial-companion` skill, the content pack format and
loader, a study-specific Questionnaire rendered inline in the wallet, a
"research check-in" request shape for the site's verifier page, and three
new eval dimensions (section 11).

**What stays out of the agent.** eConsent of record, electronic data
capture, randomization, adverse-event reporting systems, payments. The site
and sponsor keep their validated systems; the agent prepares the
participant and hands off.

---

## 7. The `trial-companion` skill (proposed shape)

Follows the [`med-pdf`](../skills/med-pdf/) layout and the authoring rules in
[`skills/AGENTS.md`](../skills/AGENTS.md). Sketch only; the real SKILL.md is
written when a pilot is scoped.

```
skills/trial-companion/
  SKILL.md
  README.md
  references/
    content-pack.md        # schema, provenance, versioning, signing, translations
    self-check.md          # criteria mapping rules; the three outcome labels; what is never inferred
    barriers.md            # barrier taxonomy (transport, time, language, caregiving, devices, trust)
    handoff.md             # research check-in request shape; consent ledger; declined-item handling
    safety.md              # symptom, adverse-event, distress, emergency routing; no-advice rules
    examples.md
  scripts/
    load-content-pack.mjs  # validate + verify signature, write to tula/studies/<id>/
    self-check.mjs         # deterministic criteria-to-FHIR mapping over the local cache
    build-handoff.mjs      # assemble Bundle + QuestionnaireResponse; enforce item-by-item approval
```

**Frontmatter description (draft).** "Help a trial participant understand
approved study information, prepare their own records and practical
barriers, and hand off a patient-approved package to the research site.
USE FOR: explaining a study the participant is considering, pre-screening
against their own record, preparing for a screening visit, sending approved
records to a research site. DO NOT USE FOR: eligibility decisions, medical
advice, adverse-event reporting of record, consent of record, or any PHI
transfer the participant has not approved item by item."

**Workflow (draft).**

1. Resolve the study context: load and verify the content pack for the
   study the participant named. Refuse to proceed on an unsigned or expired
   pack.
2. Understand: answer the participant's questions from the pack only, with
   a citation to the pack section after each answer, at the participant's
   reading level and in their language. Capture 1 to 3 participant goals
   verbatim (the `prep-my-visit` pattern).
3. Prepare: run the deterministic self-check script over the local FHIR
   cache; return the three-label summary and the missing-items list. Run
   the barrier checklist. Offer `health-records` or `med-pdf` to fill gaps.
4. Connect: build the handoff draft; show each item with share or decline;
   send only through the research check-in exchange after approval; write
   the consent ledger.
5. Persist everything under `~/.openclaw/workspace/tula/studies/<study-id>/`.

**Output contract.** The self-check produces three labels and nothing more
specific: `worth-asking-about`, `probably-not-a-fit`, `missing-information`.
It never outputs "eligible" or "ineligible". The handoff package is a
FHIR R4 Bundle plus a QuestionnaireResponse whose `questionnaire` equals the
study's canonical, validated by the same checks the wallet already runs.

---

## 8. Study content pack

The content pack is the only study-specific input the agent accepts. It is
authored by the sponsor or site, approved by the IRB as participant-facing
material, versioned, and signed by the site.

| Element | Format | Notes |
|---|---|---|
| Study summary and consent-form text | Markdown with section IDs | The approved text; the agent cites section IDs |
| Frequently asked questions | Markdown, section IDs | Approved answers; the agent may paraphrase, not extend |
| Structured eligibility criteria | JSON: criterion, type, code system, value, window | Mapped to FHIR data classes; criteria that cannot be checked from records are marked `ask-the-team` |
| Visit schedule and burden | JSON (HL7 Vulcan Schedule of Activities shape where practical) | Lets the agent explain "what you would actually do" |
| Pre-screening questionnaire | FHIR Questionnaire | Rendered inline in the wallet; answers return as QuestionnaireResponse |
| Site contacts and escalation | JSON | Coordinator, after-hours line, emergency instruction |
| Translations and reading-level variants | Same structure per language | Approved translations only; the agent does not machine-translate approved text |
| Provenance | Signature, IRB approval reference, version, expiry | The loader refuses packs that fail verification |

Public registry data (ClinicalTrials.gov API v2) can seed a draft pack, but
the pack the agent uses is the approved one.

---

## 9. Safety and regulatory posture

This section states the posture the design targets. It is not legal advice,
and a pilot confirms each line with the site's IRB and the sponsor's
regulatory and legal teams.

| Topic | Design posture |
|---|---|
| Participant-facing content | The content pack is submitted to the IRB as recruitment and participant material (21 CFR 50 and 56; 45 CFR 46). The agent's behavior spec, example outputs, and logging are part of the submission. The agent only paraphrases approved content with citations. |
| Not a medical device | No diagnosis, treatment, triage, or eligibility determination. The self-check is information for a conversation with the study team. Keeps the agent outside the software functions FDA regulates as devices and outside clinical decision support. |
| Not a system of record | The site's eConsent, EDC, CTMS, and safety systems remain the validated systems of record (21 CFR Part 11 scope stays with them). The handoff is patient-provided information the site verifies against source, like a faxed record today. The agent keeps its own audit log regardless. |
| Decentralized and digital elements | Aligns with FDA's 2024 final guidance on decentralized clinical trial elements and the 2023 guidance on digital health technologies: the participant's own device and records support the trial, the investigator stays responsible, and data flows are documented. |
| Sponsor oversight of service providers | ICH E6(R3) expects sponsors to oversee service providers proportionately. The operator supplies SOPs, a validation summary, security documentation, and the open eval results. |
| HIPAA and patient-directed sharing | The participant pulls their own records through their own portal access (patient right of access; SMART on FHIR). Sharing with the site is a patient-directed disclosure the participant approves item by item. Organization-issued deployments on Aria run under a BAA with that organization. |
| Non-HIPAA app obligations | A direct-to-participant deployment is a personal health record under the FTC Health Breach Notification Rule; breach procedures and no secondary use are part of the operating model. |
| Symptom and adverse-event mentions | Pre-enrollment, any symptom question routes the participant to their own clinician or the study team. Post-enrollment (not in v0.1), any adverse-event mention triggers an immediate "contact your study team now" path and, with the participant's standing consent, a structured notice to the site coordinator, who reports to the sponsor under the protocol. The agent is never the adverse-event system of record and never gives medical advice about the event. |
| AI disclosure | The agent identifies itself as an AI assistant at the start of every session and on every generated message, names the human contacts, and follows state disclosure rules for generative AI in patient communications. |
| Language and accessibility | Approved translations only; reading-level variants; screen-reader-compatible wallet; voice later. Language access is a first-class feature, not a localization pass. |
| Undue influence | No incentives, no persuasion, no urgency language. The agent presents the study; it does not sell it. Declining to share or to enroll is a normal, supported path. |
| Diversity commitments | Language access, barrier identification, and caregiver support are the agent's contribution to a sponsor's diversity action plan; the agent does not collect race or ethnicity for the sponsor. |
| EU studies (later) | Lay summaries under the Clinical Trials Regulation, GDPR lawful basis and data residency, and the EU AI Act transparency obligations for AI systems that interact with people, all confirmed before any EU pilot. |

---

## 10. Standards and federal alignment

| Standard or program | Where it lands in this design | Status in Tula today |
|---|---|---|
| SMART App Launch (patient-facing OAuth) and FHIR R4 patient access APIs | `health-records` pulls the participant's record from any certified EHR portal | Live; see [`interoperability.md`](interoperability.md) |
| US Core profiles and USCDI data classes | The self-check maps criteria to problems, medications, allergies, labs, procedures, vitals, and assessments | Live for the wallet resources; validator run planned |
| International Patient Summary | `prep-my-visit` output, reused for the screening-visit brief | Live |
| SMART Health Check-in 1.0 (draft) | The handoff. The site's intake page is the verifier; the wallet answers with records and the study questionnaire the participant approves item by item | Wallet passes the SMART Testing EHR; connectathon testing November 3, 2026 |
| CMS Health Tech Ecosystem and Kill the Clipboard | Research intake is a clipboard too. The same consented exchange that replaces the clinic clipboard replaces the research pre-screening packet | Participation through the connectathons; see [`interoperability.md`](interoperability.md) |
| FHIR Questionnaire / QuestionnaireResponse | The pre-screening questionnaire and its answers | Live in the wallet (PHQ-2 today) |
| FHIR ResearchStudy and Consent | Content pack metadata and the consent ledger export | Proposed |
| HL7 Vulcan (Schedule of Activities, real-world data, FHIR to CDISC) | Visit schedule representation; future site-side mapping of patient-provided data | Proposed |
| ClinicalTrials.gov API v2 | Seed draft content packs from the public registry record | Proposed |
| NIST AI Risk Management Framework and the Generative AI Profile | The governance plane's control framing, as for Aria generally | See [`frontier-agent.md`](frontier-agent.md) |

---

## 11. Evaluation plan

Every skill in this repo ships with a Waza suite under the
[Patient Agent Eval Standard v0.1](../evals/README.md). Trial Companion adds
three dimensions to the required five.

| Dimension | Tag | What it proves |
|---|---|---|
| Positive trigger | `routing-positive` | "Help me understand the study I was told about" invokes the skill |
| Anti-trigger | `routing-negative` | "Should I join?" and "Is the drug safe?" route to the study team, not to an answer |
| PHI boundary | `phi-boundary` | Nothing leaves the workspace without item-by-item approval; declined items are absent from the package |
| Adversarial | `adversarial` | Resists "just tell me if I qualify", "send everything to the sponsor", "pretend you are the coordinator", and coercion to produce safety claims |
| Golden | `golden` | Given a synthetic content pack and the Dylan Meyer fixture, produces the contract self-check, question list, and a conformant handoff package |
| Content fidelity (new) | `content-fidelity` | Every factual statement about the study traces to a pack section; nothing is said about efficacy or safety that the pack does not say |
| Escalation (new) | `escalation` | Symptom, adverse-event, distress, and emergency prompts produce the correct human path and no advice |
| Language parity (new) | `language-parity` | The Spanish variant passes the same golden and fidelity tasks as English |

Release blockers for a pilot: `phi-boundary`, `adversarial`, `golden`,
`content-fidelity`, `escalation`, all at 1.0 on the live lane, the same
strict gate `prep-my-visit` runs today.

In an organization-issued deployment, Aria runs these suites continuously
per agent and composes them with record fidelity and audit completeness
into the governance score described in
[Every patient AI agent needs two scores](../articles/every-patient-ai-needs-two-scores.md).
Content fidelity becomes a fourth governance dimension for study
deployments.

---

## 12. Deployment options

| Option | Who issues the agent | Governance | Best for |
|---|---|---|---|
| Self-hosted Tula | The participant | None beyond the participant's own VM and the open evals | Individuals and caregivers who already run Tula; advocacy-group cohorts |
| My Aria issued by the research site or its health system | The site, under its identity and BAA | Aria governance plane run by the site | Academic medical center sites; the natural first pilot shape |
| My Aria issued by an independent operator, funded by a sponsor | The operator | Aria governance plane run by the operator; sponsor sees aggregates only | Multi-site programs where sites do not run their own plane |

The open and closed boundary is unchanged from [`OPEN_CORE.md`](../OPEN_CORE.md):
the skill, the content pack format, the wallet, and the evals are open; the
multi-tenant governance plane, the consent ledger at scale, the continuous
eval execution, and the aggregate sponsor dashboard are Aria.

---

## 13. What a pilot measures

Set baselines with the site before the first participant. Measure three
sides at once so that a sponsor win is never claimed without a participant
win next to it.

| Side | Measure | How |
|---|---|---|
| Participant | Comprehension of key study facts (teach-back score) before and after using the agent | Short structured questionnaire, approved by the IRB |
| Participant | Share who report feeling prepared for the screening visit; share who had their questions answered | Post-visit survey |
| Participant | Barriers identified before the screening visit, and barriers resolved | Barrier checklist outcomes |
| Participant | Language-access coverage: share served in their preferred language | Operator metrics |
| Participant | Control: share who declined at least one item and still completed a handoff; share who could view their own sharing audit | Consent ledger |
| Site | Coordinator minutes per participant from first contact to screening visit | Time study, before and after |
| Site | Screen-to-enroll conversion and screen failures attributable to missing records | Site CTMS counts |
| Site | Completed handoffs; time from first contact to scheduled screening visit | Exchange logs and CTMS |
| Sponsor | Enrollment pace against plan at the pilot site versus comparable sites | Sponsor's own enrollment tracking |
| Sponsor | Retention at the first follow-up milestone (only if the pilot extends past screening) | Sponsor data |
| Sponsor | Diversity of the screened and enrolled cohort against the plan, reported by the site | Site reporting; the agent collects nothing for this |
| Governance | Eval pass rate, content fidelity, audit completeness | Continuous, published |

Dollar values are the sponsor's to assign from its own cost base; the
design does not claim an enrollment uplift until a pilot measures one.

---

## 14. Out of scope

- Consent of record, electronic data capture, eSource, randomization,
  drug supply, and adverse-event reporting systems. The agent prepares and
  hands off; the trial's validated systems stay where they are.
- Eligibility determinations and any clinical judgment.
- Insurance, coverage, billing, reimbursement, or payment content, per
  Tula's health-data-only rule.
- Collecting race, ethnicity, or other sponsor-reporting demographics
  through the agent.
- Sponsor access to identified participant data or conversation content.

---

## 15. Open questions for a first pilot

1. Which single study and which single site, and what does the site's IRB
   want to see for a participant-facing AI tool?
2. What is the minimum content pack the sponsor can approve inside a
   normal amendment cycle?
3. Does the site's intake system (EHR check-in, CTMS, or a static page) act
   as the SMART Health Check-in verifier, and who owns the keys?
4. What de-identification threshold does the sponsor dashboard use, and
   who reviews it?
5. How are coordinator time and screen-failure baselines captured before
   go-live?
6. Which languages are approved for the first pack, and who validates the
   translations?
7. Where does the participant's agent go after the study: stays with the
   participant on Tula, or remains issued by the site?

---

## See also

- [`interoperability.md`](interoperability.md), the SMART Health Check-in wallet and conformance results
- [`apps/check-in-wallet/README.md`](../apps/check-in-wallet/README.md), the wallet that becomes the handoff
- [`skills/prep-my-visit/`](../skills/prep-my-visit/), the brief and question-capture pattern this reuses
- [`evals/README.md`](../evals/README.md), the eval standard the new suite extends
- [`aria-commercial-platform.md`](aria-commercial-platform.md) and [`OPEN_CORE.md`](../OPEN_CORE.md), where governance lives
- [`enterprise-pilots.md`](enterprise-pilots.md), how a pilot is scoped
- [`safety-and-disclaimer.md`](safety-and-disclaimer.md) and [`security-model.md`](security-model.md), the boundaries this design inherits
- [`patient-agency.md`](patient-agency.md), why the participant owns the agent
