import type { DashboardData } from "./types";
import { dashboardFixture } from "./fixtures";
import { getDashboardDataFromFhir } from "./fhir-reader";

/**
 * The single seam between the UI and the data source.
 *
 * Behavior is selected by the `TULA_DATA_DIR` environment variable:
 *
 *   - **Unset:** returns synthetic fixtures (Phase 1 default). No PHI ever
 *     leaves the process. This is the shape every hosting copy of My Aria
 *     ships with — clean, tenant-agnostic, ready for onboarding to populate.
 *
 *   - **Set to an absolute path:** reads FHIR resources from
 *     `<TULA_DATA_DIR>/<ResourceType>/*.json` (the canonical tree produced
 *     by `~/.openclaw/workspace/scripts/splat-fhir.py`) and synthesizes
 *     the same {@link DashboardData} shape. Same UI, real data.
 *
 * Hosting note: when provisioning a tenant, the operator sets
 * `TULA_DATA_DIR` to that tenant's per-tenant FHIR directory (see
 * `docs/HOSTING_STRATEGY.md`). The codebase itself contains no
 * tenant-specific values.
 *
 * If the env var is set but the directory is unreadable or empty, we log
 * a warning and fall back to fixtures rather than crash — the dashboard
 * should always render something honest.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const dataDir = process.env.TULA_DATA_DIR?.trim();

  if (dataDir) {
    try {
      return await getDashboardDataFromFhir(dataDir);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[my-aria] TULA_DATA_DIR was set to "${dataDir}" but reading failed; ` +
          `falling back to fixtures. Error: ${String(err)}`,
      );
      // Fall through to fixture path
    }
  }

  return {
    ...dashboardFixture,
    // Stamp refreshedAt at request time so the header timestamp is honest.
    refreshedAt: new Date().toISOString(),
  };
}
