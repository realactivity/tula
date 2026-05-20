import { FlaskConical } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function LabsPage() {
  return (
    <ComingSoon
      icon={FlaskConical}
      title="Lab results"
      description="Every lab panel ingested through your Tula agent will appear here, grouped by panel and biomarker with longitudinal trends going back years."
    />
  );
}
