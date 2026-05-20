"use client";

import { useState } from "react";
import { format } from "date-fns";
import { MapPin, Wind, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { lookupZipSdoh } from "@/lib/sdoh/lookup";
import { DEMO_ZIPS } from "@/lib/sdoh/fixtures";
import type { ZipSdohBundle } from "@/lib/sdoh/types";
import { AqiBadge } from "./aqi-badge";
import { RiskBadge } from "./risk-badge";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[--color-bg-elevated] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[--color-fg-subtle]">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-[--color-fg]">
        {value}
      </p>
    </div>
  );
}

function DemographicsGrid({ demo }: { demo: ZipSdohBundle["demographics"] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Stat label="Population" value={demo.population.toLocaleString()} />
      <Stat
        label="Median household income"
        value={`$${demo.medianHouseholdIncome.toLocaleString()}`}
      />
      <Stat label="Poverty rate" value={`${demo.povertyRatePercent}%`} />
      <Stat label="Uninsured" value={`${demo.uninsuredRatePercent}%`} />
      <Stat label="SNAP participation" value={`${demo.snapParticipationPercent}%`} />
      <Stat label="Median rent" value={`$${demo.medianRent.toLocaleString()}/mo`} />
      <Stat label="Rent burden (>30% income)" value={`${demo.rentBurdenPercent}%`} />
      <Stat label="Unemployment" value={`${demo.unemploymentRatePercent}%`} />
      <Stat
        label="High school+"
        value={`${demo.highSchoolOrHigherPercent}%`}
      />
      <Stat
        label="Limited English proficiency"
        value={`${demo.limitedEnglishPercent}%`}
      />
      <Stat
        label="Single-parent households"
        value={`${demo.singleParentHouseholdPercent}%`}
      />
      <Stat label="No vehicle access" value={`${demo.noVehiclePercent}%`} />
    </div>
  );
}

export function AirQualityView() {
  const [zipInput, setZipInput] = useState("02139");
  const [bundle, setBundle] = useState<ZipSdohBundle | null>(() =>
    lookupZipSdoh("02139")
  );
  const [error, setError] = useState<string | null>(null);

  const onLookup = (zip?: string) => {
    const value = zip ?? zipInput;
    const result = lookupZipSdoh(value);
    if (!result) {
      setError("Enter a valid 5-digit US ZIP code.");
      setBundle(null);
      return;
    }
    setError(null);
    setBundle(result);
    setZipInput(result.air.zip);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Air quality &amp; SDOH</h1>
        <p className="mt-2 max-w-prose text-sm text-[--color-fg-muted]">
          Enter a ZIP code to capture local air quality and demographic indicators
          relevant to social determinants of health. Demo data today — production
          will call AirNow, Census ACS, and CDC PLACES.
        </p>
      </header>

      <Card className="p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            onLookup();
          }}
        >
          <div className="flex-1">
            <label
              htmlFor="zip"
              className="block text-xs font-medium text-[--color-fg-muted]"
            >
              ZIP code
            </label>
            <input
              id="zip"
              name="zip"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[--color-border] bg-[--color-bg-elevated] px-4 py-2.5 font-mono text-sm outline-none focus:border-[--color-accent]"
              placeholder="02139"
            />
          </div>
          <Button type="submit" className="shrink-0">
            <Search className="h-4 w-4" />
            Look up
          </Button>
        </form>
        <p className="mt-3 text-xs text-[--color-fg-subtle]">
          Demo ZIPs with rich fixtures:{" "}
          {DEMO_ZIPS.map((z, i) => (
            <span key={z}>
              {i > 0 ? ", " : ""}
              <button
                type="button"
                className="font-mono underline underline-offset-2 hover:text-[--color-fg-muted]"
                onClick={() => onLookup(z)}
              >
                {z}
              </button>
            </span>
          ))}
        </p>
        {error && (
          <p className="mt-2 text-sm text-[--color-flag-high]" role="alert">
            {error}
          </p>
        )}
      </Card>

      {bundle && (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--color-info-soft] text-[--color-info]">
                  <Wind className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Air quality
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-[--color-fg-muted]">
                    <MapPin className="h-3.5 w-3.5" />
                    {bundle.air.placeName}, {bundle.air.state} · {bundle.air.zip}
                  </p>
                </div>
              </div>
              <AqiBadge air={bundle.air} />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[--color-fg-muted]">
              {bundle.air.summary}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Stat
                label="Primary pollutant"
                value={bundle.air.primaryPollutant}
              />
              <Stat
                label="PM2.5"
                value={`${bundle.air.pm25} ${bundle.air.pm25Unit}`}
              />
              {bundle.air.ozone != null && (
                <Stat label="Ozone" value={`${bundle.air.ozone} ppb`} />
              )}
            </div>
            <p className="mt-3 text-[11px] font-mono text-[--color-fg-subtle]">
              updated {format(new Date(bundle.air.updatedAt), "MMM d, h:mm a")}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              Demographics &amp; SDOH indicators
            </h2>
            <p className="mt-1 text-sm text-[--color-fg-muted]">
              ZIP-level structural factors that shape health outcomes alongside
              clinical data.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <RiskBadge level={bundle.demographics.foodInsecurityRisk} />
              <span className="text-xs text-[--color-fg-subtle]">food access</span>
              <RiskBadge level={bundle.demographics.housingInstabilityRisk} />
              <span className="text-xs text-[--color-fg-subtle]">housing</span>
            </div>
            <div className="mt-4">
              <DemographicsGrid demo={bundle.demographics} />
            </div>
          </Card>

          <Card className="border-[--color-accent-soft] bg-[color-mix(in_oklch,var(--color-accent)_6%,transparent)] p-5">
            <h2 className="text-sm font-semibold text-[--color-fg]">
              Tula SDOH summary
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[--color-fg-muted]">
              {bundle.sdohSummary}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
