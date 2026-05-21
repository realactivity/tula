import Link from "next/link";
import { Card } from "@/components/ui/card";
import { TRAVEL_PAGES } from "@/lib/travel/pages";
import { SECONDARY_TRAVEL_PAGE_IDS } from "@/components/shell/nav-items";

const tripsPage = TRAVEL_PAGES.find((p) => p.id === "trips")!;
const secondaryPages = TRAVEL_PAGES.filter((p) =>
  SECONDARY_TRAVEL_PAGE_IDS.includes(p.id)
);

export default function TripsHubPage() {
  const Icon = tripsPage.icon;

  return (
    <div className="space-y-6">
      <div className="flex min-h-[28vh] flex-col items-start justify-center rounded-2xl border border-dashed border-[--color-border] bg-[--color-bg-elevated]/40 p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[--color-accent-soft] text-[--color-accent]">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {tripsPage.title}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-[--color-fg-muted]">
          {tripsPage.description}
        </p>
        <p className="mt-6 text-[11px] font-mono uppercase tracking-wide text-[--color-fg-subtle]">
          intelligent travel · phase 2
        </p>
      </div>

      <section className="rounded-2xl border border-[--color-border] bg-[--color-bg-card] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
          What this will track
        </h2>
        <ul className="mt-3 space-y-2">
          {tripsPage.tracks.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-[--color-fg-muted]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--color-accent]" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
          Trip planning tools
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {secondaryPages.map((page) => {
            const SecondaryIcon = page.icon;
            return (
              <li key={page.id}>
                <Link
                  href={page.href}
                  className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg]"
                >
                  <Card className="h-full p-4 transition-colors hover:border-[--color-accent-soft] hover:bg-[--color-bg-elevated]">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--color-accent-soft] text-[--color-accent]">
                        <SecondaryIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-[--color-fg]">
                          {page.label}
                        </h3>
                        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[--color-fg-muted]">
                          {page.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-[--color-fg-subtle]">
        On-trip health and the return checklist live in the sidebar; the four
        planning surfaces above are deep links from this hub.
      </p>
    </div>
  );
}
