# Email Router Skill - Technical Design

## Overview

The Email Router is Tula's primary data ingestion layer. It functions as a universal health data inbox: the user forwards any health-related email to Tula's dedicated email address, and the system automatically classifies the content, extracts structured data, stores it in a FHIR-aligned format, and notifies the user via Telegram.

This document defines the architecture, classification logic, storage schema, and implementation strategy.

## Design Principles

1. **FHIR R4 alignment from day one.** Every piece of health data stored by Tula uses a simplified FHIR Observation structure. This ensures interoperability with EHR systems, wearable data, and future integrations without migration.
2. **AI-driven classification.** Claude determines content type. No brittle rules engine. The LLM reads the email subject, sender, body, and attachment metadata, then classifies it.
3. **Simple file-based storage to start.** JSON files following FHIR resource structure, organized by content type. No database required initially. Migration to SQLite or a FHIR server is straightforward because the data shape is already correct.
4. **Idempotent processing.** Each email is processed exactly once. Processed emails are marked as seen and archived.

## Architecture

```
Email arrives at tula@yourdomain.com
        |
Himalaya IMAP poll (every 60 seconds via cron)
        |
New email detected (unseen)
        |
Tula Email Router Skill
  |-- Read email metadata (from, subject, date)
  |-- Read email body (text/html)
  |-- Detect attachments (PDF, DICOM, images)
  |-- Send metadata + body excerpt to Claude for classification
        |
Classification result
  |-- laboratory_result
  |-- imaging_report
  |-- appointment
  |-- prescription
  |-- insurance_eob
  |-- provider_message
  |-- genomic_report
  |-- device_reading
  |-- health_journal_entry
  |-- unknown_health
  |-- not_health (ignored)
        |
Content-type-specific handler
  |-- Extract structured data (PDF parsing via nano-pdf + Claude)
  |-- Map to FHIR R4 resource(s)
  |-- Store as JSON file
  |-- Send Telegram notification with summary
        |
Mark email as seen, move to Processed folder
```

## Photo Ingestion

The email router supports image attachments as a first-class data path. The user photographs any health document with their phone camera and emails the image to Tula. The email router detects the image attachment, sends it to a multimodal AI model (Claude or MedGemma) along with the email metadata, and the model extracts structured data from the photograph.

This path handles the same content types as PDF and text-based email, but captures data that would otherwise never enter a structured system: printed reports handed to patients in clinics, patient portal screens, prescription bottles, hospital whiteboards, insurance mailings, discharge instructions, and provider handwritten notes.

### Processing Pipeline for Photo Attachments

1. Email arrives with image attachment (JPEG, PNG, HEIC)
2. Email router detects image attachment and classifies the email using both metadata and a low-resolution preview of the image
3. Based on classification, the full-resolution image is sent to the appropriate multimodal model:
   - Laboratory results: extract biomarker names, values, units, reference ranges, and flags
   - Prescriptions: extract medication name, dosage, frequency, prescriber, pharmacy
   - Appointments: extract date, time, provider, location, visit type
   - Vital signs: extract readings from device displays (blood pressure, glucose, weight)
   - Insurance EOBs: extract procedure codes, amounts, dates of service
   - All other health content: extract relevant text and store as DocumentReference
4. Extracted data is mapped to FHIR R4 resources using the same pipeline as PDF-based extraction
5. Telegram notification sent with summary

### Image Quality Considerations

Multimodal AI extraction quality depends on image clarity. The following factors affect accuracy:

- **Lighting:** Well-lit, evenly illuminated documents produce the best results. Shadows, glare, and low-light conditions reduce extraction confidence.
- **Angle:** Straight-on photographs are preferred. Angled photographs introduce perspective distortion that can cause character misreads.
- **Resolution:** Modern smartphone cameras produce sufficient resolution for all health document types. Cropping to the relevant area before sending can improve results by reducing noise.
- **Focus:** Out-of-focus images are the most common cause of extraction errors. Ensure the text is sharp before sending.

The extraction pipeline should include a confidence score for each extracted value. Values below a configurable confidence threshold should be flagged for user verification via Telegram rather than stored directly.

## FHIR R4 Storage Schema

### Why FHIR for Local Storage

FHIR is not just a server protocol. It is a data model. By storing health observations as FHIR-shaped JSON files locally, Tula gains:

- A standardized vocabulary for every type of health measurement (LOINC codes)
- Standardized units (UCUM) so that "beats per minute" from Garmin and "bpm" from a blood pressure cuff are the same thing
- A structure that any FHIR-compatible system can consume if the user ever wants to export or share
- A schema that works for lab results, vital signs, wearable data, imaging reports, and genomic observations equally

### Core FHIR Resources Used

| FHIR Resource | Tula Use Case |
|---|---|
| Observation | Laboratory results, vital signs, wearable metrics, home device readings |
| DiagnosticReport | Lab panels (groups of Observations), imaging study reports |
| MedicationStatement | Current medications, prescription updates |
| Appointment | Scheduled clinical visits |
| DocumentReference | Insurance EOBs, provider messages, unstructured documents |
| Patient | The user's demographic profile (single patient in personal mode) |

### Simplified Observation JSON Structure

Each individual health measurement is stored as a JSON file following the FHIR R4 Observation resource structure. This is a simplified version that captures the fields Tula needs while remaining fully FHIR-compatible:

```json
{
  "resourceType": "Observation",
  "id": "obs-20260322-glucose-fasting-001",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "laboratory",
          "display": "Laboratory"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "1558-6",
        "display": "Fasting glucose [Mass/volume] in Serum or Plasma"
      }
    ],
    "text": "Fasting Glucose"
  },
  "effectiveDateTime": "2026-03-22",
  "issued": "2026-03-22T14:30:00Z",
  "valueQuantity": {
    "value": 112,
    "unit": "mg/dL",
    "system": "http://unitsofmeasure.org",
    "code": "mg/dL"
  },
  "interpretation": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
          "code": "H",
          "display": "High"
        }
      ]
    }
  ],
  "referenceRange": [
    {
      "low": {
        "value": 65,
        "unit": "mg/dL"
      },
      "high": {
        "value": 99,
        "unit": "mg/dL"
      },
      "text": "65-99 mg/dL"
    }
  ],
  "meta": {
    "source": "email",
    "tula": {
      "emailFrom": "results@questdiagnostics.com",
      "emailSubject": "Your Lab Results Are Ready",
      "emailDate": "2026-03-22T14:30:00Z",
      "contentType": "laboratory_result",
      "provider": "Quest Diagnostics",
      "attachmentFilename": "lab_results_20260322.pdf",
      "processedAt": "2026-03-22T14:35:00Z"
    }
  }
}
```

### Simplified DiagnosticReport JSON Structure

Lab panels (e.g., a Complete Metabolic Panel) are stored as DiagnosticReport resources that reference their individual Observation files:

```json
{
  "resourceType": "DiagnosticReport",
  "id": "report-20260322-cmp-001",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
          "code": "LAB",
          "display": "Laboratory"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "24323-8",
        "display": "Comprehensive metabolic 2000 panel"
      }
    ],
    "text": "Comprehensive Metabolic Panel"
  },
  "effectiveDateTime": "2026-03-22",
  "issued": "2026-03-22T14:30:00Z",
  "result": [
    {"reference": "Observation/obs-20260322-glucose-fasting-001"},
    {"reference": "Observation/obs-20260322-bun-001"},
    {"reference": "Observation/obs-20260322-creatinine-001"}
  ],
  "meta": {
    "source": "email",
    "tula": {
      "provider": "Quest Diagnostics",
      "flaggedCount": 3,
      "totalCount": 14,
      "processedAt": "2026-03-22T14:35:00Z"
    }
  }
}
```

### Directory Structure

```
~/.openclaw/workspace/tula/
  fhir/
    Patient/
      patient-001.json
    Observation/
      laboratory/
        obs-20260322-glucose-fasting-001.json
        obs-20260322-bun-001.json
        obs-20260322-creatinine-001.json
      vital-signs/
        obs-20260322-bp-systolic-001.json
        obs-20260322-bp-diastolic-001.json
        obs-20260322-hr-resting-001.json
      wearable/
        obs-20260322-hrv-garmin-001.json
        obs-20260322-sleep-garmin-001.json
    DiagnosticReport/
      laboratory/
        report-20260322-cmp-001.json
      imaging/
        report-20260315-mri-brain-001.json
    MedicationStatement/
      med-metformin-001.json
    Appointment/
      appt-20260401-oncology-001.json
    DocumentReference/
      eob-20260320-anthem-001.json
      msg-20260318-drsmiith-001.json
  inbox/
    raw/
      2026-03-22_14-30_quest-results.eml
    processed/
      2026-03-22_14-30_quest-results.eml
  attachments/
    2026-03-22_lab_results_quest.pdf
    2026-03-15_mri_brain_report.pdf
```

### File Naming Convention

All FHIR resource files follow this pattern:

```
{resourceType}-{date}-{descriptive-name}-{sequence}.json
```

Examples:
- `obs-20260322-glucose-fasting-001.json`
- `report-20260322-cmp-001.json`
- `appt-20260401-oncology-001.json`

### Common LOINC Codes for Laboratory Observations

The following LOINC codes cover the most commonly ordered laboratory tests. Claude will map extracted biomarker names to these codes during processing:

| Biomarker | LOINC Code | Unit (UCUM) |
|---|---|---|
| Fasting Glucose | 1558-6 | mg/dL |
| HbA1c | 4548-4 | % |
| Total Cholesterol | 2093-3 | mg/dL |
| LDL Cholesterol | 2089-1 | mg/dL |
| HDL Cholesterol | 2085-9 | mg/dL |
| Triglycerides | 2571-8 | mg/dL |
| BUN | 3094-0 | mg/dL |
| Creatinine | 2160-0 | mg/dL |
| eGFR | 33914-3 | mL/min/1.73m2 |
| ALT | 1742-6 | U/L |
| AST | 1920-8 | U/L |
| TSH | 3016-3 | mIU/L |
| Free T4 | 3024-7 | ng/dL |
| Vitamin D, 25-Hydroxy | 1989-3 | ng/mL |
| Vitamin B12 | 2132-9 | pg/mL |
| Ferritin | 2276-4 | ng/mL |
| CRP, High Sensitivity | 30522-7 | mg/L |
| PSA | 2857-1 | ng/mL |
| WBC | 6690-2 | 10*3/uL |
| RBC | 789-8 | 10*6/uL |
| Hemoglobin | 718-7 | g/dL |
| Hematocrit | 4544-3 | % |
| Platelets | 777-3 | 10*3/uL |
| Sodium | 2951-2 | mmol/L |
| Potassium | 2823-3 | mmol/L |
| Calcium | 17861-6 | mg/dL |

### Common LOINC Codes for Vital Signs and Wearable Data

| Measurement | LOINC Code | Unit (UCUM) |
|---|---|---|
| Systolic Blood Pressure | 8480-6 | mm[Hg] |
| Diastolic Blood Pressure | 8462-4 | mm[Hg] |
| Heart Rate | 8867-4 | /min |
| Body Weight | 29463-7 | kg |
| Body Mass Index | 39156-5 | kg/m2 |
| Body Temperature | 8310-5 | Cel |
| Oxygen Saturation | 2708-6 | % |
| Heart Rate Variability (RMSSD) | 80404-7 | ms |
| Step Count | 55423-8 | /d |
| Sleep Duration | 93832-4 | h |

## Email Classification Prompt

When a new email arrives, the following prompt is sent to Claude along with the email metadata and body:

```
You are Tula's email classification engine. Analyze the following email 
and classify it into exactly one content type.

EMAIL METADATA:
From: {sender}
Subject: {subject}
Date: {date}
Attachments: {attachment_list with filenames and sizes}

EMAIL BODY (first 2000 characters):
{body_excerpt}

Classify this email into exactly one of the following content types:

- laboratory_result: Lab test results from a clinical laboratory or 
  provider portal (Quest, LabCorp, hospital lab, etc.)
- imaging_report: Radiology or imaging study results (MRI, CT, X-ray, 
  mammogram, ultrasound, DICOM)
- appointment: Appointment confirmation, reminder, or scheduling 
  notification
- prescription: Prescription update, refill notification, pharmacy 
  communication
- insurance_eob: Explanation of benefits, claims, billing statements
- provider_message: Message from a healthcare provider, patient portal 
  notification, care team communication
- genomic_report: DNA test results, genetic health reports (23andMe, 
  AncestryDNA, clinical genetic panels)
- device_reading: Data from a home health device (blood pressure, 
  glucose, weight, pulse oximetry)
- health_journal_entry: Personal health note, symptom report, or 
  wellness log
- unknown_health: Health-related but does not match the above categories
- not_health: Not health-related content

Respond with a JSON object:
{
  "content_type": "laboratory_result",
  "confidence": 0.95,
  "summary": "Quest Diagnostics comprehensive metabolic panel results 
    from March 22, 2026",
  "provider": "Quest Diagnostics",
  "has_attachment": true,
  "attachment_type": "pdf",
  "action": "Extract biomarkers from PDF attachment and store as 
    FHIR Observations"
}
```

## Processing Pipeline by Content Type

### Model Routing in the Pipeline

Each processing step routes to the most appropriate model based on the user's deployment context. For the complete routing matrix and fallback chains, see [model-routing.md](model-routing.md).

| Pipeline Step | Azure-Native Model | Self-Hosted Model |
|---|---|---|
| Email classification | Claude Sonnet (Foundry) | Claude API or capable local LLM |
| Lab report text extraction | Claude in Foundry or MedGemma (Vertex) | MedGemma 27B text (local) |
| Lab report LOINC mapping | Claude Sonnet/Opus | Claude API |
| DICOM image interpretation | MedImageInsight + CXRReportGen | MedGemma 4B multimodal (local) |
| Imaging report summarization | Claude in Foundry | Claude API |
| Medical speech input | Azure Speech Services or MedASR | MedASR (local) |
| General data extraction | Claude Sonnet | Claude API or local LLM |

### Laboratory Results

1. Detect PDF attachment
2. Extract text from PDF using nano-pdf
3. Send extracted text to the configured medical text model (MedGemma 27B for structured extraction, or Claude) with prompt: "Extract all biomarker names, values, units, reference ranges, and interpretation (normal/high/low) as a JSON array"
4. Model returns structured biomarker data
5. For each biomarker, map to LOINC code (Claude performs this mapping due to its strength in clinical reasoning)
6. Generate FHIR Observation JSON for each biomarker
7. Generate FHIR DiagnosticReport JSON referencing all Observations
8. Store all files in the appropriate directories
9. Save original PDF to attachments directory
10. Send Telegram summary: "{count} biomarkers extracted from {provider}. {flagged_count} out of range: {list of flagged items with values}"

### Imaging Reports

1. Detect PDF attachment, inline report text, or DICOM study
2. For DICOM studies: route to MedGemma 4B multimodal (self-hosted) or MedImageInsight + CXRReportGen (Azure) for image analysis
3. For PDF/text reports: extract text using nano-pdf, then send to MedGemma 27B text or Claude for structured extraction of modality, body region, findings, impression, and comparison to prior studies
4. Route findings to Claude for plain-language summary generation
5. Generate FHIR DiagnosticReport with category "imaging"
6. Store report JSON, original PDF, and DICOM reference
7. Send Telegram summary with key findings in plain language

### Appointments

1. Extract date, time, provider name, location, and visit type from email body
2. Generate FHIR Appointment JSON
3. Store in Appointment directory
4. Send Telegram notification: "Appointment logged: {provider} on {date} at {time}"

### Prescriptions

1. Extract medication name, dosage, frequency, prescriber, pharmacy from email
2. Generate FHIR MedicationStatement JSON
3. Store in MedicationStatement directory
4. Send Telegram notification with medication details

### All Other Types

1. Extract relevant structured data where possible
2. Store as FHIR DocumentReference with the original email body as content
3. Send Telegram notification with classification and summary

## Implementation Phases

### Phase 1: Email Connectivity (Target: This Week)

Deliverables:
- Dedicated Gmail account for Tula with app password
- Himalaya configured on VM with IMAP/SMTP credentials
- Cron job polling inbox every 60 seconds
- Basic notification: "New email received from {sender}: {subject}"
- Test: Forward yourself an email, confirm Telegram notification

### Phase 2: Classification Engine (Target: Next Week)

Deliverables:
- Classification prompt integrated into email processing
- Claude classifies each incoming email
- Telegram notification includes content type and summary
- Unprocessed emails stored in inbox/raw with classification metadata
- Test: Forward a lab result PDF, appointment confirmation, and prescription notification. Verify correct classification for each.

### Phase 3: Laboratory Result Parser (Target: Week 3)

Deliverables:
- PDF text extraction via nano-pdf
- Biomarker extraction prompt for Claude
- LOINC code mapping
- FHIR Observation JSON generation for each biomarker
- FHIR DiagnosticReport JSON generation for the panel
- Storage in fhir/Observation/laboratory and fhir/DiagnosticReport/laboratory
- Telegram summary with flagged values
- Test: Forward a real Quest or LabCorp PDF. Verify all biomarkers extracted, LOINC codes correct, flagged values identified.

### Phase 4: Additional Content Type Handlers (Target: Weeks 4-6)

Deliverables:
- Appointment handler with FHIR Appointment storage
- Prescription handler with FHIR MedicationStatement storage
- Imaging report handler with FHIR DiagnosticReport storage
- Document handler for EOBs and provider messages
- Test: Forward examples of each content type and verify end-to-end processing.

## Querying Stored Data

Once data is stored as FHIR JSON files, Tula can answer questions by reading the relevant files. Examples:

**"What was my last fasting glucose?"**
Tula reads the most recent file in fhir/Observation/laboratory/ matching LOINC code 1558-6.

**"Show me my cholesterol trend over the past year."**
Tula reads all files in fhir/Observation/laboratory/ matching LOINC codes 2093-3, 2089-1, 2085-9, 2571-8 and presents them chronologically.

**"When is my next appointment?"**
Tula reads fhir/Appointment/ for the nearest future date.

**"What medications am I currently taking?"**
Tula reads all files in fhir/MedicationStatement/ with active status.

When query volume or complexity outgrows file-based storage, migrate to SQLite with one table per FHIR resource type. The JSON structure remains identical; only the storage layer changes.

## Security Considerations

### Email Transport Restrictions

Tula's mailbox is locked down at the Exchange transport layer:

- **Inbound:** Only authorized senders (configured in the Exchange mail flow rule) can deliver email to Tula's inbox. All other senders receive a rejection. Messages from unauthorized senders never reach the mailbox and are never processed.
- **Outbound:** Tula can only send email to authorized recipients. This prevents data exfiltration even if a prompt injection succeeds in instructing the agent to email health records to an external address.
- **Anti-spoofing:** SPF, DKIM, and DMARC on the authorized sender's domain protect against From header forgery.
- **Application-level allowlist:** The email router skill performs its own sender verification before processing, independent of the Exchange transport rules.

### Credential and Data Protection

- Email credentials (OAuth2 tokens) stored in himalaya config with restricted file permissions (chmod 600)
- Health data directories have restricted permissions (chmod 700)
- Original email attachments (PDFs containing PHI) stored locally with no external transmission
- Classification and extraction prompts are sent to the LLM API; the LLM provider's data retention policy applies. Use providers with zero data retention for sensitive health data.
- De-identification engine (future) will enable safe sharing of stored FHIR data

### Prompt Injection

The inbound sender restriction eliminates direct prompt injection via email. Indirect prompt injection via forwarded third-party content (lab PDFs, provider messages) is a residual risk with low probability and is mitigated by the outbound transport restriction. For the complete threat analysis, including prompt injection analysis by channel, data in transit considerations, and a deployment security checklist, see the [security model](security-model.md).

## Future Considerations

- **FHIR server mode:** When Tula supports multiple users or clinical integration, deploy a lightweight FHIR server (HAPI FHIR, Kodjin) and store resources there instead of as flat files.
- **Webhook ingestion:** In addition to email, accept data via webhooks from patient portals, wearable APIs, and IoT devices.
- **Garmin integration:** Daily wearable data stored as FHIR Observations in fhir/Observation/wearable/ using the same structure and LOINC codes.
- **Home device integration:** Blood pressure, weight, glucose readings stored as FHIR Observations in fhir/Observation/vital-signs/.
- **Bulk export:** Generate a FHIR Bundle containing all of a user's resources for sharing with a provider or research study.
- **MedASR voice ingestion:** Accept voice messages via Telegram containing health observations, symptoms, or medication updates. Route through MedASR for medical speech transcription, then process as structured health data.
- **Local MedGemma deployment:** Deploy MedGemma 4B on the same VM for zero-API-cost medical image and text processing in offline or low-resource settings.
- **Microsoft Healthcare Agent Orchestrator:** Integrate with Microsoft's open-source orchestrator for complex clinical workflows requiring coordinated analysis across imaging, pathology, genomics, and clinical notes.
- **Model routing configuration UI:** Provide a Telegram-based or web-based interface for users to view and modify their model routing preferences without editing configuration files.
