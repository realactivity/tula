# aria — Tula's web dashboard

Beautiful, modern, mobile-friendly view of all email-ingested health data.

> **Status:** Phase 1 walking skeleton. Renders fixture data only. The
> live `~/.openclaw/workspace/tula/fhir/` reads, SSE updates, and
> per-content-type detail pages come in Phase 2+ once the email-router
> skill starts producing FHIR.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS v4** (CSS-first config, OKLCH design tokens)
- **shadcn/ui-style primitives** (hand-built locally — `components/ui/`)
- **Framer Motion** for entrance animations and live-update transitions
- **Recharts** for biomarker trends (Phase 2)
- **lucide-react** for icons
- **date-fns** for relative timestamps

## Run locally

```bash
cd apps/aria-web
npm install
npm run dev
# open http://localhost:3000
```

You'll see the activity feed with sample lab panel, imaging report,
appointment, prescription, and EOB cards.

## Project layout

```
app/                 Next.js routes (App Router)
  layout.tsx
  page.tsx           Activity feed (the home page)
  globals.css        Tailwind v4 + OKLCH design tokens
components/
  app-shell.tsx      Header + nav + container
  activity-card.tsx  The polymorphic content-type card
  ui/                Tailwind primitives (Card, Badge, ...)
lib/
  utils.ts           cn() className composer
  fhir/types.ts      TypeScript types matching email-router design doc
  fixtures.ts        Sample data shaped like the email-router will write
```

## Design language

- **Calm, clinically-literate.** Not Fitbit, not SaaS dashboard. Closer
  to MyChart's information density with Linear's polish.
- **Front-load the actionable detail.** Flagged values, deltas from prior
  visits, key impression text. LOINC codes live in detail views, not the
  feed.
- **Dark-mode default**, light mode auto-follows system preference. Both
  use OKLCH-based color tokens so the contrast stays correct across the
  whole brightness spectrum.
- **Motion is purposeful.** Cards stagger in on first paint, then hold
  still. Live updates ease in. Nothing flashes or bounces.

## What's next

Phase 2 (after email-router skill ships): replace `lib/fixtures.ts` with
disk reads from `~/.openclaw/workspace/tula/fhir/` and add an SSE channel
that pushes new resources as they're written.

See [`docs/dashboard-build-plan.md`](../../docs/dashboard-build-plan.md)
for the full roadmap and locked-in decisions.

## Access (production deployment)

The dashboard is designed to run on the OpenClaw VM bound to
`127.0.0.1:3001`, never on a public interface. Reach it from any device
via Cloudflare Tunnel + Cloudflare Access. See the build plan for the
deployment recipe.
