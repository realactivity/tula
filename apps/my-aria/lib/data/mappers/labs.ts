import type { LabTrend, Observation } from "@/lib/data/types";
import type { RawObservation } from "@/lib/fhir/raw";
import { makeTulaMeta, pickEffectiveDateTime, pickLabLabel, getNumericValue } from "./_internal";

/**
 * Map raw laboratory Observations into the dashboard's LabTrend[] shape.
 *
 * Grounded rules (from actual MGB/Epic export):
 * - Only Observations whose category contains code "laboratory".
 * - Only those with a numeric valueQuantity (many have valueString for
 *   qualitative results like "Patient Fasting: No").
 * - Preferred grouping key: first coding with system "http://loinc.org".
 *   Fall back to code.text (e.g. "Patient Fasting").
 * - History sparkline uses up to the last 8 numeric values, oldest first.
 * - Delta string compares the two most recent values when possible.
 * - We return at most `limit` trends, choosing the ones whose latest
 *   reading is most recent (so the dashboard always shows the freshest data).
 *
 * The output Observation objects are shaped exactly like the ones in
 * lib/data/types.ts (and fixtures) so all existing cards work unchanged.
 */
export function toRecentLabs(
  observations: RawObservation[],
  limit = 6
): LabTrend[] {
  if (!observations || observations.length === 0) return [];

  // 1. Filter to laboratory + numeric
  const labs = observations.filter((o) => {
    const isLab = (o.category ?? []).some((cat) =>
      (cat.coding ?? []).some((c) => c.code === "laboratory")
    );
    const hasNumber = getNumericValue(o.valueQuantity) !== undefined;
    return isLab && hasNumber;
  });

  if (labs.length === 0) return [];

  // 2. Group by stable key (LOINC preferred, else text)
  const groups = new Map<string, RawObservation[]>();

  for (const o of labs) {
    const loinc = (o.code?.coding ?? []).find(
      (c) => c.system === "http://loinc.org" && c.code
    );
    const key = loinc?.code || o.code?.text || o.id || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  // 3. For each group, build a LabTrend
  const trends: LabTrend[] = [];

  for (const [key, group] of groups.entries()) {
    // Sort ascending by effective time (oldest first) so last 8 are recent history
    const sorted = [...group].sort((a, b) => {
      const da = pickEffectiveDateTime(a) || "";
      const db = pickEffectiveDateTime(b) || "";
      return da.localeCompare(db);
    });

    const numericValues = sorted
      .map((o) => getNumericValue(o.valueQuantity))
      .filter((v): v is number => v !== undefined);

    if (numericValues.length === 0) continue;

    const latestRaw = sorted[sorted.length - 1];
    const latestValue = numericValues[numericValues.length - 1];

    // Build the view-model Observation for the "latest"
    const latest: Observation = {
      resourceType: "Observation",
      id: latestRaw.id || key,
      status: (latestRaw.status as any) || "final",
      // Normalize raw (loose/optional) category into the strict view CodeableConcept[]
      category: ((latestRaw.category ?? []) as any[]).map((c: any) => ({
        coding: (c.coding ?? []).map((cc: any) => ({
          system: cc.system || "",
          code: cc.code || "",
          display: cc.display,
        })),
        text: c.text,
      })),
      code: {
        coding: (latestRaw.code?.coding ?? []).map((c) => ({
          system: c.system || "",
          code: c.code || "",
          display: c.display,
        })),
        text: pickLabLabel(latestRaw.code),
      },
      effectiveDateTime: pickEffectiveDateTime(latestRaw) || new Date().toISOString(),
      issued: latestRaw.issued,
      valueQuantity: latestRaw.valueQuantity
        ? {
            value: latestValue,
            unit: latestRaw.valueQuantity.unit || "",
            code: latestRaw.valueQuantity.code,
          }
        : undefined,
      interpretation: latestRaw.interpretation as any,
      referenceRange: latestRaw.referenceRange as any,
      meta: makeTulaMeta({
        provider: latestRaw.performer?.[0]?.display || "Epic",
        contentType: "laboratory_result",
        processedAt: latestRaw.meta?.lastUpdated || new Date().toISOString(),
      }),
    };

    // History: last up to 8 values, oldest first (as the UI sparkline expects)
    const history = numericValues.slice(-8);

    // Delta text (compare last two if we have them)
    let delta: string | undefined;
    if (numericValues.length >= 2) {
      const prev = numericValues[numericValues.length - 2];
      const curr = latestValue;
      const diff = curr - prev;
      if (Math.abs(diff) > 0.0001) {
        const dir = diff > 0 ? "up" : "down";
        // Try to include unit when sensible
        const unit = latest.valueQuantity?.unit ? ` ${latest.valueQuantity.unit}` : "";
        const formatted = Math.abs(diff) >= 1 ? diff.toFixed(0) : diff.toFixed(1);
        delta = `${dir} ${formatted}${unit} from previous`;
      }
    }

    trends.push({ latest, history, delta });
  }

  // 4. Sort trends so the most-recently-updated lab is first, then take limit
  trends.sort((a, b) => {
    const ta = a.latest.effectiveDateTime || "";
    const tb = b.latest.effectiveDateTime || "";
    return tb.localeCompare(ta);
  });

  return trends.slice(0, limit);
}
