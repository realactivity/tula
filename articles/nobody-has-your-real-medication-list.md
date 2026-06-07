---
title: Nobody Has Your Real Medication List
subtitle: "Your doctor's chart, your pharmacy, and your memory all disagree. The one place that can finally hold the truth is the record you own."
status: draft
drafted: 2026-06-06
author: Paul J. Swider
target_publication: Substack
companion_article: articles/i-built-the-patient-portal-my-agent-deserves.md
target_word_count: 1400
companion_content:
  - LinkedIn long post (promotes this Substack article)
  - LinkedIn brief (standalone, ~700 chars)
  - X 4-tweet thread
trigger_event: Realized while wiring real FHIR medications into My Aria that the clinic's active-med list never matches what I actually take - supplements and vitamins are missing, some prescriptions were never filled, and stale entries linger. A patient-owned reconciliation layer turns the dashboard into the single source of truth.
---

# Nobody Has Your Real Medication List

*Your doctor's chart, your pharmacy, and your memory all disagree. The one place that can finally hold the truth is the record you own.*

*June 6, 2026*

## The question every visit starts with

"So, what are you currently taking?"

You have answered this question dozens of times. At the front desk, in the exam room, on the pre-op call, in the ER intake. And every time, you give a slightly different answer, because the honest answer is *I'm not totally sure, and neither are you.*

The nurse is reading from a list in the chart. That list is wrong. Not maliciously, not even carelessly - just structurally, predictably wrong, in the same three ways for almost everyone. I found this out again last week, not in a clinic, but while wiring my own medication data into the [patient portal I built for my agent](i-built-the-patient-portal-my-agent-deserves.md). The chart said one thing. My life said another.

## Three ways the chart is always wrong

**It doesn't know about the things you buy without a prescription.** The vitamin D your last doctor told you to take. The magnesium for sleep. Fish oil, creatine, a daily baby aspirin, melatonin, the greens powder. None of it requires a prescription, so none of it reliably reaches the clinical record - and yet it is genuinely part of what you put in your body every day. It interacts with your labs. It interacts with your prescriptions. Your hepatologist would very much like to know about the supplement stack your chart has never heard of.

**It thinks you're taking things you're not.** A doctor writes a prescription. That act creates a record. Whether you ever *filled* it - whether you took it for a week and stopped, whether you decided the side effects weren't worth it, whether you simply chose not to - often never makes it back into the chart. So the "active medications" list quietly accumulates things you abandoned. I have done this. Most people have. The prescription is an intention; the chart records the intention and calls it reality.

**It never forgets, even when it should.** Dose changed but the old dose is still listed. A med you stopped two years ago lingers. The same drug appears twice under a brand name and a generic. The list grows; it rarely gets pruned, because pruning requires someone to sit down with you and reconcile every line - and nobody is paid to do that between visits.

None of this is a scandal. It is the ordinary physics of a record that is written *about* you, by many hands, in many systems, none of which is the one place you actually live.

## This is a known, dangerous, expensive problem

I want to be clear that this is not my clever observation. "Medication reconciliation" is a named discipline in medicine precisely because the gap between the list and the truth hurts people. It is a Joint Commission National Patient Safety Goal. It is one of the most common sources of preventable harm at every care transition - hospital admission, discharge, transfer, a new specialist. People get double-dosed, get drug interactions, get put back on something they stopped for a good reason, because the receiving clinician trusted a list that did not match the patient.

Hospitals spend real money and real clinical hours trying to reconcile these lists at every handoff. And they are reconciling against *each other's* records - one EHR against another, the pharmacy feed against the discharge summary. They are still missing the one input that would resolve most of it: the patient, who actually knows what they take, asked in a place that remembers the answer.

## The problem isn't data entry. It's ownership.

Here is the part that took me a while to see clearly. The reason this never gets fixed is not that it's hard to type in a medication. It's that there is no record that *belongs to you* and is *allowed to be the truth.*

Every list that exists is owned by an institution and reflects that institution's slice of you. Your cardiologist's chart. Your PCP's chart. CVS's pharmacy system. Each is authoritative about its own transactions and blind to everything outside them. When you change jobs, move, or switch health systems, the slice resets. There is no continuous, patient-owned layer that says: *regardless of what any one institution recorded, here is what I actually take, as of today.*

That layer can't live inside Epic, because Epic belongs to a hospital and resets when you leave. It can't live in your head, because your head is exactly the unreliable narrator everyone is working around. It has to live somewhere you own, that aggregates the clinical record *and* lives with you day to day.

That is the whole thesis of what I'm building.

## The unlock: a patient-owned layer on top of the chart

My agent already pulls my real medical history from five hospitals as FHIR and drops it on a Linux box I control. [My Aria](i-built-the-patient-portal-my-agent-deserves.md) renders it. So the clinical med list is already there, read-only, exactly as the hospitals recorded it. That's the floor, and it's the right floor - I never want to lose or silently mutate what a clinician actually wrote.

The unlock is letting *me* add a layer on top.

In My Aria's medications view, I can add a medication or a supplement that no chart knows about. I can mark a prescription the chart thinks I'm taking as *not taking* - without deleting the underlying clinical record, just overlaying the truth. I can correct a dose. I can remove something I added by mistake. And every entry is labeled by where it came from: **from your clinic record**, **added by you**, or **marked not taking.** Provenance is never lost. You can always see what the hospital believes *and* what is actually true, side by side.

The merge of those two layers - the clinical import and the patient-maintained overlay - is the artifact medicine has been trying to produce at every handoff and never quite can. It is **one reconciled version of the true state of your health.** The list you would actually want to hand to a new doctor, an ER, a surgeon, or another AI. The list that says, with provenance, *this is what I take, this is what the chart thinks, here is where they disagree, and here is why.*

And critically: it never writes back to the EHR. This is not me editing the hospital's record. This is my own authoritative record informing the clinician - the way it always should have worked. The patient is not a data-entry endpoint for the institution's chart. The patient is the source.

## Why this is the whole game

It is easy to undersell this as a feature - "let users edit their med list." It is not a feature. It is the difference between two completely different products.

A product that only renders the hospital's data is a nicer window onto someone else's record. Useful, but it inherits every gap I described above. A product that lets the patient maintain the truth on top of that data becomes *the patient's own authoritative health record* - the single source of truth that neither the EHR nor memory has ever been able to be.

That is the thing patients have actually needed the entire time. Not another portal login. Not another chart owned by someone who will reset it when you change insurance. A record you own, that holds what is actually true, that you can carry across every hospital and every year of your life.

Medications are where I'm starting because the gap is so obvious and the harm is so well documented. But the principle generalizes to the whole record: the institution writes what it transacted, and you reconcile it into the truth you live. The chart is an input. You are the source.

My agent pulls the data. The dashboard shows it. And now, finally, I get to tell it what's actually true.

That's the version I've wanted to walk into every appointment holding.

Paul
