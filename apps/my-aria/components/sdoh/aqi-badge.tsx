import { Badge } from "@/components/ui/badge";
import type { AirQualitySnapshot } from "@/lib/sdoh/types";

export function AqiBadge({ air }: { air: AirQualitySnapshot }) {
  const tone =
    air.aqi <= 50
      ? "ok"
      : air.aqi <= 100
        ? "neutral"
        : air.aqi <= 150
          ? "low"
          : "high";
  return (
    <Badge tone={tone}>
      AQI {air.aqi} · {air.aqiCategory}
    </Badge>
  );
}
