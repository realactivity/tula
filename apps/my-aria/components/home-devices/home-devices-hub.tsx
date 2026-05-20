import { Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HOME_DEVICE_CATEGORIES } from "@/lib/home-devices/categories";

export function HomeDevicesHub() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Home devices</h1>
        <p className="mt-2 max-w-prose text-sm text-[--color-fg-muted]">
          Clinical peripherals you use at home — blood pressure cuffs, scales,
          glucometers, pulse oximeters, and thermometers. Distinct from{" "}
          <span className="text-[--color-fg]">Wearables</span> under Longitudinal
          feeds (Garmin, Oura, Apple Health). Readings will land as FHIR
          Observations alongside your patient portal data.
        </p>
      </header>

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--color-info-soft] text-[--color-info]">
              <Home className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Connected devices
              </h2>
              <p className="text-xs text-[--color-fg-subtle]">
                Phase 2 · Apple Health, Health Connect, and vendor APIs
              </p>
            </div>
          </div>
          <Badge tone="neutral">Planned</Badge>
        </div>
      </Card>

      <ul className="grid gap-3 sm:grid-cols-2">
        {HOME_DEVICE_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <li key={cat.id}>
              <Card className="h-full p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--color-accent-soft] text-[--color-accent]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[--color-fg]">
                      {cat.label}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[--color-fg-muted]">
                      {cat.description}
                    </p>
                    <p className="mt-2 text-[11px] text-[--color-fg-subtle]">
                      {cat.examples}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-[--color-fg-subtle]">
        Category pages and live device sync arrive with the home-device-sync
        skill. Wearables stay under Longitudinal feeds.
      </p>
    </div>
  );
}
