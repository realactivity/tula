---
title: I gave an AI agent OAuth access to my hospital. It worked on the first try.
subtitle: "Or: the day a $30/month open-source agent pulled my full medical history through SMART on FHIR."
status: draft
drafted: 2026-05-16
revised: 2026-05-17
author: Paul J. Swider
target_publication: Substack
companion_content:
  - LinkedIn long post (promotes this Substack article)
  - LinkedIn brief (standalone, ~700 chars)
  - X single tweet
  - X 5-tweet thread
  - Mandel thank-you email (send before publishing)
trigger_event: First successful end-to-end SMART on FHIR pull through Tula's health-records skill against a real patient portal (2026-05-16).
disclosure_check: |
  Article describes the publicly-disclosed health-records skill only. Does NOT
  reference the memory-grounded extraction architecture, dual-pass isolation
  specifics, selector function, update function, or any patent-track material
  that lives in realactivity/aria-patient-swarm.
---

# I gave an AI agent OAuth access to my hospital. It worked on the first try.

*Or: the day a $30/month open-source agent pulled my full medical history through SMART on FHIR.*

*May 16, 2026*

I just gave an AI agent OAuth access to my hospital's patient portal. I clicked through the consent screen, the agent walked through the SMART on FHIR handshake, decrypted the patient-pull payload, and dropped my full medical history onto a Linux box in Azure.

It worked on the first try.

If you've spent any time in healthcare IT, you know how unusual that sentence is.

## What I actually did

The agent is part of [Tula](https://github.com/realactivity/tula), an open-source health agent I've been building for the last several weeks. It's a collection of skills that run on top of OpenClaw, a self-hosted agent runtime. One of those skills, `health-records`, is a SMART on FHIR client — the open standard that hospitals are legally required to support under the 21st Century Cures Act for patient-initiated data access.

The skill creates a one-time session with my hospital, hands me a URL, and waits. I open the URL on my phone, log into MyChart, click "allow access for this app to my records," and the hospital sends back an encrypted bundle containing every observation, condition, medication, lab result, and provider note in my chart.

The agent decrypts it locally (the private key never leaves my VM), writes it to disk as FHIR R4 JSON, and is now ready to reason longitudinally about my health. A1c trends across years. Every blood pressure measurement on file. Every clinical note that mentions sleep apnea or thyroid or hereditary risk factors. (The reasoning step itself uses whatever LLM is configured — Claude or Gemini against their HIPAA-eligible API tiers, or local MedGemma if you want the entire inference stack airgapped.)

The whole stack costs about $30 a month to run. The hospital integration cost: $0.

## Why this is harder than it sounds

A lot of healthcare AI demos use synthetic data. Synthetic data is fine for showing a UI, but it doesn't prove anything about whether your agent can survive contact with a real hospital's auth flow, a real Epic FHIR endpoint, a real OAuth dance that's been quietly tweaked twelve times since you last looked.

Real medical records have real edge cases. Provider notes that contain instructions you didn't anticipate. PDF attachments that look textual but are actually scanned images. Date fields in seventeen different formats. LOINC codes that look standardized until you check four different lab vendors and discover they're not. Medication entries that omit the dose, the route, or the indication, depending on which subsystem wrote them. Results vary by EHR too — Epic's FHIR endpoints are the strongest; some hospitals on other systems return spottier notes or imaging metadata.

The reason this matters: you can spend two years building a "healthcare AI" product that works perfectly against synthetic data and then collapses the first time someone forwards an actual lab PDF.

Tula was built to survive contact with real records from day one. The `health-records` skill is a Node ESM port of [Joshua Mandel's `health-skillz`](https://github.com/jmandel/health-skillz) — Mandel's the technical co-founder of the SMART project and one of the people who built SMART on FHIR into something hospitals actually implement. His original code has been battle-tested against real Epic, Cerner, and Athena endpoints. I carried his MIT license forward with full attribution and ported the patterns into Tula's skill format.

Today I tested it against my own hospital. It pulled the records. The agent now knows me.

## Why this matters

Patient access to medical records has been a legal right since HIPAA in 1996. It became a teeth-bearing legal right under the 21st Century Cures Act information-blocking rule, which took effect in 2021 and made it illegal for hospitals to obstruct patient-initiated data sharing. Most patients still have no idea this is a button they can press.

The reason is simple: nothing useful happens after you press the button. You get a clinical-systems dump with eight years of lab values, no context, no narrative, no synthesis. It's like being handed your tax returns in their raw IRS-form state and told "good luck."

What changes when you put an open-source AI agent on the other side of that pull?

- You get *your* records, on *your* hardware, on *your* time, without anyone in between.
- You can ask longitudinal questions: "How has my kidney function changed since my mother's diagnosis?" The agent has the data; the agent has the context; the agent has you.
- You can forward documents from any provider — labs, imaging, EOBs, prescriptions, portal messages — and have them automatically extracted into the same FHIR data model.
- Your providers can change. Your hospital can change. Your EHR can change. The agent doesn't care. The data follows you.

This is the inversion of the default state of healthcare in the United States. The default is that your records live in your provider's system and you visit them. The agent makes your records live with you, and your providers visit them.

## What's open and what isn't

Tula is open source under the Apache License 2.0 (as of yesterday — relicensed from MIT to add explicit contributor patent grants for downstream consumers). Anyone can deploy it. Anyone can build on it. The deployment guide is in the repo; I wrote it during a real deployment session, including every error I ran into and how I fixed it. It runs on Azure, on bare metal, on a Raspberry Pi at the high end if you're patient.

Running it on your own infrastructure means you own the security: keep the VM patched, encrypt the disk at rest, scope OAuth tokens narrowly and revoke them after the pull, and lock down the email channel. The full threat model and defense-in-depth posture is in [docs/security-model.md](https://github.com/realactivity/tula/blob/main/docs/security-model.md).

There's a commercial side to this too. RealActivity (the company I run) is building **Aria**, a hospital-scale platform that runs one Tula agent per patient under multi-tenant identity, SSO, audit, compliance, BAA chain — all the things a hospital needs to deploy this to thousands of patients at once. We call the architecture a **Patient Swarm**: many specialized, patient-centered agents operating in parallel, each with isolated state, coordinated by a shared control plane. The clinical reasoning is the same as personal Tula; what Aria adds is scale, identity, and compliance.

Personal Tula stays open, free, and complete on its own. Aria is built on top of it. The same skill that pulled my records this afternoon will run inside every patient cell in a hospital deployment. The boundaries are documented in the repo's [OPEN_CORE.md](https://github.com/realactivity/tula/blob/main/OPEN_CORE.md).

## Where to find it

- Repo: [github.com/realactivity/tula](https://github.com/realactivity/tula)
- The skill that pulled my records today: [`skills/health-records`](https://github.com/realactivity/tula/tree/main/skills/health-records)
- Deployment guide: [`docs/deployment-guide.md`](https://github.com/realactivity/tula/blob/main/docs/deployment-guide.md)
- The upstream that made it all possible: [jmandel/health-skillz](https://github.com/jmandel/health-skillz)

If you build something useful with this, I want to hear about it. If you're a hospital and want to talk about Aria, the contact info is in the repo. If you're a patient with a chronic condition or caregiving load and you want to deploy this yourself, the deployment guide was written for someone with no Linux experience, by someone who had no Linux experience three months ago.

The internet was supposed to give us this in 2005. It's twenty-one years late. Better late than never.

— Paul

---

*Tula is open-source software for personal health data organization and health literacy. It is not a medical device, not FDA-cleared, and not intended to diagnose, treat, cure, or prevent any disease. Talk to your doctor about anything that matters.*
