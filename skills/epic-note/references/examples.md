# Worked Examples

Each example shows the patient's free-text request and the ideal output.

---

## Example 1 — Medication side effect

**Patient input:**

> I started Lisinopril 10mg three weeks ago and I've been getting a dry cough
> every night. I want to ask Dr. Dave Matthews if I should switch.

**Output:**

```
Subject: Persistent dry cough since starting lisinopril — routine

Hello Dr. Dave Matthews,

I'd like to ask whether I should switch off lisinopril due to a persistent cough.

I started lisinopril 10 mg about three weeks ago. Since roughly the second
week, I've had a dry, non-productive cough that wakes me up most nights. No
fever, no congestion, no shortness of breath. Home BP this morning: 128/82.

- Current dose: lisinopril 10 mg daily
- Started: ~3 weeks ago
- Symptom: nightly dry cough, no other URI symptoms

Thank you,
Dylan
```

---

## Example 2 — Lab result follow-up

**Patient input:**

> My A1c just came back at 6.4 — what does Dr. Nguyen want me to do next?

**Output:**

```
Subject: A1c result follow-up — routine

Hello Dr. Nguyen,

I'd like guidance on next steps after my recent A1c result.

My A1c came back at 6.4% (down from 6.8% three months ago). I'm continuing
metformin 1000 mg twice daily and have not changed diet or activity since our
last visit.

Thank you,
Dylan
```

---

## Example 3 — Refill request

**Patient input:**

> I need a refill on metformin before my trip next week.

**Output:**

```
Subject: Refill request — metformin — this week

Hello Dr. Dave Matthews,

Could I please get a refill on metformin 1000 mg twice daily before I travel
next week?

I have about 5 days remaining. Pharmacy: Riverside Pharmacy.

Thank you,
Dylan
```

---

## Example 4 — Multi-topic input (split, do not bundle)

**Patient input:**

> I need a metformin refill, I have questions about my A1c, and there's a new
> rash on my forearm.

**Skill behavior:** ask the patient which to send first, since these are
unrelated topics that route differently. Do not bundle into one message.

**Output:**

> These are three different asks that the care team will route differently.
> Which would you like to send first? I recommend the rash if it's spreading
> or you have a sulfa allergy on file. The refill is fastest as a separate
> short message. The A1c discussion is best timed near your next visit.
