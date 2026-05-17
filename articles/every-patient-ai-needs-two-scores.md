---
title: Every patient AI agent needs two scores
subtitle: "A governance score for the system. A health score for the patient. Most vendors ship neither."
status: draft
drafted: 2026-05-17
author: Paul J. Swider
target_publication: Substack
companion_content:
  - LinkedIn long post (promotes this Substack article)
  - LinkedIn brief (standalone, ~700 chars)
  - X 4-tweet thread
trigger_event: Articulated the open-evals + closed-governance split as the Aria product wedge; settled on three MVP governance dimensions (eval pass rate, EHR fidelity, audit completeness).
disclosure_check: |
  Article describes the conceptual structure of the governance and
  health scores at a level appropriate for an audience of quality
  officers, CMS compliance leaders, and CMOs. Does NOT disclose the
  composition method, weighting algorithm, refusal-to-compute logic,
  EHR-divergence comparison engine, or any other patent-track material
  from realactivity/aria-patient-swarm.
---

# Every patient AI agent needs two scores

*A governance score for the system. A health score for the patient. Most vendors ship neither.*

If your health system has deployed a patient-facing AI, you are flying blind on two questions at the same time.

First: is the AI doing its job? Did it route the patient's PDF to the extraction skill, not invent an answer from training data? Did it refuse to give medical advice when asked? Did it pass its own eval suite this month? Did its understanding of the patient's chart match what is actually in the EHR? You have no instrument that answers any of those questions across your patient population in something faster than quarterly.

Second: is the patient getting better? Are tracked biomarkers moving the right direction? Are preventive screenings up to date? Is care engagement strong? Have any acute risk signals shown up that the chart has not acted on yet? You probably have some instrument here, but it was built for chart review, not for the new fact that an AI agent is now reasoning with the patient continuously between visits.

These are different questions. They need different scores. They need to be in front of you at the same time.

## Governance and health, side by side

The first score is about the system. The second score is about the patient. Most existing healthcare-AI dashboards conflate them or skip them both.

The governance score answers "is the AI working." It is composed of measurable signals about agent behavior, not about clinical state.

The health score answers "is the patient improving." It is composed of measurable signals about the patient's actual physiology and engagement, not about how well the agent is observing them.

When both scores sit in front of you, the dashboard answers a question no single score can:

- Both high: patient is doing well, system is trustworthy. Maintain.
- Low health, high governance: patient needs attention, but you can trust what you are seeing. Clinical escalation, not investigation of the AI.
- High health, low governance: patient looks fine but the system itself is not trustworthy yet. Investigate the agent before acting on its summaries.
- Both low: red zone. The patient may be sicker than the data shows. Investigate both layers.

That four-quadrant view is what an operational dashboard for a patient-AI deployment should look like. None ship today.

## Why we are building the governance score first

The health score is harder to ship safely. There are FDA SaMD questions about composite scores that influence treatment decisions. There are decades of failed attempts at universal health scores ([Karnofsky](https://en.wikipedia.org/wiki/Karnofsky_score), [ECOG](https://en.wikipedia.org/wiki/Performance_status), [Charlson](https://en.wikipedia.org/wiki/Comorbidity#Charlson_index), [LACE](https://www.mdcalc.com/calc/3805/lace-index-readmission), [HOSPITAL](https://www.mdcalc.com/calc/2235/hospital-score-readmissions)) that did not generalize across clinical contexts. There are equity concerns about sorting patients by composite scores that correlate with socioeconomic factors. None of these problems is unsolvable. All of them require careful work.

The governance score is none of those things. It does not pretend to be clinical judgment. It does not need FDA clearance. It is not sorted by ascending risk in a way that captures treatment-prioritization decisions. It just answers, for each patient and across the cohort, whether the AI is doing the job it was contracted to do.

That answer has no acceptable alternative today. The market is wide open.

## The three dimensions we are starting with

A useful governance score for a patient agent does not need to be elaborate. It needs to be defensible. The MVP is three dimensions:

**Evaluation pass rate.** The agent's instance runs the published Tula evaluation suite continuously against its own state. Each task is graded pass or fail. The rolling pass rate is one dimension of the score. This is the agent's "did I behave correctly on my own published behaviors" signal. The eval format is open (see the [companion article on the evaluation standard](how-will-you-know-if-your-patient-ai-is-working.md)). The continuous-execution layer at swarm scale is not.

**EHR fidelity.** The agent maintains an internal model of the patient: current medications, active problems, recent labs, scheduled appointments. The hospital's EHR is the authoritative record. When these diverge, that is a measurable governance signal. Lower divergence is better. A divergence with a clinical-significance tier above noise is an event the dashboard surfaces in real time.

**Audit completeness.** Every AI-influenced action the agent takes (a summary surfaced, a draft sent, a referral suggestion offered) should carry an audit record with provenance, attribution, and timestamps. The fraction of agent actions with complete audit trails is the third dimension. CMS compliance teams will recognize this number immediately. So will any malpractice insurer who has looked at what AI-influenced harm cases will require to defend.

Each dimension has a freshness indicator (when was this last measured), a confidence indicator (how much data informed it), and a direction (improving, stable, worsening). The composite refuses to be computed when too many dimensions are stale or low-confidence. Better an empty cell than a misleadingly confident number.

## Who this is for

The audience for these scores is specific.

Quality officers want to know, every morning, whether anything has changed in their AI deployment that needs attention. They do not want to read a transcript. They want a number, a direction, and a drill-down.

CMS compliance and HIPAA audit teams want documentation that AI-influenced decisions have complete audit trails. They want a percentage. They want exceptions surfaced.

Chief medical officers want a single artifact they can show to a board, a malpractice insurer, or a regulatory inspection. "We have continuous governance scoring on our patient-AI deployment. Here is the trend. Here is what we do when it dips."

Hospital leadership wants to know they bought a system that can be audited, that has documented behavior, and that does not require quarterly slide decks to verify it is working.

These are the same people who currently have no instrument to answer the questions they are responsible for answering.

## What is open, what is closed

The evaluation suite is open. [Tula's evaluations](https://github.com/realactivity/tula/tree/main/evals) are published under the [Apache License 2.0](https://github.com/realactivity/tula/blob/main/LICENSE). Anyone can run them, fork them, propose improvements. The runner ([Microsoft Waza](https://github.com/microsoft/waza)) is open. The agent ([Tula](https://github.com/realactivity/tula)) is open.

The continuous-execution layer, the EHR-fidelity comparison engine, the audit-trail aggregation, the score composition with refusal-to-compute, and the dashboard that surfaces all of this at hospital scale are not open. They are the commercial product I am building at RealActivity. We call it Aria.

This split is deliberate. The evaluation format being open means hospitals can demand it of any vendor, not just Aria. The scoring infrastructure being closed means hospitals that want it built and operated, with the BAA chain and the multi-tenant identity and the audit storage, pay us to run it.

That is the open-core arrangement that has worked for [HashiCorp](https://www.hashicorp.com/), [Sentry](https://sentry.io/), [GitLab](https://about.gitlab.com/), and several others. It is what makes the open piece actually useful (not a teaser for the closed piece), and what makes the closed piece actually differentiated (not a wrapper around the open piece). The boundary is documented in the Tula repo's [`OPEN_CORE.md`](https://github.com/realactivity/tula/blob/main/OPEN_CORE.md).

## The patient health portfolio comes second

I am not skipping the patient health portfolio. The companion view to the governance score is a portfolio of health dimensions (cardiometabolic, renal, hepatic, mental, functional, preventive, care engagement, social determinants, acute risk signals) with an optional composite that uses cohort-specific weight sets and refuses to be computed below a confidence threshold.

We will get there. We are starting with governance because it is the cleaner question, the more defensible product, and the one that has no acceptable alternative in the market today.

## How to engage

If you are a hospital quality, compliance, or medical leader and you want to be part of a small early-customer conversation about what these scores should actually contain, the contact information is at [realactivity.ai](https://realactivity.ai).

If you are a researcher or another vendor and you want to argue with the schema underneath the governance score, the open evaluations are at [Tula's evals folder](https://github.com/realactivity/tula/tree/main/evals). Issues and discussions are welcome.

The question that started this article (how will you know if your patient AI is working) has a coming answer. It is not in a slide deck. It is in a continuously computed governance score with three measurable dimensions, sitting next to a separately computed patient health portfolio, both of them refreshable, auditable, and defensible.

We can build it. We are building it.


Paul
