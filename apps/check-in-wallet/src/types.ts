export type JsonObject = Record<string, unknown>;

export type FhirCoding = {
  system?: string;
  code?: string;
  display?: string;
};

export type FhirResource = JsonObject & {
  resourceType: string;
  id?: string;
  meta?: { profile?: string[] };
};

export type BundleEntry = {
  fullUrl: string;
  resource: FhirResource;
};

export type FhirBundle = {
  resourceType: "Bundle";
  type: string;
  id?: string;
  entry: BundleEntry[];
};

export type QuestionnaireItem = {
  linkId: string;
  text?: string;
  prefix?: string;
  type: string;
  required?: boolean;
  code?: FhirCoding[];
  answerOption?: Array<{
    valueCoding?: FhirCoding;
    valueString?: string;
    valueInteger?: number;
  }>;
  item?: QuestionnaireItem[];
};

export type Questionnaire = {
  resourceType: "Questionnaire";
  url?: string;
  version?: string;
  title?: string;
  name?: string;
  status?: string;
  item?: QuestionnaireItem[];
};

export type FormAnswer = {
  linkId: string;
  text?: string;
  valueCoding?: FhirCoding;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueDate?: string;
};

export type ItemAction =
  | "share"
  | "decline"
  | "unavailable"
  | "unsupported";

export type ItemDecision = {
  itemId: string;
  action: ItemAction;
  formAnswers?: FormAnswer[];
};

export type RequestItem = {
  id: string;
  title?: string;
  summary?: string;
  required?: boolean;
  content: JsonObject;
  accept: string[];
};

export type SmartRequest = {
  type: "smart-health-checkin-request";
  version: "1";
  id: string;
  purpose?: string;
  fhirVersions?: string[];
  items: RequestItem[];
};

export type ItemStatusCode =
  | "fulfilled"
  | "partial"
  | "unavailable"
  | "declined"
  | "unsupported"
  | "error";

export type Artifact = {
  id: string;
  mediaType: "application/fhir+json";
  fhirVersion: "4.0.1";
  fulfills: string[];
  value: FhirResource;
};

export type SmartResponse = {
  type: "smart-health-checkin-response";
  version: "1";
  requestId: string;
  artifacts: Artifact[];
  requestStatus: Array<{
    item: string;
    status: ItemStatusCode;
    message?: string;
  }>;
};

export const FHIR_JSON = "application/fhir+json";
export const FHIR_R4 = "4.0.1";
export const MAX_RESPONSE_BYTES = 512 * 1024;

export const COVERAGE_UNAVAILABLE_MESSAGE =
  "Tula holds health data only. Insurance cards are not stored and are not shared.";
