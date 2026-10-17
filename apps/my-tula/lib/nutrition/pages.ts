import type { LucideIcon } from "lucide-react";
import { Utensils, LineChart, ClipboardList } from "lucide-react";
import type { Route } from "next";

export type NutritionPageConfig = {
  id: string;
  href: Route;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tracks: string[];
};

export const NUTRITION_PAGES: NutritionPageConfig[] = [
  {
    id: "overview",
    href: "/nutrition",
    label: "Overview",
    icon: Utensils,
    title: "Nutrition overview",
    description:
      "Today's intake at a glance: calories, protein, carbs, fat, fiber, hydration, caffeine and alcohol. Imported from MyFitnessPal and overlaid with your active medications, lab targets, and weekly trends. The hub for everyday diet awareness.",
    tracks: [
      "Today's macros vs goal targets",
      "Recent meal log (breakfast, lunch, dinner, snacks)",
      "Weekly macro trends + reconciled weight from Home Devices",
    ],
  },
  {
    id: "food-glucose",
    href: "/nutrition/food-glucose",
    label: "Food x Glucose",
    icon: LineChart,
    title: "Food x Glucose",
    description:
      "CGM curve overlaid with logged meals so you can see which foods spike you and which don't. Pulls glucose from your Home Devices stream and meal timing from MyFitnessPal; flags low-confidence correlations when MFP didn't record a meal time.",
    tracks: [
      "Post-prandial glucose response per meal",
      "Top spiking foods over the last 30 days",
      "Meal-time confidence (exact, inferred, unknown)",
    ],
  },
  {
    id: "diet-plan",
    href: "/nutrition/diet-plan",
    label: "Diet plan",
    icon: ClipboardList,
    title: "Diet plan",
    description:
      "Your clinician-recommended pattern (Mediterranean, DASH, low-FODMAP, Attia-style protein goals, or your own) scored against actual MyFitnessPal intake. When MFP's own goals and a clinical recommendation disagree, both are shown with a clear banner.",
    tracks: [
      "Active diet pattern + adherence score",
      "MyFitnessPal goals vs clinical recommendation",
      "Weekly adherence trend with explanations",
    ],
  },
];
