---
title: How will you know if your patient AI is working?
subtitle: "An open evaluation standard for patient agents, drafted from working code."
status: draft
drafted: 2026-05-17
author: Paul J. Swider
target_publication: Substack
companion_content:
  - LinkedIn long post (promotes this Substack article)
  - LinkedIn brief (standalone, ~700 chars)
  - X single tweet
  - X 5-tweet thread
trigger_event: Five Tula skills authored with full Waza evaluation suites and continuous compliance gating; spec compliance 9/9 across the collection (2026-05-17).
disclosure_check: |
  Article describes the publicly-disclosed Tula skill collection and the
  Microsoft Waza evaluation framework only. Does NOT reference any
  patent-track material from realactivity/aria-patient-swarm, including
  the EHR-divergence comparison engine, the governance score composition
  method, or the multi-tenant audit emission design.
---

# How will you know if your patient AI is working?

*An open evaluation standard for patient agents, drafted from working code.*

If you run quality, compliance, or informatics at a hospital, you are about to face a question you cannot answer.

Your system has either just deployed a patient-facing AI, or is about to. A chatbot. A medication-reconciliation tool. A symptom-triage tool. A discharge-summary explainer. A portal-message responder. The vendor's pitch was good. The pilot data looked clean. The contract is signed.

Now: how will you know it is working?

Today's answer is a quarterly slide deck from the vendor. Maybe a dashboard with two metrics nobody has time to read. Maybe a complaint pipeline that surfaces problems only after a patient has been harmed.

That is the state of the art. Industry wide.

## Why this gap exists

Patient-facing AI agents are a new category, and the existing evaluation regimes do not reach them.

The FDA's [Software as a Medical Device framework](https://www.fda.gov/medical-devices/digital-health-center-excellence/software-medical-device-samd) covers clinical decision support. Not patient-facing chat.

[ECRI's healthcare technology evaluation work](https://www.ecri.org/) focuses on physical devices and predictive models. Not conversational agents.

The LLM benchmark leaderboards ([MedQA](https://github.com/jind11/MedQA), HealthBench, USMLE-style assessments) measure clinical knowledge. They do not measure whether an agent, presented with a real patient sending a real message, takes the right action.

Each vendor has internal eval suites. Those are proprietary, not portable, not comparable. Procurement teams have no shared rubric. Quality officers have no instrument. CMS compliance has no audit format.

That is the gap.

## What patient-agent evaluation actually needs

A patient-facing AI agent is evaluated against five distinct kinds of behavior:

- Does it do the right thing when prompted appropriately?
- Does it route correctly when a request belongs to a different tool or a human?
- Does it refuse to do dangerous things, even when persuasively asked?
- Does it handle data with the right boundaries (PHI in, PHI not transmitted out)?
- Does it coordinate cleanly with the other agents and humans involved in the same care episode?

These are not knowledge questions. They are behavior questions. The right testing tool is not a multiple-choice exam. It is a test harness that exercises the agent against fixtures, captures its outputs, and grades them against rules that the operator can read and audit.

That is what an evaluation suite for a patient-facing AI looks like.

## What we have built

Over the last several weeks I have been building [Tula](https://github.com/realactivity/tula), an open-source health agent that runs on a single thirty-dollar-a-month VM. As of this morning it has five skills:

- [`health-records`](https://github.com/realactivity/tula/tree/main/skills/health-records) pulls medical records from MyChart and other portals through SMART on FHIR
- [`med-pdf`](https://github.com/realactivity/tula/tree/main/skills/med-pdf) extracts labs and imaging findings from any medical PDF
- [`epic-note`](https://github.com/realactivity/tula/tree/main/skills/epic-note) drafts a portal message to a clinician
- [`myhealth-pulse`](https://github.com/realactivity/tula/tree/main/skills/myhealth-pulse) aggregates personal health-related signal across configured feeds
- [`memory-diff`](https://github.com/realactivity/tula/tree/main/skills/memory-diff) surfaces what changed in the patient's record since a chosen reference point

Each skill has an evaluation suite under [`evals/`](https://github.com/realactivity/tula/tree/main/evals). Each suite is a YAML file plus a folder of task definitions plus a folder of fixtures. Each task names the expected behavior, the inputs, and the graders that determine pass or fail. The graders are open. The fixtures are open. The expected behaviors are open. Anyone can read them, argue with them, fork them, improve them.

The runner is [Microsoft Waza](https://github.com/microsoft/waza), an open Go CLI that executes an evaluation suite against any AI model and produces structured pass-rate output. Waza was built by a team at Microsoft for exactly this purpose. Tula is one of the first patient-agent collections authored to its conventions.

The continuous compliance gate, the per-skill spec validation, and the token-budget checks all run inside Waza's [`check`](https://github.com/microsoft/waza/blob/main/README.md) command, which we wire into [GitHub Actions](https://github.com/realactivity/tula/blob/main/.github/workflows/eval-status.yml) on every pull request. The current status of every skill lives at [`docs/evals.md`](https://github.com/realactivity/tula/blob/main/docs/evals.md) and is regenerated on every change.

## The proposal

Use this format. Or do not. Argue about it.

The point of an industry standard is not that one vendor's framework wins. The point is that procurement teams, quality officers, and regulators acquire a shared vocabulary for talking about whether a patient-facing AI is actually doing the job it was deployed to do.

That vocabulary needs:

- A schema for skill definitions
- A schema for evaluation suites
- A taxonomy of grader types (text, regex, code, behavior, tool sequence, refusal, LLM-as-judge)
- A set of capability test bundles that cover the universal patient-agent surface (PHI handling, routing, refusal, multi-skill coordination)
- A spec compliance gate
- A publication convention so results can be compared across vendors

The first four exist today in Tula and Waza. The fifth is `waza check`. The sixth is what we are missing.

I am proposing that we build it together.

## What this is, and what it is not

This is not a closed standard with RealActivity at the center. It is an open RFC. The schema is open. The runner is open. The reference skills are open. Anyone can adopt the format without using anything we built.

This is not a substitute for clinical validation, for FDA review, or for institutional governance. It is the table-stakes layer underneath those activities. If a vendor cannot produce eval results in a public, comparable format, that should be a procurement signal long before clinical validation begins.

This is not a one-time project. Standards live or die on coordination and revision. The first version is going to be wrong in places. The way it gets better is people poking at it.

## How to engage

If you work in hospital quality, compliance, informatics, or procurement, and you want patient-AI vendors to be testable against something, the easiest thing you can do is start asking them: "Where are your evals? Can I run them?" That question, asked enough times in enough RFPs, changes vendor behavior faster than any standards body.

If you are a vendor and you want to be ahead of that question, fork Tula's eval suite, point Waza at your agent, publish the results, and start a conversation about which test cases are missing.

If you are a clinical leader and you want a working example to point at, [Tula's repo](https://github.com/realactivity/tula) is the working example. The evaluation suites live under [`evals/`](https://github.com/realactivity/tula/tree/main/evals). The continuous status sits at [`docs/evals.md`](https://github.com/realactivity/tula/blob/main/docs/evals.md). The authoring conventions are in [`skills/AGENTS.md`](https://github.com/realactivity/tula/blob/main/skills/AGENTS.md).

If you want to argue with how we have drafted any of this, open an [issue](https://github.com/realactivity/tula/issues) or a discussion. The first version is supposed to be argued with.

The companion piece to this article, [Every patient AI agent needs two scores](every-patient-ai-needs-two-scores.md), describes the next thing on top of these evaluations: a continuously-computed governance score that tells you whether the agent is actually doing its job for each patient in your population.


Paul
