import type { ActivityEvent, Observation } from "./fhir/types";

/**
 * Sample data shaped exactly like what the email-router will write.
 * Everything here is synthetic — no real PHI.
 */

const cmpObservations: Observation[] = [
  {
    resourceType: "Observation",
    id: "obs-20260322-glucose-fasting-001",
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "laboratory",
            display: "Laboratory",
          },
        ],
      },
    ],
    code: {
      coding: [
        { system: "http://loinc.org", code: "1558-6", display: "Fasting glucose" },
      ],
      text: "Fasting Glucose",
    },
    effectiveDateTime: "2026-03-22",
    valueQuantity: { value: 112, unit: "mg/dL", code: "mg/dL" },
    interpretation: [
      { coding: [{ code: "H", display: "High" }] },
    ],
    referenceRange: [
      { low: { value: 65, unit: "mg/dL" }, high: { value: 99, unit: "mg/dL" }, text: "65-99 mg/dL" },
    ],
    meta: {
      source: "email",
      tula: {
        emailFrom: "results@questdiagnostics.com",
        provider: "Quest Diagnostics",
        contentType: "laboratory_result",
        processedAt: "2026-03-22T14:35:00Z",
      },
    },
  },
  {
    resourceType: "Observation",
    id: "obs-20260322-hba1c-001",
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
    code: {
      coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }],
      text: "HbA1c",
    },
    effectiveDateTime: "2026-03-22",
    valueQuantity: { value: 6.4, unit: "%", code: "%" },
    interpretation: [{ coding: [{ code: "N", display: "Normal" }] }],
    referenceRange: [{ high: { value: 5.7, unit: "%" }, text: "<5.7%" }],
    meta: {
      source: "email",
      tula: {
        provider: "Quest Diagnostics",
        contentType: "laboratory_result",
        processedAt: "2026-03-22T14:35:00Z",
      },
    },
  },
  {
    resourceType: "Observation",
    id: "obs-20260322-ldl-001",
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
    code: {
      coding: [{ system: "http://loinc.org", code: "2089-1", display: "LDL Cholesterol" }],
      text: "LDL Cholesterol",
    },
    effectiveDateTime: "2026-03-22",
    valueQuantity: { value: 102, unit: "mg/dL", code: "mg/dL" },
    interpretation: [{ coding: [{ code: "N", display: "Normal" }] }],
    referenceRange: [{ high: { value: 130, unit: "mg/dL" }, text: "<130 mg/dL" }],
    meta: {
      source: "email",
      tula: {
        provider: "Quest Diagnostics",
        contentType: "laboratory_result",
        processedAt: "2026-03-22T14:35:00Z",
      },
    },
  },
  {
    resourceType: "Observation",
    id: "obs-20260322-egfr-001",
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
    code: {
      coding: [{ system: "http://loinc.org", code: "33914-3", display: "eGFR" }],
      text: "eGFR",
    },
    effectiveDateTime: "2026-03-22",
    valueQuantity: { value: 88, unit: "mL/min/1.73m2", code: "mL/min/1.73m2" },
    interpretation: [{ coding: [{ code: "N", display: "Normal" }] }],
    referenceRange: [{ low: { value: 60, unit: "mL/min/1.73m2" }, text: ">60 mL/min/1.73m2" }],
    meta: {
      source: "email",
      tula: {
        provider: "Quest Diagnostics",
        contentType: "laboratory_result",
        processedAt: "2026-03-22T14:35:00Z",
      },
    },
  },
];

export const activityFixtures: ActivityEvent[] = [
  {
    id: "evt-001",
    at: "2026-03-22T14:35:00Z",
    contentType: "laboratory_result",
    provider: "Quest Diagnostics",
    emailFrom: "results@questdiagnostics.com",
    summary:
      "Comprehensive Metabolic Panel + Lipid Panel + HbA1c. 1 of 14 values flagged out of range.",
    resourceId: "report-20260322-cmp-001",
    observations: cmpObservations,
  },
  {
    id: "evt-002",
    at: "2026-03-15T09:12:00Z",
    contentType: "imaging_report",
    provider: "RadNet",
    emailFrom: "noreply@mychart.example.org",
    summary: "MRI Brain w/o contrast — no acute findings, follow-up in 6 months.",
    resourceId: "report-20260315-mri-brain-001",
    impression:
      "1. No acute intracranial abnormality. 2. Stable T2 hyperintense lesions in the left periventricular white matter, unchanged from prior. 3. No evidence of diffusion restriction. Recommend follow-up MRI in 6 months for surveillance.",
  },
  {
    id: "evt-003",
    at: "2026-03-12T18:04:00Z",
    contentType: "appointment",
    provider: "Dr. Patel — Internal Medicine",
    emailFrom: "scheduling@mychart.example.org",
    summary: "Follow-up appointment scheduled April 8, 2026 at 10:30 AM.",
    resourceId: "appt-20260408-internal-medicine-001",
  },
  {
    id: "evt-004",
    at: "2026-03-10T11:22:00Z",
    contentType: "prescription",
    provider: "Riverside Pharmacy",
    emailFrom: "prescriptions@riversidepharmacy.example.com",
    summary: "Lisinopril 10 mg daily — refill ready for pickup.",
    resourceId: "med-lisinopril-001",
  },
  {
    id: "evt-005",
    at: "2026-03-05T07:48:00Z",
    contentType: "insurance_eob",
    provider: "Anthem BCBS",
    emailFrom: "noreply@anthem.example.com",
    summary: "EOB for office visit on Feb 28, 2026. Total billed $387, your responsibility $35.",
    resourceId: "eob-20260228-anthem-001",
  },
];
