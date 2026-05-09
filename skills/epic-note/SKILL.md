---
name: epic-note
description: "Drafts a concise patient-portal message Paul can copy-paste to a clinician via Epic MyChart, Oracle Health HealtheLife, or similar. USE FOR: symptom reports, refill requests, lab/result follow-ups, visit follow-ups, asking a single clear question. DO NOT USE FOR: clinical notes, SOAP/discharge documentation, insurance or billing letters, or answering the patient's medical question."
metadata:
  {
    "openclaw":
      {
        "emoji": "✉️"
      }
  }
---

# epic-note

## When to Use

✅ Use when:

- Paul asks for help drafting a message to his PCP or specialist
- Reporting a new or worsening symptom
- Asking about a recent test or lab result
- Requesting a medication refill
- Following up after a visit, procedure, or referral

## When NOT to Use

❌ Don't use when:

- Symptoms suggest an emergency — return the 911 redirect from
  [`references/triage-rules.md`](references/triage-rules.md), don't draft
- Generating a clinician-facing note (SOAP, discharge, dictation)
- Drafting non-clinical letters (insurance, billing)
- Paul is asking a medical question for advice — that's answered directly,
  not in a portal message

## Workflow

1. **Triage first.** Scan input for red-flag symptoms. If present, do NOT
   draft — return the 911 redirect text from
   [`references/triage-rules.md`](references/triage-rules.md).

2. **Identify the single ask.** If multiple unrelated topics exist, propose
   separate messages and ask Paul which to send first.

3. **Draft** using the canonical format in
   [`references/portal-message-format.md`](references/portal-message-format.md):
   `Subject:` line with urgency, greeting, one-sentence ask, 2–4 sentences
   of context, optional bullet data, sign-off.

4. **Word budget.** Aim for ≤150 words; hard cap 220. Front-load the ask.
   Plain language. No self-diagnosis, no filler praise, no PHI of others.

5. **Output is copy-paste ready.** No explanations or meta-commentary
   wrapped around the message — just the message itself.

## Examples

See [`references/examples.md`](references/examples.md) for worked
input/output pairs (medication side effect, lab follow-up, refill request,
multi-topic split).

## Privacy

Portal messages travel through health-system networks under HIPAA. Tula
generates drafts locally — no PHI leaves the workspace.

- Don't include PHI of family members or third parties.
- The draft stays in the conversation. Never auto-send.
- Don't paste clinician/patient identifiers into web search or external
  services for "verification."

## Troubleshooting

- **No clinician name given** → use `Hello [Care Team],`.
- **Vague input** → ask one clarifying question (onset, severity, which
  clinician), then draft.
- **Paul asks for medical advice** → decline politely; this skill drafts
  messages *to* clinicians, not answers from them.
- **Multi-topic input** → propose separate messages, don't bundle.
- **Emergency-flavored prompt** → return triage redirect; never wrap a
  drafted message around it.
