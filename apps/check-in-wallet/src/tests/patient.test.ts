import { describe, expect, it } from "vitest";
import { PATIENT_ID, bundleEntries, patientBundle } from "../patient";

describe("synthetic Dylan Meyer record", () => {
  it("contains only the Tula synthetic persona", () => {
    const json = JSON.stringify(patientBundle);
    expect(json).toContain("Dylan Meyer");
    expect(json).not.toMatch(/Driscoll|Lawrence General|beverly/i);
    expect(patientBundle.entry.some((entry) => entry.resource.resourceType === "Coverage")).toBe(
      false,
    );
  });

  it("claims US Core profiles on the resources the minimum scenarios ask for", () => {
    const byType = new Map<string, string[]>();
    for (const entry of bundleEntries()) {
      const profiles = entry.resource.meta?.profile ?? [];
      byType.set(entry.resource.resourceType, profiles);
    }
    expect(byType.get("Patient")).toContain(
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    );
    expect(byType.get("Condition")).toContain(
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns",
    );
    expect(byType.get("AllergyIntolerance")).toContain(
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
    );
    expect(byType.get("MedicationRequest")).toContain(
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
    );
    expect(byType.get("Immunization")).toContain(
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
    );
  });

  it("uses a synthetic MRN and Patient id", () => {
    const patient = bundleEntries().find((entry) => entry.resource.resourceType === "Patient");
    expect(patient?.resource.id).toBe(PATIENT_ID);
    const identifier = (patient?.resource.identifier as Array<{ value?: string }>)[0];
    expect(identifier.value).toBe("SYNTH-DYLAN-MEYER-001");
  });
});
