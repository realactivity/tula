import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-start justify-center rounded-2xl border border-dashed border-[--color-border] bg-[--color-bg-elevated]/40 p-8">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[--color-accent-soft] text-[--color-accent]">
        <Icon className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-prose text-sm text-[--color-fg-muted]">
        {description}
      </p>
      <p className="mt-6 text-[11px] font-mono uppercase tracking-wide text-[--color-fg-subtle]">
        phase 2 · arrives with the email-router skill
      </p>
    </div>
  );
}
