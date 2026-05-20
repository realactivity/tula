import Link from "next/link";
import { Pill, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { MedicationStatement } from "@/lib/data/types";

export function MedicationsCard({ medications }: { medications: MedicationStatement[] }) {
  return (
    <Card>
      <header className="flex items-baseline justify-between gap-3 px-5 pb-3 pt-4">
        <h3 className="text-base font-semibold tracking-tight">Active medications</h3>
        <Link
          href="/medications"
          className="flex items-center gap-1 text-xs text-[--color-fg-muted] hover:text-[--color-fg]"
        >
          Manage <ChevronRight className="h-3 w-3" />
        </Link>
      </header>

      <ul className="divide-y divide-[--color-border]/50">
        {medications.map((med) => {
          const name = med.medicationCodeableConcept.text
            ?? med.medicationCodeableConcept.coding[0]?.display
            ?? "Medication";
          return (
            <li key={med.id} className="flex items-start gap-3 px-5 py-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[--color-accent-soft] text-[--color-accent]">
                <Pill className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[--color-fg]">{name}</p>
                {med.dosageText && (
                  <p className="mt-0.5 text-xs text-[--color-fg-muted]">{med.dosageText}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
