/**
 * Minimal FHIR R4 types tailored to what the email-router writes.
 * Mirrors the schema in docs/email-router-design.md.
 *
 * Only a subset of the FHIR spec is represented — exactly the fields
 * Tula stores. We can extend toward fuller FHIR conformance later.
 */

export type Coding = {
  system: string;
  code: string;
  display?: string;
};

export type CodeableConcept = {
  coding: Coding[];
  text?: string;
};

export type Quantity = {
  value: number;
  unit: string;
  system?: string;
  code?: string;
};

export type ReferenceRange = {
  low?: Quantity;
  high?: Quantity;
  text?: string;
};

export type ObservationInterpretation = "H" | "L" | "N" | "A" | string;

/** Provenance Tula attaches to every resource it stores. */
export type TulaMeta = {
  source: "email" | "device" | "manual" | "wearable";
  tula: {
    emailFrom?: string;
    emailSubject?: string;
    emailDate?: string;
    contentType?: string;
    provider?: string;
    attachmentFilename?: string;
    processedAt: string;
    confidence?: number;
  };
};

export type Observation = {
  resourceType: "Observation";
  id: string;
  status: "final" | "preliminary" | "amended" | "corrected";
  category: CodeableConcept[];
  code: CodeableConcept;
  effectiveDateTime: string;
  issued?: string;
  valueQuantity?: Quantity;
  valueString?: string;
  interpretation?: { coding: { code: ObservationInterpretation; display?: string }[] }[];
  referenceRange?: ReferenceRange[];
  meta: TulaMeta;
};

export type DiagnosticReport = {
  resourceType: "DiagnosticReport";
  id: string;
  status: "final" | "preliminary" | "amended";
  category: CodeableConcept[];
  code: CodeableConcept;
  effectiveDateTime: string;
  issued?: string;
  /** References to Observation/<id>. */
  result?: { reference: string }[];
  /** For imaging reports: the impression text. */
  conclusion?: string;
  meta: TulaMeta & {
    tula: TulaMeta["tula"] & {
      flaggedCount?: number;
      totalCount?: number;
    };
  };
};

export type Appointment = {
  resourceType: "Appointment";
  id: string;
  status: "booked" | "fulfilled" | "cancelled" | "noshow";
  /** Visit type, e.g., "Oncology follow-up". */
  description?: string;
  start: string;
  end?: string;
  participant?: {
    actor: { display: string };
    required?: "required" | "optional";
  }[];
  meta: TulaMeta;
};

export type MedicationStatement = {
  resourceType: "MedicationStatement";
  id: string;
  status: "active" | "completed" | "stopped" | "entered-in-error";
  medicationCodeableConcept: CodeableConcept;
  /** Free-text dosing instructions; structured Dosage left for later. */
  dosageText?: string;
  effectiveDateTime?: string;
  meta: TulaMeta;
};

export type DocumentReference = {
  resourceType: "DocumentReference";
  id: string;
  status: "current" | "superseded" | "entered-in-error";
  type?: CodeableConcept;
  date: string;
  description?: string;
  /** Inline content text (e.g. EOB summary, provider message body). */
  contentText?: string;
  meta: TulaMeta;
};

export type AnyResource =
  | Observation
  | DiagnosticReport
  | Appointment
  | MedicationStatement
  | DocumentReference;

/** Activity feed event. One per email processed. Computed from FHIR resources. */
export type ActivityEvent = {
  id: string;
  /** When the email was processed and FHIR written. */
  at: string;
  contentType:
    | "laboratory_result"
    | "imaging_report"
    | "appointment"
    | "prescription"
    | "insurance_eob"
    | "provider_message"
    | "genomic_report"
    | "device_reading"
    | "health_journal_entry"
    | "unknown_health";
  provider?: string;
  emailFrom?: string;
  summary: string;
  /** The primary FHIR resource id this event represents. */
  resourceId: string;
  /** For lab panels, the observations to surface as quick stats. */
  observations?: Observation[];
  /** For imaging reports, the impression text to show. */
  impression?: string;
};
