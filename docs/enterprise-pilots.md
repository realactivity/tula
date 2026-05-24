# Commercial Pilots and Strategic Partnerships

Tula is the open-source foundation for patient-owned personal health agents. RealActivity is also developing Aria, a commercial hospital-scale platform built on the same foundation, for governed patient-agent infrastructure.

This page is for organizations evaluating Tula and Aria seriously enough to consider a pilot, a design-partner relationship, a strategic collaboration, or an aligned investment conversation.

## What we are exploring

RealActivity is selectively exploring:

- **Commercial pilots.** Bounded, time-limited engagements where Tula and Aria are deployed against a real patient-agent workflow with measurable outcomes.
- **Design-partner relationships.** Multi-quarter partnerships where an organization helps shape Aria's governance, evaluation, and workflow surface in exchange for early access, co-developed features, and preferential commercial terms.
- **Strategic partnerships.** Longer-term alignment across product, distribution, or platform integration (for example, EHR vendors, LLM gateway providers, voice-stack operators, or AI foundry partners).
- **Aligned investment conversations.** Conversations with mission-aligned investors and strategic partners focused on patient agency, health data sovereignty, caregiver support, healthcare operations, and safe AI adoption.

We are intentionally selective. Tula and Aria are aimed at organizations that share a commitment to patient agency, governed safety, evaluation-first AI engineering, and open standards where the science is open.

## Who we are talking to

Tula and Aria are designed to be useful across the patient-experience continuum. We are open to conversations with:

- **Hospitals and health systems** evaluating patient-facing AI under HIPAA-aligned governance, including academic medical centers, community health systems, and integrated delivery networks
- **Payers** building member engagement, care management, and prior-authorization-adjacent workflows on a governed agent foundation
- **Employers and benefits organizations** offering patient-navigation and benefits-coordination AI to their members
- **Research organizations** running cohort engagement, longitudinal data capture, and consent-aware patient communication at scale
- **Patient advocacy groups** building member-facing health-literacy and care-coordination tooling
- **Digital health companies** integrating governed patient agents into their clinical, administrative, or member-experience workflows
- **Mission-aligned investors** focused on patient agency, health data sovereignty, caregiver support, and responsible AI adoption in healthcare

## What Aria adds on top of Tula

Aria is the commercial extension of the Tula skill layer. Where Tula is a single-user, self-hosted personal health agent, Aria provides the multi-tenant, hospital-scale infrastructure required to run governed patient agents at organizational scale.

Aria extends the Tula skill layer with enterprise capabilities for:

- Patient-agent orchestration at scale
- Identity, access, consent, and role-based governance
- EHR-connected workflows
- Audit trails and compliance reporting
- Patient engagement and access workflows
- Quality, safety, and evaluation controls
- Model routing and LLM gateway governance
- Administrative and operational healthcare workflows

The platform-level vision is detailed in [`docs/aria-commercial-platform.md`](aria-commercial-platform.md). The open / closed scope split is documented in [`OPEN_CORE.md`](../OPEN_CORE.md).

## How a pilot typically looks

Pilots are typically scoped against a single bounded workflow with clear success criteria. Representative shapes include:

- A patient-access or navigation flow for a service line, with measurable engagement, satisfaction, and escalation-quality outcomes
- A medication-adherence or appointment-coordination workflow tied to a specific patient cohort
- A caregiver-support workflow paired with a clinical service line
- A patient-reported-outcome capture flow tied to a research protocol or quality program
- A health-literacy and education flow for a defined population (chronic disease, post-discharge, oncology, maternal health, etc.)

We co-define the success criteria with you up front. Evaluation suites are written in the open and committed to the repository (or to your private fork) so that pilot results are reproducible against a stable model snapshot.

## Why this is different

Most patient-facing AI projects start as a chatbot demo and then spend nine to eighteen months retrofitting evaluations, audit logging, identity, model governance, and HIPAA controls before a hospital will let them anywhere near a real patient. The evaluation harness, the audit-friendly trace shape, the scope-contained skill model, the sender-allowlist transport gate, and the provider-agnostic routing layer in Tula are built in from skill #1. The same code that survives a [Microsoft Waza](https://github.com/microsoft/waza) spec gate in this open repo is what Aria runs under multi-tenant identity, RBAC, BAA-tier LLM gateways, and per-tenant audit aggregation at hospital scale. See [`docs/frontier-agent.md`](frontier-agent.md) for the full positioning.

## Contact

For commercial or strategic inquiries:

**Paul Swider**
CEO, RealActivity
pswider@realactivity.com

## See also

- [`README.md`](../README.md), the front-door summary
- [`docs/aria-commercial-platform.md`](aria-commercial-platform.md), the Aria platform vision
- [`docs/frontier-agent.md`](frontier-agent.md), the technical positioning
- [`OPEN_CORE.md`](../OPEN_CORE.md), the open / closed scope split
- [`articles/how-will-you-know-if-your-patient-ai-is-working.md`](../articles/how-will-you-know-if-your-patient-ai-is-working.md), the patient-AI evaluation standard draft
- [`articles/every-patient-ai-needs-two-scores.md`](../articles/every-patient-ai-needs-two-scores.md), the two-score framework draft
