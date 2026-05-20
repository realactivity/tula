import Link from "next/link";
import {
  Watch,
  Scan,
  Dna,
  ShieldCheck,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PlannedCapability } from "@/lib/data/types";

const ICONS: Record<PlannedCapability["icon"], LucideIcon> = {
  watch: Watch,
  scan: Scan,
  dna: Dna,
  shield: ShieldCheck,
};

function CapabilityTile({ cap }: { cap: PlannedCapability }) {
  const Icon = ICONS[cap.icon];
  return (
    <Link
      href={cap.href as never}
      className="flex h-full items-start gap-3 rounded-xl border border-transparent bg-[--color-bg-elevated] p-3 transition-colors hover:border-[--color-border]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[--color-info-soft] text-[--color-info]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight">{cap.label}</span>
        <span className="mt-1 block text-[11px] leading-snug text-[--color-fg-subtle]">
          {cap.description}
        </span>
      </span>
    </Link>
  );
}

export function LongitudinalFeedsSection({ feeds }: { feeds: PlannedCapability[] }) {
  return (
    <Card>
      <header className="px-5 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight">Longitudinal feeds</h3>
          <Badge tone="neutral">Planned</Badge>
        </div>
        <p className="mt-1 text-xs text-[--color-fg-subtle]">
          Connect devices, imaging, and genomics into your longitudinal record
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
        {feeds.map((cap) => (
          <li key={cap.id}>
            <CapabilityTile cap={cap} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DeIdentificationSection({ capability }: { capability: PlannedCapability }) {
  const Icon = ICONS[capability.icon];
  return (
    <Card>
      <header className="px-5 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight">De-identification</h3>
          <Badge tone="neutral">Planned</Badge>
        </div>
        <p className="mt-1 text-xs text-[--color-fg-subtle]">
          Share a redacted copy — not about collecting data, about exporting it safely
        </p>
      </header>
      <div className="p-3 pt-1">
        <Link
          href={capability.href as never}
          className="flex items-center gap-4 rounded-xl border border-transparent bg-[--color-bg-elevated] p-4 transition-colors hover:border-[--color-border]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--color-accent)_12%,transparent)] text-[--color-accent]">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{capability.label}</span>
            <span className="mt-1 block text-xs leading-relaxed text-[--color-fg-muted]">
              {capability.description}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[--color-fg-subtle]" />
        </Link>
      </div>
    </Card>
  );
}
