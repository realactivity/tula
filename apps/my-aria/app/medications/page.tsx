import { Pill } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function MedicationsPage() {
  return (
    <ComingSoon
      icon={Pill}
      title="Medications"
      description="Active medications, refill status, dosing instructions, and a history of every change. Includes a refill request flow that drafts a portal message through the epic-note skill."
    />
  );
}
