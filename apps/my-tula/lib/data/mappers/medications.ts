import type { MedicationStatement } from "@/lib/data/types";
import type { RawMedicationRequest } from "@/lib/fhir/raw";
import { makeTulaMeta } from "./_internal";

/**
 * Map active MedicationRequest resources (real data) into the app's
 * MedicationStatement view type used by the dashboard and /medications page.
 *
 * Real data facts (grounded):
 * - Active = status === "active" (there are currently 9 such records).
 * - Preferred display name lives in medicationReference.display.
 * - Structured dosage lives in dosageInstruction[0].text.
 * - authoredOn is the best "start of this med" date we have.
 *
 * We synthesize the minimal MedicationStatement shape the UI cards expect.
 */
export function toActiveMedications(
  reqs: RawMedicationRequest[]
): MedicationStatement[] {
  if (!reqs || reqs.length === 0) return [];

  const active = reqs.filter((r) => r.status === "active");

  return active.map((r) => {
    // Name: prefer the inline display on the reference (most reliable in this export)
    const refDisplay = r.medicationReference?.display;
    const ccText = r.medicationCodeableConcept?.text;
    const ccCodingDisplay = r.medicationCodeableConcept?.coding?.[0]?.display;

    const name = refDisplay || ccText || ccCodingDisplay || "Medication";

    // Build a CodeableConcept for the view type (UI only looks at .text or first coding.display)
    const sourceCoding = r.medicationReference?.display
      ? [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "", display: name }]
      : (r.medicationCodeableConcept?.coding ?? []);

    const medicationCodeableConcept = {
      text: name,
      coding: (sourceCoding as any[]).map((c: any) => ({
        system: c.system || "",
        code: c.code || "",
        display: c.display,
      })),
    };

    const dosageText =
      r.dosageInstruction?.[0]?.text ||
      r.dosageInstruction?.[0]?.patientInstruction;

    // Use authoredOn as the effective start (closest analog to the fixture's effectiveDateTime)
    const effectiveDateTime = r.authoredOn;

    return {
      resourceType: "MedicationStatement",
      id: r.id || `med-${Math.random().toString(36).slice(2)}`,
      status: "active",
      medicationCodeableConcept,
      dosageText: dosageText || undefined,
      effectiveDateTime,
      meta: makeTulaMeta({
        provider: r.requester?.display || "Health Records",
        contentType: "prescription",
        processedAt: new Date().toISOString(), // we don't have the original pull time here
      }),
    } satisfies MedicationStatement;
  });
}
