import { TravelPage } from "@/components/travel/travel-page";
import { TRAVEL_PAGES } from "@/lib/travel/pages";

const page = TRAVEL_PAGES.find((p) => p.id === "on-trip-health")!;

export default function OnTripHealthPage() {
  return <TravelPage page={page} />;
}
