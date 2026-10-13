import type { RequestItem } from "./types";

/**
 * Tula policy: this wallet shares health data, not insurance cards.
 * Coverage / C4DIC items are answered unavailable (or declined if the
 * patient turns the item off). They never produce an artifact.
 */
export function isInsuranceItem(item: RequestItem): boolean {
  const content = item.content;
  if (content.kind !== "selection.fhir") return false;
  const profiles = Array.isArray(content.profiles)
    ? (content.profiles as string[])
    : [];
  return profiles.some(
    (profile) =>
      profile.includes("C4DIC-Coverage") ||
      profile.includes("us-core-coverage") ||
      profile.includes("insurance-card"),
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
