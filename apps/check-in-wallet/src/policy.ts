import type { RequestItem } from "./types";

/**
 * Tula policy: this wallet shares health data, not insurance cards.
 * Coverage / C4DIC items are answered unavailable (or declined if the
 * patient turns the item off). They never produce an artifact.
 */
function canonicals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/** Coverage / insurance-card profiles. Tula does not store or share these. */
export function isCoverageCanonical(canonical: string): boolean {
  const url = canonical.split("|")[0];
  return (
    url.endsWith("/C4DIC-Coverage") ||
    url.endsWith("/us-core-coverage") ||
    url.includes("/insurance-card/")
  );
}

export function isInsuranceItem(item: RequestItem): boolean {
  const content = item.content;
  if (content.kind !== "selection.fhir") return false;
  return [...canonicals(content.profiles), ...canonicals(content.profilesFrom)].some(
    isCoverageCanonical,
  );
}

export function isSelectionItem(item: RequestItem): boolean {
  return item.content.kind === "selection.fhir";
}

export function isFormItem(item: RequestItem): boolean {
  return item.content.kind === "form.fhir";
}

export function isUnknownKind(item: RequestItem): boolean {
  const kind = item.content.kind;
  return kind !== "selection.fhir" && kind !== "form.fhir";
}
