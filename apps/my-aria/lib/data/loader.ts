import type { DashboardData } from "./types";
import { dashboardFixture } from "./fixtures";

/**
 * The single seam between the UI and the data source.
 *
 * Phase 1: returns synthetic fixtures (no PHI).
 * Phase 2: replace with reads from `~/.openclaw/workspace/tula/fhir/`
 *          + the dashboard `state.json`. Same return shape — no UI changes.
 */
export async function getDashboardData(): Promise<DashboardData> {
  // Stamp refreshedAt at request time so the header timestamp is honest.
  return {
    ...dashboardFixture,
    refreshedAt: new Date().toISOString(),
  };
}
