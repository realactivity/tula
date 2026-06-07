import type { DashboardData } from "./types";
import { dashboardFixture } from "./fixtures";
import { readType } from "@/lib/fhir/store";
import { toFirstName } from "./mappers/patient";
import { toRecentLabs } from "./mappers/labs";
import { toActiveMedications } from "./mappers/medications";
import type { RawPatient, RawObservation, RawMedicationRequest } from "@/lib/fhir/raw";

/**
 * The single seam between the UI and the data source.
 *
 * - By default (and in production) this now reads the real on-disk FHIR
 *   resources from ~/.openclaw/workspace/tula/fhir (or TULA_FHIR_DIR).
 * - If TULA_USE_FIXTURES=1 (or any truthy value) is set, or if any
 *   read/mapping step throws, we fall back to the original synthetic
 *   fixtures so the app never 500s during development or on bad data.
 *
 * The return shape (DashboardData) is unchanged, so all existing
 * components continue to work without modification.
 */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function shouldUseFixtures(): boolean {
  const flag = process.env.TULA_USE_FIXTURES;
  if (!flag) return false;
  const v = flag.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function getDashboardData(): Promise<DashboardData> {
  // Fast path: explicit fixture mode (useful for screenshots, demos, or when
  // the real data dir is unavailable / contains PHI you don't want to render).
  if (shouldUseFixtures()) {
    return {
      ...dashboardFixture,
      // Keep the fixture patient name when forcing fixtures
      refreshedAt: new Date().toISOString(),
    };
  }

  try {
    // Read the three resource types we care about for the dashboard cards.
    const patients = readType<RawPatient>("Patient");
    const observations = readType<RawObservation>("Observation");
    const medRequests = readType<RawMedicationRequest>("MedicationRequest");

    const patientFirstName = toFirstName(patients);
    const recentLabs = toRecentLabs(observations, 6);
    const activeMedications = toActiveMedications(medRequests);

    // We have no Appointment resources in the current export (only Encounters).
    // The UpcomingCard already handles undefined gracefully.
    const upcomingAppointment = undefined;

    // Static UI affordances (quick actions, roadmap tiles, disclaimer) stay
    // exactly as designed in fixtures. They are not derived from FHIR.
    const { quickActions, longitudinalFeeds, deIdentification } = dashboardFixture;

    return {
      greeting: getGreeting(),
      patientFirstName,
      upcomingAppointment,
      recentLabs,
      activeMedications,
      quickActions,
      longitudinalFeeds,
      deIdentification,
      refreshedAt: new Date().toISOString(),
    };
  } catch (err) {
    // Never let a filesystem error, bad JSON, or mapper bug take the
    // whole portal down. Fall back to the well-known fixture data.
    // (In production you may want to log this to your agent logs.)
    // eslint-disable-next-line no-console
    console.error("[my-aria] FHIR data load failed, falling back to fixtures:", err);
    return {
      ...dashboardFixture,
      refreshedAt: new Date().toISOString(),
    };
  }
}
