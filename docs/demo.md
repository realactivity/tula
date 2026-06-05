# Live Demo

**17-minute walkthrough** of Tula on the AI Agent and Copilot Podcast (May 14, 2026).

**Watch now:** [OpenClaw-Powered Healthcare Assistant Builds Patient Agency](https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/)

**Jump to Epic MyChart and live features:** start at **10:05** in your player.

---

## What you will see

Paul Swider (RealActivity) walks through Tula: a self-hosted personal health agent
built on [OpenClaw](https://github.com/openclaw/openclaw), running on a Linux VM the
patient owns. The demo covers patient agency, open-source posture, and capabilities
that are live in this repo today.

| Timestamp | Topic |
|---|---|
| **1:23** | Why Tula exists - patient agency, health equity, personal motivation |
| **4:28** | OpenClaw on Ubuntu, owning your agent vs renting SaaS agents |
| **10:05** | **Core features** - health data ingest, MedPDF, portal workflows, live retrieval |
| **~15:00** | Open source, contributors, scale, and commercial path (Aria) |

At **10:05** the conversation moves into concrete product behavior: pulling and
working with real health data, healthcare-specific PDF parsing (`med-pdf`), and the
kind of portal-connected workflows the [`health-records`](../skills/health-records/)
skill enables via SMART on FHIR.

This is not a synthetic-data UI mock. Tula is built to survive real hospital OAuth
and FHIR endpoints. See also
[I gave an AI agent OAuth access to my hospital](https://www.paulswider.com/p/i-gave-an-ai-agent-oauth-access-to)
for the technical write-up behind the demo.

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

## Share this demo

Copy-paste for social posts:

```
Watch Tula pull live Epic MyChart records into a self-hosted health agent you own (demo starts at 10:05):
https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/

Open source (Apache 2.0): https://github.com/realactivity/tula
```

---

## GitHub repository About link

Repo maintainers: set the GitHub **About** website field to the podcast URL so the
link appears next to the repo description on the main page:

1. Open [github.com/realactivity/tula](https://github.com/realactivity/tula)
2. Click the gear icon next to **About**
3. **Website:** `https://agentandcopilot.com/cloud-wars-minute/ai-agent-and-copilot-podcast-openclaw-powered-healthcare-assistant-builds-patient-agency/`
4. Optional **Description:** `Open-source personal health AI agent. Live demo (Epic MyChart at 10:05).`

This page (`docs/demo.md`) is the canonical in-repo guide; the About widget should
point at the video for one-click access from GitHub.

---

## See also

- [Example flows](example-flows.md) - end-to-end scenarios after deploy
- [Architecture](architecture.md) - how components fit together
- [Roadmap](roadmap.md) - what is live vs in progress
- [Patient Agent Eval Standard v0.1](../evals/README.md) - how we test patient-side AI
