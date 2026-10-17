import type { TulaMeta } from "@/lib/data/types";

/**
 * Internal helpers shared by the FHIR mappers.
 * Not part of the public mapper API.
 */

/**
 * Fabricate the TulaMeta shape that the app's view types (Observation,
 * MedicationStatement, etc.) require in .meta.
 *
 * Real on-disk resources have a standard FHIR meta { source, lastUpdated }.
 * The dashboard was written against the email-router's synthetic shape that
 * includes meta.tula.* provenance. We synthesize a minimal version here so
 * the existing UI components continue to work unchanged.
 */
export function makeTulaMeta(opts: {
  emailFrom?: string;
  provider?: string;
  contentType?: string;
  processedAt?: string;
  confidence?: number;
}): TulaMeta {
  return {
    source: "manual", // health-records-pull / direct import; not "email" in this dataset
    tula: {
      emailFrom: opts.emailFrom,
      provider: opts.provider,
      contentType: opts.contentType,
      processedAt: opts.processedAt || new Date().toISOString(),
      confidence: opts.confidence,
    },
  };
}

/**
 * Best-effort ISO date from raw effective fields.
 * Prefers effectiveDateTime, falls back to effectivePeriod.start.
 */
export function pickEffectiveDateTime(raw: {
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string };
}): string | undefined {
  if (raw.effectiveDateTime) return raw.effectiveDateTime;
  return raw.effectivePeriod?.start;
}

/**
 * Pick a short human label for a lab from the code.
 */
export function pickLabLabel(code?: { text?: string; coding?: Array<{ display?: string; code?: string }> }): string {
  if (!code) return "Lab result";
  return code.text || code.coding?.find((c) => c.display)?.display || code.coding?.[0]?.code || "Lab result";
}

/**
 * Get numeric value if present.
 */
export function getNumericValue(q?: { value?: number }): number | undefined {
  return typeof q?.value === "number" ? q.value : undefined;
}
