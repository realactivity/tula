import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { TrendSparkline } from "@/components/viz/trend-sparkline";
import type { LabTrend, Observation } from "@/lib/data/types";

function flagTone(o: Observation): "ok" | "high" | "low" {
  const code = o.interpretation?.[0]?.coding?.[0]?.code;
  if (code === "H" || code === "A") return "high";
  if (code === "L") return "low";
  return "ok";
}

function LabRow({ trend }: { trend: LabTrend }) {
  const { latest, history, delta } = trend;
  const tone = flagTone(latest);
  const label = latest.code.text ?? latest.code.coding[0]?.display ?? "Observation";
  const value = latest.valueQuantity?.value;
  const unit = latest.valueQuantity?.unit;
  const range = latest.referenceRange?.[0]?.text;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 border-t border-[--color-border]/50 first:border-t-0 sm:grid-cols-[1.5fr_2fr_auto]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[--color-fg]">{label}</p>
        {delta && (
          <p className="mt-0.5 text-xs text-[--color-fg-subtle]">{delta}</p>
        )}
      </div>

      <div className="hidden text-[--color-accent] sm:block">
        <TrendSparkline values={history} ariaLabel={`${label} trend`} />
      </div>

      <div className="flex items-baseline justify-end gap-2">
        <span className="font-mono text-base tabular-nums">
          {value}
          <span className="ml-1 text-xs text-[--color-fg-subtle]">{unit}</span>
        </span>
        {tone !== "ok" && (
          <Badge tone={tone}>
            {tone === "high" ? "High" : "Low"}
            {range ? ` · ${range}` : ""}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function RecentResultsCard({ trends }: { trends: LabTrend[] }) {
  if (trends.length === 0) {
    return (
      <Card>
        <CardBody className="p-5 text-sm text-[--color-fg-muted]">
          No recent lab results.
        </CardBody>
      </Card>
    );
  }

  const date = trends[0]?.latest.effectiveDateTime;

  return (
    <Card>
      <header className="flex items-baseline justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Recent labs</h3>
          {date && (
            <p className="mt-0.5 text-xs text-[--color-fg-subtle]">
              {format(new Date(date), "MMM d, yyyy")}
            </p>
          )}
        </div>
        <Link
          href="/labs"
          className="flex items-center gap-1 text-xs text-[--color-fg-muted] hover:text-[--color-fg]"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </header>
      <div>
        {trends.map((trend) => (
          <LabRow key={trend.latest.id} trend={trend} />
        ))}
      </div>
    </Card>
  );
}
