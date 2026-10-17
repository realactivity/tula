import { NutritionPage } from "@/components/nutrition/nutrition-page";
import { NUTRITION_PAGES } from "@/lib/nutrition/pages";

const page = NUTRITION_PAGES.find((p) => p.id === "diet-plan")!;

export default function DietPlanPage() {
  return <NutritionPage page={page} />;
}
