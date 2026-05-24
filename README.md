# Tula: Open-Source Personal Health AI Agent

Your health. Your data. Your AI.

Tula is an open-source personal health agent skill layer built on [OpenClaw](https://github.com/openclaw/openclaw). It helps individuals, caregivers, and health-focused communities organize health records, medical PDFs, lab results, portal messages, personal notes, and longitudinal health signals in a private, self-hosted AI workspace.

Tula is designed for patient agency: helping people better understand, organize, and act on their own health information without handing that data to another closed platform.

Tula is named after a brilliant, strong woman, a Mensa member and mother of five. The project embodies her sharp intelligence, warmth, and directness in service of one goal: helping individuals take an active, informed role in their health.

Tula is the open-source foundation. Aria is RealActivity's commercial hospital-scale platform for governed patient-agent infrastructure.

## 30-Second Summary

Tula turns a general-purpose AI agent into a personal health intelligence assistant.

It currently supports:

- Pulling patient records from portals using SMART on FHIR
- Parsing medical PDFs, lab reports, screenshots, and image-only documents
- Drafting patient portal messages for medication questions, lab follow-ups, refill requests, and symptom summaries
- Creating daily health signal digests
- Comparing health information over time through longitudinal memory diffing
- Running skills inside a self-hosted OpenClaw workspace
- Supporting continuous evaluation and compliance checks through Microsoft Waza

Tula is not a medical device, not a clinical decision support system, and not a replacement for professional medical advice.

## Tula Is a Frontier AI Agent

**Tula is a Frontier AI agent built on Microsoft Foundry agent patterns. It is engineered to meet enterprise-grade security, evaluation, observability, audit, and healthcare-specific guardrail expectations out of the box.**

This is not a hobby chatbot wearing a healthcare costume. Tula adopts the same agent patterns the leading frontier-model vendors publish for their own enterprise stacks, and it is designed from day one to drop into a governed AI foundry — [Microsoft / Azure AI Foundry](https://azure.microsoft.com/en-us/products/ai-foundry), [NVIDIA AI Foundry](https://www.nvidia.com/en-us/ai/foundry/), or [Palantir Foundry](https://www.palantir.com/platforms/foundry/) — alongside identity, audit, and compliance plumbing (Microsoft Entra, Defender, Purview, and the [Microsoft Foundry Control Plane](https://azure.microsoft.com/en-us/products/ai-foundry/control-plane)) without re-architecture. **Tula is foundry-agnostic**: skills emit OpenTelemetry-shaped traces, ship binary-graded evaluation suites, and route through a model-provider seam that any of these enterprise foundries can consume. The same skill layer that runs on a single self-hosted VM for an individual patient is the skill layer that runs inside Aria's hospital-scale governed runtime.

### What "Frontier AI agent" means in practice

| Capability | How Tula delivers it | Microsoft Frontier pattern it mirrors |
|---|---|---|
| **Continuous evaluations** | Every skill ships an open evaluation suite under [`evals/<skill>/`](evals/) with task fixtures, ground truth, and a Waza spec gate enforced in CI on every PR. Status is regenerated continuously at [`docs/evals.md`](docs/evals.md). | [Foundry agent evaluators](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/agent-evaluators) function as unit tests with binary Pass/Fail, covering both **system** (final outcome) and **process** (step-by-step tool use) evaluation — including the *Task Adherence* evaluator Microsoft explicitly designs for "validating compliance in regulated environments." Tula's suite is shaped to publish into that same lifecycle (dev → CI → production traffic). |
| **Observability and tracing** | Tula runs on [OpenClaw](https://github.com/openclaw/openclaw), which emits structured per-run logs of inputs, tool calls, model selections, outputs, latency, and cost. The trace surface is OpenTelemetry-shaped so it can be exported to Application Insights, Azure Monitor, or any OTel-compatible collector. | [Foundry Observability is GA](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/generally-available-evaluations-monitoring-and-tracing-in-microsoft-foundry/4502760) and publishes traces, evaluations, and metrics into Azure Monitor / Application Insights, inheriting Azure Monitor's RBAC, retention, and audit-log controls. Microsoft and Cisco Outshift's [multi-agent OpenTelemetry semantic conventions](https://learn.microsoft.com/en-us/azure/foundry/observability/concepts/trace-agent-concept) are the trace contract Tula targets. |
| **Audit-ready governance** | All agent actions land in append-only logs the operator owns. The Tula reference deployment keeps every change reproducible via `agent-backup.sh` snapshots with a regex secret-scan gate. Aria extends this to per-tenant append-only audit with break-glass procedures. | [Foundry Control Plane](https://learn.microsoft.com/en-us/azure/foundry/control-plane/overview) integrates with **Microsoft Purview**, **Microsoft Defender**, and **Microsoft Entra** for versioned policy, data-loss prevention, compliance posture, and full audit traceability across agents and environments. |
| **Defense in depth for autonomous agents** | Tula implements all four of Microsoft's published patterns for autonomous AI agents: skills are scope-contained (one skill, one job), least-permission (each skill writes only to its own cache), human-in-the-loop on consequential actions (portal-message drafts are *drafts*, never auto-sent), and identity-bound (every action is attributable to the named agent). | Microsoft's May 2026 [Defense in depth for autonomous AI agents](https://www.microsoft.com/en-us/security/blog/2026/05/14/defense-in-depth-autonomous-ai-agents/) blog defines the four mutually-reinforcing patterns: agents as microservices, least permissions, deterministic human-in-the-loop, and agent identity. "Identity makes all of it auditable." Tula is built on those four. |
| **Healthcare-specific guardrails** | Tula's open skills enforce healthcare-specific safety: portal messages are drafted but never auto-sent; PHI is scoped to a private workspace memory layer the user owns; the `.health-records-cache/` and `.med-pdf-cache/` directories are bounded to the agent's workspace; the email router locks inbound mail to a sender allowlist at the **Exchange transport layer** before any model ever sees it. See [`docs/security-model.md`](docs/security-model.md). | Aligned with [Microsoft Foundry's healthcare AI foundation models](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/healthcare-ai/healthcare-ai-models) (MedImageInsight, CXRReportGen, MedASR, and others) and Microsoft's broader Responsible AI safeguards: out-of-distribution detection, drift monitoring, content filtering, and red-team scanning. |
| **Compliance-ready spec gates** | [Microsoft Waza](https://github.com/microsoft/waza) runs as a static spec gate on every PR. Skills that don't pass don't merge. The same gate runs continuously in CI and publishes a public status doc. | Microsoft Foundry pairs continuous evaluation with [governance integrations](https://devblogs.microsoft.com/foundry/achieve-end-to-end-observability-in-azure-ai-foundry/) for **Microsoft Purview Compliance Manager**, **Credo AI**, and **Saidot** to align evaluation plans with frameworks like the EU AI Act. |

### Foundry-agnostic and provider-portable

Tula is **not** locked to a single AI foundry, a single model provider, or a single cloud. The same skill layer runs across all three of the major enterprise AI foundries and across every major frontier-model API.

**Enterprise AI foundries Tula targets**

- [**Microsoft / Azure AI Foundry**](https://azure.microsoft.com/en-us/products/ai-foundry) — first-class home for the reference deployment. Hosts the [healthcare AI foundation models](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/healthcare-ai/healthcare-ai-models) — **MedImageInsight** for medical-image embeddings (X-ray, CT, MRI, dermatology, pathology, mammography), **CXRReportGen** for chest X-ray narrative generation, **MedASR** for medical speech recognition, and **MedGemma** (4B and 27B) for medical text and imaging reasoning — plus the [Foundry Control Plane](https://azure.microsoft.com/en-us/products/ai-foundry/control-plane), Foundry Observability, and Purview/Defender/Entra integrations.
- [**NVIDIA AI Foundry**](https://www.nvidia.com/en-us/ai/foundry/) — for custom-tuned frontier models packaged as NVIDIA NIM inference microservices on NVIDIA DGX Cloud, including NVIDIA's Nemotron family, optimized open-weights, and customer-tuned domain models. Tula can route to NIM endpoints anywhere NIM runs (cloud, on-prem, or edge).
- [**Palantir Foundry / AIP**](https://www.palantir.com/platforms/foundry/) — for healthcare and life-sciences operators who already standardize on Foundry's ontology, lineage, and role-/permission-governed data layer ([AIP](https://aip.palantir.com/) for the AI surface). Tula's structured outputs (FHIR R4, lab JSON, imaging JSON, audit traces) are shaped to land cleanly into a Foundry ontology.

**Frontier model providers Tula routes to**

- [**Anthropic Claude**](https://www.anthropic.com/claude) (Claude Sonnet 4.6 and Claude Opus 4.7) for clinical reasoning, document understanding, and message drafting — the default in the reference deployment via OpenClaw's `copilot-sdk` integration, and routable directly or through any of the foundries above.
- [**OpenAI**](https://openai.com/api/) (GPT family, o-series reasoning, Whisper) — directly, or via [Azure OpenAI / Azure AI Foundry](https://azure.microsoft.com/en-us/products/ai-foundry) on BAA-eligible endpoints.
- [**Google Gemini**](https://ai.google.dev/) (including Gemini Live for voice), [**xAI Grok**](https://x.ai/), [**Mistral**](https://mistral.ai/), [**DeepSeek**](https://www.deepseek.com/), [**Cohere**](https://cohere.com/), and other SOTA providers through the [OpenClaw](https://github.com/openclaw/openclaw) plugin system.
- **Open-weight models via [vLLM](https://github.com/vllm-project/vllm)** (MedGemma 4B locally, Llama, Mistral, Qwen, and any compatible model) for fully air-gapped deployments where regulatory or sovereignty constraints rule out any external API call.

Routing is deployment-context-aware: each task is directed to the most capable, cost-effective, and privacy-appropriate model available in *that* foundry, in *that* deployment, at *that* moment. See [`docs/model-routing.md`](docs/model-routing.md).

### Why this matters for enterprises

Most patient-facing AI projects start as a chatbot demo and then spend nine to eighteen months retrofitting evaluations, audit logging, identity, model governance, and HIPAA controls before a hospital will let them anywhere near a real patient. Tula inverts that order. The evaluation harness, the audit-friendly trace shape, the scope-contained skill model, the sender-allowlist transport gate, and the provider-agnostic routing layer are built in from skill #1. The same code that survives a Waza spec gate in this open repo is what Aria runs under multi-tenant identity, RBAC, BAA-tier LLM gateways, and per-tenant audit aggregation at hospital scale.

**Tula is enterprise-ready for the strictest compliance environments** — health systems, payers, employers, research organizations, and regulated digital-health vendors — because its open foundations were designed to drop directly into Microsoft / Azure AI Foundry, NVIDIA AI Foundry, or Palantir Foundry; to route to Anthropic Claude, OpenAI, Gemini, or any combination of Foundry-catalog healthcare models; and to run end-to-end on air-gapped open-weight inference, all without rewriting the agent.

## What Is Tula?

Tula is not a standalone consumer health app.

Tula is a health-focused skill layer for OpenClaw. It provides reusable agent skills, configuration patterns, evaluation suites, and deployment guidance for building a self-hosted personal health AI assistant.

The reference deployment runs on a single self-hosted VM and uses a private workspace memory model. Health data stays under the user's control.

## What Tula Is Not

Tula is not:

- A medical device
- A diagnostic system
- A treatment recommendation engine
- A substitute for a physician, nurse, pharmacist, or qualified healthcare professional
- An emergency response system
- A replacement for an EHR, patient portal, or clinical workflow system

Tula is designed to support personal health organization, health literacy, caregiver coordination, and patient-facing AI experimentation in a private environment.

## Coverage

Paul Swider on the AI Agent and Copilot Podcast: [OpenClaw-Powered Healthcare Assistant Builds Patient Agency](https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/) (17 minutes, May 14, 2026).

## Open-Core Model

Tula and Aria are related but distinct.

| Project | Scope | License and Availability |
|---|---|---|
| Tula | Open-source health agent skill layer and single-user reference deployment | Apache License 2.0 |
| Aria | Commercial hospital-scale patient-agent platform for governed, multi-tenant deployment | Proprietary RealActivity platform |

Tula is complete and useful on its own. Aria consumes Tula skills as a versioned dependency and adds the enterprise infrastructure required for healthcare organizations, including patient identity, ingest routing, dashboards, LLM gateway governance, audit, compliance, and operational controls.

The detailed scope split is documented in [`OPEN_CORE.md`](OPEN_CORE.md).

## Core Capabilities

| Capability | Status | Description |
|---|---|---|
| Electronic Health Record Integration | Live | Pulls medical history, visit summaries, conditions, medications, labs, and immunizations from patient portals using SMART on FHIR. Implemented in [`skills/health-records`](skills/health-records/). |
| Medical PDF and Photo Capture | Live | Extracts structured data from PDFs, screenshots, lab reports, and image-only documents. Implemented in [`skills/med-pdf`](skills/med-pdf/). |
| Laboratory Result Parsing | Live via med-pdf | Extracts biomarker values, units, reference ranges, and out-of-range flags. |
| Patient Portal Message Drafting | Live | Drafts concise MyChart-style messages for medication questions, lab follow-ups, refill requests, and symptom reports. Implemented in [`skills/epic-note`](skills/epic-note/). |
| Personal Health Pulse | Live | Aggregates configured signal feeds into a daily digest. Implemented in [`skills/myhealth-pulse`](skills/myhealth-pulse/). |
| Longitudinal Change Detection | Live | Compares health information over time and produces tiered change summaries. Implemented in [`skills/memory-diff`](skills/memory-diff/). |
| Intelligent Model Routing | Partial | Tasks routed to the most capable, cost-effective, and privacy-appropriate model available. First-class support for Microsoft, OpenAI, and Anthropic. Healthcare-specific routing (MedGemma, MedASR, MedImageInsight) on the roadmap. See [`docs/model-routing.md`](docs/model-routing.md). |
| Intelligent Email Ingestion | In Progress | Classifies and routes forwarded health correspondence. Transport-layer sender allowlist; see [`docs/security-model.md`](docs/security-model.md). |
| Patient Health Dashboard | In Progress | Mobile-friendly dashboard for FHIR data, labs, imaging reports, medications, and activity feed. See [`docs/dashboard-build-plan.md`](docs/dashboard-build-plan.md). |
| Wearable Device Integration | Planned | Garmin, Oura, Whoop, Withings, Apple Health, and related device feeds. |
| Medical Image Interpretation | Planned | DICOM imaging workflows using purpose-built healthcare imaging models. |
| Genomic Health Reports | Planned | Consumer and clinical genomic report ingestion. |
| De-Identification | Planned | PHI removal for research and sharing workflows. |

## Why This Matters

Most people do not have a health data problem. They have a health coordination problem.

Their labs are in one place. Their imaging reports are somewhere else. Their medications change over time. Their wearable signals are disconnected. Their portal messages are buried. Their caregivers are overloaded. Their clinicians are busy.

Tula exists to give individuals and caregivers a private AI workspace for understanding and organizing their own health information.

The larger vision is patient agency: a world where every person can have an AI agent that helps them stay informed, prepared, and engaged in their care.

For healthcare organizations, this creates a second problem: if patient agents become common, hospitals will need governed infrastructure for safety, consent, identity, escalation, audit, and workflow integration. That is the role of Aria.

The people building this project are not doing so as a technical exercise. One of us is building Tula because he lost a parent to cancer and carries hereditary risk factors he is determined to monitor proactively. Another is building it because his wife is undergoing cancer treatment, and the demands of caregiving alongside daily life require better tools for tracking medications, understanding test results, and staying organized across multiple providers.

The architecture that supports a healthy individual in tracking wellness metrics is the same architecture that supports a patient in managing treatment adherence, or a caregiver in coordinating complex care. It is one platform that adapts to the user's needs.

## Enterprise Vision: Governed Patient Agents

Tula demonstrates what an individual patient agent can do.

Aria extends that idea to healthcare organizations: a governed patient-agent platform where each patient can have a dedicated AI agent operating within organizational policies, consent rules, identity boundaries, escalation paths, audit controls, and approved workflows.

The opportunity is not simply a better chatbot. The opportunity is governed patient-agent infrastructure.

Potential enterprise workflows include:

- Patient access and navigation
- Care journey support
- Medication and appointment coordination
- Patient satisfaction and experience monitoring
- Caregiver support
- Administrative follow-up
- Longitudinal patient engagement
- Patient-reported data capture
- Health literacy and education
- Safe escalation to human teams
- Governance and audit reporting for patient-facing AI

Aria is designed for organizations that need to manage patient agents safely, consistently, and at scale.

## Commercial Use, Pilots, and Strategic Partnerships

Tula is maintained by RealActivity as an open-source project.

For hospitals, health systems, employers, payers, research organizations, patient advocacy groups, and digital health companies evaluating governed patient-agent infrastructure, RealActivity is developing Aria, a commercial hospital-scale platform built on the same foundation.

Aria extends the Tula skill layer with enterprise capabilities for:

- Patient-agent orchestration at scale
- Identity, access, consent, and role-based governance
- EHR-connected workflows
- Audit trails and compliance reporting
- Patient engagement and access workflows
- Quality, safety, and evaluation controls
- Model routing and LLM gateway governance
- Administrative and operational healthcare workflows

RealActivity is selectively exploring commercial pilots, strategic partnerships, design-partner relationships, and aligned investment conversations with organizations focused on patient agency, health data sovereignty, caregiver support, healthcare operations, and safe AI adoption.

For commercial or strategic inquiries, contact:

Paul Swider
CEO, RealActivity
pswider@realactivity.com

## Example Flow

Tula's reference deployment supports this end-to-end personal-health flow today, using the five live skills:

1. Connect a patient portal through SMART on FHIR (`health-records`)
2. Upload a lab report PDF (`med-pdf`)
3. Ask Tula what changed since the last lab result (`memory-diff`)
4. Draft a patient portal message to the care team (`epic-note`)
5. Generate a daily health pulse (`myhealth-pulse`)
6. The same skill layer becomes part of Aria's governed patient-agent infrastructure at hospital scale

## Architecture

The diagram below distinguishes live components (deployed and ready on the reference VM) from planned components (on the roadmap). The Project Status section below is the canonical source of truth for individual component states.

```
User Interface
  |-- Telegram                                   (live)
  |-- Email outbound                             (live)
  |-- Email inbound auto-ingest                  (in progress)
  |-- Voice calls (Twilio + voice-call plugin)   (plan documented)
        |
Data Sources
  |-- Live
  |     |-- Patient portals via SMART on FHIR    -> health-records skill
  |     |-- Medical PDFs (lab, imaging, OCR)     -> med-pdf skill
  |     |-- X (Twitter) search                   -> @openclaw/xai-plugin
  |     |-- Brave web search                     -> @openclaw/brave-plugin
  |-- Planned
        |-- Email inbox auto-classify            (M365 / Graph API)
        |-- Wearables (Garmin, Oura, Whoop, Withings, Apple Health)
        |-- Home devices (BP, scale, pulse ox, glucose)
        |-- Genomic reports (23andMe, AncestryDNA)
        |-- Research feeds (PubMed, Google Scholar)
        |
OpenClaw Gateway  -- single self-hosted VM (Azure B2s, Ubuntu 24.04, ~$30/mo)
        |
Tula Skills  -- deployed under ~/.openclaw/workspace/skills/
  |-- Live (this repo, ready on reference VM)
  |     |-- health-records   -- SMART on FHIR records pull
  |     |-- med-pdf          -- PDF to structured labs, imaging JSON
  |     |-- epic-note        -- draft portal messages to clinicians
  |     |-- myhealth-pulse   -- signal aggregation orchestrator
  |     |-- memory-diff      -- longitudinal change detection
  |-- Planned
        |-- email-router     -- inbound classification and routing
        |-- lab-parser       -- structured biomarker tracker beyond med-pdf
        |-- patient-journal  -- Telegram daily check-ins
        |-- professional-journal
        |-- wearable-sync    -- one adapter per device family
        |-- home-device-sync -- BP, scale, pulse ox, glucose
        |-- genomic-analyzer
        |-- medical-image-interpreter -- DICOM (MedGemma / MedImageInsight)
        |-- de-identification-engine  -- HIPAA Safe Harbor
        |-- research-synthesis        -- PubMed / Google Scholar summarization
        |
Agent Workspace Memory  -- ~/.openclaw/workspace/
  |-- MEMORY.md            -- persistent state (conditions, meds, providers, trends)
  |-- memory/YYYY-MM-DD.md -- dated agent notes
  |-- memory/profile.yaml  -- personalization profile (read by myhealth-pulse, etc.)
  |-- .health-records-cache/<date>/<provider>.json   -- FHIR R4 pulls
  |-- .med-pdf-cache/<slug>/                         -- PDF extractions
  |-- .myhealth-pulse-cache/<date>.json              -- pulse digests
  |-- .memory-diff-cache/<date>.md                   -- diff renderings
        |
Continuous Evaluation and Compliance  -- Microsoft Waza, this repo
  |-- evals/<skill>/eval.yaml + tasks/ + fixtures/   (open eval suites)
  |-- waza check         -- static compliance gate on every PR via CI
  |-- docs/evals.md      -- continuous status, regenerated by CI on every push
  |-- waza run (local)   -- live LLM execution; results/ gitignored
        |
AI Model Routing  -- deployment-context-aware; see docs/model-routing.md
  |-- Reference deployment today
  |     |-- Clinical reasoning: Claude Sonnet 4.6 (Anthropic, via copilot-sdk)
  |     |-- General tasks: gpt-4o-mini (OpenAI, via copilot-sdk)
  |-- First-class supported providers
  |     |-- Microsoft: Azure AI Foundry, Azure OpenAI, Azure Speech, MedASR
  |     |-- OpenAI:    GPT family, o-series reasoning, Whisper
  |     |-- Anthropic: Claude family (direct API or via Azure AI Foundry)
  |-- Other SOTA providers OpenClaw can route to
  |     |-- Google (Gemini, Gemini Live for voice), xAI (Grok), Mistral,
  |     |   DeepSeek, Cohere, Cerebras, Together, Fireworks, open-weight
  |     |   models via vLLM, and many more through the OpenClaw plugin system
  |-- Planned healthcare-specific routing
        |-- Voice loop: Gemini Live (via @openclaw/voice-call plugin)
        |-- Medical text: MedGemma 27B / Claude in Azure AI Foundry
        |-- Medical imaging: MedGemma 4B / MedImageInsight / CXRReportGen
        |-- Medical speech: MedASR / Azure Speech Services
```

The five live skills produce structured outputs (FHIR R4 JSON, extracted lab and imaging JSON, rendered digests) that land in the workspace memory layer. Other skills consume what is already there rather than re-fetching. `memory-diff` reads from the cache directories `health-records` and `med-pdf` write to, and `myhealth-pulse` writes its own daily cache that `memory-diff` includes in its scan. This composition is intentional and is what makes the agent feel like it knows you over time rather than like a transactional chatbot.

## Project Status

Tula is in active development. The reference deployment currently includes five live skills that pass continuous Waza compliance checks.

### Live Skills

| Skill | Description | Status |
|---|---|---|
| [`health-records`](skills/health-records/) | SMART on FHIR record pull from MyChart and other patient portals | Complete |
| [`med-pdf`](skills/med-pdf/) | Medical PDF parsing for labs, imaging reports, and structured extraction | Complete |
| [`epic-note`](skills/epic-note/) | Patient portal message drafting | Complete |
| [`myhealth-pulse`](skills/myhealth-pulse/) | Signal aggregation and daily health digest | Complete |
| [`memory-diff`](skills/memory-diff/) | Longitudinal change detection over workspace memory | Complete |

### Infrastructure

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

### Request-Amendment Eval Snapshot

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
- Full suite guide: [`evals/request-amendment/README.md`](evals/request-amendment/README.md)

### In Progress

| Component | Description |
|---|---|
| Intelligent Email Ingestion | Secure inbound routing and classification |
| Patient Health Dashboard | Mobile-friendly private dashboard |
| Patient Health Journal | Structured check-ins through Telegram |
| Professional Journal | Daily and weekly synthesis for work notes |
| Laboratory Parser | Structured biomarker tracker beyond med-pdf |

### Planned

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

### Strategy Artifacts

| Artifact | Status |
|---|---|
| [Patient agent evaluation standard article](articles/how-will-you-know-if-your-patient-ai-is-working.md) | Draft |
| [Two-score framework article (governance and health portfolio)](articles/every-patient-ai-needs-two-scores.md) | Draft |
| [Voice integration architecture (OpenClaw and Twilio)](docs/voice-integration.md) | Plan documented |
| [Open-core scope split](OPEN_CORE.md) | Complete |

### Community Ideas

| Component | Description |
|---|---|
| Medication Adherence (IoT) | Community proposal |
| Caregiver Dashboard | Community proposal |

## Where to Start

### For Developers

Start with the deployment guide and the skills development guide.

- Deploy OpenClaw using [`docs/deployment-guide.md`](docs/deployment-guide.md)
- Install the Tula skills with [`scripts/deploy-skills.sh`](scripts/deploy-skills.sh)
- Run the reference VM
- Review the Waza evaluation patterns in [`evals/`](evals/) and [`docs/evals.md`](docs/evals.md)
- Build or improve a health skill following [`docs/skills-development.md`](docs/skills-development.md) and [`skills/AGENTS.md`](skills/AGENTS.md)

### For Patients and Caregivers

Start with the personal health use cases and the self-hosted deployment guide.

Tula is designed for people who want to organize their own records, understand their health information, and coordinate care without handing data to another closed platform. See [`docs/use-cases.md`](docs/use-cases.md).

### For Healthcare Organizations

Start with the Tula and Aria open-core model and the patient-agent evaluation articles.

Tula shows the skill layer. Aria provides the governed infrastructure for hospital-scale use. See [`OPEN_CORE.md`](OPEN_CORE.md), the [evaluation standard draft](articles/how-will-you-know-if-your-patient-ai-is-working.md), and the [two-score framework draft](articles/every-patient-ai-needs-two-scores.md).

## Evaluation: Open and Closed Boundaries

The open and closed split applies to the evaluation infrastructure as well:

- Open in this repo: the eval suites under [`evals/`](evals/), the skill authoring conventions in [`skills/AGENTS.md`](skills/AGENTS.md), the Waza spec gates wired into [CI](.github/workflows/eval-status.yml), and the continuous compliance status at [`docs/evals.md`](docs/evals.md). These are intended as a vendor-neutral starting point for evaluating any patient-facing AI agent. See the draft article [`how-will-you-know-if-your-patient-ai-is-working.md`](articles/how-will-you-know-if-your-patient-ai-is-working.md) for the public framing.
- Closed in Aria: the continuous-execution layer that runs these evaluations per patient agent at hospital scale, the EHR-fidelity comparison engine that grounds the agent's view against the chart of record, the audit aggregation, and the governance score that composes those signals into a single number a quality officer can act on. See the draft article [`every-patient-ai-needs-two-scores.md`](articles/every-patient-ai-needs-two-scores.md) for the public framing of why the split lands where it does.

## Contributing

Contributions are welcome. Tula is built as a set of standard OpenClaw skills. Contributors familiar with OpenClaw can begin contributing immediately.

Ways to contribute:

- Report issues. If something does not work as expected, open an issue. Detailed bug reports are among the most valuable contributions at this stage.
- Propose a health skill. We track community ideas in [Discussions](../../discussions).
- Build a skill. Read the [skills development guide](docs/skills-development.md) and use the [`med-pdf`](skills/med-pdf/) skill as the reference template. The [skills authoring conventions](skills/AGENTS.md) explain the OpenClaw-first, Waza-second priority rule. Submit a pull request.
- Improve documentation. The deployment guide was written during a real setup session. If any section is unclear or outdated, improvements are appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines including the Developer Certificate of Origin (DCO) sign-off requirement. See the [community skill ideas](docs/community-skills.md) for a full list of skills we would like to build.

## Principles

- Patient empowerment through health literacy. Tula translates clinical information into language that supports informed decision-making.
- Data sovereignty. All data is stored locally on the user's own server. No cloud health platforms. No third-party data sharing.
- Intelligent model routing. Each task is directed to the most capable model for that specific job. Purpose-built healthcare models for medical imaging and text. General-purpose reasoning models for clinical synthesis. The right model for the right task in the right deployment context.
- Caregiver recognition. Caregiver support is a core use case, not a secondary consideration.
- Global health equity. Open source, self-hosted, model-agnostic, and accessible on low-bandwidth networks. Designed so that a clinic in a low-resource setting has access to the same tools as a patient in a high-income country.
- Defense in depth. Email ingestion is locked to authorized senders at the Exchange transport layer. Outbound email is restricted to authorized recipients. Prompt injection risks are analyzed honestly and mitigated at multiple layers. See the [security model](docs/security-model.md).

See the [full principles](docs/principles.md) for the complete set of values and commitments.

## Cost

Running Tula costs approximately $35 to $115 per month depending on usage, from text-based journaling and laboratory parsing at the low end to medical image interpretation and genomic analysis at the high end. No subscription fees. No platform lock-in. Users provide their own API keys. See the [cost guide](docs/cost-guide.md) for a detailed breakdown.

Optional voice calling adds Twilio carrier fees (around $1 per month for a US local number plus per-minute usage) and voice-model usage on top. A heavy personal user lands in the $30 to $60 per month range above the base figure; light users stay under $10. See [`docs/voice-integration.md`](docs/voice-integration.md) for the full cost and latency breakdown.

## Background

This project originated as a personal build by a Windows Server administrator of 25 years deploying his first native Linux server to run an AI health agent. The [deployment guide](docs/deployment-guide.md) was written in real time as issues were encountered and resolved. It documents the actual experience, including common errors and their solutions.

Tula is a [RealActivity](https://realactivity.ai) initiative.

## Founding Contributors

- Paul Swider. Creator. Health data integration, laboratory parsing, wearable integration, infrastructure.
- Sal Rosales. Medical adherence, caregiver tools, IoT integration.

## Intellectual Property

Tula is open source under the Apache License 2.0. RealActivity retains ownership of its trademarks, commercial platform architecture, proprietary Aria components, and non-public implementation details.

RealActivity may pursue intellectual property protection around commercial patient-agent orchestration, governance, evaluation, and enterprise deployment patterns.

## License

Tula is licensed under the Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details. The Apache 2.0 license applies to the open-source Tula codebase. It does not grant rights to RealActivity trademarks, the Aria commercial platform, proprietary deployment architecture, or non-public commercial implementation details.

The `skills/health-records/` subdirectory retains its upstream MIT terms. See [NOTICE](NOTICE) for attribution and license details.

"Tula", "Aria", and "RealActivity" are trademarks of RealActivity. The Apache 2.0 license covers the code, not the names. See [TRADEMARK.md](TRADEMARK.md) for details.

## Disclaimer

Tula is an open-source software tool intended to support personal health data organization and health literacy. It is not a medical device, not FDA-cleared or approved, and not intended to diagnose, treat, cure, or prevent any disease or medical condition. Tula does not provide clinical decision support and should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always seek the guidance of qualified healthcare providers with any questions regarding a medical condition. If you are experiencing a medical emergency, contact your local emergency services immediately.
