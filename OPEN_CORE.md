# Open Core Scope

Tula is maintained by RealActivity as an MIT-licensed open-source health agent
skill collection. RealActivity also develops **Aria**, a commercial
hospital-scale platform built on the same Tula skills. The two are distinct
products with distinct licenses and distinct repositories.

This document scopes what the public Tula repo is for, what it accepts
contributions for, and what's out of scope.

## What's in scope for this repo

The public Tula repo is the home of:

- **Core health skills** for the [OpenClaw](https://github.com/openclaw/openclaw)
  runtime, authored under the conventions in [`skills/AGENTS.md`](skills/AGENTS.md).
  The reference template is [`skills/med-pdf/`](skills/med-pdf/).
- **The evaluation harness** — [`evals/`](evals/) and `.waza.yaml`, with
  [Microsoft Waza](https://github.com/microsoft/waza) running in CI for every
  PR that touches skills or evals.
- **Authoring conventions and tooling** — `skills/AGENTS.md`,
  [`docs/skills-development.md`](docs/skills-development.md), and the deploy
  script in [`scripts/`](scripts/).
- **Single-user, self-hosted deployment** — the
  [deployment guide](docs/deployment-guide.md), the
  [cost guide](docs/cost-guide.md), the personal
  [security model](docs/security-model.md), and the
  [email router design](docs/email-router-design.md) at personal scale.
- **The TripIt-style email ingestion pattern** at single-user scale — one
  mailbox, sender allowlist, Telegram or web for notifications.

Contributions that improve any of the above are welcome. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for how to submit them.

## What's out of scope (lives in Aria)

The following capabilities are part of Aria, the commercial hospital-scale
platform, and live in a separate private repository:

- **Multi-tenant agent runtime** — per-patient isolation, tenant-scoped
  workspaces, fleet skill deployment.
- **Patient identity and SSO** — Entra ID / OIDC integration, RBAC,
  caregiver proxy access, consent flows.
- **Multi-tenant ingest router** — shared mailbox with patient-token
  recipient addresses, per-patient sender allowlists, tenant routing.
- **Patient-facing dashboard at scale** — multi-tenant web app,
  authenticated chat with the agent, in-app document capture, Web Push
  notifications, caregiver portal.
- **LLM gateway** — BAA-tier endpoints, per-tenant rate limits, per-tenant
  cost attribution, audit-logged model calls.
- **Audit logging** — append-only, per-tenant, with break-glass procedures.
- **EHR / patient-portal integrations at hospital scale** — Epic, Oracle
  Health, FHIR API connectors.
- **Compliance plumbing** — BAA chain management, SOC 2 evidence
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

## Trademark

"Tula," "Aria," and "RealActivity" are trademarks of RealActivity. See
[`TRADEMARK.md`](TRADEMARK.md). You may fork the Tula code under the MIT
license; you may not call your fork "Tula" or "Aria."

## Questions

If you're unsure whether a contribution falls inside or outside the public
scope, open a Discussion before doing the work. Easier to align upfront
than to scope a PR after the fact.
