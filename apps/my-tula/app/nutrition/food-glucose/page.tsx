import { NutritionPage } from "@/components/nutrition/nutrition-page";
import { NUTRITION_PAGES } from "@/lib/nutrition/pages";

const page = NUTRITION_PAGES.find((p) => p.id === "food-glucose")!;

export default function FoodGlucosePage() {
  return <NutritionPage page={page} />;
}
