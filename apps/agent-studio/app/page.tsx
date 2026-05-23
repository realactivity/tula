import { ActivityCard } from "@/components/activity-card";
import { AppShell } from "@/components/app-shell";
import { activityFixtures } from "@/lib/fixtures";

export default function HomePage() {
  return (
    <AppShell>
      <section>
        <div className="mb-5 flex items-baseline justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Recent activity</h1>
          <span className="text-xs text-[--color-fg-subtle] font-mono">
            phase 1 · fixtures
          </span>
        </div>

        <div className="grid gap-3">
          {activityFixtures.map((event, i) => (
            <ActivityCard key={event.id} event={event} index={i} />
          ))}
        </div>
      </section>

      <footer className="mt-16 text-xs text-[--color-fg-subtle] flex items-center justify-between">
        <span className="font-mono">
          agent-studio - single user, local data, private network
        </span>
        <span className="font-mono">
          {activityFixtures.length} events
        </span>
      </footer>
    </AppShell>
  );
}
