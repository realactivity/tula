import { ShieldCheck } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function DeIdentificationPage() {
  return (
    <ComingSoon
      icon={ShieldCheck}
      title="De-identification"
      description="Remove PHI from your records before sharing with another AI, a researcher, or a caregiver — HIPAA Safe Harbor-style de-identification on your own hardware."
    />
  );
}
