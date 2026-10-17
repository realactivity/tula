import type { SmartCheckinRequest, SmartCheckinResponse } from "@smart-health-checkin/client/model";
import { parseSmartCheckinRequest } from "@smart-health-checkin/client/model";
import { checkWalletResponse } from "@smart-health-checkin/client/wallet";
import { describe, expect, it } from "vitest";
import formPhq2 from "../fixtures/form-phq2.request.json";
import records from "../fixtures/records.request.json";
import unknownSelector from "../fixtures/unknown-selector.request.json";
import { bundleEntries } from "../patient";
import { SAMPLE_PHQ2_ANSWERS } from "../phq2";
import { isInsuranceItem } from "../policy";
import {
  asRequest,
  buildCheckinResponse,
  declineItem,
  defaultDecisions,
  responseSizeBytes,
} from "../respond";
import { COVERAGE_UNAVAILABLE_MESSAGE, MAX_RESPONSE_BYTES } from "../types";

function parse(raw: unknown) {
  const parsed = parseSmartCheckinRequest(JSON.stringify({
    ...(raw as object),
    id: "req-test-001",
  }));
  if (!parsed.ok) throw new Error(parsed.error);
  return asRequest(parsed.value);
}

function specRequest(request: ReturnType<typeof parse>): SmartCheckinRequest {
  return request as unknown as SmartCheckinRequest;
}

function specResponse(response: { type: string }): SmartCheckinResponse {
  return response as unknown as SmartCheckinResponse;
}

describe("share-records", () => {
  it("fulfills health items and returns coverage unavailable", async () => {
    const request = parse(records);
    const decisions = defaultDecisions(request);
    const response = await buildCheckinResponse({
      request,
      entries: bundleEntries(),
      decisions,
    });

    expect(response.requestId).toBe("req-test-001");
    const byItem = Object.fromEntries(response.requestStatus.map((row) => [row.item, row]));
    expect(byItem.patient.status).toBe("fulfilled");
    expect(byItem.problems.status).toBe("fulfilled");
    expect(byItem.allergies.status).toBe("fulfilled");
    expect(byItem.medications.status).toBe("fulfilled");
    expect(byItem.immunizations.status).toBe("fulfilled");
    expect(byItem.coverage.status).toBe("unavailable");
    expect(byItem.coverage.message).toBe(COVERAGE_UNAVAILABLE_MESSAGE);

    const coverageArtifacts = response.artifacts.filter((artifact) =>
      artifact.fulfills.includes("coverage"),
    );
    expect(coverageArtifacts).toHaveLength(0);

    const issues = checkWalletResponse(specRequest(request), specResponse(response));
    expect(issues).toEqual([]);
    expect(responseSizeBytes(response)).toBeLessThan(MAX_RESPONSE_BYTES);
  });

  it("returns FHIR R4 application/fhir+json for shared items", async () => {
    const request = parse(records);
    const response = await buildCheckinResponse({
      request,
      entries: bundleEntries(),
      decisions: defaultDecisions(request),
    });
    for (const artifact of response.artifacts) {
      expect(artifact.mediaType).toBe("application/fhir+json");
      expect(artifact.fhirVersion).toBe("4.0.1");
      expect(artifact.value.resourceType).toBe("Bundle");
    }
    const patient = response.artifacts.find((artifact) => artifact.fulfills.includes("patient"));
    const bundle = patient?.value as unknown as {
      entry: Array<{ resource: { resourceType: string; meta?: { profile?: string[] } } }>;
    };
    expect(bundle.entry[0].resource.resourceType).toBe("Patient");
    expect(bundle.entry[0].resource.meta?.profile).toContain(
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    );
  });
});

describe("decline-item", () => {
  it("declines immunizations and still shares the rest", async () => {
    const request = parse(records);
    const decisions = declineItem(defaultDecisions(request), "immunizations");
    const response = await buildCheckinResponse({
      request,
      entries: bundleEntries(),
      decisions,
    });
    const byItem = Object.fromEntries(response.requestStatus.map((row) => [row.item, row]));
    expect(byItem.immunizations.status).toBe("declined");
    expect(byItem.patient.status).toBe("fulfilled");
    expect(byItem.coverage.status).toBe("unavailable");
    expect(response.artifacts.some((artifact) => artifact.fulfills.includes("immunizations"))).toBe(false);
    expect(checkWalletResponse(specRequest(request), specResponse(response))).toEqual([]);
  });
});

describe("fill-form", () => {
  it("returns a QuestionnaireResponse that echoes the requested canonical", async () => {
    const request = parse(formPhq2);
    const decisions = defaultDecisions(request).map((decision) =>
      decision.itemId === "phq2"
        ? { ...decision, formAnswers: SAMPLE_PHQ2_ANSWERS }
        : decision,
    );
    const response = await buildCheckinResponse({
      request,
      entries: bundleEntries(),
      decisions,
      now: "2026-10-13T12:00:00Z",
    });
    const byItem = Object.fromEntries(response.requestStatus.map((row) => [row.item, row]));
    expect(byItem.phq2.status).toBe("fulfilled");
    const form = response.artifacts.find((artifact) => artifact.fulfills.includes("phq2"));
    expect(form?.value.resourceType).toBe("QuestionnaireResponse");
    expect(form?.value.questionnaire).toBe(
      "https://smart-health-checkin.org/connectathon/Questionnaire/phq-2.json",
    );
    const items = form?.value.item as Array<{ linkId: string }>;
    expect(items.map((item) => item.linkId)).toEqual(["phq2-1", "phq2-2"]);
    expect(checkWalletResponse(specRequest(request), specResponse(response))).toEqual([]);
  });
});

describe("unknown selector", () => {
  it("answers the unknown item unsupported and still shares demographics", async () => {
    const request = parse(unknownSelector);
    const response = await buildCheckinResponse({
      request,
      entries: bundleEntries(),
      decisions: defaultDecisions(request),
    });
    const byItem = Object.fromEntries(response.requestStatus.map((row) => [row.item, row]));
    expect(byItem.patient.status).toBe("fulfilled");
    expect(byItem.mystery.status).toBe("unsupported");
    expect(checkWalletResponse(specRequest(request), specResponse(response))).toEqual([]);
  });
});

describe("edge cases", () => {
  it("declines insurance when the patient turns that item off", async () => {
    const request = parse(records);
    const response = await buildCheckinResponse({
      request,
      entries: bundleEntries(),
      decisions: declineItem(defaultDecisions(request), "coverage"),
    });
    const coverage = response.requestStatus.find((row) => row.item === "coverage");
    expect(coverage?.status).toBe("declined");
    expect(response.artifacts.some((artifact) => artifact.fulfills.includes("coverage"))).toBe(false);
    expect(checkWalletResponse(specRequest(request), specResponse(response))).toEqual([]);
  });

  it("does not call an incomplete form declined", async () => {
    const request = parse(formPhq2);
    const response = await buildCheckinResponse({
      request,
      entries: bundleEntries(),
      decisions: defaultDecisions(request),
    });
    const phq2 = response.requestStatus.find((row) => row.item === "phq2");
    expect(phq2?.status).toBe("error");
    expect(response.artifacts.some((artifact) => artifact.fulfills.includes("phq2"))).toBe(false);
    expect(checkWalletResponse(specRequest(request), specResponse(response))).toEqual([]);
  });

  it("returns unsupported when the item does not accept FHIR JSON", async () => {
    const request = parse({
      type: "smart-health-checkin-request",
      version: "1",
      purpose: "Pre-visit check-in",
      fhirVersions: ["4.0.1"],
      items: [
        {
          id: "immunizations",
          title: "Immunizations",
          content: {
            kind: "selection.fhir",
            profiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization"],
          },
          accept: ["application/smart-health-card"],
        },
      ],
    });
    const response = await buildCheckinResponse({
      request,
      entries: bundleEntries(),
      decisions: defaultDecisions(request),
    });
    expect(response.requestStatus).toEqual([
      expect.objectContaining({ item: "immunizations", status: "unsupported" }),
    ]);
    expect(response.artifacts).toHaveLength(0);
    expect(checkWalletResponse(specRequest(request), specResponse(response))).toEqual([]);
  });

  it("includes a referenced prescriber and refuses an oversized response", async () => {
    const request = parse(records);
    const entries = bundleEntries();
    const response = await buildCheckinResponse({
      request,
      entries,
      decisions: defaultDecisions(request),
    });
    const medications = response.artifacts.find((artifact) => artifact.fulfills.includes("medications"));
    const bundle = medications?.value as { entry?: Array<{ resource: { resourceType: string } }> };
    expect(bundle.entry?.some((entry) => entry.resource.resourceType === "Practitioner")).toBe(true);

    const bloated = structuredClone(entries);
    const patient = bloated.find((entry) => entry.resource.resourceType === "Patient");
    patient!.resource.text = "x".repeat(MAX_RESPONSE_BYTES);
    await expect(buildCheckinResponse({
      request,
      entries: bloated,
      decisions: defaultDecisions(request),
    })).rejects.toThrow(/512 KB/);
  });
});

describe("policy", () => {
  it("treats the records.json coverage item as insurance", () => {
    const request = parse(records);
    const coverage = request.items.find((item) => item.id === "coverage");
    expect(coverage && isInsuranceItem(coverage)).toBe(true);
  });
});
