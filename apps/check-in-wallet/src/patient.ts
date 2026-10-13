import type { BundleEntry, FhirBundle } from "./types";

/**
 * Synthetic FHIR R4 / US Core collection for Dylan Meyer.
 * Fictional patient used across Tula evals. Never replace with real PHI.
 */
export const PATIENT_ID = "dylan-meyer";
export const PATIENT_FULL_URL = `https://tula.example/fhir/Patient/${PATIENT_ID}`;
export const PRACTITIONER_ID = "dave-matthews";
export const PRACTITIONER_FULL_URL = `https://tula.example/fhir/Practitioner/${PRACTITIONER_ID}`;

const US_CORE_PATIENT =
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient";
const US_CORE_CONDITION =
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns";
const US_CORE_ALLERGY =
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance";
const US_CORE_MED_REQUEST =
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest";
const US_CORE_IMMUNIZATION =
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization";
const US_CORE_PRACTITIONER =
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner";

function entry(resourceType: string, id: string, resource: Record<string, unknown>): BundleEntry {
  return {
    fullUrl: `https://tula.example/fhir/${resourceType}/${id}`,
    resource: { resourceType, id, ...resource } as BundleEntry["resource"],
  };
}

export const patientBundle: FhirBundle = {
  resourceType: "Bundle",
  type: "collection",
  id: "tula-synth-dylan-meyer",
  entry: [
    entry("Patient", PATIENT_ID, {
      meta: { profile: [US_CORE_PATIENT] },
      identifier: [
        {
          use: "usual",
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                code: "MR",
                display: "Medical Record Number",
              },
            ],
          },
          system: "https://tula.example/synthetic-mrn",
          value: "SYNTH-DYLAN-MEYER-001",
        },
      ],
      active: true,
      name: [
        {
          use: "official",
          family: "Meyer",
          given: ["Dylan"],
        },
      ],
      telecom: [
        { system: "phone", value: "555-0100", use: "home" },
        { system: "email", value: "dylan.meyer@example.test" },
      ],
      gender: "male",
      birthDate: "1975-03-14",
      address: [
        {
          use: "home",
          line: ["100 Example Street"],
          city: "Testville",
          state: "MA",
          postalCode: "02108",
          country: "US",
        },
      ],
    }),
    entry("Practitioner", PRACTITIONER_ID, {
      meta: { profile: [US_CORE_PRACTITIONER] },
      identifier: [
        {
          system: "http://hl7.org/fhir/sid/us-npi",
          value: "9999999999",
        },
      ],
      name: [
        {
          family: "Matthews",
          given: ["Dave"],
          prefix: ["Dr."],
          suffix: ["MD"],
        },
      ],
    }),
    entry("Condition", "hypertension", {
      meta: { profile: [US_CORE_CONDITION] },
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
            display: "Active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "confirmed",
            display: "Confirmed",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "problem-list-item",
              display: "Problem List Item",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "59621000",
            display: "Essential hypertension",
          },
          {
            system: "http://hl7.org/fhir/sid/icd-10-cm",
            code: "I10",
            display: "Essential (primary) hypertension",
          },
        ],
        text: "Essential hypertension",
      },
      subject: { reference: PATIENT_FULL_URL, display: "Dylan Meyer" },
      onsetDateTime: "2026-04-30",
      recordedDate: "2026-04-30",
      asserter: { reference: PRACTITIONER_FULL_URL, display: "Dr. Dave Matthews" },
    }),
    entry("Condition", "prediabetes", {
      meta: { profile: [US_CORE_CONDITION] },
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
            display: "Active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "confirmed",
            display: "Confirmed",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "problem-list-item",
              display: "Problem List Item",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "714628002",
            display: "Prediabetes",
          },
          {
            system: "http://hl7.org/fhir/sid/icd-10-cm",
            code: "R73.03",
            display: "Prediabetes",
          },
        ],
        text: "Prediabetes",
      },
      subject: { reference: PATIENT_FULL_URL, display: "Dylan Meyer" },
      onsetDateTime: "2026-04-25",
      recordedDate: "2026-04-25",
    }),
    entry("Condition", "hyperlipidemia", {
      meta: { profile: [US_CORE_CONDITION] },
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
            display: "Active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "confirmed",
            display: "Confirmed",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "problem-list-item",
              display: "Problem List Item",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "55822004",
            display: "Hyperlipidemia",
          },
          {
            system: "http://hl7.org/fhir/sid/icd-10-cm",
            code: "E78.5",
            display: "Hyperlipidemia, unspecified",
          },
        ],
        text: "Hyperlipidemia",
      },
      subject: { reference: PATIENT_FULL_URL, display: "Dylan Meyer" },
      onsetDateTime: "2026-04-25",
      recordedDate: "2026-04-25",
    }),
    entry("AllergyIntolerance", "penicillin", {
      meta: { profile: [US_CORE_ALLERGY] },
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
            code: "active",
            display: "Active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
            code: "confirmed",
            display: "Confirmed",
          },
        ],
      },
      type: "allergy",
      category: ["medication"],
      criticality: "low",
      code: {
        coding: [
          {
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            code: "7980",
            display: "Penicillin",
          },
        ],
        text: "Penicillin",
      },
      patient: { reference: PATIENT_FULL_URL, display: "Dylan Meyer" },
      reaction: [
        {
          manifestation: [
            {
              coding: [
                {
                  system: "http://snomed.info/sct",
                  code: "271807003",
                  display: "Eruption of skin",
                },
              ],
              text: "Rash",
            },
          ],
          severity: "moderate",
        },
      ],
    }),
    entry("MedicationRequest", "lisinopril", {
      meta: { profile: [US_CORE_MED_REQUEST] },
      status: "active",
      intent: "order",
      reportedBoolean: false,
      medicationCodeableConcept: {
        coding: [
          {
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            code: "314076",
            display: "Lisinopril 10 MG Oral Tablet",
          },
        ],
        text: "Lisinopril 10 mg oral tablet",
      },
      subject: { reference: PATIENT_FULL_URL, display: "Dylan Meyer" },
      authoredOn: "2026-04-30",
      requester: {
        reference: PRACTITIONER_FULL_URL,
        display: "Dr. Dave Matthews",
      },
      dosageInstruction: [
        {
          text: "10 mg by mouth once daily",
          timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } },
          route: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "26643006",
                display: "Oral route",
              },
            ],
          },
        },
      ],
    }),
    entry("Immunization", "influenza-2025", {
      meta: { profile: [US_CORE_IMMUNIZATION] },
      status: "completed",
      vaccineCode: {
        coding: [
          {
            system: "http://hl7.org/fhir/sid/cvx",
            code: "141",
            display: "Influenza, seasonal, injectable",
          },
        ],
        text: "Influenza, seasonal, injectable",
      },
      patient: { reference: PATIENT_FULL_URL, display: "Dylan Meyer" },
      occurrenceDateTime: "2025-10-15",
      primarySource: true,
    }),
    entry("Immunization", "covid-2025", {
      meta: { profile: [US_CORE_IMMUNIZATION] },
      status: "completed",
      vaccineCode: {
        coding: [
          {
            system: "http://hl7.org/fhir/sid/cvx",
            code: "208",
            display: "COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL dose",
          },
        ],
        text: "COVID-19 mRNA vaccine",
      },
      patient: { reference: PATIENT_FULL_URL, display: "Dylan Meyer" },
      occurrenceDateTime: "2025-09-20",
      primarySource: true,
    }),
    entry("Immunization", "tdap-2021", {
      meta: { profile: [US_CORE_IMMUNIZATION] },
      status: "completed",
      vaccineCode: {
        coding: [
          {
            system: "http://hl7.org/fhir/sid/cvx",
            code: "115",
            display: "Tdap",
          },
        ],
        text: "Tdap",
      },
      patient: { reference: PATIENT_FULL_URL, display: "Dylan Meyer" },
      occurrenceDateTime: "2021-05-18",
      primarySource: true,
    }),
  ],
};

export function bundleEntries(): BundleEntry[] {
  return structuredClone(patientBundle.entry);
}

export function summarizeResource(resource: { resourceType: string; [key: string]: unknown }): string {
  const type = resource.resourceType;
  if (type === "Patient") {
    return "Dylan Meyer, born 1975-03-14";
  }
  if (type === "Condition") {
    const code = resource.code as { text?: string } | undefined;
    return code?.text ?? "Condition";
  }
  if (type === "AllergyIntolerance") {
    const code = resource.code as { text?: string } | undefined;
    return code?.text ?? "Allergy";
  }
  if (type === "MedicationRequest") {
    const med = resource.medicationCodeableConcept as { text?: string } | undefined;
    return med?.text ?? "Medication";
  }
  if (type === "Immunization") {
    const vac = resource.vaccineCode as { text?: string } | undefined;
    const when = resource.occurrenceDateTime as string | undefined;
    return when ? `${vac?.text ?? "Immunization"} (${when})` : (vac?.text ?? "Immunization");
  }
  if (type === "Practitioner") {
    return "Dr. Dave Matthews";
  }
  return type;
}
