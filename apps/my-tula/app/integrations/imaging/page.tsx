import { Scan } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ImagingPage() {
  return (
    <ComingSoon
      icon={Scan}
      title="Medical image interpretation"
      description="DICOM imaging workflows using purpose-built healthcare imaging models - upload studies, surface key findings, and keep them in the same FHIR layer as your labs and notes."
    />
  );
}
