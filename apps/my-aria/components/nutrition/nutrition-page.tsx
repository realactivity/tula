import type { NutritionPageConfig } from "@/lib/nutrition/pages";

export function NutritionPage({ page }: { page: NutritionPageConfig }) {
  const Icon = page.icon;
  return (
    <div className="space-y-6">
      <div className="flex min-h-[32vh] flex-col items-start justify-center rounded-2xl border border-dashed border-[--color-border] bg-[--color-bg-elevated]/40 p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[--color-accent-soft] text-[--color-accent]">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
        <p className="mt-2 max-w-prose text-sm text-[--color-fg-muted]">
          {page.description}
        </p>
        <p className="mt-6 text-[11px] font-mono uppercase tracking-wide text-[--color-fg-subtle]">
          intelligent nutrition · phase 2 · imported from MyFitnessPal
        </p>
      </div>

      <section className="rounded-2xl border border-[--color-border] bg-[--color-bg-card] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
          What this will track
        </h2>
        <ul className="mt-3 space-y-2">
          {page.tracks.map((item) => (
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

      <p className="text-xs text-[--color-fg-subtle]">
        Nutrition data imported from MyFitnessPal. Not affiliated with Under
        Armour, Inc. or MyFitnessPal.
      </p>
    </div>
  );
}
