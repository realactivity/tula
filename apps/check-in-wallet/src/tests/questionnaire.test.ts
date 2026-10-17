import { describe, expect, it } from "vitest";
import formPhq2 from "../fixtures/form-phq2.request.json";
import {
  buildQuestionnaireResponse,
  formCanonical,
  hasValue,
  isFormComplete,
  loadQuestionnaire,
} from "../questionnaire";
import { SAMPLE_PHQ2_ANSWERS } from "../phq2";
import { asRequest } from "../respond";

const request = asRequest(formPhq2);
const phq2 = request.items.find((item) => item.id === "phq2");
if (!phq2) throw new Error("missing phq2 item");

describe("PHQ-2 form helpers", () => {
  it("echoes the request canonical, not a reconstructed one", () => {
    expect(formCanonical(phq2)).toBe(
      "https://smart-health-checkin.org/connectathon/Questionnaire/phq-2.json",
    );
  });

  it("requires both answers before the form is complete", async () => {
    const loaded = await loadQuestionnaire(phq2);
    if ("error" in loaded) throw new Error(loaded.error);
    expect(isFormComplete(loaded.questionnaire, [])).toBe(false);
    expect(isFormComplete(loaded.questionnaire, SAMPLE_PHQ2_ANSWERS.slice(0, 1))).toBe(false);
    expect(isFormComplete(loaded.questionnaire, SAMPLE_PHQ2_ANSWERS)).toBe(true);
  });

  it("builds a completed QuestionnaireResponse", async () => {
    const loaded = await loadQuestionnaire(phq2);
    if ("error" in loaded) throw new Error(loaded.error);
    const qr = buildQuestionnaireResponse({
      canonical: loaded.canonical,
      questionnaire: loaded.questionnaire,
      answers: SAMPLE_PHQ2_ANSWERS,
      authored: "2026-10-13T12:00:00Z",
    });
    expect(qr.questionnaire).toBe(loaded.canonical);
    expect(qr.status).toBe("completed");
    expect(Array.isArray(qr.item) && (qr.item as unknown[]).length).toBe(2);
  });

  it("does not treat a blank string as an answer", () => {
    expect(hasValue({ linkId: "q", valueString: "   " })).toBe(false);
    expect(hasValue({ linkId: "q", valueBoolean: false })).toBe(true);
  });

  it("fetches a remote questionnaire only from https and without cookies", async () => {
    const remote = structuredClone(phq2);
    delete remote.content.questionnaire;
    remote.content.questionnaireCanonical = "http://evil.example/q.json";
    let called = false;
    const blocked = await loadQuestionnaire(remote, (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch);
    expect(called).toBe(false);
    expect("error" in blocked).toBe(true);

    remote.content.questionnaireCanonical = "https://example.test/q.json";
    const loaded = await loadQuestionnaire(remote, (async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe("https://example.test/q.json");
      expect(init?.credentials).toBe("omit");
      expect(init?.redirect).toBe("error");
      return new Response(JSON.stringify({
        resourceType: "Questionnaire",
        url: "https://example.test/q.json",
        item: [],
      }), { status: 200, headers: { "content-type": "application/fhir+json" } });
    }) as typeof fetch);
    expect("error" in loaded).toBe(false);
  });

  it("rejects a versioned canonical that does not match the inline form", async () => {
    const clone = structuredClone(phq2);
    clone.content.questionnaireCanonical =
      "https://smart-health-checkin.org/connectathon/Questionnaire/phq-2.json|99";
    const loaded = await loadQuestionnaire(clone);
    expect("error" in loaded).toBe(true);
  });
});
