import { NutritionPage } from "@/components/nutrition/nutrition-page";
import { NUTRITION_PAGES } from "@/lib/nutrition/pages";

const page = NUTRITION_PAGES.find((p) => p.id === "overview")!;

export default function NutritionOverviewPage() {
  return <NutritionPage page={page} />;
}
