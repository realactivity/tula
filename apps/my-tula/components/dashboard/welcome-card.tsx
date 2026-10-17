import { format } from "date-fns";

export function WelcomeCard({
  greeting,
  firstName,
  refreshedAt,
}: {
  greeting: string;
  firstName: string;
  refreshedAt: string;
}) {
  return (
    <div className="rounded-2xl border border-[--color-border] bg-gradient-to-br from-[--color-bg-card] to-[--color-bg-elevated] p-6 sm:p-7">
      <p className="text-sm text-[--color-fg-subtle]">{greeting},</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        {firstName}.
      </h1>
      <p className="mt-3 max-w-prose text-sm text-[--color-fg-muted]">
        Here is your latest health activity, organized by your personal Tula
        agent. New results, messages, and updates appear here automatically as
        they arrive.
      </p>
      <p className="mt-4 text-[11px] font-mono text-[--color-fg-subtle]">
        last refreshed {format(new Date(refreshedAt), "MMM d, h:mm a")}
      </p>
    </div>
  );
}
