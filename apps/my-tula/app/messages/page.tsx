import { MessageSquare } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function MessagesPage() {
  return (
    <ComingSoon
      icon={MessageSquare}
      title="Messages"
      description="Provider messages and Tula-drafted replies. Draft a portal message about a specific lab or symptom; the epic-note skill formats it for your care team."
    />
  );
}
