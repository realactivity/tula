/**
 * Loose, tolerant types for on-disk Epic FHIR R4 resources as written by
 * health-records-pull / email-router. These mirror real file shapes exactly
 * (Epic OIDs, varying fields, extra keys). All properties are optional and
 * extra keys are tolerated via index signature.
 *
 * This is the *read boundary*. Do not use these in UI components.
 * Map to the strict view types in lib/fhir/types.ts (or lib/data/types.ts re-exports)
 * before returning data to the dashboard.
 *
 * Keep this file narrow; only add fields the mappers actually consume.
 */

export interface RawCoding {
  system?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
  [k: string]: any;
}

export interface RawCodeableConcept {
  coding?: RawCoding[];
  text?: string;
  [k: string]: any;
}

export interface RawQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
  [k: string]: any;
}

export interface RawReference {
  reference?: string;
  display?: string;
  type?: string;
  identifier?: {
    use?: string;
    system?: string;
    value?: string;
    [k: string]: any;
  };
  [k: string]: any;
}

export interface RawPeriod {
  start?: string;
  end?: string;
  [k: string]: any;
}

/**
 * Raw Observation as stored on disk (laboratory and vital-signs).
 * Real files frequently:
 * - use Epic OID code systems in addition to (or instead of) loinc.org
 * - have both category "laboratory" and internal "Lab"
 * - use valueString for non-numeric results
 * - have effectivePeriod instead of / in addition to effectiveDateTime
 * - carry real FHIR meta { source, lastUpdated } (NOT the app's TulaMeta)
 */
export interface RawObservation {
  resourceType?: "Observation";
  id?: string;
  status?: string;
  category?: RawCodeableConcept[];
  code?: RawCodeableConcept;
  effectiveDateTime?: string;
  effectivePeriod?: RawPeriod;
  issued?: string;
  valueQuantity?: RawQuantity;
  valueString?: string;
  valueCodeableConcept?: RawCodeableConcept;
  interpretation?: Array<{
    coding?: Array<{ code?: string; display?: string; [k: string]: any }>;
    [k: string]: any;
  }>;
  referenceRange?: Array<{
    low?: RawQuantity;
    high?: RawQuantity;
    text?: string;
    [k: string]: any;
  }>;
  subject?: RawReference;
  encounter?: RawReference;
  performer?: RawReference[];
  basedOn?: RawReference[];
  specimen?: RawReference;
  meta?: {
    source?: string;
    lastUpdated?: string;
    [k: string]: any;
  };
  [k: string]: any;
}

/**
 * Raw MedicationRequest (source of active meds for the dashboard).
 * Medication name is reliably in medicationReference.display.
 * Dosing text is in dosageInstruction[0].text.
 * We filter on status === "active".
 */
export interface RawMedicationRequest {
  resourceType?: "MedicationRequest";
  id?: string;
  status?: string;
  intent?: string;
  category?: RawCodeableConcept[];
  medicationCodeableConcept?: RawCodeableConcept;
  medicationReference?: RawReference;
  subject?: RawReference;
  encounter?: RawReference;
  authoredOn?: string;
  requester?: RawReference;
  recorder?: RawReference;
  dosageInstruction?: Array<{
    text?: string;
    patientInstruction?: string;
    timing?: any;
    [k: string]: any;
  }>;
  courseOfTherapyType?: RawCodeableConcept;
  meta?: {
    source?: string;
    lastUpdated?: string;
    [k: string]: any;
  };
  [k: string]: any;
}

/**
 * Raw Patient (used only to extract the first/given name for greeting).
 */
export interface RawPatient {
  resourceType?: "Patient";
  id?: string;
  name?: Array<{
    use?: "official" | "usual" | "nickname" | string;
    text?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
    [k: string]: any;
  }>;
  birthDate?: string;
  gender?: string;
  meta?: any;
  [k: string]: any;
}

/**
 * Raw Encounter (for future "most recent visit" derivation if we want to
 * show something where Appointment would have been). Not required for
 * initial dashboard wiring (upcoming will be undefined).
 */
export interface RawEncounter {
  resourceType?: "Encounter";
  id?: string;
  status?: string;
  class?: RawCodeableConcept;
  type?: RawCodeableConcept[];
  period?: RawPeriod;
  reasonCode?: RawCodeableConcept[];
  participant?: Array<{
    type?: RawCodeableConcept[];
    individual?: RawReference;
    [k: string]: any;
  }>;
  subject?: RawReference;
  meta?: any;
  [k: string]: any;
}

/**
 * Raw DocumentReference (for messages/notes). Bodies are usually Binary links,
 * not inline, so we can surface metadata only for Phase 1 dashboard.
 */
export interface RawDocumentReference {
  resourceType?: "DocumentReference";
  id?: string;
  status?: string;
  type?: RawCodeableConcept;
  date?: string;
  description?: string;
  author?: RawReference[];
  content?: Array<{
    attachment?: {
      contentType?: string;
      url?: string; // Binary/...
      [k: string]: any;
    };
    [k: string]: any;
  }>;
  meta?: any;
  [k: string]: any;
}

/** Union for any raw resource we might read in future mappers. */
export type AnyRawResource =
  | RawObservation
  | RawMedicationRequest
  | RawPatient
  | RawEncounter
  | RawDocumentReference
  | { resourceType?: string; [k: string]: any };

/** Helper: narrow check */
export function isRawObservation(r: any): r is RawObservation {
  return r && r.resourceType === "Observation";
}

export function isRawMedicationRequest(r: any): r is RawMedicationRequest {
  return r && r.resourceType === "MedicationRequest";
}

export function isRawPatient(r: any): r is RawPatient {
  return r && r.resourceType === "Patient";
}
