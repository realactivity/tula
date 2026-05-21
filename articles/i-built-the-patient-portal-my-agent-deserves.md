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

*Epic spent decades teaching you to log into their chart. I spent an afternoon teaching my agent to show me mine - on my server, from five hospitals, with a sidebar that knows the difference between a portal, a Garmin, and a ZIP code.*

*May 20, 2026*

Two weeks ago I wrote about the day SMART on FHIR worked on the first try. OAuth to a real hospital, encrypted bundle, full medical history dropped onto a Linux box I control. That story ends where most health-tech demos end - with proof that the pipe works.

It does not end with proof that *you* can live inside the pipe.

A JSON dump is not a patient experience. So I built one. I call it **My Aria**.

![My Aria Dashboard](apps/my-aria/public/my-aria-dashboard.png)

## What I refused to build, and the three names you need

My Aria lives in the open-source [Tula](https://github.com/realactivity/tula) repo beside `aria-web`. Same stack: Next.js 15, TypeScript, Tailwind v4, dark-first, burgundy accent.

Three names do real work here:

- **Tula** - the open-source agent and skill layer.
- **My Aria** - the personal patient-portal UI you're looking at (`apps/my-aria/`).
- **Aria** - RealActivity's separate hospital-scale platform (different repo).

**Disclaimers** are prominent on every page: Personal demo. Open-source. Not affiliated with Epic or MyChart. Not a medical device.

## A sidebar that encodes data sovereignty

The real breakthrough is the **taxonomy**. Most portals organize by hospital modules. My Aria organizes by **where the data actually comes from** across a person's lifetime:

- **Patient portals**
- **Longitudinal feeds** (wearables, imaging, genomics)
- **Home devices** (BP cuffs, scales, glucometers - clinically distinct from wearables)
- **Intelligent Nutrition**
- **Intelligent SDOH**
- **Intelligent Travel**

![AI Chats → SDOH Extraction](apps/my-aria/public/my-aria-ai-chats.png)

## Dashboard as command surface

The home screen is calm, dense, and actually useful two minutes before a cardiology appointment.

![Home Devices View](apps/my-aria/public/my-aria-home-devices.png)

It includes:
- Upcoming appointments
- Recent labs with sparklines and smart flags
- Active medications
- Quick actions (Schedule, Message, Refill, Download full FHIR)
- Clear sections for planned features (Longitudinal Feeds, De-identification, etc.)

## Why this matters

Tula gives patient agency via legal access + operational skills.  
**My Aria** gives you the durable visual layer where it all compounds - a single surface you and your caregivers can actually use.

If SMART on FHIR is the pipe and Tula is the plumbing, My Aria is *your* faucet.

**Repo**: [github.com/realactivity/tula](https://github.com/realactivity/tula) - app lives in `apps/my-aria/`

Steal the sidebar taxonomy. Let me know which home device category you want prioritized next.

- Paul

---

*Disclaimer: My Aria is open-source software for personal health organization and health literacy. It is not a medical device, not FDA-cleared, and not intended to diagnose, treat, cure, or prevent any disease. Always work with qualified healthcare providers.*
