# Principles

These principles guide the design, development, and governance of the Tula project.

## Patient Empowerment Through Health Literacy

Laboratory results, imaging studies, genetic reports, and treatment plans are your data about your body. Tula translates clinical information into language that supports informed decision-making.

## Data Sovereignty

All data is stored locally on the user's own server. No cloud health platforms. No third-party data sharing. No monetization of personal health information.

## Active Privacy Protection

Local storage is the baseline. De-identification tools enable safe sharing when the user chooses to do so. The user controls what data leaves their environment and in what form.

## Comprehensive Health Context

Laboratory data, genomic information, medical records, imaging studies, wearable metrics, home device readings, and patient-reported outcomes are maintained in a single, cross-referenced repository. AI-powered analysis surfaces correlations across data sources that may not be apparent when reviewed in isolation.

## Caregiver Recognition

Individuals supporting a loved one through illness carry a significant burden that is often underrecognized by the healthcare system. Tula is built to support the caregiver's role as a core use case, not a secondary consideration.

## Open Source by Design

All skills are released under the MIT license. Use them, modify them, share them, and build upon them.

## Global Health Equity

Current AI health tools are overwhelmingly trained on data from high-income, English-speaking countries and delivered through proprietary platforms that require paid subscriptions. This approach excludes billions of people in low- and middle-income countries who face the greatest burden of disease and the least access to clinical resources.

Tula is designed to address this gap through deliberate architectural decisions:

- **Free and open source.** No subscription fees, no vendor lock-in. The MIT license ensures that any organization, clinic, or individual can deploy Tula without cost barriers.
- **Self-hosted with data sovereignty.** All data remains on infrastructure controlled by the user or their organization. This aligns with the growing emphasis on national data sovereignty, particularly in the Global South, where governments are asserting greater control over health data governance.
- **Model-agnostic.** Tula routes to whatever AI model is available and appropriate. In regions where frontier API providers are unavailable or cost-prohibitive, Tula can use open-weight models (Llama, Qwen, Nemotron) running on local or regional infrastructure.
- **Low-bandwidth accessible.** Telegram, Tula's primary interface, operates on low-bandwidth mobile connections and basic smartphones. The email ingestion gateway similarly functions without high-speed connectivity. These are the dominant communication channels in Sub-Saharan Africa, South Asia, and Latin America.
- **Multilingual by design.** Skills are designed with language as a configurable parameter. Medication adherence reminders, patient check-ins, and health education should function in Spanish, Portuguese, Swahili, Hindi, Tagalog, and any language supported by the underlying AI model, without rewriting the skill.
- **FHIR R4 interoperability.** The EHR connector skill uses FHIR R4, enabling integration with open-source health information systems such as OpenMRS that are widely deployed across LMICs.
- **De-identification for research equity.** The de-identification engine enables individuals in underrepresented populations to contribute anonymized health data to research collaborations, helping address the systemic data gaps that perpetuate inequity in AI model training.

Tula is not a replacement for health system infrastructure, trained clinicians, or evidence-based public health programs. It is a tool that can augment existing resources, reduce the cognitive burden on patients and community health workers, and provide health literacy support in contexts where access to specialist interpretation is limited.

We welcome contributors from all regions and health systems. If you are deploying Tula in a low-resource setting, we want to learn from your experience and adapt the platform to better serve your community.

## AI-Assisted Interpretation, Not Clinical Diagnosis

Tula supports health literacy and informed patient-provider communication. It is not a medical device, not a diagnostic tool, and not a substitute for professional medical advice, diagnosis, or treatment. Users should always consult qualified healthcare providers for clinical decisions. Tula's purpose is to help individuals become more informed participants in their own care.
