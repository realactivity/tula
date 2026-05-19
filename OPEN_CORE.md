# Open Core Scope

Tula is maintained by RealActivity as an Apache-2.0-licensed open-source health agent
skill collection. RealActivity also develops **Aria**, a commercial
hospital-scale platform built on the same Tula skills. Aria's runtime gives
every patient their own AI agent and coordinates thousands of these agents
under a shared multi-tenant control plane, an architecture RealActivity
calls a **Patient Swarm**. The two are distinct products with distinct
licenses and distinct repositories.

This document scopes what the public Tula repo is for, what it accepts
contributions for, and what's out of scope.

## What's in scope for this repo

The public Tula repo is the home of:

- **Core health skills** for the [OpenClaw](https://github.com/openclaw/openclaw)
  runtime, authored under the conventions in [`skills/AGENTS.md`](skills/AGENTS.md).
  The reference template is [`skills/med-pdf/`](skills/med-pdf/).
- **The evaluation harness**: [`evals/`](evals/) and `.waza.yaml`, with
  [Microsoft Waza](https://github.com/microsoft/waza) running in CI for every
  PR that touches skills or evals.
- **Authoring conventions and tooling**: `skills/AGENTS.md`,
  [`docs/skills-development.md`](docs/skills-development.md), and the deploy
  script in [`scripts/`](scripts/).
- **Single-user, self-hosted deployment**: the
  [deployment guide](docs/deployment-guide.md), the
  [cost guide](docs/cost-guide.md), the personal
  [security model](docs/security-model.md), and the
  [email router design](docs/email-router-design.md) at personal scale.
- **The TripIt-style email ingestion pattern** at single-user scale: one
  mailbox, sender allowlist, Telegram or web for notifications.
- **Voice integration at single-user scale**: the
  [voice integration architecture](docs/voice-integration.md) for
  giving your personal Tula agent a phone number via the open
  `@openclaw/voice-call` plugin, including setup, costs, and known
  limitations. The hospital-scale multi-tenant voice channel (with
  HIPAA-eligible ConversationRelay transport, voice-specific
  governance signals, and EHR-divergence detection on
  voice-asserted facts) is part of Aria.

Contributions that improve any of the above are welcome. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for how to submit them.

## What's out of scope (lives in Aria)

The following Patient Swarm capabilities are part of Aria, the commercial
hospital-scale platform, and live in a separate private repository:

- **Patient Swarm runtime**: the multi-tenant control plane that schedules
  one isolated agent per patient on top of OpenClaw, with tenant-scoped
  workspaces and fleet skill deployment.
- **Patient identity and SSO**: Entra ID / OIDC integration, RBAC,
  caregiver proxy access, consent flows.
- **Multi-tenant ingest router**: shared mailbox with patient-token
  recipient addresses, per-patient sender allowlists, tenant routing.
- **Patient-facing dashboard at scale**: multi-tenant web app,
  authenticated chat with the agent, in-app document capture, Web Push
  notifications, caregiver portal.
- **LLM gateway**: BAA-tier endpoints, per-tenant rate limits, per-tenant
  cost attribution, audit-logged model calls.
- **Audit logging**: append-only, per-tenant, with break-glass procedures.
- **EHR / patient-portal integrations at hospital scale**: Epic, Oracle
  Health, FHIR API connectors.
- **Compliance plumbing**: BAA chain management, SOC 2 evidence
  collection, HIPAA controls, FDA SaMD posture.

These areas are not accepting community pull requests in this repo. If you
have ideas for hospital-scale deployment patterns, please open a Discussion
or reach out directly.

## How the two relate

Aria consumes Tula skills as a versioned dependency. Improvements to public
Tula skills flow into Aria when Aria bumps its pinned version; nothing
proprietary flows back. The same skill code that runs in a single-user
personal deployment runs in Aria, just under a multi-tenant runtime with
tenant-scoped workspace and identity.

This means:

- **Your contributions to Tula skills benefit both projects.** If you
  improve `med-pdf` here, hospitals using Aria get the improvement when
  Aria's next release bumps the dependency.
- **Tula stays useful as a standalone project.** It's not a teaser for
  Aria; it's a complete personal health agent that runs end-to-end on a
  single VM.
- **Aria is not required.** Nothing in Tula depends on Aria or assumes
  Aria's runtime.

## Patient-agent evaluation conventions live here

Tula is also the home of the patient-agent evaluation conventions that
Aria (and any other operator) builds on top of. The eval suites under
[`evals/`](evals/), the authoring conventions in
[`skills/AGENTS.md`](skills/AGENTS.md), the [`waza check`](https://github.com/microsoft/waza)
spec gates wired into CI, and the continuous status doc at
[`docs/evals.md`](docs/evals.md) are deliberately open so the format
can be referenced as a vendor-neutral starting point. See
[`articles/how-will-you-know-if-your-patient-ai-is-working.md`](articles/how-will-you-know-if-your-patient-ai-is-working.md)
for the public framing of this work.

Aria runs these same evaluations continuously, at hospital scale, per
patient agent, and composes their outputs (along with EHR-fidelity
measurements and audit-completeness signals) into a governance score
that surfaces in the operator dashboard. The continuous-execution
layer, the EHR comparison engine, the audit aggregation, and the
score composition method are part of Aria, not Tula. See
[`articles/every-patient-ai-needs-two-scores.md`](articles/every-patient-ai-needs-two-scores.md)
for the public framing of why the split lands where it does.

## Trademark

"Tula," "Aria," and "RealActivity" are trademarks of RealActivity. See
[`TRADEMARK.md`](TRADEMARK.md). You may fork the Tula code under the
Apache License 2.0; you may not call your fork "Tula" or "Aria."

## Questions

If you're unsure whether a contribution falls inside or outside the public
scope, open a Discussion before doing the work. Easier to align upfront
than to scope a PR after the fact.
