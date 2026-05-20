/** Air quality snapshot for a US ZIP code (demo / future EPA + AirNow API). */
export type AirQualitySnapshot = {
  zip: string;
  placeName: string;
  state: string;
  aqi: number;
  aqiCategory: "Good" | "Moderate" | "Unhealthy for Sensitive Groups" | "Unhealthy" | "Very Unhealthy" | "Hazardous";
  primaryPollutant: string;
  pm25: number;
  pm25Unit: string;
  ozone?: number;
  updatedAt: string;
  summary: string;
};

/** Census-style SDOH indicators at ZIP level (demo fixtures). */
export type ZipDemographics = {
  zip: string;
  population: number;
  medianHouseholdIncome: number;
  povertyRatePercent: number;
  uninsuredRatePercent: number;
  snapParticipationPercent: number;
  medianRent: number;
  rentBurdenPercent: number;
  unemploymentRatePercent: number;
  highSchoolOrHigherPercent: number;
  limitedEnglishPercent: number;
  singleParentHouseholdPercent: number;
  noVehiclePercent: number;
  foodInsecurityRisk: "low" | "moderate" | "elevated" | "high";
  housingInstabilityRisk: "low" | "moderate" | "elevated" | "high";
};

export type ZipSdohBundle = {
  air: AirQualitySnapshot;
  demographics: ZipDemographics;
  sdohSummary: string;
};

/** SDOH signal extracted from an AI chat thread. */
export type SdohChatSignal = {
  theme: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
  icd10ZCode?: string;
};

export type AiChatSdohThread = {
  id: string;
  source: "telegram" | "portal" | "sms";
  title: string;
  lastMessageAt: string;
  excerpt: string;
  signals: SdohChatSignal[];
};

export type AiChatsSdohReport = {
  analyzedAt: string;
  threadCount: number;
  signalCount: number;
  threads: AiChatSdohThread[];
};
