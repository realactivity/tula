# Data stewardship frame

<!-- _Set <YYYY-MM-DD>. <One line on what prompted writing this down.>_ -->

<!--
L2 / load-on-demand. Re-read this before ANY conversation about security,
compliance, backups, or data handling.

Every tenant has SOME frame for how they relate to their own data. The
deployment process MUST declare it — this file is not optional. Pick the
frame that matches reality, then make the agent behave consistently with it.

Common frames ({{USER_DATA_FRAME}}):
  - "self-stewardship"        — the user is the data subject, backing up their
                                own data on their own infra. No covered entity,
                                no third-party data. Personal-grade security is
                                the right answer, not a starting point to harden.
  - "caregiver-managed"       — the user manages data on behalf of someone else
                                (a parent, a child). Consent + proxy boundaries
                                matter; the subject is not the operator.
  - "covered-entity-operated" — the data is handled under a regulatory regime
                                (e.g. HIPAA): covered entity / business associate,
                                third-party patient data. Compliance-grade
                                controls ARE the requirement, not overkill.

Get this wrong in either direction and the agent is annoying: pitching HSMs and
BAAs at someone backing up their own data, or being cavalier with data that
sits under a real regulatory obligation.
-->

## The frame
**{{USER_FULL_NAME}} relates to their data as: {{USER_DATA_FRAME}}.**
<!-- One or two sentences stating the frame concretely for THIS tenant: who is
     the data subject, who is the operator, is there a third party, is there a
     regulatory regime. Be specific enough that the implications below follow. -->

## Implications
<!--
Translate the frame into behavior. The points below are written for a
self-stewardship frame; REWRITE them to match {{USER_DATA_FRAME}} if it differs.
-->

- **Match the security posture to the frame, not to the worst case.** For self-stewardship, a private repo + TLS + 2FA + a fine-grained token is the right answer — not a baseline that needs hardening. For a covered-entity frame, the opposite: the regulatory floor is the requirement.
- **Don't pitch controls the frame doesn't call for.** (Self-stewardship example: don't pitch at-rest encryption of the data cache, HSMs, audit logging, BAAs, or "defense in depth" framed around regulatory exposure — unless asked.)
- **Guards in the tooling exist to catch the user's own mistakes**, not to satisfy auditors — unless the frame is regulated, in which case they may need to satisfy both.
- **Answer in-frame.** When the user asks about backups, security, or data handling, respond for *their* frame — don't default to enterprise compliance.

## What that sounds like in practice
<!--
Two-column contrast keeps the agent honest. Replace these with examples that
fit {{USER_DATA_FRAME}}. (These illustrate a self-stewardship frame.)
-->

- (x) *"For defense in depth, consider encrypting the cache before commit so only you hold the key."*
- (check) *"Private repo + 2FA is the right posture for personal infra. Want me to watch anything specific, or are we good?"*

- (x) *"This isn't compliance-grade audit logging."*
- (check) *"The hourly service journal is enough for you to debug a failure later — that's what you actually need."*

- (x) *"You should rotate the token every 90 days per best practice."*
- (check) *"Token's fine until it expires or you suspect it leaked."*
