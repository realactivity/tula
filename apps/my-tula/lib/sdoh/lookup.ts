import { ZIP_SDOH_FIXTURES } from "./fixtures";
import type { ZipSdohBundle } from "./types";

function normalizeZip(input: string): string | null {
  const digits = input.replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : null;
}

/** Demo lookup - returns curated fixtures or a synthesized bundle for unknown ZIPs. */
export function lookupZipSdoh(rawZip: string): ZipSdohBundle | null {
  const zip = normalizeZip(rawZip);
  if (!zip) return null;

  const known = ZIP_SDOH_FIXTURES[zip];
  if (known) return known;

  const seed = zip.split("").reduce((n, d) => n + Number(d), 0);
  const aqi = 35 + (seed % 55);
  const category =
    aqi <= 50
      ? "Good"
      : aqi <= 100
        ? "Moderate"
        : aqi <= 150
          ? "Unhealthy for Sensitive Groups"
          : "Unhealthy";

  return {
    air: {
      zip,
      placeName: `ZIP ${zip}`,
      state: "US",
      aqi,
      aqiCategory: category as ZipSdohBundle["air"]["aqiCategory"],
      primaryPollutant: seed % 2 === 0 ? "PM2.5" : "Ozone",
      pm25: 6 + (seed % 25),
      pm25Unit: "µg/m³",
      updatedAt: new Date().toISOString(),
      summary: `Demo air quality for ZIP ${zip}. Connect AirNow / OpenAQ in production.`,
    },
    demographics: {
      zip,
      population: 12_000 + seed * 420,
      medianHouseholdIncome: 45_000 + seed * 800,
      povertyRatePercent: 8 + (seed % 18),
      uninsuredRatePercent: 4 + (seed % 12),
      snapParticipationPercent: 5 + (seed % 20),
      medianRent: 900 + seed * 12,
      rentBurdenPercent: 28 + (seed % 25),
      unemploymentRatePercent: 3 + (seed % 9),
      highSchoolOrHigherPercent: 82 + (seed % 15),
      limitedEnglishPercent: 5 + (seed % 20),
      singleParentHouseholdPercent: 10 + (seed % 15),
      noVehiclePercent: 8 + (seed % 35),
      foodInsecurityRisk: seed % 4 === 0 ? "high" : seed % 3 === 0 ? "elevated" : "moderate",
      housingInstabilityRisk: seed % 5 === 0 ? "elevated" : "moderate",
    },
    sdohSummary: `Synthetic SDOH profile for ZIP ${zip} (demo). Replace with Census ACS, CDC PLACES, and USDA food-access APIs.`,
  };
}
