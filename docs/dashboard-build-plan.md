# Tula Dashboard — Build Plan

Companion to the [email router build plan](email-router-build-plan.md).
The email router writes structured FHIR JSON; this dashboard reads it and
presents a beautiful, modern UI Paul can browse from any device.

This plan has no code yet. It captures architecture, stack decisions,
phase ordering, and the questions still to answer.

## What it is

A Node-based web app running on the OpenClaw VM. Paul opens a URL in any
browser (laptop, phone, tablet) and sees:

- **Activity feed** — most recent emails processed, newest first, each
  with content type and a one-line summary
- **Trends** — interactive charts of biomarkers over time
  (HbA1c, lipid panel, kidney function, vitals)
- **Documents** — imaging reports, lab panels, EOBs, provider messages
- **Medications** — current med list with refill status
- **Appointments** — upcoming visits
- **Confidence review queue** — extractions the model wasn't sure about,
  awaiting Paul's verification before they commit to canonical FHIR

The dashboard is read-mostly in Phase 1, with a handful of write actions
in later phases (verify extraction, flag for follow-up, mark message as
seen).

## Goals

1. **TripIt-like immediacy.** Forward an email at 2pm, see the data on
   the dashboard by 2:02pm. Live updates via Server-Sent Events.
2. **Beautiful, calm, clinically-literate UI.** Not a SaaS dashboard,
   not a Fitbit graph. Closer to MyChart's information density with
   Linear's design polish.
3. **Mobile-first.** Most checks happen on the phone after a clinic visit.
4. **Single user, single tenant, local data.** No cloud round-trip for
   reads. Direct FHIR JSON file reads from `~/.openclaw/workspace/tula/`.
5. **Maintainable by one person.** Pick a stack with a low cognitive
   surface and good defaults.

## Non-goals (Phase 1)

- Multi-user / multi-tenant. Personal mode only.
- Editable EHR-style features (write-back to clinic systems).
- Push notifications (Telegram already does that).
- Mobile native apps. PWA only.
- Authentication "log in" UX. Network-level access (Tailscale) is the
  auth boundary. See "Access" below.

## Architecture

```
Browser (Paul's laptop / phone)
        │ HTTPS
        ▼
Tailscale tailnet (or Cloudflare Tunnel)
        │
        ▼
VM: ra-agent01
  ┌──────────────────────────────────────────────────────────┐
  │  Tula Dashboard (Node, listens on 127.0.0.1:3001)       │
  │   ├── Server (SvelteKit/Next.js SSR)                     │
  │   │    ├── reads FHIR JSON from disk                     │
  │   │    ├── exposes /api/* for live data                  │
  │   │    └── /events SSE stream for new-email notifications│
  │   └── Static assets / client bundle                      │
  └──────────────────────────────────────────────────────────┘
        ▲
        │ reads
  ┌─────┴─────────────────────────────────────────┐
  │ ~/.openclaw/workspace/tula/                   │
  │   fhir/                                        │
  │     Observation/, DiagnosticReport/,           │
  │     MedicationStatement/, Appointment/,        │
  │     DocumentReference/                         │
  │   inbox/  (raw + processed .eml files)         │
  │   attachments/                                 │
  └────────────────────────────────────────────────┘
        ▲
        │ writes
  ┌─────┴─────────────────────────────────────────┐
  │ email-router skill (Phase 2 of email plan)    │
  │ writes new files; emits inotify events the    │
  │ dashboard subscribes to                        │
  └────────────────────────────────────────────────┘
```

### Why this shape

- **The dashboard never talks to the email router directly.** They share
  the FHIR filesystem. The router writes; the dashboard reads. This
  keeps both sides simple and lets either evolve independently.
- **inotify (Linux file watcher) → SSE.** When the email-router writes a
  new FHIR file, an inotify event triggers the dashboard server to push
  an SSE message. The browser appends the new card to the activity feed
  with no refresh needed.
- **127.0.0.1 binding.** The dashboard never listens on a public
  interface. Access is through Tailscale (preferred) or Cloudflare
  Tunnel. This eliminates an entire class of "exposed health data" risks.

## Stack — recommendation and alternatives

### Recommended: SvelteKit + Tailwind CSS + shadcn-svelte

| Concern | SvelteKit pick | Why |
|---|---|---|
| Framework | **SvelteKit** | Compiles to small JS bundles. SSR + client islands by default. Tiny memory footprint matters on a B2s VM. |
| Styling | **Tailwind CSS** | Universal modern default. Consistent design system without writing CSS files. |
| Components | **shadcn-svelte** | Copy-paste components (not an install dep). Beautiful defaults that ship with Radix primitives ported to Svelte. |
| Charts | **LayerChart** or **Apache ECharts** | LayerChart is Svelte-native; ECharts is heavier but more flexible. |
| Realtime | **SSE** (built into SvelteKit endpoints) | Server-push for new-email notifications. WebSockets would also work but SSE is simpler for one-way push. |
| Persistence | **None initially** | Reads FHIR JSON from disk. Add SQLite if query volume grows. |
| Auth | **None — Tailscale handles it** | See "Access" below. |
| Deploy | **`@sveltejs/adapter-node`** | Outputs a self-contained Node server we run with `pm2`/`systemd` on the VM. |

### Why not Next.js?

- 2-3x larger bundle and memory footprint than SvelteKit at equivalent
  feature surface. Matters on B2s.
- Heavier mental model (RSC vs client components vs server actions).
- shadcn/ui (the React version) is excellent, but the Svelte port has
  caught up.

### Why not Astro?

- Excellent for content sites; less natural for an interactive dashboard
  with live updates and many small client islands.

### Why not Express + HTMX?

- Genuinely tempting for the simplicity. But "beautiful modern UX" is the
  user's brief, and HTMX-flavored UIs tend to feel less polished than
  component-driven frameworks at the same effort level. Reserve as a
  fallback if SvelteKit feels heavy.

## Pages and views (Phase 1 surface)

```
/                    Activity feed (newest 50 events, infinite scroll)
/labs                Lab observations, grouped by panel and date
/labs/:loinc         Single biomarker trend (e.g., /labs/4548-4 → HbA1c)
/imaging             Imaging studies list
/imaging/:id         Single report with key findings
/medications         Active medications + history
/appointments        Upcoming + past appointments
/documents           EOBs, provider messages, generic documents
/review              Confidence-flagged items pending verification
/inbox/raw           Unprocessed emails (debug + manual classification)
/settings            Allowlist, polling cadence, model prefs, theme
```

### Activity feed card (the heart of the dashboard)

```
┌──────────────────────────────────────────────────────┐
│ 🩺 Lab panel — Quest Diagnostics       2 minutes ago │
│ Comprehensive Metabolic Panel + Lipid Panel          │
│                                                       │
│   HbA1c           6.4 %   ↓ 0.4 from last visit      │
│   LDL             102 mg/dL                          │
│   eGFR            88 mL/min                          │
│   Fasting Glucose 112 mg/dL  (high — was 99)         │
│                                                       │
│  [View full panel] [Compare with last visit]         │
└──────────────────────────────────────────────────────┘
```

The same card style applies to every content type with the relevant data.
Imaging cards show the impression. Medication cards show name + dose.
Appointments show the next upcoming. Hover/tap reveals details.

### Information density choices

- **Front-load deltas, flagged values, and the actionable detail.** No
  rendering of the raw FHIR JSON. Paul shouldn't see LOINC codes in the
  default view (they're available in details).
- **Trends in line, not as walls of charts.** A small sparkline next to
  the value (last 8 readings) is more useful than a full Plotly chart on
  the home page.
- **Group lab values into clinically meaningful panels.** Don't dump 30
  individual observations; show them inside the panel they came from.

## Access — keep the VM private

Single recommendation, easy alternatives.

### Recommended: Tailscale

- Install Tailscale on the VM and on Paul's laptop/phone (~5 min total).
- Bind dashboard to `127.0.0.1:3001`. Tailscale's userspace networking
  exposes it to the tailnet via `aria-agent01.tail<id>.ts.net:3001` (or a
  MagicDNS name like `https://tula.aria-agent01.<tailnet>.ts.net`).
- Tailscale ACLs lock it to Paul's identity; no public surface.
- Tailscale Funnel is available if Paul *wants* a public URL later, but
  for personal health data the tailnet-only mode is the right default.

### Alternatives

- **Cloudflare Tunnel + Cloudflare Access** — public hostname behind
  Cloudflare Zero Trust. Free for personal use up to 50 users. Slightly
  more setup than Tailscale, supports adding caregivers without VPN
  installs.
- **Public + Entra ID OAuth** — match the M365 auth, single login across
  email-router and dashboard. More setup, but consolidates identity.
- **Local-only on the VM** — `ssh -L 3001:127.0.0.1:3001 ra-agent01`
  forwards the port to the laptop on demand. Zero infra; bad UX from
  a phone.

## Data flow contract with email-router

The dashboard depends only on:

1. **FHIR JSON file paths** — exactly as the email-router design doc
   already specifies. Stable, no migration needed.
2. **A `meta.tula` block in every FHIR resource** — already in the design
   doc. Provides emailFrom, processedAt, classification metadata, and
   confidence score.
3. **An optional `state.json`** in `~/.openclaw/workspace/tula/` we'll
   add to track:
   - last-seen email message ID
   - confidence-review queue state
   - dashboard read positions ("inbox zero" feel)

If we tweak the FHIR shapes during email-router build, the dashboard's
type definitions update once. Single source of truth.

## Phase plan

### Phase 1 — Walking skeleton

- SvelteKit project scaffold with TypeScript + Tailwind + shadcn-svelte
- Three pages: `/` (activity feed), `/labs/:loinc` (single trend),
  `/settings` (read-only)
- Reads from a fake `fixtures/` directory that mirrors the FHIR layout
  (so we can build it before email-router is producing data)
- Server starts under `pm2`; `systemd` unit for boot
- 127.0.0.1:3001 binding
- Tailscale install + ACL config

**Deliverable**: Paul can open the dashboard URL on his laptop and see
3 hardcoded sample lab panels rendered beautifully.

**Estimated effort**: 4-6 hours (most of it is the design system,
not the data).

### Phase 2 — Live FHIR reads

- Replace fixtures with real reads from
  `~/.openclaw/workspace/tula/fhir/**/*.json`
- inotify watcher → SSE channel to push new resources as they're written
- Activity feed updates without reload
- Trend page renders real lab history

**Deliverable**: when email-router writes a new FHIR file, dashboard
shows it within 2 seconds.

**Estimated effort**: 6-8 hours.

### Phase 3 — Coverage of remaining content types

Pages for imaging, medications, appointments, documents, review queue,
inbox raw. Each is mostly a list view + detail view with the same card
style.

**Deliverable**: every content type defined in the email-router design
has a real view.

**Estimated effort**: 1-2 days.

### Phase 4 — Interactions

Confidence-review actions: approve, edit, reject. Flag for follow-up.
Compose Telegram message from a card ("ask Tula about this lab"). Mark
seen. Soft-delete.

**Deliverable**: the dashboard becomes the central command surface, not
just a viewer.

**Estimated effort**: 1-2 days.

### Phase 5 — Operational polish

- PWA manifest + service worker for offline read mode
- Settings UI (allowlist edits, polling cadence, theme)
- Search (filename grep + a small SQLite FTS index over extracted text)
- Import/export FHIR Bundle
- Performance: virtualize the activity feed if >1000 events

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| FHIR JSON layout drifts during email-router build | High | Define TypeScript types in `tula/types.ts` in the dashboard repo; both router and dashboard import from there. Single source of truth. |
| File-watcher misses events under heavy write load | Low (personal volume) | Fall back to a 60s polling tick if no inotify event seen in 5 min |
| LayerChart/ECharts performance on 5+ years of biomarker history | Low | Virtualize / chunk. Page-level data limit. |
| Tailscale free tier limits | Very low (personal use) | Free for ≤3 users / ~100 devices |
| Dashboard process crash | Medium | `systemd Restart=on-failure` |
| Beautiful UI ≠ accessible UI | Medium | shadcn primitives are a11y by default; verify with axe in CI |
| FHIR file lock contention between router writes and dashboard reads | Low | Atomic write (write to .tmp + rename) on router side; dashboard tolerates partial reads gracefully |

## Open decisions

We need answers to these before scaffolding:

1. **Stack**: SvelteKit (recommended) vs Next.js vs Astro vs Express+HTMX?
2. **Access**: Tailscale (recommended) vs Cloudflare Tunnel vs Entra OAuth vs local SSH-tunnel?
3. **Branding / name**: "Tula Dashboard"? "Tula Console"? "Aria"? Just "Tula"?
4. **Hostname**: `https://tula.aria-agent01.<tailnet>.ts.net` (Tailscale MagicDNS) vs a custom domain via Cloudflare Tunnel?
5. **Charts library**: LayerChart (small, Svelte-native) vs ECharts (richer)
   vs Recharts (if we go React)?
6. **Caregivers viewing the dashboard**: in scope for Phase 1, or after?
   This affects auth choice — Tailscale is fine if it's just Paul; if
   caregivers need access without a VPN install, lean Cloudflare Tunnel
   + Cloudflare Access.

## Sequencing with the email-router work

Two reasonable orders:

### Option A — Email router first, dashboard after

Get data flowing into FHIR. Then build the dashboard against real data.
Pro: dashboard authors against the actual shape, no fixtures-to-real
migration. Con: nothing to look at for ~2 weeks.

### Option B — Dashboard skeleton first, then email router, then iterate

Build the dashboard against fixtures matching the design doc's FHIR
shapes. Then build email-router. Both reach completeness around the
same time, with the dashboard ready to display data the moment the
router starts producing it.
Pro: faster perceived progress; UI design pressure surfaces FHIR
schema gaps early. Con: small risk of fixtures-vs-reality drift.

**Recommendation**: Option B. The FHIR shapes in the design doc are
solid and explicit. Drift risk is low. Faster feedback loop.

## What to do next session

1. Pick stack, access model, branding name (questions 1–4 above).
2. Scaffold SvelteKit (or chosen alternative) into `apps/dashboard/` in
   this repo.
3. Build Phase 1 walking skeleton against fixtures.
4. Resume email-router Phase 1 (M365 setup) in parallel — they're
   genuinely independent until Phase 2 of the dashboard.
