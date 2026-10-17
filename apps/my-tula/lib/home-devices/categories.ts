import type { LucideIcon } from "lucide-react";
import {
  HeartPulse,
  Scale,
  Droplets,
  Activity,
  Thermometer,
} from "lucide-react";

export type HomeDeviceCategory = {
  id: string;
  label: string;
  description: string;
  examples: string;
  icon: LucideIcon;
};

export const HOME_DEVICE_CATEGORIES: HomeDeviceCategory[] = [
  {
    id: "blood-pressure",
    label: "Blood pressure",
    description:
      "Cuff readings at home - compare trends with portal vitals and flag white-coat vs sustained hypertension.",
    examples: "Omron, Withings BPM, QardioArm, Beurer",
    icon: HeartPulse,
  },
  {
    id: "weight",
    label: "Weight & body composition",
    description:
      "Daily weight and optional body-fat % for longitudinal trends alongside labs and portal observations.",
    examples: "Withings, Renpho, Wyze, Eufy, Garmin Index",
    icon: Scale,
  },
  {
    id: "glucose",
    label: "Glucose & CGM",
    description:
      "Fingerstick logs and continuous glucose curves when you use a CGM - separate from wearables activity rings.",
    examples: "Dexcom, FreeStyle Libre, Contour, OneTouch",
    icon: Droplets,
  },
  {
    id: "pulse-ox",
    label: "Pulse ox & heart rhythm",
    description:
      "SpO₂ spot checks and optional single-lead ECG screening devices for home use.",
    examples: "Fingertip pulse ox, Kardia (AliveCor)",
    icon: Activity,
  },
  {
    id: "temperature",
    label: "Temperature",
    description:
      "Fever and baseline temperature trends - useful during illness, travel, and treatment cycles.",
    examples: "Kinsa, Withings Thermo",
    icon: Thermometer,
  },
];
