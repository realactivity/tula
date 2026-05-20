import { CalendarDays, MapPin, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Appointment } from "@/lib/data/types";

export function UpcomingCard({ appointment }: { appointment?: Appointment }) {
  if (!appointment) {
    return (
      <Card>
        <CardBody className="p-5 text-sm text-[--color-fg-muted]">
          No upcoming appointments scheduled.
        </CardBody>
      </Card>
    );
  }

  const start = new Date(appointment.start);
  const provider = appointment.participant?.[0]?.actor?.display;

  return (
    <Link
      href="/appointments"
      className="block transition-colors hover:border-[--color-fg-subtle]/40 focus-visible:outline-none"
    >
      <Card className="hover:border-[--color-fg-subtle]/40">
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--color-info-soft] text-[--color-info]">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-semibold tracking-tight">
                {appointment.description ?? "Upcoming visit"}
              </h3>
              <ChevronRight className="h-4 w-4 shrink-0 text-[--color-fg-subtle]" />
            </div>
            <p className="mt-0.5 text-sm text-[--color-fg-muted]">
              {format(start, "EEEE, MMMM d")} · {format(start, "h:mm a")}
            </p>
            {provider && (
              <p className="mt-1 flex items-center gap-1 text-xs text-[--color-fg-subtle]">
                <MapPin className="h-3 w-3" />
                {provider}
              </p>
            )}
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
