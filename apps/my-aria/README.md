# My Aria - personal patient view

A MyChart-style personal-portal UI for the Tula health agent.

> **Status:** Phase 1 walking skeleton. Renders fixture data only.
> Phase 2 swaps `lib/data/loader.ts` to read live FHIR JSON from
> `~/.openclaw/workspace/tula/fhir/`. The UI does not change.

## What this app is

- A patient-facing view of your own health record, organized by your Tula
  agent. Dashboard sections: welcome, upcoming, recent results,
  medications, quick actions, account.
- MyChart-inspired information density, Linear-grade polish, dark-first.
- Mobile-first: bottom navigation on phones, sidebar on tablet/desktop.

## What this app is **not**

- Not affiliated with, endorsed by, or derived from Epic Systems
  Corporation or its MyChart product. References to "MyChart-style" are
  nominative descriptions of a design language, not branding claims.
- Not a medical device, not FDA-cleared, not clinical advice. See the
  in-app disclaimer.

## Stack

- **Next.js 15** (App Router, TypeScript, typed routes)
- **Tailwind CSS v4** (CSS-first config in `app/globals.css`, OKLCH tokens)
- **motion** (the new `framer-motion` package, imported as `motion/react`)
- **lucide-react** icons, **recharts** sparklines
- **gray-matter** for editable copy in `data/content/*.md`

## Run locally

```bash
cd apps/my-aria
npm install
npm run dev
# open http://localhost:3002
```

## Project layout

```
app/
  layout.tsx              # html + body + AppShell + metadata
  page.tsx                # redirect to /dashboard
  dashboard/page.tsx      # main view
  labs/, medications/,
  messages/, appointments/ # stub routes (phase 2)
  globals.css             # design tokens (@theme)
components/
  shell/                  # header, sidebar, bottom-nav, disclaimer, app-shell
  dashboard/              # 6 cards + section wrapper
  viz/                    # trend-sparkline
  ui/                     # card, badge, button
lib/
  fhir/types.ts           # FHIR R4 subset (shared shape with agent-studio)
  data/
    types.ts              # FHIR re-exports + UX-only types
    fixtures.ts           # synthetic FHIR-shaped data (no PHI)
    loader.ts             # the single data-source seam
    content.ts            # gray-matter wrapper (editable copy only)
  utils.ts                # cn() class composer
data/
  content/                # markdown files for editable copy
    welcome.md
    disclaimer.md
```

## Design tokens

All colors flow from CSS variables defined in `app/globals.css` under
`@theme`. Never hardcode hex. The accent token is burgundy
(`oklch(0.46 0.16 18)` ~ `#9B1C2C`); informational tone is clinical blue;
flag tones come from the shared `agent-studio` palette so observations
render consistently across both apps.

## Relationship to `apps/agent-studio`

Both apps share the FHIR types in `lib/fhir/types.ts`. `agent-studio` is
the ingestion-feed view (newest-first activity log). `my-aria` is the
patient-portal view (curated dashboard sections, sparklines, quick
actions). They will eventually read from the same on-disk FHIR layer.

## Why a separate app

Distinct audience and information architecture: the activity feed is
useful when you want to see what just arrived; the dashboard is useful
when you want to know how you're doing.

## Trademark

Aria is a trademark of RealActivity. MyChart and Epic are trademarks of
Epic Systems Corporation. This app uses those names only as nominative
references in its disclaimer copy. The "My Aria" wordmark is a
RealActivity sub-brand and is not a MyChart variant.

## Disclaimer

See `data/content/disclaimer.md` and the in-app `<Disclaimer/>` ribbon.
Personal demo. Not affiliated with Epic. Not medical advice.
