import type {
  FormAnswer,
  FhirCoding,
  FhirResource,
  Questionnaire,
  QuestionnaireItem,
  RequestItem,
} from "./types";

export function isQuestionnaire(value: unknown): value is Questionnaire {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Questionnaire).resourceType === "Questionnaire"
  );
}

export function formCanonical(item: RequestItem): string | undefined {
  const content = item.content;
  if (typeof content.questionnaireCanonical === "string" && content.questionnaireCanonical) {
    return content.questionnaireCanonical;
  }
  if (isQuestionnaire(content.questionnaire)) {
    const url = content.questionnaire.url;
    const version = content.questionnaire.version;
    if (url && version) return `${url}|${version}`;
    return url;
  }
  return undefined;
}

export function inlineQuestionnaire(item: RequestItem): Questionnaire | undefined {
  return isQuestionnaire(item.content.questionnaire) ? item.content.questionnaire : undefined;
}

export function splitCanonical(canonical: string): { url: string; version?: string } {
  const bar = canonical.indexOf("|");
  if (bar === -1) return { url: canonical };
  return { url: canonical.slice(0, bar), version: canonical.slice(bar + 1) };
}

/**
 * Load the Questionnaire for a form.fhir item. Inline copy wins.
 * A versioned canonical is accepted only when url and version match (CAN-4).
 */
export async function loadQuestionnaire(
  item: RequestItem,
  fetchImpl: typeof fetch = fetch,
): Promise<{ questionnaire: Questionnaire; canonical: string } | { error: string }> {
  const canonical = formCanonical(item);
  const inline = inlineQuestionnaire(item);

  if (inline) {
    if (canonical) {
      const { url, version } = splitCanonical(canonical);
      if (inline.url && inline.url !== url) {
        return { error: "Inline Questionnaire.url does not match questionnaireCanonical" };
      }
      if (version && inline.version && inline.version !== version) {
        return { error: "Inline Questionnaire.version does not match questionnaireCanonical" };
      }
    }
    const echoed =
      canonical ??
      (inline.url
        ? inline.version
          ? `${inline.url}|${inline.version}`
          : inline.url
        : undefined);
    if (!echoed) {
      return { error: "Form item has no questionnaireCanonical or Questionnaire.url" };
    }
    return { questionnaire: inline, canonical: echoed };
  }

  if (!canonical) {
    return { error: "Form item has no questionnaire to render" };
  }

  const { url, version } = splitCanonical(canonical);
  try {
    const res = await fetchImpl(url);
    if (!res.ok) {
      return { error: `Could not fetch Questionnaire (${res.status})` };
    }
    const body: unknown = await res.json();
    if (!isQuestionnaire(body)) {
      return { error: "Fetched document is not a Questionnaire" };
    }
    if (body.url && body.url !== url) {
      return { error: "Fetched Questionnaire.url does not match the canonical" };
    }
    if (version && body.version !== version) {
      return { error: "Fetched Questionnaire.version does not match the canonical" };
    }
    return { questionnaire: body, canonical };
  } catch {
    return { error: "Could not fetch Questionnaire" };
  }
}

export function walkItems(items: QuestionnaireItem[] | undefined): QuestionnaireItem[] {
  if (!items) return [];
  const out: QuestionnaireItem[] = [];
  for (const item of items) {
    out.push(item);
    if (item.item) out.push(...walkItems(item.item));
  }
  return out;
}

export function answerableItems(questionnaire: Questionnaire): QuestionnaireItem[] {
  return walkItems(questionnaire.item).filter(
    (item) => item.type !== "display" && item.type !== "group",
  );
}

export function isFormComplete(
  questionnaire: Questionnaire,
  answers: FormAnswer[],
): boolean {
  const answered = new Set(
    answers.filter((answer) => hasValue(answer)).map((answer) => answer.linkId),
  );
  return answerableItems(questionnaire).every((item) => {
    if (item.required === false) return true;
    // FHIR required defaults to false, but connectathon screens (PHQ-2)
    // need both questions answered to count as fulfilled.
    return answered.has(item.linkId);
  });
}

export function hasValue(answer: FormAnswer): boolean {
  return (
    answer.valueCoding !== undefined ||
    answer.valueString !== undefined ||
    answer.valueBoolean !== undefined ||
    answer.valueInteger !== undefined ||
    answer.valueDecimal !== undefined ||
    answer.valueDate !== undefined
  );
}

export function buildQuestionnaireResponse(args: {
  canonical: string;
  questionnaire: Questionnaire;
  answers: FormAnswer[];
  authored?: string;
  subjectReference?: string;
}): FhirResource {
  const byLink = new Map(args.answers.map((answer) => [answer.linkId, answer]));
  const items = responseItems(args.questionnaire.item ?? [], byLink);
  return {
    resourceType: "QuestionnaireResponse",
    status: "completed",
    questionnaire: args.canonical,
    subject: args.subjectReference
      ? { reference: args.subjectReference, display: "Dylan Meyer" }
      : undefined,
    authored: args.authored ?? new Date().toISOString(),
    item: items,
  };
}

function responseItems(
  items: QuestionnaireItem[],
  answers: Map<string, FormAnswer>,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const item of items) {
    if (item.type === "display") continue;
    if (item.type === "group") {
      const children = responseItems(item.item ?? [], answers);
      if (children.length) {
        out.push({ linkId: item.linkId, text: item.text, item: children });
      }
      continue;
    }
    const answer = answers.get(item.linkId);
    if (!answer || !hasValue(answer)) continue;
    out.push({
      linkId: item.linkId,
      text: answer.text ?? item.text,
      answer: [answerValue(answer)],
    });
  }
  return out;
}

function answerValue(answer: FormAnswer): Record<string, unknown> {
  if (answer.valueCoding) return { valueCoding: stripCoding(answer.valueCoding) };
  if (answer.valueString !== undefined) return { valueString: answer.valueString };
  if (answer.valueBoolean !== undefined) return { valueBoolean: answer.valueBoolean };
  if (answer.valueInteger !== undefined) return { valueInteger: answer.valueInteger };
  if (answer.valueDecimal !== undefined) return { valueDecimal: answer.valueDecimal };
  return { valueDate: answer.valueDate };
}

function stripCoding(coding: FhirCoding): FhirCoding {
  const out: FhirCoding = {};
  if (coding.system) out.system = coding.system;
  if (coding.code) out.code = coding.code;
  if (coding.display) out.display = coding.display;
  return out;
}
