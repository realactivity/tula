"use client";

import { motion } from "motion/react";
import {
  FlaskConical,
  Scan,
  CalendarDays,
  Pill,
  ReceiptText,
  MessageSquare,
  Dna,
  Activity,
  NotebookPen,
  HelpCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ActivityEvent, Observation } from "@/lib/fhir/types";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityEvent["contentType"], React.ComponentType<{ className?: string }>> = {
  laboratory_result: FlaskConical,
  imaging_report: Scan,
  appointment: CalendarDays,
  prescription: Pill,
  insurance_eob: ReceiptText,
  provider_message: MessageSquare,
  genomic_report: Dna,
  device_reading: Activity,
  health_journal_entry: NotebookPen,
  unknown_health: HelpCircle,
};

const LABELS: Record<ActivityEvent["contentType"], string> = {
  laboratory_result: "Lab panel",
  imaging_report: "Imaging",
  appointment: "Appointment",
  prescription: "Prescription",
  insurance_eob: "EOB",
  provider_message: "Provider message",
  genomic_report: "Genomic report",
  device_reading: "Device reading",
  health_journal_entry: "Journal entry",
  unknown_health: "Health item",
};

function flagTone(o: Observation): "ok" | "high" | "low" {
  const code = o.interpretation?.[0]?.coding?.[0]?.code;
  if (code === "H" || code === "A") return "high";
  if (code === "L") return "low";
  return "ok";
}

function ObservationRow({ o }: { o: Observation }) {
  const tone = flagTone(o);
  const range = o.referenceRange?.[0]?.text;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-t border-[--color-border]/50 first:border-t-0">
      <span className="text-sm text-[--color-fg-muted]">{o.code.text ?? o.code.coding[0]?.display}</span>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm tabular-nums">
          {o.valueQuantity?.value} <span className="text-[--color-fg-subtle]">{o.valueQuantity?.unit}</span>
        </span>
        {tone !== "ok" && (
          <Badge tone={tone}>
            {tone === "high" ? "High" : "Low"}
            {range ? ` · ${range}` : ""}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function ActivityCard({ event, index }: { event: ActivityEvent; index: number }) {
  const Icon = ICONS[event.contentType];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.2, 0.0, 0.0, 1] }}
    >
      <Card className="transition-colors hover:border-[--color-fg-subtle]/40">
        <CardHeader>
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              "bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)] text-[--color-accent]"
            )}
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight truncate">
                {LABELS[event.contentType]}
                {event.provider ? <span className="text-[--color-fg-muted] font-normal"> - {event.provider}</span> : null}
              </h3>
              <time
                className="text-xs text-[--color-fg-subtle] whitespace-nowrap"
                dateTime={event.at}
                title={new Date(event.at).toLocaleString()}
              >
                {formatDistanceToNow(new Date(event.at), { addSuffix: true })}
              </time>
            </div>
            <p className="text-sm text-[--color-fg-muted] mt-1 leading-snug">{event.summary}</p>
          </div>
        </CardHeader>

        {event.observations && event.observations.length > 0 && (
          <CardBody>
            <div className="rounded-xl bg-[--color-bg-elevated] px-4 py-2">
              {event.observations.map((o) => (
                <ObservationRow key={o.id} o={o} />
              ))}
            </div>
          </CardBody>
        )}

        {event.impression && (
          <CardBody>
            <div className="rounded-xl bg-[--color-bg-elevated] px-4 py-3 text-sm leading-relaxed text-[--color-fg-muted]">
              <span className="font-medium text-[--color-fg]">Impression. </span>
              {event.impression}
            </div>
          </CardBody>
        )}
      </Card>
    </motion.div>
  );
}
