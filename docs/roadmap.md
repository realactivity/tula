# Roadmap and Project Status

Tula is in active development. The reference deployment currently includes five live skills that pass continuous Waza compliance checks. This page is the canonical status of every component, eval snapshot, and strategy artifact.

The README contains a short summary and points back here.

## Live Skills

| Skill | Description | Status |
|---|---|---|
| [`health-records`](../skills/health-records/) | SMART on FHIR record pull from MyChart and other patient portals | Complete |
| [`med-pdf`](../skills/med-pdf/) | Medical PDF parsing for labs, imaging reports, and structured extraction | Complete |
| [`epic-note`](../skills/epic-note/) | Patient portal message drafting | Complete |
| [`myhealth-pulse`](../skills/myhealth-pulse/) | Signal aggregation and daily health digest | Complete |
| [`memory-diff`](../skills/memory-diff/) | Longitudinal change detection over workspace memory | Complete |

## Infrastructure

| Component | Status |
|---|---|
| Deployment Guide | Complete |
| OpenClaw Setup | Complete |
| Telegram Integration | Complete |
| Email Security Model | Complete |
| Skills Authoring Framework (Waza and conventions) | Complete |
| Personal Data Reference Convention (privacy seam) | Complete |
| Continuous Eval Status (waza check, CI gate, docs/evals.md) | Complete |
| Deploy Tooling (deploy-skills.sh, agent-backup.sh) | Complete |

## In Progress

| Component | Description |
|---|---|
| Intelligent Email Ingestion | Secure inbound routing and classification |
| Patient Health Dashboard | Mobile-friendly private dashboard |
| Patient Health Journal | Structured check-ins through Telegram |
| Professional Journal | Daily and weekly synthesis for work notes |
| Laboratory Parser | Structured biomarker tracker beyond med-pdf |

## Planned

| Component | Description |
|---|---|
| Wearable Sync | Garmin, Oura, Whoop, Withings, Apple Health |
| Home Device Sync | BP monitor, scale, pulse ox, glucose |
| Genomic Analyzer | 23andMe, AncestryDNA, clinical panels |
| Medical Image Interpreter | DICOM workflows with healthcare imaging models |
| De-Identification Engine | PHI removal for sharing and research |
| Research Synthesis | PubMed and literature monitoring |
| Voice Calling | OpenClaw voice-call plugin integration |
| Healthcare Model Routing | MedGemma, MedASR, MedImageInsight |

## Community Ideas

| Component | Description |
|---|---|
| Medication Adherence (IoT) | Community proposal |
| Caregiver Dashboard | Community proposal |

Community ideas live in [Discussions](../../../discussions) and [`docs/community-skills.md`](community-skills.md).

## Strategy Artifacts

| Artifact | Status |
|---|---|
| [Patient agent evaluation standard article](../articles/how-will-you-know-if-your-patient-ai-is-working.md) | Draft |
| [Two-score framework article (governance and health portfolio)](../articles/every-patient-ai-needs-two-scores.md) | Draft |
| [Voice integration architecture (OpenClaw and Twilio)](voice-integration.md) | Plan documented |
| [Open-core scope split](../OPEN_CORE.md) | Complete |

## Eval Snapshot: Request-Amendment

Local benchmark snapshot from `waza run evals/request-amendment/eval.yaml -v` using `claude-sonnet-4.6` (latest completed non-quota-interrupted run):

- Total tests: 10
- Succeeded: 8
- Failed: 2
- Success rate: 80.0%
- Aggregate score: 0.97

| Category | Task Coverage | Result |
|---|---|---|
| Core workflow | `positive-factual-correction`, `clinically-disputed-note`, `missing-context-addendum` | 2/3 passed |
| Regulatory fidelity | `denied-path-statement-of-disagreement`, `should-not-promise-provider-must-amend` | 1/2 passed |
| FHIR draft posture and conformance | `fhir-disabled-no-json-post`, `fhir-draft-enabled-json-only`, `fhir-draft-json-shape-from-fixture` | 3/3 passed |
| Safety and abuse resistance | `phi-boundary-no-external-tools`, `sensitive-domain-escalation` | 2/2 passed |
| Overall | all request-amendment tasks in run | 8/10 passed, aggregate 0.97 |

This suite now includes two high-signal showcase tasks:

- `golden-full-package-deterministic` (fixture-backed full-package conformance)
- `adversarial-phi-exfiltration-coercion` (combined exfiltration + coercion + forced-submit pressure)
- Full suite guide: [`evals/request-amendment/README.md`](../evals/request-amendment/README.md)

The continuous compliance status across all skills is regenerated at [`docs/evals.md`](evals.md).

## See also

- [`README.md`](../README.md), the front-door summary
- [`docs/evals.md`](evals.md), continuous Waza compliance status
- [`docs/architecture.md`](architecture.md), the system architecture
- [`docs/skills-development.md`](skills-development.md), the skill authoring guide
- [`docs/community-skills.md`](community-skills.md), community proposals
- [`OPEN_CORE.md`](../OPEN_CORE.md), the open / closed scope split
