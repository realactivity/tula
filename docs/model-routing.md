# Model Routing

Tula uses deployment-context-aware model routing to direct each task to the most capable, cost-effective, and privacy-appropriate AI model available in the user's environment. This document serves as the authoritative reference for model selection across all Tula skills.

## Routing Philosophy

Tula is model-agnostic by design. It does not prescribe a single model stack. Instead, it routes based on two dimensions:

1. **Task type**: What category of model is best suited for this specific task?
2. **Deployment context**: What models are available and affordable in this user's environment?

This approach ensures that an academic medical center on Azure and a community health center running a self-hosted instance on a $30/month VM can both use Tula effectively, with each receiving the best model selection their environment supports.

## Deployment Contexts

### Azure-Native

For organizations, Microsoft partners, and individuals using Azure as their primary cloud platform. Models are accessed through Azure Foundry with enterprise governance, DICOMweb and FHIR integration, and billing through existing Azure agreements (MACC eligible).

Available healthcare models:
- Microsoft MedImageInsight (medical image embeddings)
- Microsoft CXRReportGen (chest X-ray report generation)
- Microsoft MedImageParse (medical image segmentation)
- Claude in Foundry (clinical reasoning with healthcare-specific tools)
- Azure Speech Services (speech-to-text with medical vocabulary)
- GPT-4o / GPT-4o mini (general reasoning and lightweight tasks)

### Self-Hosted / Low-Resource

For community health deployments, global health equity use cases, and cost-conscious individuals. Models run locally on the user's own hardware or a low-cost VM, with no API fees and no data leaving the local environment.

Available healthcare models:
- Google MedGemma 4B multimodal (medical imaging and text, runs on modest hardware)
- Google MedGemma 27B text (medical text reasoning, requires more compute)
- Google MedASR (medical speech-to-text)
- Qwen, Llama, and other open-weight models (general tasks)
- Claude API (when API access is available and funded)

### Hybrid

For users who want the best of both contexts. Use Azure healthcare models for complex tasks and self-hosted models for routine work, optimizing both accuracy and cost.

## Routing Matrix

| Task | Azure-Native Model | Self-Hosted Model | Rationale |
|---|---|---|---|
| Chest X-ray interpretation | MedImageInsight + CXRReportGen | MedGemma 4B multimodal | Azure has purpose-built CXR model; MedGemma covers broader imaging locally |
| CT/MRI interpretation | MedImageInsight + Claude in Foundry | MedGemma 4B/27B multimodal | Azure offers managed DICOM pipelines; MedGemma 1.5 supports 3D volumes |
| Histopathology analysis | MedImageInsight + Claude in Foundry | MedGemma 4B multimodal | Both support whole-slide imaging analysis |
| Medical image segmentation | MedImageParse | MedGemma + custom adapter | MedImageParse is purpose-built for segmentation |
| Lab report text extraction | Claude in Foundry | MedGemma 27B text | MedGemma 1.5 achieves 78% F1 on lab extraction (+18% over v1) |
| EHR text interpretation | Claude in Foundry | MedGemma 27B text | MedGemma 1.5 achieves 90% on EHRQA (+22% over v1) |
| Email classification | Claude Sonnet (Foundry) | Claude API or capable local LLM | General reasoning task |
| Clinical reasoning and synthesis | Claude Sonnet/Opus (Foundry) | Claude API | Claude excels at multi-step reasoning across data sources |
| Biomarker trend analysis | Claude Sonnet/Opus (Foundry) | Claude API | Requires cross-referencing multiple data sources |
| Genomic variant interpretation | Claude Opus + MedGemma 27B | MedGemma 27B + Claude API | Requires both medical knowledge and complex reasoning |
| Medical speech transcription | Azure Speech Services or MedASR | MedASR | MedASR: 5.2% WER vs. Whisper 28.2% on medical dictation |
| General speech transcription | Azure Speech Services or Whisper | Whisper | Non-medical voice messages |
| Research synthesis | Claude Sonnet/Opus + Gemini Search | Claude API + Gemini Search | Requires web search plus reasoning |
| Daily check-ins, journaling | GPT-4o mini or Gemini Flash | Qwen or Llama (local) | Lightweight, cost-efficient |
| Complex clinical workflows | Healthcare Agent Orchestrator + Claude | MedGemma + Claude API | Microsoft's orchestrator designed for tumor board coordination |

## Fallback Chains

When a preferred model is unavailable or returns an error, Tula falls back through the chain in order:

**Medical imaging:**
MedImageInsight/CXRReportGen (Azure) -> MedGemma 4B multimodal (self-hosted) -> Claude multimodal (API) -> Flag for manual review

**Medical text extraction:**
MedGemma 27B text -> Claude Sonnet -> GPT-4o -> General-purpose local LLM

**Medical speech:**
MedASR -> Azure Speech Services (medical) -> Whisper -> Text input fallback

**Clinical reasoning:**
Claude Opus -> Claude Sonnet -> GPT-4o -> MedGemma 27B text

**General tasks:**
Gemini Flash -> GPT-4o mini -> Qwen (local) -> Llama (local)

## Healthcare Model Details

### Google MedGemma

MedGemma is Google's collection of open models for medical text and image comprehension, built on Gemma 3 and released under the Health AI Developer Foundations program.

| Variant | Parameters | Modality | Key Capabilities |
|---|---|---|---|
| MedGemma 1.5 4B | 4 billion | Text + Image | CT/MRI 3D volumes, histopathology WSI, chest X-ray time series, lab report extraction, anatomical localization. Runs on modest hardware. |
| MedGemma 1 27B | 27 billion | Text only | Medical text reasoning, EHR interpretation, clinical Q&A. MedQA score: 87.7%. |
| MedGemma 1 27B | 27 billion | Text + Image | All 27B text capabilities plus medical image analysis. |

Availability: Hugging Face (free download), Google Cloud Vertex AI (pay-per-use with DICOM support).

### Google MedASR

Medical speech recognition model fine-tuned for clinical dictation and spoken prompts. Achieves 5.2% word error rate on medical dictation compared to 28.2% for Whisper large-v3.

Availability: Hugging Face (free download), Google Cloud Vertex AI.

### Microsoft Healthcare AI Models (Azure Foundry)

| Model | Type | Key Capabilities |
|---|---|---|
| MedImageInsight | Image embedding | Classification and similarity search across X-ray, CT, MRI, dermoscopy, histopathology, ultrasound, mammography. Supports zero-shot classification and adapter training. |
| CXRReportGen | Report generation | Purpose-built chest X-ray report generation from imaging data. |
| MedImageParse | Image segmentation | Identifies and outlines anatomical structures and abnormalities in medical images. |
| Healthcare Agent Orchestrator | Agent framework | Open-source orchestrator for complex clinical workflows (tumor boards, multidisciplinary review). Built on Azure Foundry. |

Availability: Azure Foundry model catalog. Requires Azure subscription. MACC eligible.

### Claude in Azure Foundry (Healthcare)

Anthropic's Claude models deployed through Azure Foundry with healthcare-specific tools, connectors, and skills. Supports clinical research, documentation review, prior authorization workflows, and care coordination. Uses standard Anthropic API pricing, billed through Azure (MACC eligible).

## Cost Implications

| Configuration | Medical Imaging | Lab Parsing | Speech | Monthly Estimate (Intensive Use) |
|---|---|---|---|---|
| Azure-native (full) | Azure compute pricing | Claude Foundry tokens (MACC) | Azure Speech pricing | ~$60 - $120 |
| Cloud API (MedGemma Vertex + Claude API) | Vertex AI pricing | Vertex AI + Claude tokens | Vertex AI pricing | ~$50 - $100 |
| Self-hosted (MedGemma local + Claude API) | VM compute only | VM compute + Claude tokens | VM compute only | ~$35 - $60 |
| Fully self-hosted (MedGemma + local LLM) | VM compute only | VM compute only | VM compute only | ~$30 (VM only) |

Self-hosted MedGemma 4B can reduce medical imaging API costs to zero. The primary cost in a fully self-hosted deployment is the VM compute itself.

## Privacy Considerations

- **Self-hosted models** (MedGemma, MedASR, open-weight LLMs): Health data never leaves the local server. Maximum privacy.
- **Azure Foundry models**: Data processed within Azure's compliance boundary. Subject to Azure's data handling policies and the user's enterprise agreements.
- **Cloud API models** (Anthropic API, Google Vertex AI): Data is transmitted to the provider's infrastructure. Subject to the provider's data retention and privacy policies. Use providers with zero data retention options for sensitive health data.

Skills should document which models they use and the privacy implications of each routing path. Users should be informed when health data is sent to cloud APIs.

## Configuration

Model routing is configured at the skill level. Each Tula skill specifies its recommended model for each task and the fallback chain. Users can override model selection in their OpenClaw workspace configuration.

Detailed configuration instructions for each model provider will be added as integration skills are developed. For current deployment instructions, see the [deployment guide](deployment-guide.md).

## References

- [Google MedGemma](https://developers.google.com/health-ai-developer-foundations/medgemma)
- [Google MedASR](https://research.google/blog/next-generation-medical-image-interpretation-with-medgemma-15-and-medical-speech-to-text-with-medasr/)
- [Microsoft Healthcare AI Models](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/healthcare-ai/healthcare-ai-models)
- [Microsoft Healthcare Agent Orchestrator](https://www.microsoft.com/en-us/research/project/multimodal-hls-foundation-models/healthcare-agent-orchestrator/)
- [Claude in Microsoft Foundry](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry)
- [MedGemma on Hugging Face](https://huggingface.co/collections/google/medgemma)
- [Microsoft Healthcare AI Examples (GitHub)](https://github.com/microsoft/healthcareai-examples)
