import { selectEntries } from "@smart-health-checkin/client/wallet";
import type { SelectionContent } from "@smart-health-checkin/client/wallet";
import { PATIENT_FULL_URL, PATIENT_ID } from "./patient";
import { isFormItem, isInsuranceItem, isSelectionItem, isUnknownKind } from "./policy";
import {
  buildQuestionnaireResponse,
  isFormComplete,
  loadQuestionnaire,
} from "./questionnaire";
import type {
  Artifact,
  BundleEntry,
  FormAnswer,
  ItemDecision,
  ItemStatusCode,
  Questionnaire,
  RequestItem,
  SmartRequest,
  SmartResponse,
} from "./types";
import { COVERAGE_UNAVAILABLE_MESSAGE, FHIR_JSON, FHIR_R4 } from "./types";

export type UnsupportedHint = { id: string };

export type BuiltResponse = {
  response: SmartResponse;
  issues: string[];
};

export function asRequest(value: unknown): SmartRequest {
  const request = value as SmartRequest;
  if (request?.type !== "smart-health-checkin-request") {
    throw new Error("Not a SMART Health Check-in request");
  }
  return request;
}

export function defaultDecisions(
  request: SmartRequest,
  unsupportedIds: Iterable<string> = [],
): ItemDecision[] {
  const unsupported = new Set(unsupportedIds);
  return request.items.map((item) => {
    if (unsupported.has(item.id) || isUnknownKind(item)) {
      return { itemId: item.id, action: "unsupported" as const };
    }
    if (isInsuranceItem(item)) {
      return { itemId: item.id, action: "unavailable" as const };
    }
    return { itemId: item.id, action: "share" as const };
  });
}

export function declineItem(decisions: ItemDecision[], itemId: string): ItemDecision[] {
  return decisions.map((decision) =>
    decision.itemId === itemId ? { ...decision, action: "decline" } : decision,
  );
}

export async function buildCheckinResponse(args: {
  request: SmartRequest;
  entries: BundleEntry[];
  decisions: ItemDecision[];
  unsupportedItems?: UnsupportedHint[];
  fetchImpl?: typeof fetch;
  now?: string;
}): Promise<BuiltResponse> {
  const issues: string[] = [];
  const artifacts: Artifact[] = [];
  const requestStatus: SmartResponse["requestStatus"] = [];
  const decisionById = new Map(args.decisions.map((decision) => [decision.itemId, decision]));
  const unsupported = new Set((args.unsupportedItems ?? []).map((item) => item.id));
  let artifactIndex = 1;

  for (const item of args.request.items) {
    const decision = decisionById.get(item.id) ?? { itemId: item.id, action: "share" as const };

    if (unsupported.has(item.id) || isUnknownKind(item)) {
      requestStatus.push({
        item: item.id,
        status: decision.action === "decline" ? "declined" : "unsupported",
        message:
          decision.action === "decline"
            ? undefined
            : "This wallet does not handle this kind of request item.",
      });
      continue;
    }

    if (decision.action === "decline") {
      requestStatus.push({ item: item.id, status: "declined" });
      continue;
    }

    if (isInsuranceItem(item)) {
      requestStatus.push({
        item: item.id,
        status: "unavailable",
        message: COVERAGE_UNAVAILABLE_MESSAGE,
      });
      continue;
    }

    if (isFormItem(item)) {
      const built = await buildFormArtifact(item, decision.formAnswers ?? [], {
        fetchImpl: args.fetchImpl,
        now: args.now,
        artifactId: `a${artifactIndex}`,
      });
      if (built.kind === "artifact") {
        artifacts.push(built.artifact);
        artifactIndex += 1;
        requestStatus.push({ item: item.id, status: "fulfilled" });
      } else {
        requestStatus.push({ item: item.id, status: built.status, message: built.message });
        if (built.issue) issues.push(built.issue);
      }
      continue;
    }

    if (!isSelectionItem(item)) {
      requestStatus.push({
        item: item.id,
        status: "unsupported",
        message: "This wallet does not handle this kind of request item.",
      });
      continue;
    }

    const selected = selectMatchingEntries(item, args.entries);
    if (selected.length === 0) {
      requestStatus.push({
        item: item.id,
        status: "unavailable",
        message: "No matching records in this wallet.",
      });
      continue;
    }

    if (decision.action !== "share") {
      requestStatus.push({
        item: item.id,
        status: decision.action as ItemStatusCode,
      });
      continue;
    }

    artifacts.push({
      id: `a${artifactIndex}`,
      mediaType: FHIR_JSON,
      fhirVersion: FHIR_R4,
      fulfills: [item.id],
      value: {
        resourceType: "Bundle",
        type: "collection",
        entry: selected.map((entry) => ({
          fullUrl: entry.fullUrl,
          resource: entry.resource,
        })),
      },
    });
    artifactIndex += 1;
    requestStatus.push({ item: item.id, status: "fulfilled" });
  }

  const response: SmartResponse = {
    type: "smart-health-checkin-response",
    version: "1",
    requestId: args.request.id,
    artifacts,
    requestStatus,
  };

  return { response, issues };
}

function selectMatchingEntries(item: RequestItem, entries: BundleEntry[]): BundleEntry[] {
  const content = item.content as SelectionContent;
  return selectEntries(content, entries, { exclude: [PATIENT_FULL_URL] }) as BundleEntry[];
}

async function buildFormArtifact(
  item: RequestItem,
  answers: FormAnswer[],
  options: { fetchImpl?: typeof fetch; now?: string; artifactId: string },
): Promise<
  | { kind: "artifact"; artifact: Artifact }
  | { kind: "status"; status: ItemStatusCode; message?: string; issue?: string }
> {
  const loaded = await loadQuestionnaire(item, options.fetchImpl);
  if ("error" in loaded) {
    return {
      kind: "status",
      status: "unsupported",
      message: loaded.error,
      issue: loaded.error,
    };
  }
  if (!isFormComplete(loaded.questionnaire, answers)) {
    return {
      kind: "status",
      status: "declined",
      message: "The form was not completed.",
    };
  }
  return {
    kind: "artifact",
    artifact: {
      id: options.artifactId,
      mediaType: FHIR_JSON,
      fhirVersion: FHIR_R4,
      fulfills: [item.id],
      value: buildQuestionnaireResponse({
        canonical: loaded.canonical,
        questionnaire: loaded.questionnaire,
        answers,
        authored: options.now,
        subjectReference: `Patient/${PATIENT_ID}`,
      }),
    },
  };
}

export function previewSelection(
  item: RequestItem,
  entries: BundleEntry[],
): BundleEntry[] {
  if (!isSelectionItem(item) || isInsuranceItem(item)) return [];
  return selectMatchingEntries(item, entries);
}

export function responseSizeBytes(response: SmartResponse): number {
  return new TextEncoder().encode(JSON.stringify(response)).length;
}

export type LoadedForm = {
  itemId: string;
  questionnaire: Questionnaire;
  canonical: string;
};

export async function loadForms(
  request: SmartRequest,
  fetchImpl?: typeof fetch,
): Promise<{ forms: LoadedForm[]; unsupported: Array<{ id: string; message: string }> }> {
  const forms: LoadedForm[] = [];
  const unsupported: Array<{ id: string; message: string }> = [];
  for (const item of request.items) {
    if (!isFormItem(item)) continue;
    const loaded = await loadQuestionnaire(item, fetchImpl);
    if ("error" in loaded) {
      unsupported.push({ id: item.id, message: loaded.error });
    } else {
      forms.push({ itemId: item.id, questionnaire: loaded.questionnaire, canonical: loaded.canonical });
    }
  }
  return { forms, unsupported };
}
