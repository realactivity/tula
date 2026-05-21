---
title: I Built the Patient Portal My Agent Deserves
subtitle: Epic spent decades teaching you to log into their chart. I taught my agent to show me mine.
status: draft
drafted: 2026-05-20
author: Paul J. Swider
target_publication: Substack
companion_article: articles/i-gave-an-ai-agent-oauth-access-to-my-hospital.md
target_word_count: 1500
---

# I Built the Patient Portal My Agent Deserves

*Epic spent decades teaching you to log into their chart. I spent a weekend teaching my agent to show me mine - on my server, from five hospitals, with a sidebar that knows the difference between a portal, a Garmin, and a ZIP code.*

*May 20, 2026*

## The pipe worked. Now I needed a faucet.

Two weeks ago I wrote about [the day SMART on FHIR worked on the first try](articles/i-gave-an-ai-agent-oauth-access-to-my-hospital.md). My Tula agent did the OAuth dance with a real hospital, pulled my full medical history as encrypted FHIR R4 bundles, and dropped them onto a Linux box I control - not a vendor cloud, not a data lake, *my* VM. Within a week the same agent was authenticated against five different patient portals and was paying me dividends every morning when it ran the daily pulse.

That story ends where most health-tech demos end: with proof that the pipe works.

It does not end with proof that *you* can live inside the pipe. A JSON dump is not a patient experience. Telegram replies from an agent are wonderful, but they are not a chart. I had FHIR Observations going back twelve years, three Garmin devices syncing nightly, and an Oura ring telling me how I slept in Lisbon last Tuesday - and none of it was *visible* in a single coherent place.

So I built one. I vibe coded my own "Epic" inside my own personal agent. I call it **My Aria**.

![My Aria Dashboard](apps/my-aria/public/my-aria-dashboard.png)

## Vibe coded, but not vibe shipped

The stack is intentionally boring so the agent can extend it without ceremony. Next.js 15 with the App Router and Turbopack for instant dev reloads. React 19, TypeScript 5, Tailwind v4 (the new CSS-first config with OKLCH color tokens). `lucide-react` for icons, `recharts` for sparklines, `gray-matter` so the welcome copy lives in editable markdown next to the code. Playwright drives a headless Chromium for the marketing screenshots so I can refresh them in seconds, against a production build, with the dev-tools indicator suppressed.

The whole thing lives in `apps/my-aria/` of the open-source [Tula](https://github.com/realactivity/tula) repo, side by side with `aria-web`. It reads FHIR off disk from `~/.openclaw/workspace/tula/fhir/` - whatever the agent pulled overnight is what the UI renders the next morning. One data-source seam, one app, one VM. There is no SaaS in the loop, no analytics tag, no third-party CDN. The footer literally says `single user / local data / private network`.

"Vibe coded" is not a synonym for sloppy. The agent pair-programmed every component with me in Cursor. I picked the taxonomy and the design tokens; the agent generated the FHIR R4 types, the synthetic fixtures, the Tailwind tokens, the Playwright capture script, and most of the prose copy. I rewrote what I disagreed with. We typechecked and built after every meaningful change. Every commit on `main` is a working production build.

## A sidebar that encodes data sovereignty

The real design move is the **taxonomy**. Most patient portals organize by hospital module - Labs, Visits, Messages, Imaging - because they reflect the org chart of the EHR vendor. My Aria organizes by **where the data actually came from across your lifetime**, because that is the only organization principle that survives the next employer change, the next move, the next specialist:

- **Patient portals** - Dashboard, lab results, medications, messages, appointments. FHIR-shaped chart data from SMART on FHIR pulls. The plural matters. I am not building for a single health system; I am building for someone who will accumulate portals across a lifetime.
- **Longitudinal feeds** - Wearables (Garmin, Oura, Whoop, Withings, Apple Health), medical imaging, genomic reports, and de-identification for the day you want to hand a redacted copy to another AI or a researcher.
- **Home devices** - One hub, not five sidebar links. BP cuffs, scales, glucometers, pulse oximeters, thermometers. Clinically distinct from wearables: episodic peripherals you use at home, often the numbers your PCP actually quotes back to you.
- **Intelligent Nutrition** - MyFitnessPal feeds the meal log; Tula correlates it. Overview, Food x Glucose (CGM curves overlaid with logged meals), and a clinical Diet plan scored against an actual recommended pattern.
- **Intelligent SDOH** - Air quality, demographics, and social-determinant signals extracted from agent chats. More on this below.
- **Intelligent Travel** - Business and personal trips as health perturbations: trips, on-trip vitals vs home baseline, and care away from home for the ZIP you are currently in.

This is the durable visual layer where the longitudinal record actually compounds. A FHIR Observation from Cleveland Clinic in 2014 sits next to a 2026 Garmin HRV reading sits next to a Z59.41 food-insecurity signal pulled from a Telegram thread last week. Same record. Same patient. Same person.

## ZIP code is more than air quality

A ZIP code is the cheapest, most under-used data input in clinical medicine.

My Aria pulls **air quality** from AirNow (AQI, PM2.5, ozone, primary pollutant, plain-English summary) so when I am scheduling pulmonary rehab or my morning run, I see the air I am about to breathe. But the same ZIP unlocks Census ACS demographics: median household income, poverty rate, uninsured rate, SNAP participation, median rent and rent-burden percentage, unemployment, educational attainment, limited-English households, single-parent households, and the no-vehicle rate. Tula folds those into a **food-insecurity risk** and a **housing-instability risk** tag at the neighborhood level.

That is the structural backdrop your PCP almost never gets to see. When you travel for business and your ZIP changes for a week, the SDOH picture changes with it. Intelligent Travel ties the two together, so your "where I was" history is annotated with the SDOH of every "where", not just the one on your insurance card.

## Your chat history is a social-determinant data source

Here is the part that does not exist in any EHR I have ever logged into.

![AI Chats to SDOH Extraction](apps/my-aria/public/my-aria-ai-chats.png)

Tula scans your agent conversations - Telegram check-ins, portal-message drafts, SMS - and extracts structured social-determinant signals. Each scanned thread keeps its source, a quoted excerpt, and a list of signals with a theme, the evidence string the model pulled, a confidence flag, and an ICD-10 Z code where one applies. Z59.x for socioeconomic risk, Z77.x for environmental exposure.

"I've been taking the bus to chemo because my car broke down" becomes a high-confidence Z59.82 transportation-access entry, with the exact sentence retained as evidence. "We're stretching groceries until the 3rd" becomes Z59.41 food insecurity. A draft portal message about a 30-day notice becomes Z59.1 housing instability. The smog complaint becomes Z77.118 environmental exposure plus a physical-activity barrier.

The same Tula skill that drafts your portal replies reads them back as structured chart data. That is the loop: the agent acts on your behalf, then files the lived experience of acting on your behalf into your longitudinal record. No nurse intake form, no annual screener with five Likert items, no checkbox a busy PCP forgets to click. Just the chat you were already having, lifted into a place a future agent can act on.

## Home devices, not "device integration"

![Home Devices Hub](apps/my-aria/public/my-aria-home-devices.png)

One sidebar link, one page, five categories: blood pressure, weight and body composition, glucose and CGM, pulse ox and heart rhythm, and temperature. Each category lists the vendors people actually own (Omron, Withings, Dexcom, FreeStyle Libre, Kardia) and explains how the reading will land as a FHIR Observation alongside the portal data. I renamed "Device integration" to **Wearables** under Longitudinal feeds so I would stop conflating a Garmin with an Omron. They are clinically different surfaces; the sidebar should respect that.

## Three names, one repo

- **Tula** is the open-source agent and skill layer running on my VM under Apache 2.0. It performs the SMART on FHIR pull, parses the Quest PDF, drafts the portal reply, and runs the daily pulse. The agent persona is named Tula.
- **My Aria** is what this article is about: the open-source personal patient-portal UI in `apps/my-aria/` that sits *on top of* Tula. The surface you and your caregivers look at. A RealActivity sub-brand. Not Epic, not MyChart, not a medical device.
- **Aria** (no "My") is RealActivity's separate hospital-scale platform - one agent per patient under multi-tenant governance. Different repo, different license, not this article.

If SMART on FHIR is the pipe and Tula is the plumbing, **My Aria is your faucet**.

## The perfect patient chart, finally

For thirty years the patient chart has been built by hospital IT for billing, by EHR vendors for hospital IT, by health plans for actuarial workflows, and by exactly nobody for the patient.

My Aria flips the org chart. Built **by a patient, for the patient**, with an agent that holds the OAuth tokens, the file system, the inbox, the wearable feeds, the ZIP code, and the chat history - all on hardware you own. The chart finally belongs to the person it is about. That is not a marketing line. That is what `single user / local data / private network` in the footer literally means.

**Repo**: [github.com/realactivity/tula](https://github.com/realactivity/tula) - the app lives in `apps/my-aria/`.

Steal the sidebar taxonomy. Tell me which home device category you want prioritized next. Let me know what your Telegram thread with your own agent reveals about your social-determinant profile.

- Paul

---

*Disclaimer: My Aria is open-source software for personal health organization and health literacy. It is not a medical device, not FDA-cleared, and not intended to diagnose, treat, cure, or prevent any disease. Talk to your doctor about anything that matters.*
