import type { AiChatsSdohReport, ZipSdohBundle } from "./types";

const ZIP_02139: ZipSdohBundle = {
  air: {
    zip: "02139",
    placeName: "Cambridge",
    state: "MA",
    aqi: 42,
    aqiCategory: "Good",
    primaryPollutant: "PM2.5",
    pm25: 8.2,
    pm25Unit: "µg/m³",
    ozone: 28,
    updatedAt: "2026-05-20T12:00:00Z",
    summary:
      "Air quality is good today. Sensitive groups can enjoy outdoor activity; no special precautions needed.",
  },
  demographics: {
    zip: "02139",
    population: 38_420,
    medianHouseholdIncome: 98_400,
    povertyRatePercent: 11.2,
    uninsuredRatePercent: 3.8,
    snapParticipationPercent: 8.4,
    medianRent: 2_450,
    rentBurdenPercent: 38.5,
    unemploymentRatePercent: 4.1,
    highSchoolOrHigherPercent: 94.2,
    limitedEnglishPercent: 12.6,
    singleParentHouseholdPercent: 14.8,
    noVehiclePercent: 22.3,
    foodInsecurityRisk: "moderate",
    housingInstabilityRisk: "moderate",
  },
  sdohSummary:
    "ZIP 02139 shows relatively strong economic indicators but elevated rent burden and moderate food-insecurity risk—common in dense college-town markets. Air quality is favorable for outdoor exercise and pulmonary rehab.",
};

const ZIP_10001: ZipSdohBundle = {
  air: {
    zip: "10001",
    placeName: "Manhattan (Chelsea / Midtown South)",
    state: "NY",
    aqi: 68,
    aqiCategory: "Moderate",
    primaryPollutant: "Ozone",
    pm25: 14.1,
    pm25Unit: "µg/m³",
    ozone: 52,
    updatedAt: "2026-05-20T12:00:00Z",
    summary:
      "Moderate air quality. Unusually sensitive people should consider limiting prolonged outdoor exertion.",
  },
  demographics: {
    zip: "10001",
    population: 21_150,
    medianHouseholdIncome: 112_800,
    povertyRatePercent: 9.4,
    uninsuredRatePercent: 5.2,
    snapParticipationPercent: 6.1,
    medianRent: 3_200,
    rentBurdenPercent: 44.2,
    unemploymentRatePercent: 5.8,
    highSchoolOrHigherPercent: 96.8,
    limitedEnglishPercent: 18.4,
    singleParentHouseholdPercent: 11.2,
    noVehiclePercent: 58.7,
    foodInsecurityRisk: "moderate",
    housingInstabilityRisk: "elevated",
  },
  sdohSummary:
    "High rent burden and low vehicle access point to transportation and housing stress despite above-average income (cost-of-living skew). Moderate AQI may affect asthma and COPD management.",
};

const ZIP_90210: ZipSdohBundle = {
  air: {
    zip: "90210",
    placeName: "Beverly Hills",
    state: "CA",
    aqi: 91,
    aqiCategory: "Unhealthy for Sensitive Groups",
    primaryPollutant: "PM2.5",
    pm25: 28.4,
    pm25Unit: "µg/m³",
    ozone: 61,
    updatedAt: "2026-05-20T12:00:00Z",
    summary:
      "Sensitive groups should reduce prolonged outdoor exertion. General population unlikely to be affected.",
  },
  demographics: {
    zip: "90210",
    population: 19_800,
    medianHouseholdIncome: 185_200,
    povertyRatePercent: 7.1,
    uninsuredRatePercent: 4.5,
    snapParticipationPercent: 3.2,
    medianRent: 4_100,
    rentBurdenPercent: 32.1,
    unemploymentRatePercent: 3.9,
    highSchoolOrHigherPercent: 97.5,
    limitedEnglishPercent: 14.2,
    singleParentHouseholdPercent: 9.8,
    noVehiclePercent: 8.5,
    foodInsecurityRisk: "low",
    housingInstabilityRisk: "low",
  },
  sdohSummary:
    "Lower structural SDOH risk by income and insurance, but wildfire-season PM2.5 spikes create episodic environmental health burden for respiratory patients.",
};

export const ZIP_SDOH_FIXTURES: Record<string, ZipSdohBundle> = {
  "02139": ZIP_02139,
  "10001": ZIP_10001,
  "90210": ZIP_90210,
};

export const DEMO_ZIPS = ["02139", "10001", "90210"] as const;

export const aiChatsSdohFixture: AiChatsSdohReport = {
  analyzedAt: "2026-05-20T14:22:00Z",
  threadCount: 4,
  signalCount: 9,
  threads: [
    {
      id: "chat-001",
      source: "telegram",
      title: "Weekly check-in with Tula",
      lastMessageAt: "2026-05-18T09:14:00Z",
      excerpt:
        "I've been taking the bus to chemo because my car broke down last month. The pharmacy on the other side of town is the only one that stocks my anti-nausea med.",
      signals: [
        {
          theme: "Transportation access",
          evidence: "Taking bus to chemo; car broke down last month",
          confidence: "high",
          icd10ZCode: "Z59.82",
        },
        {
          theme: "Medication access / pharmacy desert",
          evidence: "Only one pharmacy stocks anti-nausea medication, far from home",
          confidence: "high",
          icd10ZCode: "Z59.86",
        },
      ],
    },
    {
      id: "chat-002",
      source: "telegram",
      title: "Meal planning question",
      lastMessageAt: "2026-05-15T19:40:00Z",
      excerpt:
        "We're stretching groceries until the 3rd. My wife lost her hours at the clinic so we're watching every dollar on food this month.",
      signals: [
        {
          theme: "Food insecurity",
          evidence: "Stretching groceries until the 3rd; spouse lost work hours",
          confidence: "high",
          icd10ZCode: "Z59.41",
        },
        {
          theme: "Financial strain",
          evidence: "Watching every dollar on food after spouse lost hours",
          confidence: "medium",
          icd10ZCode: "Z59.6",
        },
      ],
    },
    {
      id: "chat-003",
      source: "portal",
      title: "Draft message — housing follow-up",
      lastMessageAt: "2026-05-12T11:02:00Z",
      excerpt:
        "Draft: I received the 30-day notice and I'm looking for a new apartment. Worried about moving during treatment.",
      signals: [
        {
          theme: "Housing instability",
          evidence: "30-day notice; searching for new apartment during treatment",
          confidence: "high",
          icd10ZCode: "Z59.1",
        },
      ],
    },
    {
      id: "chat-004",
      source: "telegram",
      title: "Air quality and outdoor walks",
      lastMessageAt: "2026-05-10T07:55:00Z",
      excerpt:
        "Smog has been bad this week — I skipped my walks. Is it safe to exercise outside when the air looks hazy?",
      signals: [
        {
          theme: "Environmental exposure (air quality)",
          evidence: "Skipped walks due to smog; asking about outdoor exercise safety",
          confidence: "medium",
          icd10ZCode: "Z77.118",
        },
        {
          theme: "Physical activity barrier",
          evidence: "Stopped walking routine due to perceived air quality",
          confidence: "medium",
        },
      ],
    },
  ],
};
