# Safety and Disclaimer

This page consolidates the safety boundaries, scope limits, and medical disclaimer for Tula. The README contains a short summary and link back here; this page is the canonical source.

## Disclaimer

Tula is an open-source software tool intended to support personal health data organization and health literacy. It is not a medical device, not FDA-cleared or approved, and not intended to diagnose, treat, cure, or prevent any disease or medical condition. Tula does not provide clinical decision support and should not be used as a substitute for professional medical advice, diagnosis, or treatment.

Always seek the guidance of qualified healthcare providers with any questions regarding a medical condition.

If you are experiencing a medical emergency, contact your local emergency services immediately.

## What Tula Is Not

Tula is **not**:

- A medical device
- A diagnostic system
- A treatment recommendation engine
- A substitute for a physician, nurse, pharmacist, or qualified healthcare professional
- An emergency response system
- A replacement for an EHR, patient portal, or clinical workflow system

Tula is designed to support personal health organization, health literacy, caregiver coordination, and patient-facing AI experimentation in a private environment. The clinical decisions remain with you and your healthcare team.

## Safety boundaries built into the skills

The Tula skill layer enforces several safety boundaries at the architecture level, not at the prompt level.

- **Drafts are drafts.** Patient portal messages drafted by [`skills/epic-note`](../skills/epic-note/) are never auto-sent. Every message requires explicit human review and submit through the patient portal.
- **PHI stays in the workspace.** PHI is scoped to a private workspace memory layer the user owns. The `.health-records-cache/` and `.med-pdf-cache/` directories are bounded to the agent's workspace and do not leave it unless the user explicitly exports.
- **External upload is refused, with reason.** The skills explicitly refuse to upload medical PDFs or PHI to external tools, and the refusal language names PHI explicitly so it is auditable in the evaluation suite.
- **Inbound email is allowlisted at the transport layer.** The email router locks inbound mail to a sender allowlist at the **Exchange transport layer** before any model ever sees it. Untrusted messages never reach the agent.
- **Outbound email is restricted to authorized recipients.** No accidental forwarding of health data to arbitrary addresses.
- **Scope-contained skills.** Each skill writes only to its own cache, with no cross-skill side-effects beyond the workspace memory contract documented in [`docs/architecture.md`](architecture.md).
- **Identity-bound actions.** Every action is attributable to the named agent and traceable through the OpenClaw audit log.

The full defense-in-depth design is in [`docs/security-model.md`](security-model.md).

## Human-in-the-loop expectations

Tula is designed around explicit human review at every consequential step:

- The user reviews and submits portal-message drafts. The agent never sends.
- The user decides which records to pull, when, and from which portals.
- The user reviews longitudinal change summaries before acting on them.
- The user decides whether to escalate, contact a clinician, or take any clinical action.

The agent's job is to help organize, summarize, and prepare. The clinical action is the user's, with their care team.

## Clinical escalation boundaries

Tula does not implement clinical triage. The skills are deliberately conservative about anything that could be interpreted as triage:

- If a user asks Tula to evaluate a symptom, the agent prepares context (recent labs, recent meds, recent visits) and surfaces it for the user to bring to their clinician. The agent does not output a diagnosis, severity grade, or treatment recommendation.
- Portal-message drafts include red-flag handling: prompts that look like emergencies redirect the user to call 911 or local emergency services, and do not produce a portal message.
- Anything beyond personal data organization, health literacy, or caregiver coordination is out of scope for the open Tula skill layer. Higher-acuity workflows are intentionally deferred to Aria's governed runtime where escalation paths can be audited and operationally enforced. See [`docs/aria-commercial-platform.md`](aria-commercial-platform.md).

## Privacy and security considerations

- **Self-hosted by default.** Health data is stored on the user's own server. No cloud health platforms. No third-party data sharing.
- **User-owned keys.** API keys, OAuth tokens, and Telegram bot tokens live on the user's VM. Tula does not phone home.
- **Backups are user-controlled.** The included `agent-backup.sh` script lets the user mirror the agent workspace to a private remote of their own. There is no managed cloud backup.
- **Secret-scan gate.** Workspace backups run through a regex secret-scan gate before commit, so accidentally-cached secrets are not silently mirrored offsite.

See [`docs/security-model.md`](security-model.md) for the threat model, the prompt-injection analysis, and the defense-in-depth design.

## Healthcare compliance caveats

Tula is the open, single-user reference deployment. It is not, by itself, a HIPAA-compliant patient-facing AI service for an organization. The artifacts that make it ready for hospital-scale deployment (per-tenant audit aggregation, BAA-tier LLM gateway, identity-bound multi-tenant runtime, EHR-fidelity comparison, governance reporting) are part of the commercial Aria platform, not the open repo. See [`docs/aria-commercial-platform.md`](aria-commercial-platform.md) and [`OPEN_CORE.md`](../OPEN_CORE.md) for the boundary.

If you are evaluating Tula or Aria for a real organizational deployment, see [`docs/enterprise-pilots.md`](enterprise-pilots.md) for the partnership posture.

## See also

- [`README.md`](../README.md), the front-door summary
- [`docs/security-model.md`](security-model.md), the defense-in-depth design
- [`docs/architecture.md`](architecture.md), the system architecture
- [`docs/aria-commercial-platform.md`](aria-commercial-platform.md), the commercial extension
