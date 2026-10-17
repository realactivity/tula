import type {
  Appointment,
  DashboardData,
  LabTrend,
  MedicationStatement,
  Observation,
  PlannedCapability,
  QuickAction,
} from "./types";

/**
 * Synthetic, FHIR-shaped fixtures. No real PHI. Mirrors what the
 * email-router + health-records skills will write to disk in Phase 2.
 */

const hba1c: Observation = {
  resourceType: "Observation",
  id: "obs-hba1c-20260322",
  status: "final",
  category: [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
        },
      ],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }],
    text: "HbA1c",
  },
  effectiveDateTime: "2026-03-22",
  valueQuantity: { value: 6.0, unit: "%", code: "%" },
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
};

const ldl: Observation = {
  resourceType: "Observation",
  id: "obs-ldl-20260322",
  status: "final",
  category: [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
        },
      ],
    },
  ],
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
};

const fastingGlucose: Observation = {
  resourceType: "Observation",
  id: "obs-glucose-20260322",
  status: "final",
  category: [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
        },
      ],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: "1558-6", display: "Fasting glucose" }],
    text: "Fasting Glucose",
  },
  effectiveDateTime: "2026-03-22",
  valueQuantity: { value: 112, unit: "mg/dL", code: "mg/dL" },
  interpretation: [{ coding: [{ code: "H", display: "High" }] }],
  referenceRange: [
    { low: { value: 65, unit: "mg/dL" }, high: { value: 99, unit: "mg/dL" }, text: "65-99 mg/dL" },
  ],
  meta: {
    source: "email",
    tula: {
      provider: "Quest Diagnostics",
      contentType: "laboratory_result",
      processedAt: "2026-03-22T14:35:00Z",
    },
  },
};

const egfr: Observation = {
  resourceType: "Observation",
  id: "obs-egfr-20260322",
  status: "final",
  category: [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
        },
      ],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: "33914-3", display: "eGFR" }],
    text: "eGFR",
  },
  effectiveDateTime: "2026-03-22",
  valueQuantity: { value: 88, unit: "mL/min/1.73m2", code: "mL/min/1.73m2" },
  interpretation: [{ coding: [{ code: "N", display: "Normal" }] }],
  referenceRange: [
    { low: { value: 60, unit: "mL/min/1.73m2" }, text: ">60 mL/min/1.73m2" },
  ],
  meta: {
    source: "email",
    tula: {
      provider: "Quest Diagnostics",
      contentType: "laboratory_result",
      processedAt: "2026-03-22T14:35:00Z",
    },
  },
};

export const recentLabs: LabTrend[] = [
  {
    latest: hba1c,
    history: [6.8, 6.7, 6.6, 6.5, 6.5, 6.4, 6.2, 6.0],
    delta: "down 0.4 from last visit",
  },
  {
    latest: ldl,
    history: [128, 122, 118, 115, 110, 108, 105, 102],
    delta: "down 6 from last visit",
  },
  {
    latest: fastingGlucose,
    history: [96, 99, 102, 105, 108, 110, 109, 112],
    delta: "trending up - discuss at next visit",
  },
  {
    latest: egfr,
    history: [86, 87, 87, 88, 88, 87, 88, 88],
  },
];

export const upcomingAppointment: Appointment = {
  resourceType: "Appointment",
  id: "appt-cardiology-20260527",
  status: "booked",
  description: "Cardiology follow-up",
  start: "2026-05-27T18:30:00Z",
  end: "2026-05-27T19:00:00Z",
  participant: [
    { actor: { display: "Dr. Anita Sharma, MD" }, required: "required" },
  ],
  meta: {
    source: "email",
    tula: {
      provider: "Tula Medical Group",
      contentType: "appointment",
      processedAt: "2026-05-10T11:00:00Z",
    },
  },
};

export const activeMedications: MedicationStatement[] = [
  {
    resourceType: "MedicationStatement",
    id: "med-lisinopril",
    status: "active",
    medicationCodeableConcept: {
      coding: [
        { system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "29046", display: "Lisinopril" },
      ],
      text: "Lisinopril",
    },
    dosageText: "10 mg by mouth once daily",
    effectiveDateTime: "2025-11-01",
    meta: {
      source: "email",
      tula: {
        provider: "Riverside Pharmacy",
        contentType: "prescription",
        processedAt: "2026-03-10T11:22:00Z",
      },
    },
  },
  {
    resourceType: "MedicationStatement",
    id: "med-atorvastatin",
    status: "active",
    medicationCodeableConcept: {
      coding: [
        { system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "83367", display: "Atorvastatin" },
      ],
      text: "Atorvastatin",
    },
    dosageText: "20 mg by mouth at bedtime",
    effectiveDateTime: "2025-08-15",
    meta: {
      source: "email",
      tula: {
        provider: "Riverside Pharmacy",
        contentType: "prescription",
        processedAt: "2025-08-15T09:00:00Z",
      },
    },
  },
  {
    resourceType: "MedicationStatement",
    id: "med-metformin",
    status: "active",
    medicationCodeableConcept: {
      coding: [
        { system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "6809", display: "Metformin" },
      ],
      text: "Metformin",
    },
    dosageText: "500 mg by mouth twice daily with meals",
    effectiveDateTime: "2025-06-01",
    meta: {
      source: "email",
      tula: {
        provider: "Riverside Pharmacy",
        contentType: "prescription",
        processedAt: "2025-06-01T08:30:00Z",
      },
    },
  },
];

export const longitudinalFeeds: PlannedCapability[] = [
  {
    id: "wearables",
    label: "Device integration",
    description:
      "Garmin, Oura, Whoop, Withings, Apple Health, and related device feeds",
    icon: "watch",
    href: "/integrations/wearables",
  },
  {
    id: "imaging",
    label: "Medical image interpretation",
    description:
      "DICOM imaging workflows using purpose-built healthcare imaging models",
    icon: "scan",
    href: "/integrations/imaging",
  },
  {
    id: "genomics",
    label: "Genomic health reports",
    description: "Consumer and clinical genomic report ingestion",
    icon: "dna",
    href: "/integrations/genomics",
  },
];

export const deIdentification: PlannedCapability = {
  id: "de-identification",
  label: "De-identify your record",
  description:
    "Remove PHI before sharing with another AI, a researcher, or a caregiver - HIPAA Safe Harbor-style de-identification on your own hardware",
  icon: "shield",
  href: "/integrations/de-identification",
};

export const quickActions: QuickAction[] = [
  {
    id: "schedule",
    label: "Schedule a visit",
    description: "Book an appointment with your care team",
    icon: "calendar",
    href: "/appointments",
  },
  {
    id: "message",
    label: "Message a provider",
    description: "Send a non-urgent question",
    icon: "message",
    href: "/messages",
  },
  {
    id: "refill",
    label: "Request a refill",
    description: "Prescription refill or renewal",
    icon: "pill",
    href: "/medications",
  },
  {
    id: "records",
    label: "Download records",
    description: "Export your full chart as FHIR JSON",
    icon: "file",
    href: "/dashboard",
  },
];

export const dashboardFixture: DashboardData = {
  greeting: "Good afternoon",
  patientFirstName: "Dylan",
  upcomingAppointment,
  recentLabs,
  activeMedications,
  quickActions,
  longitudinalFeeds,
  deIdentification,
  refreshedAt: new Date().toISOString(),
};
