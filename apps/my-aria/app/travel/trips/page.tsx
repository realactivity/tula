import { TravelPage } from "@/components/travel/travel-page";
import { TRAVEL_PAGES } from "@/lib/travel/pages";

const page = TRAVEL_PAGES.find((p) => p.id === "trips")!;

export default function TripsPage() {
  return <TravelPage page={page} />;
}
