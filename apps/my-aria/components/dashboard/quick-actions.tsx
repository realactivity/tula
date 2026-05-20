import Link from "next/link";
import {
  CalendarDays,
  MessageSquare,
  Pill,
  FileDown,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { QuickAction } from "@/lib/data/types";

const ICONS: Record<QuickAction["icon"], LucideIcon> = {
  calendar: CalendarDays,
  message: MessageSquare,
  pill: Pill,
  file: FileDown,
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <Card>
      <header className="px-5 pt-4">
        <h3 className="text-base font-semibold tracking-tight">Quick actions</h3>
      </header>
      <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {actions.map((action) => {
          const Icon = ICONS[action.icon];
          return (
            <li key={action.id}>
              <Link
                href={action.href as never}
                className="flex h-full flex-col items-start gap-2 rounded-xl border border-transparent bg-[--color-bg-elevated] p-3 transition-colors hover:border-[--color-border]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--color-accent-soft] text-[--color-accent]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium leading-tight">{action.label}</span>
                <span className="text-[11px] leading-snug text-[--color-fg-subtle]">
                  {action.description}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
