# Aria: Commercial Hospital-Scale Patient-Agent Platform

Aria is RealActivity's commercial hospital-scale platform for governed patient-agent infrastructure. It is the commercial extension of the open-source Tula skill layer.

## Tula and Aria, in one paragraph

Tula is the open-source foundation: a personal health agent skill layer designed for individuals, caregivers, and self-hosted single-user deployments. Aria is the commercial platform that consumes Tula skills as a versioned dependency and adds the multi-tenant, hospital-scale infrastructure required to run governed patient agents at organizational scale.

The detailed scope split is documented in [`OPEN_CORE.md`](../OPEN_CORE.md).

## What Aria does

Aria demonstrates what an individual patient agent can do at the scale and governance of a healthcare organization. Where Tula gives a single person a private AI workspace for their own health, Aria extends that idea to organizations: a governed patient-agent platform where each patient can have a dedicated AI agent operating within organizational policies, consent rules, identity boundaries, escalation paths, audit controls, and approved workflows.

The opportunity is not simply a better chatbot. The opportunity is governed patient-agent infrastructure.

## Workflows Aria targets

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

## Enterprise capabilities Aria adds on top of Tula skills

Aria extends the open Tula skill layer with:

- **Patient-agent orchestration at scale.** Per-patient agent identities, per-tenant runtime isolation, and lifecycle management for thousands of concurrent patient agents.
- **Identity, access, consent, and role-based governance.** Integration with enterprise identity providers, consent capture and revocation, role-aware operator controls, and break-glass procedures.
- **EHR-connected workflows.** Bidirectional integration with the EHR for chart-of-record fidelity, draft-to-portal handoff, and clinician-facing summaries.
- **Audit trails and compliance reporting.** Per-tenant append-only audit, audit aggregation, and compliance-officer-facing reporting surfaces.
- **Patient engagement and access workflows.** Service-line-specific patient-access, navigation, education, and follow-up flows.
- **Quality, safety, and evaluation controls.** Continuous-execution evaluation per patient agent, drift monitoring, content filtering, red-team scanning, and human-in-the-loop escalation paths.
- **Model routing and LLM gateway governance.** Multi-tenant LLM gateway with BAA-aligned routing, deployment-context-aware model selection, and tenant-level cost and quota controls.
- **Administrative and operational healthcare workflows.** Operational dashboards, workforce surfaces, and integration with existing care-management and patient-experience platforms.

The same skill layer that runs on a single self-hosted VM for an individual patient is the skill layer that runs inside Aria's hospital-scale governed runtime. See [`docs/frontier-agent.md`](frontier-agent.md) for the technical positioning.

## Open / closed evaluation boundary

The open and closed split applies to the evaluation infrastructure as well as to the skill layer.

- **Open in this repo.** The eval suites under [`evals/`](../evals/), the skill authoring conventions in [`skills/AGENTS.md`](../skills/AGENTS.md), the Waza spec gates wired into [CI](../.github/workflows/eval-status.yml), and the continuous compliance status at [`docs/evals.md`](evals.md). These are intended as a vendor-neutral starting point for evaluating any patient-facing AI agent. See the draft article [`articles/how-will-you-know-if-your-patient-ai-is-working.md`](../articles/how-will-you-know-if-your-patient-ai-is-working.md) for the public framing.
- **Closed in Aria.** The continuous-execution layer that runs these evaluations per patient agent at hospital scale, the EHR-fidelity comparison engine that grounds the agent's view against the chart of record, the audit aggregation, and the governance score that composes those signals into a single number a quality officer can act on. See the draft article [`articles/every-patient-ai-needs-two-scores.md`](../articles/every-patient-ai-needs-two-scores.md) for the public framing of why the split lands where it does.

This boundary is intentional. The static spec gate is open because the science of evaluating patient-facing AI should be open. The continuous governance and EHR-fidelity engine is closed because it requires per-tenant identity, audit, and operational controls that only make sense inside a multi-tenant commercial platform.

## Pilots and partnerships

RealActivity is selectively exploring commercial pilots, design-partner relationships, strategic partnerships, and aligned investment conversations with hospitals, health systems, payers, employers, research organizations, advocacy groups, digital health companies, and mission-aligned investors. See [`docs/enterprise-pilots.md`](enterprise-pilots.md) for the partnership posture and contact information.

## See also

- [`README.md`](../README.md), the front-door summary
- [`OPEN_CORE.md`](../OPEN_CORE.md), the open / closed scope split
- [`docs/enterprise-pilots.md`](enterprise-pilots.md), pilots and partnership posture
- [`docs/frontier-agent.md`](frontier-agent.md), the technical positioning
- [`docs/security-model.md`](security-model.md), defense-in-depth design
- [`docs/evals.md`](evals.md), continuous evaluation status
