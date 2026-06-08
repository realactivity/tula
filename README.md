# Tula: Open-Source Personal Health AI Agent

**Your health. Your data. Your AI.**

Built and maintained by [RealActivity](https://realactivity.ai).

> **Watch the live demo (~16 min).** [YouTube](https://youtu.be/FcLl6fASpgw) (Epic MyChart at **[10:00](https://youtu.be/FcLl6fASpgw?t=600)**) | [Video guide](docs/demo.md) | [Podcast interview](https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/) (~17 min, May 2026)

Tula is an open-source personal health agent skill layer built on [OpenClaw](https://github.com/openclaw/openclaw). It helps individuals, caregivers, and health-focused communities organize health records, medical PDFs, lab results, portal messages, personal notes, and longitudinal health signals in a private, self-hosted AI workspace.

Tula is designed for patient agency: helping people better understand, organize, and act on their own health information without handing that data to another closed platform.

> **Microsoft validated this architecture.** At Build 2026, Microsoft shipped Scout on the same OpenClaw runtime that powers Tula. Think of Tula as your patients' Scout, governed. See [Microsoft Just Validated Our Architecture](https://www.realactivity.ai/frontier/build26/tula-scout-post.html).
>
> **Frontier agent posture.** Tula is designed around enterprise-grade evaluation, observability, auditability, least-permission skills, human-in-the-loop safety, and healthcare-specific guardrails. See [`docs/frontier-agent.md`](docs/frontier-agent.md).
>
> **Open-core path.** Tula is the open-source foundation. Aria is RealActivity's commercial hospital-scale platform for governed patient-agent infrastructure. See [`OPEN_CORE.md`](OPEN_CORE.md) and [`docs/aria-commercial-platform.md`](docs/aria-commercial-platform.md).
>
> **Pilots and partnerships.** RealActivity is selectively exploring commercial pilots, design partnerships, strategic collaborations, and aligned investment conversations with healthcare organizations and mission-aligned partners. See [`docs/enterprise-pilots.md`](docs/enterprise-pilots.md).

## 30-Second Summary

Tula turns a general-purpose AI agent into a personal health intelligence assistant.

It currently supports:

- Pulling patient records from portals using SMART on FHIR
- Self-hosting the records-pull relay (Wren) with no third-party dependency
- Parsing medical PDFs, lab reports, screenshots, and image-only documents
- Drafting patient portal messages for medication questions, lab follow-ups, refill requests, and symptom summaries
- Daily health-signal digests
- Comparing health information over time through longitudinal memory diffing
- Preparing visit-prep packages and HIPAA-aligned record amendment requests
- Running skills inside a self-hosted OpenClaw workspace
- Continuous evaluation and compliance checks through Microsoft Waza ([Patient Agent Eval Standard v0.1](evals/README.md): 78 tasks across 8 skills + composition bundle)

Tula is not a medical device, not a clinical decision support system, and not a replacement for professional medical advice. See [`docs/safety-and-disclaimer.md`](docs/safety-and-disclaimer.md).

## Why Tula Is a Frontier AI Agent

Tula adopts the agent patterns the leading frontier-model vendors publish for their own enterprise stacks. It is designed from day one to drop into a governed AI foundry (Microsoft / Azure AI Foundry, NVIDIA AI Foundry, or Palantir Foundry) alongside identity, audit, and compliance plumbing without re-architecture.

What that means in practice:

- **Continuous evaluations.** Every skill ships an open evaluation suite with a Waza spec gate enforced in CI.
- **Observability and tracing.** OpenTelemetry-shaped traces ready for Azure Monitor, Application Insights, or any OTel collector.
- **Audit-ready governance.** Append-only logs, reproducible workspace snapshots, regex secret-scan gates.
- **Defense in depth.** Scope-contained skills, least permissions, human-in-the-loop on consequential actions, identity-bound auditability.
- **Healthcare-specific guardrails.** Portal messages drafted, never auto-sent. PHI bounded to the agent's workspace. Email locked to an Exchange sender allowlist before any model sees it.

Full technical positioning, the Microsoft Frontier capability table, foundry-agnostic routing, and the enterprise-readiness argument live in [`docs/frontier-agent.md`](docs/frontier-agent.md).

## Tula Is Your Patients' Scout

At Build 2026, Microsoft shipped Scout: an always-on personal agent for the workforce that knows your calendar, inbox, and files, built on the OpenClaw runtime. Tula is the patient-side equivalent, built on that same open foundation: an always-on personal agent that knows your labs, medications, and conditions, and works for the patient.

Microsoft's insight with Scout was that open-source agent capability is only half the equation. The other half is governance: identity, audit, policy enforcement, and controls a compliance team can verify. That is the same split Tula is built around:

- **Microsoft governs the workforce agent.** Scope-bound identity, audit, and policy conformance for the employee.
- **RealActivity governs the patient agent.** Tula is the open-source patient agent runtime (Apache 2.0, on OpenClaw). Aria is the governance plane: HIPAA-aligned identity, full audit trail, escalation policy, and hospital-controlled model routing.

Patients are already using general-purpose chatbots to interpret labs, manage medications, and understand diagnoses, with no grounding in their real record and no connection to their care team. Tula connects to the patient's clinical record via SMART on FHIR so that conversation can finally be grounded and governed.

Full write-up: [Microsoft Just Validated Our Architecture](https://www.realactivity.ai/frontier/build26/tula-scout-post.html).

## What Tula Is

Tula is a health-focused skill layer for OpenClaw. It provides reusable agent skills, configuration patterns, evaluation suites, and deployment guidance for building a self-hosted personal health AI assistant. The reference deployment runs on a single self-hosted VM and uses a private workspace memory model. Health data stays under the user's control.

## What Tula Is Not

Tula is not a medical device, not a diagnostic system, not a treatment recommendation engine, not a substitute for clinical professionals, not an emergency response system, and not a replacement for an EHR or patient portal.

Full safety positioning in [`docs/safety-and-disclaimer.md`](docs/safety-and-disclaimer.md).

## Current Capabilities

| Capability | Status |
|---|---|
| EHR integration via SMART on FHIR ([`skills/health-records`](skills/health-records/)) | Live |
| Self-hostable records relay ([`services/wren`](services/wren/)) | Live |
| Medical PDF and photo capture ([`skills/med-pdf`](skills/med-pdf/)) | Live |
| Patient portal message drafting ([`skills/epic-note`](skills/epic-note/)) | Live |
| Daily health signal digest ([`skills/myhealth-pulse`](skills/myhealth-pulse/)) | Live |
| Longitudinal change detection ([`skills/memory-diff`](skills/memory-diff/)) | Live |
| Visit preparation packages ([`skills/prep-my-visit`](skills/prep-my-visit/)) | Live |
| Health-record amendment requests ([`skills/request-amendment`](skills/request-amendment/)) | Live |
| Ambient environmental and public-health awareness ([`skills/lookout`](skills/lookout/)) | Live |
| Intelligent email ingestion | In Progress |
| Patient health dashboard | In Progress |
| Wearables, medical imaging, genomics, de-identification | Planned |

Full roadmap, eval snapshots, and component status in [`docs/roadmap.md`](docs/roadmap.md).

## Coverage

See [`docs/demo.md`](docs/demo.md) for both videos: [YouTube live demo](https://youtu.be/FcLl6fASpgw) and [podcast interview](https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/).

## Commercial Pilots and Strategic Partnerships

Tula is the open-source foundation for patient-owned personal health agents.

RealActivity is also developing Aria, a commercial hospital-scale platform for governed patient-agent infrastructure. We are selectively exploring pilots, design-partner relationships, strategic partnerships, and aligned investment conversations with hospitals, health systems, payers, employers, research organizations, advocacy groups, digital health companies, and mission-aligned investors.

For commercial or strategic inquiries: **Paul Swider, CEO, RealActivity, pswider@realactivity.com**.

Read more: [`docs/enterprise-pilots.md`](docs/enterprise-pilots.md), [`docs/aria-commercial-platform.md`](docs/aria-commercial-platform.md).

## Stewardship

RealActivity funds and maintains Tula and contributes it to the community under the Apache License 2.0. What is given openly: eight Apache-2.0 health skills, the self-hostable Wren records relay, and the forkable [Patient Agent Eval Standard v0.1](evals/README.md) (78 tasks, adopt or fork for any patient-facing agent).

We are committed to keeping the open core open. Tula is complete and useful on its own; the commercial Aria platform consumes Tula skills as a versioned dependency rather than replacing them. See [`OPEN_CORE.md`](OPEN_CORE.md) for the full scope split.

## Why This Matters

Most people do not have a health data problem. They have a health coordination problem. Their labs are in one place, their imaging is in another, their medications change over time, their wearable signals are disconnected, their portal messages are buried, their caregivers are overloaded, and their clinicians are busy.

Tula exists to give individuals and caregivers a private AI workspace for understanding and organizing their own health information. The larger vision is patient agency: a world where every person can have an AI agent that helps them stay informed, prepared, and engaged in their care.

This project is shaped by lived experience with serious illness in the family. The full story is in [`docs/patient-agency.md`](docs/patient-agency.md).

## Example Flow

1. Connect a patient portal through SMART on FHIR (`health-records`)
2. Upload a lab report PDF (`med-pdf`)
3. Ask Tula what changed since the last lab result (`memory-diff`)
4. Draft a patient portal message to the care team (`epic-note`)
5. Generate a daily health pulse (`myhealth-pulse`)

More flows in [`docs/example-flows.md`](docs/example-flows.md).

## Architecture

Tula runs on a single self-hosted VM. The OpenClaw gateway routes user input (Telegram, email, future voice) into Tula skills that read and write a private workspace memory layer. Continuous evaluation runs via Microsoft Waza in CI. Model routing is deployment-context-aware across Microsoft, OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek, Cohere, and open-weight backends.

Full diagram, data flow, and skill composition in [`docs/architecture.md`](docs/architecture.md).

## Project Status

Tula is in active development. The reference deployment includes eight published skills (all with Waza eval suites under [Patient Agent Eval Standard v0.1](evals/README.md)) plus the self-hostable Wren records relay. Latest local snapshot from `evals/request-amendment`: 8 of 10 tasks passed, aggregate score 0.97.

Full status (live skills, infrastructure, in progress, planned, community ideas, strategy artifacts, eval snapshots) in [`docs/roadmap.md`](docs/roadmap.md).

## Where to Start

- **Coding agents.** [`AGENTS.md`](AGENTS.md) - canonical repo guide (read first).
- **New here.** [`docs/demo.md`](docs/demo.md) - [YouTube live demo](https://youtu.be/FcLl6fASpgw) (Epic MyChart at **10:00**) or [podcast interview](https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/), then pick a path below.
- **Developers.** [`docs/deployment-guide.md`](docs/deployment-guide.md), then [`docs/skills-development.md`](docs/skills-development.md) and [`skills/AGENTS.md`](skills/AGENTS.md).
- **Healthcare organizations.** [`docs/enterprise-pilots.md`](docs/enterprise-pilots.md), [`docs/aria-commercial-platform.md`](docs/aria-commercial-platform.md), and the [patient-AI evaluation standard draft](articles/how-will-you-know-if-your-patient-ai-is-working.md).
- **Patients and caregivers.** [`docs/safety-and-disclaimer.md`](docs/safety-and-disclaimer.md), then [`docs/use-cases.md`](docs/use-cases.md) and [`docs/patient-agency.md`](docs/patient-agency.md).
- **Contributors.** [`CONTRIBUTING.md`](CONTRIBUTING.md), then [`docs/skills-development.md`](docs/skills-development.md) and [`docs/community-skills.md`](docs/community-skills.md).

## Open-Core Model

| Project | Scope | License |
|---|---|---|
| Tula | Open-source health agent skill layer and single-user reference deployment | Apache 2.0 |
| Aria | Commercial hospital-scale patient-agent platform for governed, multi-tenant deployment | Proprietary RealActivity platform |

Tula is complete and useful on its own. Aria consumes Tula skills as a versioned dependency and adds the enterprise infrastructure required for healthcare organizations: patient identity, ingest routing, dashboards, LLM gateway governance, audit, compliance, and operational controls.

Full scope split in [`OPEN_CORE.md`](OPEN_CORE.md). Aria platform detail in [`docs/aria-commercial-platform.md`](docs/aria-commercial-platform.md).

## Name

Tula was my mother. She was a Mensa member, a mother of five, and one of the sharpest and most direct people I have ever known. She passed from brain cancer. This project is named in her memory and built in her spirit: warm, sharp, and unwavering in service of the people she loved.

The name is personal and memorial in origin. It is not affiliated with, derived from, or intended to reference any similarly named product or company.

## Contributing

Contributions are welcome. Tula is built as a set of standard OpenClaw skills, so contributors familiar with OpenClaw can begin immediately.

- Report issues. Detailed bug reports are among the most valuable contributions at this stage.
- Propose a health skill. Community ideas are tracked in [Discussions](../../discussions) and [`docs/community-skills.md`](docs/community-skills.md).
- Build a skill. See [`docs/skills-development.md`](docs/skills-development.md). The [`med-pdf`](skills/med-pdf/) skill is the reference template. The [`skills/AGENTS.md`](skills/AGENTS.md) authoring conventions explain the OpenClaw-first, Waza-second priority rule.
- Improve documentation. The [deployment guide](docs/deployment-guide.md) was written during a real setup session; corrections and clarifications are welcome.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for detailed guidelines and the Developer Certificate of Origin (DCO) sign-off requirement.

## Founding Contributors

- **Paul Swider.** Creator. Health data integration, laboratory parsing, wearable integration, infrastructure.
- **Sal Rosales.** Medical adherence, caregiver tools, IoT integration.

## License, Trademark, and Disclaimer

Tula is licensed under the Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). The Apache 2.0 license applies to the open-source Tula codebase. It does not grant rights to RealActivity trademarks, the Aria commercial platform, proprietary deployment architecture, or non-public commercial implementation details. The `skills/health-records/` subdirectory retains its upstream MIT terms (see [NOTICE](NOTICE)).

RealActivity retains ownership of its trademarks, commercial platform architecture, proprietary Aria components, and non-public implementation details. RealActivity may pursue intellectual property protection around commercial patient-agent orchestration, governance, evaluation, and enterprise deployment patterns.

"Tula", "Aria", and "RealActivity" are trademarks of RealActivity. The Apache 2.0 license covers the code, not the names. See [`TRADEMARK.md`](TRADEMARK.md).

**Disclaimer.** Tula is an open-source software tool intended to support personal health data organization and health literacy. It is not a medical device, not FDA-cleared or approved, and not intended to diagnose, treat, cure, or prevent any disease or medical condition. Tula does not provide clinical decision support and should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always seek the guidance of qualified healthcare providers with any questions regarding a medical condition. If you are experiencing a medical emergency, contact your local emergency services immediately. Full safety positioning in [`docs/safety-and-disclaimer.md`](docs/safety-and-disclaimer.md).

Tula is a [RealActivity](https://realactivity.ai) initiative.
