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

## Recommendations

- Configure spending limits on API provider dashboards.
- Begin with text-based skills and add image-intensive skills after establishing baseline usage.
- Use Claude Sonnet as the default model and route to Opus selectively for complex interpretation tasks.

## Billing

No subscription fees. No platform lock-in. Users provide their own API keys. All costs are billed directly by the respective API providers (Anthropic, Google, OpenAI) and Microsoft Azure based on actual consumption.
