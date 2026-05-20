import { Dna } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function GenomicsPage() {
  return (
    <ComingSoon
      icon={Dna}
      title="Genomic health reports"
      description="Ingest consumer and clinical genomic reports (23andMe, AncestryDNA, clinical panels) so your agent can reason about variants alongside your longitudinal chart."
    />
  );
}
