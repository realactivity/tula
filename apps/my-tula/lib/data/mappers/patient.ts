import type { RawPatient } from "@/lib/fhir/raw";

/**
 * Extract the patient's first/given name from the on-disk Patient resource(s).
 * Prefers the "official" name if present; falls back to first available given name.
 * Returns "you" if nothing usable is found (graceful for greeting).
 */
export function toFirstName(patients: RawPatient[]): string {
  if (!patients || patients.length === 0) return "you";

  // Prefer official use
  const official = patients.find((p) =>
    p.name?.some((n) => n.use === "official" && n.given && n.given.length > 0)
  );
  const candidate = official || patients[0];

  const nameEntry = candidate?.name?.find(
    (n) => (n.use === "official" || n.use === "usual" || !n.use) && n.given && n.given.length > 0
  ) ?? candidate?.name?.[0];

  const given = nameEntry?.given?.[0];
  if (given && typeof given === "string" && given.trim()) {
    return given.trim();
  }

  // Last resort: try text "Paul Swider" -> first word
  const text = nameEntry?.text;
  if (text) {
    const first = text.split(/\s+/)[0];
    if (first) return first;
  }

  return "you";
}
