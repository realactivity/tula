import { TravelPage } from "@/components/travel/travel-page";
import { TRAVEL_PAGES } from "@/lib/travel/pages";

const page = TRAVEL_PAGES.find((p) => p.id === "itineraries")!;

export default function ItinerariesPage() {
  return <TravelPage page={page} />;
}
