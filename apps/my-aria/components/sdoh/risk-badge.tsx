import { Badge } from "@/components/ui/badge";

export function RiskBadge({
  level,
}: {
  level: "low" | "moderate" | "elevated" | "high";
}) {
  const tone =
    level === "low"
      ? "ok"
      : level === "moderate"
        ? "neutral"
        : level === "elevated"
          ? "low"
          : "high";
  return (
    <Badge tone={tone} className="capitalize">
      {level} risk
    </Badge>
  );
}
