import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function AppointmentsPage() {
  return (
    <ComingSoon
      icon={CalendarDays}
      title="Appointments"
      description="Upcoming visits, past visit summaries, and scheduling. Sync with your portal so your agent knows what you have coming up."
    />
  );
}
