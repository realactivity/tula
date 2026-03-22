# Cost Guide

Running costs vary based on usage. All figures are estimates. Actual costs depend on which skills are enabled, usage frequency, and model routing.

## Standard Usage

Text-based journaling, daily check-ins, web search, periodic laboratory result parsing:

| Item | Monthly |
|------|---------|
| Azure B2s VM (Ubuntu) | ~$30 |
| Anthropic API (Claude Sonnet) | ~$5 - $15 |
| Gemini API (Web Search) | ~$0 - $5 |
| **Total** | **~$35 - $50** |

## Intensive Usage

All of the above, plus medical image interpretation (DICOM), genomic report analysis, frequent research synthesis, voice transcription:

| Item | Monthly |
|------|---------|
| Azure B2s VM (Ubuntu) | ~$30 |
| Anthropic API (Claude Sonnet/Opus) | ~$20 - $75 |
| OpenAI API (Whisper) | ~$1 - $5 |
| Gemini API (Web Search) | ~$0 - $5 |
| **Total** | **~$51 - $115** |

## Cost Considerations

Image-intensive skills such as DICOM interpretation consume significantly more tokens than text-based skills. A single imaging study processed through multimodal AI capabilities may cost 10 to 50 times more than a text-based laboratory report. Genomic reports containing thousands of variants are similarly token-intensive. Tula's skill routing directs each task to the most appropriate model, using lightweight models for routine queries and more capable models for complex clinical interpretation, to optimize cost-effectiveness without compromising quality.

## Healthcare Model Cost Scenarios

Tula's deployment-context-aware routing significantly affects cost. The following scenarios illustrate how model selection impacts monthly spend for intensive usage:

| Configuration | Medical Imaging | Lab Parsing | Speech | Monthly Estimate |
|---|---|---|---|---|
| Azure-native (MedImageInsight + Claude Foundry) | Azure compute pricing | Claude tokens (MACC eligible) | Azure Speech | ~$60 - $120 |
| Cloud API (MedGemma Vertex + Claude API) | Vertex AI pricing | Vertex AI + Claude tokens | Vertex AI | ~$50 - $100 |
| Self-hosted MedGemma + Claude API | VM compute only | VM compute + Claude tokens | VM compute | ~$35 - $60 |
| Fully self-hosted (MedGemma + local LLM) | VM compute only | VM compute only | VM compute only | ~$30 (VM only) |

Self-hosted MedGemma 4B can reduce medical imaging API costs to zero. The primary cost in a fully self-hosted deployment is the VM compute itself. This is particularly relevant for global health equity deployments where API fees are prohibitive.

For Azure-native users, Microsoft Healthcare AI model usage and Claude in Foundry are eligible for Microsoft Azure Consumption Commitment (MACC), meaning usage can be applied against existing Azure agreements.

For the complete routing matrix and model details, see the [model routing reference](model-routing.md).

## Recommendations

- Configure spending limits on API provider dashboards.
- Begin with text-based skills and add image-intensive skills after establishing baseline usage.
- Use Claude Sonnet as the default reasoning model and route to Opus selectively for complex interpretation tasks.
- For medical imaging: deploy MedGemma 4B locally to avoid per-image API costs, or use Microsoft MedImageInsight through Azure Foundry if on an Azure agreement.
- For medical speech: use MedASR (self-hosted, free) instead of Whisper for medical dictation. MedASR achieves 5.2% word error rate compared to 28.2% for Whisper on medical speech.
- For Azure partners: route through Azure Foundry to apply costs against MACC commitments.

## Billing

No subscription fees. No platform lock-in. Users provide their own API keys. All costs are billed directly by the respective API providers (Anthropic, Google, OpenAI) and Microsoft Azure based on actual consumption.
