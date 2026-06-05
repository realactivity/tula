# Videos

Two ways to see Tula: a **screen-recorded live demo** (start here) and a **podcast interview** (story and context).

---

## Live demo (YouTube) - start here

**~16 minutes.** Screen recording of Tula running on a self-hosted VM: Telegram chat, live SMART on FHIR record pull, and the My Aria patient chart.

| | |
|---|---|
| **Watch** | [Tula - The Open-Source Personal Health AI Agent (Live Demo)](https://youtu.be/FcLl6fASpgw) |
| **Epic MyChart retrieval** | Jump to **[10:00](https://youtu.be/FcLl6fASpgw?t=600)** |
| **Published** | May 25, 2026 (RealActivity) |

### What you will see

- Tula on Telegram analyzing real longitudinal data (BP, wearables, genomics context)
- Live **SMART on FHIR** portal connect and record pull (patient-initiated, not agent-automated OAuth)
- Agent grounded in pulled FHIR bundles answering questions from your chart
- Preview of **My Aria** - patient-owned chart UI inspired by portal UX, built for multi-hospital life

This is the best entry point if you want to **see the product work** before reading the repo.

Technical background for the records pull:
[I gave an AI agent OAuth access to my hospital](https://www.paulswider.com/p/i-gave-an-ai-agent-oauth-access-to).

---

## Podcast interview (AI Agent and Copilot)

**~17 minutes.** Conversation with Paul Swider on why Tula exists, OpenClaw vs rented SaaS agents, open source, and health equity.

| | |
|---|---|
| **Listen / watch** | [OpenClaw-Powered Healthcare Assistant Builds Patient Agency](https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/) |
| **Published** | May 14, 2026 |

### Chapter guide (podcast)

| Timestamp | Topic |
|---|---|
| **1:23** | Why Tula exists - patient agency, health equity, personal motivation |
| **4:28** | OpenClaw on Ubuntu; owning your agent vs renting SaaS agents |
| **10:05** | Core capabilities - ingest, MedPDF, portal workflows |
| **~15:00** | Open source, contributors, scale, commercial path (Aria) |

Use this episode when you want the **narrative and positioning**, not the screen recording.

---

## After you watch

| If you are... | Start here |
|---|---|
| Ready to run it yourself | [`deployment-guide.md`](deployment-guide.md) |
| Evaluating skills or contributing | [`skills-development.md`](skills-development.md) |
| A hospital or health system | [`enterprise-pilots.md`](enterprise-pilots.md), [`aria-commercial-platform.md`](aria-commercial-platform.md) |
| Curious about the mission | [`patient-agency.md`](patient-agency.md) |
| Checking safety boundaries | [`safety-and-disclaimer.md`](safety-and-disclaimer.md) |

Clone and explore:

```bash
git clone https://github.com/realactivity/tula.git
cd tula
```

Epic MyChart / SMART on FHIR setup: [`skills/health-records/`](../skills/health-records/)
and [`services/wren/`](../services/wren/) (self-hostable records relay).

---

## Share

**Live demo (YouTube):**

```
Watch Tula pull live Epic MyChart records on hardware you control (jump to 10:00):
https://youtu.be/FcLl6fASpgw?t=600

Open source (Apache 2.0): https://github.com/realactivity/tula
```

**Podcast:**

```
Why we need patient-owned health agents (17-min interview):
https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/
```

---

## GitHub repository About link

Set the GitHub **About** website field to the **YouTube live demo** (primary entry point):

1. Open [github.com/realactivity/tula](https://github.com/realactivity/tula)
2. Click the gear icon next to **About**
3. **Website:** `https://youtu.be/FcLl6fASpgw`
4. Optional **Description:** `Open-source personal health AI agent. Live demo on YouTube (Epic MyChart at 10:00).`

This page (`docs/demo.md`) links both videos; the About widget should point at YouTube for one-click access from the repo home page.

---

## See also

- [Example flows](example-flows.md) - end-to-end scenarios after deploy
- [Architecture](architecture.md) - how components fit together
- [Roadmap](roadmap.md) - what is live vs in progress
- [Patient Agent Eval Standard v0.1](../evals/README.md) - how we test patient-side AI
