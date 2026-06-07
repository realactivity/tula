# Tula Dashboard - Build Plan

Companion to the [email router build plan](email-router-build-plan.md).
The email router writes structured FHIR JSON; this dashboard reads it and
presents a beautiful, modern UI Paul can browse from any device.

> **Status note (updated 2026-06-06):** This document started as a pre-code
> plan. It is now partly built. The authoritative snapshot of what actually
> exists lives in **[Current state](#current-state-2026-06-06)** directly
> below; the architecture/stack sections after it retain the original
> reasoning for context. Where the two disagree, Current state wins.

## Current state (2026-06-06)

### The app that exists: `apps/my-aria`

The dashboard is real and running. `apps/agent-studio` (the activity-feed
sibling) is still a one-page skeleton and is **not** running.

| Aspect | Reality |
|---|---|
| Framework | Next.js 15 (App Router, TS), Tailwind v4, `motion`, `recharts`, `lucide-react` |
| Process | systemd **user** unit `my-aria.service`, `next start -p 3002 -H 127.0.0.1`, `Restart=always`, enabled at boot |
| Health | Up ~29h, ~78MB RAM, `/dashboard` returns 200 |
| Binding | `127.0.0.1:3002` only — not reachable off-VM |
| Data | **100% synthetic fixtures.** No filesystem/FHIR reads anywhere in source |
| Routes built | ~23: `dashboard`, `labs`, `medications`, `messages`, `appointments`, `home-devices`, `integrations/*` (4), `nutrition/*` (3), `sdoh/*` (3), `travel/*` (7) |

The data seam was designed but never implemented — every route resolves
through `lib/data/loader.ts`, which returns `dashboardFixture`:

```ts
export async function getDashboardData(): Promise<DashboardData> {
  return { ...dashboardFixture, refreshedAt: new Date().toISOString() };
}
```

### The data that exists: real FHIR on disk

Contrary to the old assumption that data wasn't flowing yet, a substantial
real export is already present at `~/.openclaw/workspace/tula/fhir/` —
**1,319 JSON files** (real MGB/Epic export, single patient "Swider, Paul"):

| Resource | Count | | Resource | Count |
|---|---|---|---|---|
| Observation | 712 | | Medication | 44 |
| DocumentReference | 110 | | MedicationRequest | 44 |
| Condition | 106 | | DiagnosticReport | 35 |
| Practitioner | 77 | | Specimen | 24 |
| Encounter | 71 | | Procedure | 21 |
| Location | 21 | | Organization | 20 |
| Coverage | 6 | | ServiceRequest | 11 |
| CarePlan | 3 | | Goal / AuditEvent | 3 / 3 |

This is real PHI. Two data-shape gaps to design around:

- **No `Appointment` resources** exist (only `Encounter`). The dashboard's
  "upcoming appointment" must derive from `Encounter` or render empty.
- The `travel`, `sdoh`, `nutrition`, `home-devices`, and `integrations`
  routes have **no FHIR backing** — they are demo/roadmap surfaces with
  their own fixtures and stay synthetic until a real source exists.

### The three gaps between "running" and "done"

1. **Data wiring** — implement the `loader.ts` seam against the FHIR store.
   This is the bulk of the work. See [Data wiring plan](#data-wiring-plan-detailed).
2. **Remote access** — nothing is installed (no Tailscale/cloudflared/
   nginx/caddy); UFW allows only SSH. Chosen path: **Tailscale**. See
   [Remote access via Tailscale](#remote-access-via-tailscale-runbook).
3. **Port discipline for ~10 apps** — only `3002` is in use today. Adopt a
   convention now. See [Port allocation](#port-allocation-10-apps).

## What it is

A Node-based web app running on the OpenClaw VM. Paul opens a URL in any
browser (laptop, phone, tablet) and sees:

- **Activity feed** - most recent emails processed, newest first, each
  with content type and a one-line summary
- **Trends** - interactive charts of biomarkers over time
  (HbA1c, lipid panel, kidney function, vitals)
- **Documents** - imaging reports, lab panels, EOBs, provider messages
- **Medications** - current med list with refill status
- **Appointments** - upcoming visits
- **Confidence review queue** - extractions the model wasn't sure about,
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

## Product insight: patient-owned medication reconciliation

> Captured 2026-06-06 from the patient (Paul). This is one of the clearest
> concrete benefits of the whole system and should drive a Phase 4 feature.

The medication list a clinic holds is almost never the true list of what the
patient actually takes. Three systematic gaps:

1. **Supplements, vitamins, and OTC products** are rarely captured in the
   clinical record at all, yet they are part of the real regimen (and matter
   for interactions and labs).
2. **Prescribed-but-not-filled.** The patient sometimes chooses not to fill
   or not to continue a prescription. The clinic record still shows it as
   active; reality differs.
3. **Stale/duplicated entries** linger in the EHR after a real-world change.

Because Tula already aggregates the clinical record (FHIR from the portals)
*and* lives with the patient day to day, it is uniquely positioned to hold
**one reconciled version of the true state of the patient's health** - the
single source of truth that neither the EHR nor memory alone provides.

The unlock is letting the patient **add and delete medications (and
supplements/vitamins) directly in My Aria**, layered on top of the
clinically-sourced list. That patient-maintained layer, merged with the FHIR
import, is exactly the artifact a patient wants to walk into a visit with -
and the artifact an agent should reason over.

### Requirements this implies

- A **patient-maintained medication/supplement layer** stored locally
  (e.g. `~/.openclaw/workspace/tula/patient/medications.json`), kept
  **separate** from the read-only FHIR import so provenance is never lost.
- The medications view **merges** two sources and labels each entry's
  origin: `from clinic record`, `added by you`, or `marked not taking`.
- Patient actions: **add** (free-text or searched drug/supplement + dose),
  **edit dose/schedule**, **mark as not taking / stopped** (soft-delete that
  hides a clinic entry without destroying the underlying FHIR), and
  **remove** a patient-added entry.
- A clear **reconciliation status** per medication: agrees with clinic /
  patient-added / patient-stopped / clinic-only-not-confirmed.
- **Export/share** the reconciled list (print or de-identified hand-off) so
  it can be brought to a visit as "this is what I actually take."
- Never write back to the EHR. This layer is the patient's own truth; it
  informs the clinician, it does not silently mutate the clinical source.

### Why this is a differentiator

This converts My Aria from a *viewer of someone else's record* into the
patient's *own authoritative health record*. It is the difference between
"here is what your clinic thinks you take" and "here is what you actually
take" - the thing patients and agents both actually need.

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
  │  Tula Dashboard (Node, listens on 127.0.0.1:3002)       │
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
- **inotify (Linux file watcher) -> SSE.** When the email-router writes a
  new FHIR file, an inotify event triggers the dashboard server to push
  an SSE message. The browser appends the new card to the activity feed
  with no refresh needed.
- **127.0.0.1 binding.** The dashboard never listens on a public
  interface. Access is through Tailscale (preferred) or Cloudflare
  Tunnel. This eliminates an entire class of "exposed health data" risks.

## Stack - recommendation and alternatives

### Recommended: SvelteKit + Tailwind CSS + shadcn-svelte

| Concern | SvelteKit pick | Why |
|---|---|---|
| Framework | **SvelteKit** | Compiles to small JS bundles. SSR + client islands by default. Tiny memory footprint matters on a B2s VM. |
| Styling | **Tailwind CSS** | Universal modern default. Consistent design system without writing CSS files. |
| Components | **shadcn-svelte** | Copy-paste components (not an install dep). Beautiful defaults that ship with Radix primitives ported to Svelte. |
| Charts | **LayerChart** or **Apache ECharts** | LayerChart is Svelte-native; ECharts is heavier but more flexible. |
| Realtime | **SSE** (built into SvelteKit endpoints) | Server-push for new-email notifications. WebSockets would also work but SSE is simpler for one-way push. |
| Persistence | **None initially** | Reads FHIR JSON from disk. Add SQLite if query volume grows. |
| Auth | **None - Tailscale handles it** | See "Access" below. |
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
/labs/:loinc         Single biomarker trend (e.g., /labs/4548-4 -> HbA1c)
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
│ 🩺 Lab panel - Quest Diagnostics       2 minutes ago │
│ Comprehensive Metabolic Panel + Lipid Panel          │
│                                                       │
│   HbA1c           6.4 %   v 0.4 from last visit      │
│   LDL             102 mg/dL                          │
│   eGFR            88 mL/min                          │
│   Fasting Glucose 112 mg/dL  (high - was 99)         │
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

## Access - keep the VM private

Single recommendation, easy alternatives.

### Chosen: Tailscale  ✅ (decided 2026-06-06)

See the step-by-step [Remote access via Tailscale](#remote-access-via-tailscale-runbook)
runbook above for install/ACL/serve details.

- Install Tailscale on the VM and on Paul's laptop/phone (~5 min total).
- Bind dashboard to `127.0.0.1:3002`. Tailscale's userspace networking
  exposes it to the tailnet via `tula-agent01.tail<id>.ts.net:3002` (or a
  MagicDNS name like `https://aria.tula-agent01.<tailnet>.ts.net`).
- Tailscale ACLs lock it to Paul's identity; no public surface.
- Tailscale Funnel is available if Paul *wants* a public URL later, but
  for personal health data the tailnet-only mode is the right default.

### Alternatives

- **Cloudflare Tunnel + Cloudflare Access** - public hostname behind
  Cloudflare Zero Trust. Free for personal use up to 50 users. Slightly
  more setup than Tailscale, supports adding caregivers without VPN
  installs.
- **Public + Entra ID OAuth** - match the M365 auth, single login across
  email-router and dashboard. More setup, but consolidates identity.
- **Local-only on the VM** - `ssh -L 3001:127.0.0.1:3001 ra-agent01`
  forwards the port to the laptop on demand. Zero infra; bad UX from
  a phone.

## Data flow contract with email-router

The dashboard depends only on:

1. **FHIR JSON file paths** - exactly as the email-router design doc
   already specifies. Stable, no migration needed.
2. **A `meta.tula` block in every FHIR resource** - already in the design
   doc. Provides emailFrom, processedAt, classification metadata, and
   confidence score.
3. **An optional `state.json`** in `~/.openclaw/workspace/tula/` we'll
   add to track:
   - last-seen email message ID
   - confidence-review queue state
   - dashboard read positions ("inbox zero" feel)

If we tweak the FHIR shapes during email-router build, the dashboard's
type definitions update once. Single source of truth.

## Data wiring plan (detailed)

This is the critical path: turn the synthetic dashboard into a live view of
the on-disk FHIR record without changing the UI. The seam is already in the
right place (`lib/data/loader.ts`); we implement behind it.

### Design principles

- **One seam, no UI churn.** Every change lands behind `getDashboardData()`
  and sibling loaders. Components keep consuming the same `DashboardData`
  shape from `lib/data/types.ts`.
- **Read-only, server-side.** FHIR reads happen in Next.js Server Components
  / route handlers (Node runtime), never shipped to the client. The browser
  only ever sees the curated `DashboardData`, never raw FHIR.
- **Config the path, default to the real store.** Add
  `TULA_FHIR_DIR` env (default `~/.openclaw/workspace/tula/fhir`). The
  `my-aria.service` unit gets `Environment=TULA_FHIR_DIR=...` so prod and
  local dev can point at different trees.
- **Tolerate partial/atomic writes.** The email-router writes new files
  live; reads must `try/catch` per-file and skip malformed/`.tmp` files.

### Step 1 — FHIR reader library (`lib/fhir/store.ts`)

A small, dependency-free reader:

- `loadResources<T>(type)` — read + `JSON.parse` every `*.json` under
  `<TULA_FHIR_DIR>/<type>/`, skipping unreadable files.
- `index()` — build an in-memory index grouped by `resourceType`, with a
  light cache (mtime-based) so we re-read only changed dirs. 1,319 small
  files parse in well under a second; cache keeps request latency flat.
- Reference resolver — follow `subject`/`encounter`/`performer` references
  (e.g. `Practitioner/<id>`, `Organization/<id>`) to display names.

**Effort:** ~0.5 day.

### Step 2 — FHIR → DashboardData mappers (`lib/data/mappers/`)

Map real resources into the existing view types. Per-route mapping:

| Route | Source FHIR | Mapping notes |
|---|---|---|
| `dashboard` recent labs | `Observation` (category `laboratory`) | Group by LOINC `code`, sort by `effectiveDateTime`, take latest + last 8 for `LabTrend.history` sparkline; compute `delta` vs previous |
| `dashboard` medications | `MedicationRequest` + `Medication` | Active = `status in (active, on-hold)`; resolve `medicationReference` → `Medication.code.text` for display + dose |
| `dashboard` upcoming | `Encounter` (no `Appointment` exists) | Derive next/most-recent encounter, or render empty-state. Flag for product decision |
| `labs` | `Observation` (`laboratory`) | Full panel grouping by `DiagnosticReport` where present; per-LOINC trend pages |
| `medications` | `MedicationRequest`/`Medication` | Active + history; requester → `Practitioner` |
| `messages` | `DocumentReference` | Provider notes/letters; `type.text` + `date` + `author` → `Practitioner` |
| `appointments` | `Encounter` | Past encounters list until real `Appointment` data exists |
| conditions (new, optional) | `Condition` | 106 records — high-value problem list; not yet a route |

The `travel` / `sdoh` / `nutrition` / `home-devices` / `integrations` routes
are **out of scope** for FHIR wiring — they remain fixture-backed demo
surfaces and should be visually badged as such.

**Effort:** dashboard + labs + medications ≈ 1–1.5 days; messages,
appointments, conditions ≈ +1–1.5 days.

### Step 3 — Live refresh (optional, later)

`inotify` watch on `<TULA_FHIR_DIR>` → SSE channel → activity feed updates
without reload. Defer until the email-router is actively writing during a
session; a 60s server-side revalidate covers the demo in the meantime.

**Effort:** ~0.5–1 day when wanted.

### PHI guardrails (do before remote access)

- Confirm the build doesn't bake fixtures+real data into the client bundle
  (reads are server-only — verify with a production build + bundle check).
- Keep the in-app disclaimer ribbon.
- Don't log full resources; log counts/ids only.
- Gate the real-data path behind Tailscale (next section) before it's
  reachable from anything other than localhost.

## Port allocation (~10 apps)

Today only `3002` (my-aria) is a Tula app port. Adopt this convention before
app #3 exists so we never end up tunneling ten separate ports.

| Port | App / service | State |
|---|---|---|
| 3000 | `agent-studio` (activity feed) | reserved; skeleton, not running |
| 3001 | (reserved, originally planned dashboard port) | free |
| 3002 | `my-aria` | **live** |
| 3003–3010 | apps 3–10 | one per app, allocate sequentially |
| 8080 | filebrowser | existing |
| 18789 | openclaw gateway | existing |

Rules:

1. **Every app binds `127.0.0.1:30xx`.** Never `0.0.0.0`. The loopback bind
   is the first line of defense; Tailscale is the second.
2. **One front door, not ten.** Expose the apps through a single entry point
   (Tailscale + optionally a local reverse proxy) with name- or path-based
   routing — e.g. `aria.<tailnet-name>`, `studio.<tailnet-name>` — rather
   than publishing 10 ports.
3. **Record allocations here.** This table is the registry; update it when
   an app claims a port.
4. **systemd unit per app**, mirroring `my-aria.service` (user unit,
   `Restart=always`, explicit `-H 127.0.0.1 -p 30xx`).

## Remote access via Tailscale (runbook)

Chosen over Cloudflare Tunnel: it's the fastest path for a single operator +
demo machine, needs no domain, and keeps the VM off the public internet.
(Cloudflare Tunnel remains the future option if non-VPN caregiver access is
needed — see the alternatives under [Access](#access---keep-the-vm-private).)

### One-time setup

1. **Install on the VM:**
   `curl -fsSL https://tailscale.com/install.sh | sh`
2. **Bring up with SSH + a tag** (so it's identifiable and ACL-able):
   `sudo tailscale up --ssh --hostname tula-agent01`
   Authenticate via the printed URL against your tailnet.
3. **Install Tailscale on the demo machine** and sign into the same tailnet.
4. **Keep apps on `127.0.0.1`.** Tailscale's userspace networking reaches
   loopback services by the tailnet hostname — no `0.0.0.0` rebind, no UFW
   change (Tailscale uses WireGuard on UDP 41641; UFW's SSH-only inbound
   rule stays as is).

### Reaching the apps

- Direct: `http://tula-agent01:3002/dashboard` from the demo machine once
  both are on the tailnet (enable MagicDNS for the bare hostname).
- Cleaner names (optional): run a local reverse proxy (Caddy) bound to
  `127.0.0.1` that maps `aria.tula-agent01.<tailnet>.ts.net` → `:3002`,
  `studio...` → `:3000`, etc. This pairs with the "one front door" port rule.
- HTTPS (optional): `tailscale cert` + `tailscale serve` can terminate TLS
  for a service so the browser shows a valid cert on the tailnet name.

### Guardrails

- Lock down with a Tailscale ACL so only your identity/devices can reach the
  `tula-agent01` node before pointing it at real PHI.
- Do **not** enable Tailscale Funnel (public exposure) for any PHI-backed app.

## Phase plan

### Phase 1 - Walking skeleton

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

### Phase 2 - Live FHIR reads

- Replace fixtures with real reads from
  `~/.openclaw/workspace/tula/fhir/**/*.json`
- inotify watcher -> SSE channel to push new resources as they're written
- Activity feed updates without reload
- Trend page renders real lab history

**Deliverable**: when email-router writes a new FHIR file, dashboard
shows it within 2 seconds.

**Estimated effort**: 6-8 hours.

### Phase 3 - Coverage of remaining content types

Pages for imaging, medications, appointments, documents, review queue,
inbox raw. Each is mostly a list view + detail view with the same card
style.

**Deliverable**: every content type defined in the email-router design
has a real view.

**Estimated effort**: 1-2 days.

### Phase 4 - Interactions

Confidence-review actions: approve, edit, reject. Flag for follow-up.
Compose Telegram message from a card ("ask Tula about this lab"). Mark
seen. Soft-delete.

**Patient-owned medication reconciliation** (see [Product insight](#product-insight-patient-owned-medication-reconciliation)):
patient can add/edit/remove medications and supplements and mark clinic
entries as "not taking", producing one reconciled true-state list merged
from the FHIR import and the patient-maintained layer. This is a flagship
Phase 4 capability, not a minor edit action.

**Deliverable**: the dashboard becomes the central command surface, not
just a viewer - and the medications view becomes the patient's single
source of truth (clinic record + patient-maintained layer, reconciled).

**Estimated effort**: 1-2 days (core interactions) + ~1 day for the
medication reconciliation layer (storage, merge, origin labels, export).

### Phase 5 - Operational polish

- PWA manifest + service worker for offline read mode
- Settings UI (allowlist edits, polling cadence, theme)
- Search (filename grep + a small SQLite FTS index over extracted text)
- Import/export FHIR Bundle
- Performance: virtualize the activity feed if >1000 events

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| FHIR JSON layout drifts during email-router build | High | Define TypeScript types in `lib/fhir/types.ts` in `apps/agent-studio/`; both router and dashboard import from there. Single source of truth. |
| File-watcher misses events under heavy write load | Low (personal volume) | Fall back to a 60s polling tick if no inotify event seen in 5 min |
| LayerChart/ECharts performance on 5+ years of biomarker history | Low | Virtualize / chunk. Page-level data limit. |
| Tailscale free tier limits | Very low (personal use) | Free for <=3 users / ~100 devices |
| Dashboard process crash | Medium | `systemd Restart=on-failure` |
| Beautiful UI != accessible UI | Medium | shadcn primitives are a11y by default; verify with axe in CI |
| FHIR file lock contention between router writes and dashboard reads | Low | Atomic write (write to .tmp + rename) on router side; dashboard tolerates partial reads gracefully |

## Locked-in decisions

| Decision | Choice |
|---|---|
| Stack | **Next.js 15 + Tailwind CSS v4 + Framer Motion (`motion`)** (TypeScript) — built; `shadcn/ui` not actually used, components are hand-rolled in `components/ui/` |
| Access | **Tailscale** (decided 2026-06-06, supersedes the earlier Cloudflare pick) — VM stays off the public internet, no domain needed, single-operator + demo machine. Cloudflare Tunnel kept as the future option if non-VPN caregiver access is needed |
| Apps / brand | **`my-aria`** is the patient-portal dashboard (running on 3002). **`agent-studio`** is the activity-feed sibling (skeleton). "Aria" usage is a RealActivity sub-brand; see [`TRADEMARK.md`](../TRADEMARK.md) |
| Caregivers in Phase 1 | **Deferred** — Tailscale is operator-device scoped. Caregiver access (without a VPN client) would move us to Cloudflare Tunnel + Access later |
| Charts library | **Recharts** (in use for sparklines) |
| Hostname | Tailnet MagicDNS name (e.g. `aria.tula-agent01.<tailnet>.ts.net`); optional TLS via `tailscale serve`/`tailscale cert` |
| Ports | `127.0.0.1:30xx` per app, registry in [Port allocation](#port-allocation-10-apps); my-aria = 3002 |
| Repo location | `apps/my-aria/` and `apps/agent-studio/` (monorepo-style; skills + scripts + apps in one repo) |

### Why these choices

- **Stack**: shadcn/ui is the de-facto modern component system; the React
  ecosystem (magicui, aceternity, Geist) leads on "stunning UX" component
  libraries. Tailwind v4's CSS-first config + Next.js 15's mature Server
  Components + Framer Motion's physics-based animations give us the
  Linear/Vercel-grade feel without writing CSS.
- **Access**: caregivers need to reach the dashboard without installing
  VPN software, which rules out Tailscale-only. Cloudflare Tunnel +
  Access is the canonical Zero Trust pattern: VM stays private, public
  hostname is gated by identity-aware proxy with email/SSO auth. Free
  for personal use.
- **Name**: aligning with the operational identity (`agent-repo`,
  `agent-backup.sh`, the agent's runtime) keeps mental model consistent.
  Tula stays the agent persona/product name; "agent-studio" is the
  open-source UI surface for the activity feed.

## Sequencing with the email-router work

Two reasonable orders:

### Option A - Email router first, dashboard after

Get data flowing into FHIR. Then build the dashboard against real data.
Pro: dashboard authors against the actual shape, no fixtures-to-real
migration. Con: nothing to look at for ~2 weeks.

### Option B - Dashboard skeleton first, then email router, then iterate

Build the dashboard against fixtures matching the design doc's FHIR
shapes. Then build email-router. Both reach completeness around the
same time, with the dashboard ready to display data the moment the
router starts producing it.
Pro: faster perceived progress; UI design pressure surfaces FHIR
schema gaps early. Con: small risk of fixtures-vs-reality drift.

**Recommendation**: Option B. The FHIR shapes in the design doc are
solid and explicit. Drift risk is low. Faster feedback loop.

## What to do next session

Stack, access model, and the walking skeleton are all **done**. The live
plan is now:

1. **Data wiring (highest value).** Implement `lib/fhir/store.ts` + mappers
   per [Data wiring plan](#data-wiring-plan-detailed); start with the
   `dashboard` recent-labs + medications cards, then the `labs` route.
   Add `TULA_FHIR_DIR` env and wire it into `my-aria.service`.
2. **Decide the "upcoming" behavior** — derive from `Encounter` or show an
   empty-state, given no `Appointment` resources exist.
3. **Remote access** — run the [Tailscale runbook](#remote-access-via-tailscale-runbook)
   on the VM + demo machine; lock down with an ACL before pointing at PHI.
4. **Badge the non-clinical routes** (`travel`/`sdoh`/`nutrition`/
   `home-devices`/`integrations`) as demo/fixture surfaces so real vs.
   synthetic is unambiguous in a demo.
5. **Adopt the port registry** for app #3 onward.
