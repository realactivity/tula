# Intended Use Cases

Tula is designed to support individuals across a broad spectrum of health needs, from managing complex illness to maintaining long-term wellness. The following use cases describe how Tula's capabilities apply to different health journeys.

## Universal Photo Capture

Every use case below is powered by a single capability: photograph any health document with your phone, email it to Tula, and Tula extracts structured data from it.

This matters because health data is fragmented. It lives in patient portal screens, printed lab reports, prescription bottles, hospital whiteboards, insurance mailings, discharge instructions, imaging reports, and handwritten notes from providers. Most of it never makes it into a structured system. Patients carry it in folders, photograph it for their own records, or lose track of it entirely.

Tula turns any phone camera into a universal health data connector. There is no patient portal integration to configure, no FHIR API to negotiate, no IT department to involve, and no technical literacy required beyond taking a photograph and sending an email. The email is secured at the Exchange transport layer so that only authorized senders can reach Tula's inbox.

Concrete examples of what this captures:

- A printed lab report handed to you at a clinic visit
- A MyChart or patient portal screen on your phone showing new results
- A prescription bottle with medication name, dosage, frequency, prescriber, and refill count
- A hospital whiteboard listing vitals, medications, and care team members
- An Explanation of Benefits mailed by your insurance company
- Discharge instructions from an emergency department or urgent care visit
- A radiology report printed or displayed on a screen
- A handwritten note from a provider with follow-up instructions
- A glucose meter or blood pressure monitor display showing a reading
- A vaccination card or immunization record

Each of these, once photographed and emailed, is classified by the email router, processed by the appropriate skill, stored as a FHIR R4 resource, and summarized via Telegram. A printed lab report becomes a set of FHIR Observation resources with LOINC codes, units, reference ranges, and flagged values. A prescription bottle becomes a FHIR MedicationStatement. An appointment card becomes a FHIR Appointment.

This capability is particularly important for caregivers, who often collect health information in chaotic clinical environments where manual data entry is not realistic, and for patients in low-resource settings where patient portal access may not be available.

## Patients Navigating Complex or Serious Illness

Individuals managing oncology diagnoses, autoimmune conditions, or other complex medical situations often face a high volume of clinical data across multiple providers and specialties. Tula consolidates laboratory results, imaging studies, medication lists, provider notes, and patient-reported symptoms into a single, structured record. Imaging studies are interpreted using purpose-built healthcare models (Google MedGemma multimodal or Microsoft MedImageInsight/CXRReportGen, depending on deployment context) rather than general-purpose AI, providing more accurate and clinically relevant analysis. Laboratory reports are extracted using medical text models optimized for structured data extraction from clinical documents. The goal is to support more informed patient-provider communication and reduce the cognitive burden of managing complex care.

## Caregivers

Family caregivers frequently manage medication schedules, coordinate appointments across multiple specialists, track symptoms, and navigate insurance documentation, often without clinical training. Tula provides a centralized system for organizing this information, with medication adherence reminders, symptom logging by voice or text, and exportable summaries for the care team. Research consistently demonstrates that caregiver burden is associated with adverse health outcomes for caregivers themselves; tools that reduce logistical complexity may support caregiver wellbeing.

## Individuals Managing Chronic Conditions

For individuals with diabetes, hypertension, cardiovascular risk factors, autoimmune disorders, and other chronic conditions requiring ongoing monitoring, Tula integrates data from home health devices, laboratory results, and daily health journals. Longitudinal trend visualization can surface patterns that may not be apparent in episodic clinical encounters.

## Individuals with Hereditary Risk Factors

For those with significant family histories of cancer, cardiovascular disease, diabetes, or other heritable conditions, Tula supports integration of consumer and clinical genomic data with ongoing biomarker monitoring. The aim is to facilitate proactive, evidence-informed screening and risk reduction in collaboration with one's healthcare provider.

## Preventive Health and Wellness

Healthy individuals focused on long-term wellness can use Tula to track wearable physiological data, monitor routine laboratory work, log nutrition and exercise, and stay current with relevant clinical and translational research.

## Community Health in Low-Resource Settings

In many low- and middle-income countries, community health workers serve as the front line of care, often managing large patient populations with limited clinical support and fragmented record-keeping systems. A shared Tula instance deployed at a community health center can consolidate patient-reported symptoms, medication adherence records, and basic laboratory data into a structured, searchable system accessible through Telegram on a basic smartphone.

Tula's architecture is designed for this context. It operates on low-bandwidth mobile networks, requires no proprietary software licenses, integrates with open-source health information systems via FHIR R4, and supports multilingual interaction through the underlying AI model's language capabilities. MedGemma 4B runs locally on modest hardware without API fees, providing medical image and text comprehension in offline or low-connectivity environments. MedASR provides medical speech recognition for voice-based data entry where typing is impractical or where clinical staff use dictation workflows. The de-identification engine enables anonymized data contribution to research collaborations, helping address the systemic underrepresentation of LMIC populations in global health datasets.

Tula is not a substitute for trained clinicians, functioning health infrastructure, or evidence-based public health programs. It is a supplementary tool that can reduce administrative burden, improve continuity of care documentation, and provide health literacy support where access to specialist interpretation is limited.
