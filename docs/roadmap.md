# Roadmap and Project Status

Tula is in active development. The reference deployment currently includes eight published skills (all with Waza eval suites under [Patient Agent Eval Standard v0.1](../evals/README.md)) and the self-hostable Wren records relay. This page is the canonical status of every component, eval snapshot, and strategy artifact.

The README contains a short summary and points back here.

## Recent Milestones

- **2026-06-04: Patient Agent Eval Standard v0.1.** All eight skills plus a cross-skill composition bundle ship under [`evals/`](../evals/README.md): 78 tasks, golden fixtures, adversarial packs, mock CI lanes, and taxonomy lint. See [`docs/evals.md`](evals.md).
- **2026-05-25: YouTube live demo.** [~16-minute screen recording](https://youtu.be/FcLl6fASpgw) with Epic MyChart SMART on FHIR pull at **10:00**. See [`docs/demo.md`](demo.md).
- **2026-05-14: Podcast interview.** [AI Agent and Copilot Podcast](https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/) (~17 min) - story, OpenClaw, and patient agency. See [`docs/demo.md`](demo.md).
- **2026-06-04: Wren merged to public Tula.** The self-hostable SMART on FHIR records relay landed at [`services/wren/`](../services/wren/). The `health-records` skill can now pull through a self-hosted relay with no third-party dependency, set via `HEALTH_SKILLZ_BASE_URL`. The multi-tenant, hospital-scale version of the relay remains private under Aria.

## Live Skills

| Skill | Description | Status |
|---|---|---|
| [`health-records`](../skills/health-records/) | SMART on FHIR record pull from MyChart and other patient portals | Complete |
| [`med-pdf`](../skills/med-pdf/) | Medical PDF parsing for labs, imaging reports, and structured extraction | Complete |
| [`epic-note`](../skills/epic-note/) | Patient portal message drafting | Complete |
| [`myhealth-pulse`](../skills/myhealth-pulse/) | Signal aggregation and daily health digest | Complete |
| [`memory-diff`](../skills/memory-diff/) | Longitudinal change detection over workspace memory | Complete |
| [`prep-my-visit`](../skills/prep-my-visit/) | IPS-aligned visit-prep package from patient health data | Complete |
| [`request-amendment`](../skills/request-amendment/) | HIPAA-aligned health-record amendment request drafting | Complete |
| [`lookout`](../skills/lookout/) | Ambient environmental and public-health awareness triaged against the record | Complete |

## Self-Hostable Services

| Service | Description | Status |
|---|---|---|
| [`services/wren`](../services/wren/) | Self-hostable SMART on FHIR records relay: the backend the `health-records` skill pulls through. Lets a deployment run the whole records-pull stack with no third-party dependency. Single-tenant; point the skill at it via `HEALTH_SKILLZ_BASE_URL`. | Complete (merged to public main, 2026-06-04) |

Wren is a rebranded MIT derivative of [`jmandel/health-skillz`](https://github.com/jmandel/health-skillz); attribution is preserved in [`services/wren/NOTICE`](../services/wren/NOTICE), [`services/wren/LICENSE`](../services/wren/LICENSE), and the root [`NOTICE`](../NOTICE). The multi-tenant, hospital-scale version of the relay is part of Aria, not this repo.

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
| Native Apps | One-click install apps for Android, iOS, macOS, and Windows |
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
| [Patient agent evaluation standard article](../articles/how-will-you-know-if-your-patient-ai-is-working.md) | Draft (companion to [`evals/README.md`](../evals/README.md) v0.1) |
| [Two-score framework article (governance and health portfolio)](../articles/every-patient-ai-needs-two-scores.md) | Draft |
| [Voice integration architecture (OpenClaw and Twilio)](voice-integration.md) | Plan documented |
| [Open-core scope split](../OPEN_CORE.md) | Complete |

## Eval Snapshot: Request-Amendment

Prior local benchmark snapshot from `waza run evals/request-amendment/eval.yaml -v`
using `claude-sonnet-4.6` (pre-v0.1 expansion, 10-task suite):

- Total tests: 10
- Succeeded: 8
- Failed: 2
- Success rate: 80.0%
- Aggregate score: 0.97

The suite now has **12 tasks** (golden moved to `tasks/golden/`, adversarial
pack added). Re-run live certification on the VM after merge and publish to
`results/`.

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
