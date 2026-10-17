import { Watch } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function WearablesPage() {
  return (
    <ComingSoon
      icon={Watch}
      title="Wearables"
      description="Connect Garmin, Oura, Whoop, Withings, Apple Health, and related wearable feeds for continuous activity, sleep, and HRV - separate from home clinical peripherals (BP cuffs, scales, glucometers) under Home devices."
    />
  );
}
