# 🧬 Tula - Your Personal Health AI Agent

**Tula** is an open-source collection of [OpenClaw](https://github.com/openclaw/openclaw) skills, configurations, and patterns designed to transform a general-purpose AI agent into a personal health intelligence assistant.

Named after a brilliant, strong woman - a Mensa member and mother of five - Tula embodies sharp intelligence, warmth, and directness in service of one goal: **helping individuals take an active, informed role in their health.**

## Why This Matters

Tula exists because health is not abstract. Behind every biomarker is a person. Behind every caregiver is someone they love.

The people building this project are not doing so as a technical exercise. One of us is building Tula because he lost a parent to cancer and carries hereditary risk factors he is determined to monitor proactively. Another is building it because his wife is undergoing cancer treatment, and the demands of caregiving alongside daily life require better tools for tracking medications, understanding test results, and staying organized across multiple providers. Both need the same thing: an AI that consolidates health data, provides context, and highlights what matters, without selling it, sharing it, or placing it behind a subscription.

That is the core insight. The architecture that supports a healthy individual in tracking wellness metrics is the same architecture that supports a patient in managing treatment adherence, or a caregiver in coordinating complex care. It is not three different products. It is one platform that adapts to the user's needs.

Whether you are here to support long-term health, manage a condition, or help someone you love navigate a difficult diagnosis, Tula is designed to serve your needs.

Caregivers deserve dedicated support. Medication adherence, appointment coordination, treatment journaling, and caregiver wellbeing tracking are primary use cases for Tula, not secondary features.

## What Is This?

Tula is **not** a standalone application. It is a health-focused skill layer built on top of OpenClaw, providing the following capabilities:

- 📧 **Intelligent Email Ingestion** - Forward any health-related correspondence to Tula for automatic classification and routing. Tula identifies the content type (laboratory results, imaging studies, explanation of benefits, appointment confirmations, prescription notifications, provider messages) and routes each item to the appropriate skill for processing and structured storage.
- 🧪 **Laboratory Result Parsing** - Automated extraction of biomarker values, units, and reference ranges from laboratory report PDFs. Longitudinal trend tracking with out-of-range flagging.
- 🩻 **Medical Image Interpretation** - Support for DICOM imaging studies including MRI, CT, radiograph, mammography, and ultrasound. Tula provides plain-language annotation of key findings, medical terminology translation, and longitudinal comparison across sequential studies. Integrates with laboratory and clinical record data for comprehensive context.
- 🧬 **Genomic Health Reports** - Import and analysis of consumer genomic data (e.g., 23andMe) to identify clinically relevant genetic variants and correlate predispositions with current biomarker profiles and care protocols.
- 🏥 **Electronic Health Record Integration** - Retrieval of medical history, visit summaries, and provider documentation from patient portals via FHIR R4 and patient access APIs.
- ⌚ **Wearable Device Integration** - Synchronization of daily physiological metrics from compatible wearable devices (e.g., Garmin), including heart rate variability (HRV), resting heart rate, sleep architecture, and stress indicators.
- 🩺 **Home Health Device Integration** - Connectivity with Bluetooth and Wi-Fi enabled home monitoring devices including blood pressure monitors, body composition scales, pulse oximeters, and glucose meters for continuous, passive data collection.
- 📓 **Patient Health Journal** - Structured daily check-ins via Telegram for tracking sleep quality, energy levels, mood, symptom burden, and treatment protocol adherence.
- 💼 **Professional Journal** - Business-focused note capture with automated daily summaries, weekly synthesis, and searchable history.
- 🔬 **Research Synthesis** - Scheduled retrieval and summarization of current peer-reviewed literature and clinical evidence relevant to the user's health profile and active protocols.
- 🗣️ **Voice Input** - Speech-to-text transcription of Telegram voice messages for hands-free interaction.
- 🔒 **De-Identification** - Removal of protected health information (PHI) from health documents prior to sharing, export, or use in research contexts. Designed to support HIPAA Safe Harbor de-identification principles.

## Who Tula Is For

Tula supports patients navigating complex illness, caregivers, individuals managing chronic conditions, those with hereditary risk factors, and anyone focused on preventive health and wellness. See the [detailed use cases](docs/use-cases.md) for more information.

## Architecture

```
User Interface (Telegram / Email / Voice)
        |
Data Sources
  |-- Email Inbox (automated classification and routing)
  |-- Laboratory PDFs (Quest Diagnostics, LabCorp, institutional labs)
  |-- Genomic Reports (23andMe, AncestryDNA, clinical panels)
  |-- EHR / Patient Portal (FHIR R4 API)
  |-- Wearable Devices (Garmin, compatible devices)
  |-- Home Health Devices (BP monitors, scales, pulse oximeters, glucose meters)
        |
OpenClaw Gateway (Azure B2s, Ubuntu 24.04 LTS)
        |
Tula Skills (this repository)
  |-- Email Router (classification and skill routing)
  |-- Laboratory Parser
  |-- Medical Image Interpreter (DICOM)
  |-- Genomic Analyzer
  |-- EHR Connector (FHIR R4)
  |-- Biomarker Tracker
  |-- Patient Health Journal
  |-- Professional Journal
  |-- Wearable Sync
  |-- Home Device Sync
  |-- De-Identification Engine
  |-- Research Synthesis
        |
AI Models (Anthropic Claude Sonnet / Opus, Google Gemini)
        |
SQLite (local storage, user-controlled)
```

## Getting Started

### Prerequisites

- An [OpenClaw](https://github.com/openclaw/openclaw) instance (see our [Deployment Guide](docs/deployment-guide.md))
- An Azure VM (B2s is sufficient, approximately $30/month) or any server running Ubuntu 24.04 LTS
- API keys for [Anthropic](https://console.anthropic.com) (Claude) and [Google AI Studio](https://aistudio.google.com) (Gemini)
- A Telegram account

### Quick Start

1. **Deploy OpenClaw** - Follow the [step-by-step deployment guide](docs/deployment-guide.md). The guide covers the complete process from Azure VM creation to Telegram integration. It is written to be accessible to administrators without prior Linux experience.

2. **Install Tula Skills** - Coming soon. Skills will be installable via ClawHub or by copying skill directories into the OpenClaw workspace.

3. **Configure Data Sources** - Set up email forwarding for laboratory results, connect wearable and home health devices, and configure check-in schedules.

## Project Status

This project is in **early development**. Current status:

| Component | Status |
|-----------|--------|
| Deployment Guide | ✅ Complete |
| OpenClaw Setup | ✅ Complete |
| Telegram Integration | ✅ Complete |
| Intelligent Email Ingestion and Router | 📋 Planned |
| Laboratory Parser Skill | 🔨 In Progress |
| Medical Image Interpretation (DICOM) | 📋 Planned |
| Patient Health Journal Skill | 🔨 In Progress |
| Professional Journal Skill | 🔨 In Progress |
| Wearable Device Integration | 📋 Planned |
| Genomic Report Import | 📋 Planned |
| EHR / Patient Portal Connector (FHIR R4) | 📋 Planned |
| Home Device Sync (BP, Scale, Pulse Ox) | 📋 Planned |
| De-Identification Engine | 📋 Planned |
| Research Synthesis | 📋 Planned |
| Voice Transcription (Whisper) | 📋 Planned |
| Medication Adherence (IoT) | 💡 Community Idea |
| Caregiver Dashboard | 💡 Community Idea |

## Contributing

Contributions are welcome. Tula is built as a set of standard OpenClaw skills. Contributors familiar with OpenClaw can begin contributing immediately.

**Ways to contribute:**

- **Report issues** - If something does not work as expected, open an issue. Detailed bug reports are among the most valuable contributions at this stage.
- **Propose a health skill** - We are tracking community ideas in [Discussions](../../discussions).
- **Build a skill** - Review the [skill template](skills/TEMPLATE/) for the expected structure. Submit a pull request.
- **Improve documentation** - The deployment guide was written during a real setup session. If any section is unclear or outdated, improvements are appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines. See the [community skill ideas](docs/community-skills.md) for a full list of skills we would like to build.

## Principles

- **Patient empowerment through health literacy.** Tula translates clinical information into language that supports informed decision-making.
- **Data sovereignty.** All data is stored locally on the user's own server. No cloud health platforms. No third-party data sharing.
- **Caregiver recognition.** Caregiver support is a core use case, not a secondary consideration.

See the [full principles](docs/principles.md) for our complete set of values and commitments.

## Cost

Running Tula costs approximately **$35 - $115/month** depending on usage, from text-based journaling and laboratory parsing at the low end to medical image interpretation and genomic analysis at the high end. No subscription fees. No platform lock-in. Users provide their own API keys. See the [cost guide](docs/cost-guide.md) for a detailed breakdown.

## Background

This project originated as a personal build by a Windows Server administrator of 25 years deploying his first native Linux server to run an AI health agent. The [deployment guide](docs/deployment-guide.md) was written in real time as issues were encountered and resolved. It documents the actual experience, including common errors and their solutions.

Tula is a [RealActivity](https://realactivity.com) initiative.

## Founding Contributors

- **Paul Swider** - Creator. Health data integration, laboratory parsing, wearable integration, infrastructure.
- **Sal Rosales** - Medical adherence, caregiver tools, IoT integration.

## License

MIT - see [LICENSE](LICENSE). The code is free to use, modify, and distribute.

"Tula" and "RealActivity" are trademarks of RealActivity. The MIT license covers the code, not the name. See [TRADEMARK.md](TRADEMARK.md) for details.

## Disclaimer

Tula is an open-source software tool intended to support personal health data organization and health literacy. It is not a medical device, not FDA-cleared or approved, and not intended to diagnose, treat, cure, or prevent any disease or medical condition. Tula does not provide clinical decision support and should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always seek the guidance of qualified healthcare providers with any questions regarding a medical condition. If you are experiencing a medical emergency, contact your local emergency services immediately.

---

*Your health. Your data. Your AI. Whatever your journey, Tula is here to help.* 🧬
