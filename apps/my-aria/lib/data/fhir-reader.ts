/**
 * fhir-reader — read the canonical per-resource FHIR tree on disk and
 * synthesize the {@link DashboardData} shape the UI consumes.
 *
 * The canonical tree is produced by `~/.openclaw/workspace/scripts/splat-fhir.py`
 * from `health-records` skill pulls. Structure:
 *
 *   <TULA_DATA_DIR>/
 *     Patient/<provider-slug>__<id>.json
 *     Observation/<provider-slug>__<id>.json
 *     MedicationRequest/<provider-slug>__<id>.json
 *     Appointment/<provider-slug>__<id>.json
 *     ...
 *
 * Privacy: this module ONLY reads from a configured filesystem path on
 * the host. No network calls, no PHI ever leaves the process. The path
 * is set by env var `TULA_DATA_DIR` (see {@link loader.ts}); if the var
 * is unset, the loader falls back to the synthetic fixtures and this
 * module is not invoked.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  Appointment,
  CodeableConcept,
  DashboardData,
  LabTrend,
  MedicationStatement,
  Observation,
  TulaMeta,
} from "./types";
import {
  longitudinalFeeds as longitudinalFeedsFixture,
  deIdentification as deIdentificationFixture,
  quickActions as quickActionsFixture,
} from "./fixtures";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Which lab codes the dashboard's "Recent results" card surfaces, in order
 * of clinical priority for the cardiometabolic / healthspan profile. The
 * reader picks the most recent observation for each, and trends up to 8
 * prior values for the sparkline.
 *
 * Keys are LOINC codes; values are display labels we'll prefer over
 * whatever the source system used in `code.text`.
 */
const DASHBOARD_LAB_PRIORITIES: Array<{ loinc: string; label: string }> = [
  { loinc: "4548-4", label: "HbA1c" }, // Hemoglobin A1c
  { loinc: "2345-7", label: "Glucose" }, // Glucose (fasting)
  { loinc: "2093-3", label: "Total Cholesterol" },
  { loinc: "2089-1", label: "LDL Cholesterol" },
  { loinc: "2085-9", label: "HDL Cholesterol" },
  { loinc: "2571-8", label: "Triglycerides" },
  { loinc: "2160-0", label: "Creatinine" },
  { loinc: "1742-6", label: "ALT" },
  { loinc: "1920-8", label: "AST" },
  { loinc: "3016-3", label: "TSH" },
];

const MAX_HISTORY_POINTS = 8;
const DASHBOARD_CARD_LIMIT = 5;
const DASHBOARD_MEDS_LIMIT = 8;

// ---------------------------------------------------------------------------
// Low-level: read a per-resource directory
// ---------------------------------------------------------------------------

async function readResourceDir<T>(
  dataDir: string,
  resourceType: string,
): Promise<T[]> {
  const dir = path.join(dataDir, resourceType);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (err) {
    // Missing directory → no resources of this type. Not an error.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const jsonFiles = names.filter((n) => n.endsWith(".json"));
  const results: T[] = [];
  for (const name of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(dir, name), "utf8");
      results.push(JSON.parse(raw) as T);
    } catch (err) {
      // Per-file read failures shouldn't take down the whole dashboard.
      // The UI's "honest about gaps" stance means it's better to drop
      // the bad file than crash. Log to stderr for the host operator.
      // eslint-disable-next-line no-console
      console.warn(`[fhir-reader] skipped unreadable file ${name}: ${String(err)}`);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Meta adapter — splatted FHIR has `meta.source: "health-records-pull:..."`,
// while the UI types expect Tula-extended meta. We synthesize a compatible
// shape so the UI doesn't have to special-case real-pull data.
// ---------------------------------------------------------------------------

type RawMeta = {
  source?: string;
  lastUpdated?: string;
} & Record<string, unknown>;

function adaptMeta(raw: RawMeta | undefined): TulaMeta {
  const sourceTag = raw?.source ?? "";
  const provider = extractProviderFromSourceTag(sourceTag);
  return {
    source: "email", // Tula's narrow union doesn't have "portal" yet; "email" is the closest existing tag and the UI doesn't render it. Future: extend the union.
    tula: {
      provider,
      contentType: undefined,
      processedAt: raw?.lastUpdated ?? new Date().toISOString(),
    },
  };
}

function extractProviderFromSourceTag(tag: string): string | undefined {
  // Tag format from splat-fhir.py: "health-records-pull:beverly-hospital@2026-05-22"
  const match = /health-records-pull:([^@]+)@/.exec(tag);
  if (!match) return undefined;
  // Reverse the slug → "Beverly Hospital", "Mass General Brigham"
  return match[1]
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Patient — pick the most-recently-updated, fall back to first available
// ---------------------------------------------------------------------------

type RawPatient = {
  resourceType: "Patient";
  id?: string;
  name?: Array<{
    text?: string;
    given?: string[];
    family?: string;
  }>;
  meta?: RawMeta;
};

function pickPatient(patients: RawPatient[]): RawPatient | undefined {
  if (patients.length === 0) return undefined;
  // If multiple providers know this patient, prefer the one with the most
  // recent meta.lastUpdated. Ties broken arbitrarily but deterministically.
  return patients.slice().sort((a, b) => {
    const aUpdated = a.meta?.lastUpdated ?? "";
    const bUpdated = b.meta?.lastUpdated ?? "";
    return bUpdated.localeCompare(aUpdated);
  })[0];
}

function patientFirstName(patient: RawPatient | undefined): string {
  if (!patient) return "there";
  const name = patient.name?.[0];
  if (name?.given?.[0]) return name.given[0];
  if (name?.text) {
    // Sometimes the source provides "Family, Given" or "Given Family"
    if (name.text.includes(",")) {
      const parts = name.text.split(",").map((s) => s.trim());
      return parts[1]?.split(/\s+/)[0] ?? parts[0] ?? "there";
    }
    return name.text.split(/\s+/)[0] ?? "there";
  }
  return "there";
}

// ---------------------------------------------------------------------------
// Observation — coerce a raw FHIR Observation into the UI's narrower shape
// ---------------------------------------------------------------------------

type RawObservation = {
  resourceType: "Observation";
  id: string;
  status?: string;
  category?: Array<CodeableConcept>;
  code?: CodeableConcept;
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string };
  issued?: string;
  valueQuantity?: { value: number; unit?: string };
  valueString?: string;
  interpretation?: Array<CodeableConcept>;
  referenceRange?: Array<{
    low?: { value: number; unit?: string };
    high?: { value: number; unit?: string };
    text?: string;
  }>;
  meta?: RawMeta;
};

function observationLoincCode(obs: RawObservation): string | undefined {
  return obs.code?.coding?.find((c) => c.system === "http://loinc.org")?.code;
}

function observationEffectiveDate(obs: RawObservation): string {
  return (
    obs.effectiveDateTime ??
    obs.effectivePeriod?.start ??
    obs.issued ??
    ""
  );
}

function coerceObservation(raw: RawObservation, preferredLabel?: string): Observation {
  // Narrow the status to the UI's enum, defaulting to "final" if missing.
  const status = (["final", "preliminary", "amended", "corrected"] as const).includes(
    raw.status as never,
  )
    ? (raw.status as Observation["status"])
    : "final";

  // Use the preferred dashboard label if we have one; otherwise the source's
  // best human label.
  const codeText = preferredLabel ?? raw.code?.text ?? raw.code?.coding?.[0]?.display ?? "";

  return {
    resourceType: "Observation",
    id: raw.id,
    status,
    category: raw.category ?? [],
    code: {
      coding: raw.code?.coding ?? [],
      text: codeText,
    },
    effectiveDateTime: observationEffectiveDate(raw),
    issued: raw.issued,
    valueQuantity: raw.valueQuantity
      ? {
          value: raw.valueQuantity.value,
          unit: raw.valueQuantity.unit ?? "",
          code: raw.valueQuantity.unit,
        }
      : undefined,
    valueString: raw.valueString,
    interpretation: raw.interpretation?.map((cc) => ({
      coding:
        cc.coding?.map((c) => ({
          code: c.code,
          display: c.display,
        })) ?? [],
    })),
    referenceRange: raw.referenceRange?.map((r) => ({
      low: r.low
        ? { value: r.low.value, unit: r.low.unit ?? "" }
        : undefined,
      high: r.high
        ? { value: r.high.value, unit: r.high.unit ?? "" }
        : undefined,
      text: r.text,
    })),
    meta: adaptMeta(raw.meta),
  };
}

function buildLabTrends(observations: RawObservation[]): LabTrend[] {
  // Group by LOINC code
  const byLoinc = new Map<string, RawObservation[]>();
  for (const obs of observations) {
    const loinc = observationLoincCode(obs);
    if (!loinc) continue;
    if (!obs.valueQuantity) continue; // numeric labs only for sparklines
    const date = observationEffectiveDate(obs);
    if (!date) continue;
    if (!byLoinc.has(loinc)) byLoinc.set(loinc, []);
    byLoinc.get(loinc)!.push(obs);
  }

  const trends: LabTrend[] = [];
  for (const { loinc, label } of DASHBOARD_LAB_PRIORITIES) {
    const list = byLoinc.get(loinc);
    if (!list || list.length === 0) continue;
    // Sort by date ascending so latest is last
    list.sort((a, b) =>
      observationEffectiveDate(a).localeCompare(observationEffectiveDate(b)),
    );
    const latestRaw = list[list.length - 1];
    const history = list
      .slice(-MAX_HISTORY_POINTS)
      .map((o) => o.valueQuantity?.value)
      .filter((v): v is number => typeof v === "number");

    const latest = coerceObservation(latestRaw, label);

    // Compute a one-liner delta if we have at least 2 points.
    let delta: string | undefined;
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      const cur = history[history.length - 1];
      const diff = cur - prev;
      const unit = latest.valueQuantity?.unit ?? "";
      const dir = diff === 0 ? "flat" : diff > 0 ? "up" : "down";
      if (dir === "flat") {
        delta = `unchanged from prior ${unit}`.trim();
      } else {
        const abs = Math.abs(diff);
        // Tidy magnitude: 0.4 not 0.4000000000000004
        const tidy = abs >= 10 ? abs.toFixed(0) : abs.toFixed(2).replace(/\.?0+$/, "");
        delta = `${dir} ${tidy} ${unit}`.trim();
      }
    }

    trends.push({ latest, history, delta });
    if (trends.length >= DASHBOARD_CARD_LIMIT) break;
  }
  return trends;
}

// ---------------------------------------------------------------------------
// MedicationRequest → MedicationStatement (UI type)
//
// Real Epic pulls give us MedicationRequest, not MedicationStatement. For
// the dashboard "active medications" card, the active MedicationRequests
// ARE the patient's current med list — we adapt the shape rather than
// require a separate FHIR resource type.
// ---------------------------------------------------------------------------

type RawMedicationRequest = {
  resourceType: "MedicationRequest";
  id: string;
  status?: string;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: { reference: string; display?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { code?: { text?: string } };
  }>;
  authoredOn?: string;
  meta?: RawMeta;
};

function adaptMedicationRequest(raw: RawMedicationRequest): MedicationStatement | null {
  // Real-world MedicationRequest sometimes uses medicationReference instead of
  // medicationCodeableConcept; either gives us a name to display.
  let medCode: CodeableConcept | undefined = raw.medicationCodeableConcept;
  if (!medCode && raw.medicationReference?.display) {
    medCode = {
      coding: [],
      text: raw.medicationReference.display,
    };
  }
  if (!medCode || !medCode.text) return null;

  // Narrow status to the UI's enum
  const statusMap: Record<string, MedicationStatement["status"]> = {
    active: "active",
    completed: "completed",
    stopped: "stopped",
    "entered-in-error": "entered-in-error",
    "on-hold": "active", // surface on-hold meds as active in the patient view
    draft: "active",
    unknown: "active",
  };
  const status =
    statusMap[raw.status ?? "active"] ?? ("active" as MedicationStatement["status"]);

  return {
    resourceType: "MedicationStatement",
    id: raw.id,
    status,
    medicationCodeableConcept: medCode,
    dosageText: raw.dosageInstruction?.[0]?.text,
    effectiveDateTime: raw.authoredOn,
    meta: adaptMeta(raw.meta),
  };
}

function buildActiveMedications(reqs: RawMedicationRequest[]): MedicationStatement[] {
  const active = reqs
    .filter((r) => (r.status ?? "active") === "active")
    .map(adaptMedicationRequest)
    .filter((m): m is MedicationStatement => m !== null);
  // Sort by authoredOn descending so newest meds appear first
  active.sort((a, b) =>
    (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""),
  );
  return active.slice(0, DASHBOARD_MEDS_LIMIT);
}

// ---------------------------------------------------------------------------
// Appointment — pick the next upcoming, fall back to undefined gracefully
// ---------------------------------------------------------------------------

type RawAppointment = {
  resourceType: "Appointment";
  id: string;
  status?: string;
  description?: string;
  start?: string;
  end?: string;
  participant?: Array<{
    actor?: { display?: string };
    required?: string;
  }>;
  meta?: RawMeta;
};

function pickUpcomingAppointment(appts: RawAppointment[]): Appointment | undefined {
  const now = new Date().toISOString();
  const upcoming = appts
    .filter((a) => (a.status ?? "booked") === "booked")
    .filter((a) => a.start && a.start > now)
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const next = upcoming[0];
  if (!next) return undefined;
  return {
    resourceType: "Appointment",
    id: next.id,
    status: "booked",
    description: next.description,
    start: next.start!,
    end: next.end,
    participant: next.participant
      ?.filter((p) => p.actor?.display)
      .map((p) => ({
        actor: { display: p.actor!.display! },
        required: p.required === "optional" ? "optional" : "required",
      })),
    meta: adaptMeta(next.meta),
  };
}

// ---------------------------------------------------------------------------
// Greeting — sourced from time of day, not the data
// ---------------------------------------------------------------------------

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Up late";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the dashboard payload from the canonical FHIR tree at `dataDir`.
 * The path is not validated here; the caller (loader.ts) handles fallback
 * when the directory is missing or unreadable.
 */
export async function getDashboardDataFromFhir(
  dataDir: string,
): Promise<DashboardData> {
  // Read everything we need in parallel — disk is local, this is cheap.
  const [patients, observations, medRequests, appointments] = await Promise.all([
    readResourceDir<RawPatient>(dataDir, "Patient"),
    readResourceDir<RawObservation>(dataDir, "Observation"),
    readResourceDir<RawMedicationRequest>(dataDir, "MedicationRequest"),
    readResourceDir<RawAppointment>(dataDir, "Appointment"),
  ]);

  const patient = pickPatient(patients);
  const firstName = patientFirstName(patient);

  return {
    greeting: greetingFor(new Date()),
    patientFirstName: firstName,
    upcomingAppointment: pickUpcomingAppointment(appointments),
    recentLabs: buildLabTrends(observations),
    activeMedications: buildActiveMedications(medRequests),
    // Quick actions, longitudinal feeds, and de-identification are UI config,
    // not data — they come from the fixture module unchanged.
    quickActions: quickActionsFixture,
    longitudinalFeeds: longitudinalFeedsFixture,
    deIdentification: deIdentificationFixture,
    refreshedAt: new Date().toISOString(),
  };
}
