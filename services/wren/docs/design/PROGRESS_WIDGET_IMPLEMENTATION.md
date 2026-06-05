# Progress Widget Implementation Plan

## Chosen Design: "Counter Hero + Dot Strip" (viz5-d)

**Prototype**: `prototype/viz5-d.html` (static HTML/CSS mockup)
**Screenshot**: `prototype/viz5-d-final.png`

Three vertically stacked zones, all pre-allocated from t=0:
1. **Counter hero**: large resource count ("1,490") + "resources found"
2. **Dot strip**: 44 tiny dots in a horizontal row, grouped with gaps
3. **Status text**: active query names + settled count + reference/attachment bars

The entire layout is fixed. Nothing grows, moves, or is added. Only colors and text content change.

---

## State Model

### The 44 query slots

We make exactly 44 FHIR search queries. Each maps to one dot. The queries are defined in `src/client/lib/smart/client.ts` in `PATIENT_SEARCH_QUERIES` (44 entries). Each dot's position is fixed from the start.

Grouped for the dot strip (groups separated by wider gaps):

| Group | Label | Count | Queries |
|-------|-------|-------|---------|
| 1 | Lab & Vitals | 19 | 17 Observation categories + 2 DiagnosticReport categories |
| 2 | Conditions | 3 | problem-list, health-concern, encounter-diagnosis |
| 3 | Documents | 2 | clinical-note, all |
| 4 | Services | 4 | 4 ServiceRequest queries |
| 5 | Medications | 3 | MedRequest, MedDispense, MedStatement |
| 6 | Clinical | 4 | Allergies, Immunizations, CarePlan, CareTeam |
| 7 | Admin | 9 | Patient, Encounter, Procedure, Goal, Coverage, Device, FamilyHistory, QuestionnaireResponse, RelatedPerson |

Verify: 19+3+2+4+3+4+9 = 44

### Per-query state machine

```
pending → active → done(count)    success, found resources
                 → empty           success, zero results  
                 → error           request failed
```

### What's knowable when

| Time | Known | Not known |
|------|-------|-----------|
| t=0 | 44 query slots, their labels/groups | Everything else |
| During Phase 1 | Which queries are pending/active/settled; running resource total; for active queries, that they're still going | How many pages a query will need; total resource count |
| After Phase 1 | All 44 settled; exact reference count to fetch | Attachment count (not yet) |
| During Phase 2 | refs completed / refs total | Attachment count |
| After Phase 2 | Exact attachment count to fetch | — |
| During Phase 3 | attachments completed / attachments total | — |

**Critical**: We do NOT know how many pages a query will take. Epic usually omits `bundle.total`. A query stays in "active" state for its entire duration — could be 1 page or 20. We NEVER show page numbers to the user.

### Three sequential phases

1. **Resource queries** (44 parallel queries, max 5 concurrent) → dot strip animates
2. **References** (N individual fetches, N known) → reference bar fills
3. **Attachments** (N individual fetches, N known) → attachment bar fills

---

## Visual Spec

### Dot states (5 visually distinct treatments)

```css
.dot.pending  { background: #e0e0e0; }                           /* light grey */
.dot.active   { background: #26a69a; animation: pulse 1s infinite; } /* teal, pulsing */
.dot.done-1   { background: #c8e6c9; }  /* 1-5 resources: very light green */
.dot.done-2   { background: #81c784; }  /* 6-20: light green */
.dot.done-3   { background: #4caf50; }  /* 21-100: medium green */
.dot.done-4   { background: #2e7d32; }  /* 101+: dark green */
.dot.empty    { background: #ececec; }  /* slightly lighter than pending */
.dot.error    { background: #ef5350; }  /* red */

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1.0; }
}
```

Dots are 5px diameter, 1px gap within groups, 3px gap between groups.

### Counter hero

- During fetch: "1,490" in 32px weight-600 dark text + "resources found" in 12px #999
- On completion: number turns #2e7d32 (dark green), "✓" appended

### Status text area

- During Phase 1: "Loading: Labs, Vitals, Encounters, ..." (friendly names, italic, muted)
- Settled counter: "32 of 44 settled" in 11px muted
- Reference bar: thin track with green fill, "—" when inactive, count when active/done
- Attachment bar: same
- On completion: "25 types found · 17 empty · 2 failed"

### Pre-allocated layout

The reference and attachment bars are visible from t=0 as empty grey tracks with "—" counts. They fill when their phase starts. The widget height never changes.

---

## Current Codebase Integration Points

### Where progress is generated

`src/client/lib/smart/client.ts`:
- `fetchPatientData()` calls `onProgress(info: ProgressInfo)` throughout
- Current `ProgressInfo` shape:
  ```typescript
  interface ProgressInfo {
    phase: 'resources' | 'references' | 'attachments';
    completed: number;   // queries or refs or attachments completed
    total: number;       // total queries (44) or refs or attachments
    detail: string;      // label like "Observation:laboratory"
    subProgress?: { current: number; total: number }; // page info (internal)
  }
  ```

### Where progress is stored

`src/client/store/records.ts`:
- `connectionState[id].refreshProgress: ProgressInfo | null` — per-connection during refresh
- `statusMessage: string` — global status text set during initial fetch (line 355):
  ```typescript
  statusMessage: `Fetching: ${info.detail || info.phase} (${info.completed}/${info.total})`
  ```

### Where progress is rendered

`src/client/pages/RecordsPage.tsx` (line 175-179):
```tsx
{refreshing && prog && (
  <div className="conn-progress">
    {prog.phase}: {prog.completed}/{prog.total}
    {prog.detail ? ` — ${prog.detail}` : ''}
  </div>
)}
```

Also used in `OAuthCallbackPage.tsx` during initial connection via `statusMessage`.

---

## Implementation Steps

### Step 1: Extend the progress model

The current `ProgressInfo` is too coarse — it reports one "current query" but the widget needs the state of ALL 44 queries simultaneously (since 5 run concurrently).

Create a new type in `src/client/lib/smart/client.ts`:

```typescript
export type QueryState = 
  | { status: 'pending' }
  | { status: 'active'; resourcesSoFar: number }
  | { status: 'done'; count: number }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export interface QuerySlot {
  resourceType: string;
  category: string | null;
  friendlyLabel: string;  // e.g., "Labs", "Vitals", "Allergies"
  group: number;          // 1-7
  state: QueryState;
}

export interface FetchProgress {
  phase: 'resources' | 'references' | 'attachments';
  queries: QuerySlot[];         // always length 44, mutated in place
  totalResources: number;       // running sum across all done/active queries
  settledCount: number;         // how many of 44 are done/empty/error
  references: { completed: number; total: number } | null;
  attachments: { completed: number; total: number } | null;
}
```

### Step 2: Build the query slot table

Define the 44 slots with friendly labels and group assignments. Add this as a const alongside `PATIENT_SEARCH_QUERIES`:

```typescript
const QUERY_FRIENDLY_LABELS: Array<{ label: string; group: number }> = [
  // Group 1: Lab & Vitals (19)
  { label: 'Labs', group: 1 },
  { label: 'Vitals', group: 1 },
  { label: 'Social History', group: 1 },
  { label: 'Surveys', group: 1 },
  { label: 'Exams', group: 1 },
  { label: 'Therapy', group: 1 },
  { label: 'Activity', group: 1 },
  { label: 'Imaging', group: 1 },
  { label: 'Procedures', group: 1 },
  { label: 'SDOH', group: 1 },
  { label: 'Functional', group: 1 },
  { label: 'Disability', group: 1 },
  { label: 'Cognitive', group: 1 },
  { label: 'Clinical Tests', group: 1 },
  { label: 'ADI', group: 1 },
  { label: 'Care Experience', group: 1 },
  { label: 'Treatment Prefs', group: 1 },
  { label: 'Lab Reports', group: 1 },
  { label: 'Radiology', group: 1 },
  // Group 2: Conditions (3)
  { label: 'Problems', group: 2 },
  { label: 'Health Concerns', group: 2 },
  { label: 'Diagnoses', group: 2 },
  // Group 3: Documents (2)
  { label: 'Clinical Notes', group: 3 },
  { label: 'Documents', group: 3 },
  // Group 4: Services (4)
  { label: 'Evaluations', group: 4 },
  { label: 'Social Services', group: 4 },
  { label: 'SDOH Services', group: 4 },
  { label: 'Services', group: 4 },
  // Group 5: Medications (3)
  { label: 'Medications', group: 5 },
  { label: 'Dispensing', group: 5 },
  { label: 'Med History', group: 5 },
  // Group 6: Clinical (4)
  { label: 'Allergies', group: 6 },
  { label: 'Immunizations', group: 6 },
  { label: 'Care Plan', group: 6 },
  { label: 'Care Team', group: 6 },
  // Group 7: Admin (9)
  { label: 'Patient', group: 7 },
  { label: 'Encounters', group: 7 },
  { label: 'Procedures', group: 7 },
  { label: 'Goals', group: 7 },
  { label: 'Coverage', group: 7 },
  { label: 'Devices', group: 7 },
  { label: 'Family History', group: 7 },
  { label: 'Questionnaires', group: 7 },
  { label: 'Related Persons', group: 7 },
];
```

This array is parallel to `PATIENT_SEARCH_QUERIES` — index 0 corresponds to the first query, etc.

### Step 3: Update `fetchPatientData` to emit rich progress

Inside `fetchPatientData()`, create the `FetchProgress` object at the start, initialize all 44 slots as `pending`, and mutate slot states as queries progress. Emit via a new callback (or replace the existing `onProgress`).

Key changes:
- Before each query starts: set slot to `{ status: 'active', resourcesSoFar: 0 }`
- On each page completion within a query: update `resourcesSoFar`
- On query completion: set slot to `done(count)`, `empty`, or `error`
- After each state change: emit the full `FetchProgress` object
- For Phase 2/3: update `references` / `attachments` fields

The existing `ProgressInfo` callback can be kept for backward compat, or replaced.

### Step 4: Store the progress in Zustand

In `src/client/store/records.ts`, add:

```typescript
fetchProgress: FetchProgress | null;
```

Set it during both `saveNewConnection` (initial fetch) and `refreshConnection` (refresh). Clear it when fetch completes or connection is removed.

### Step 5: Create the React component

Create `src/client/components/FetchProgressWidget.tsx`:

```tsx
import { useRecordsStore } from '../store/records';
import type { FetchProgress, QuerySlot } from '../lib/smart/client';

function dotClass(slot: QuerySlot): string {
  switch (slot.state.status) {
    case 'pending': return 'dot pending';
    case 'active':  return 'dot active';
    case 'empty':   return 'dot empty';
    case 'error':   return 'dot error';
    case 'done': {
      const c = slot.state.count;
      if (c <= 5) return 'dot done-1';
      if (c <= 20) return 'dot done-2';
      if (c <= 100) return 'dot done-3';
      return 'dot done-4';
    }
  }
}

export default function FetchProgressWidget({ progress }: { progress: FetchProgress }) {
  const { queries, totalResources, settledCount, references, attachments, phase } = progress;
  const isComplete = settledCount === 44 && phase === 'attachments' 
    && attachments && attachments.completed === attachments.total;

  // Group queries by group number
  const groups: QuerySlot[][] = [[], [], [], [], [], [], []];
  for (const q of queries) {
    groups[q.group - 1].push(q);
  }

  // Active query labels
  const activeLabels = queries
    .filter(q => q.state.status === 'active')
    .map(q => q.friendlyLabel);

  const doneCount = queries.filter(q => q.state.status === 'done').length;
  const emptyCount = queries.filter(q => q.state.status === 'empty').length;
  const errorCount = queries.filter(q => q.state.status === 'error').length;

  return (
    <div className="fetch-progress">
      {/* Zone 1: Counter */}
      <div className={`counter-hero${isComplete ? ' complete' : ''}`}>
        <div className="counter-num">
          {totalResources.toLocaleString()}
          {isComplete && <span className="counter-check">✓</span>}
        </div>
        <div className="counter-label">resources found</div>
      </div>

      {/* Zone 2: Dot strip */}
      <div className="dot-strip">
        {groups.map((group, gi) => (
          <div key={gi} className="dot-group">
            {group.map((slot, si) => (
              <span key={si} className={dotClass(slot)} />
            ))}
          </div>
        ))}
      </div>

      {/* Zone 3: Status */}
      <div className="status-zone">
        {!isComplete && activeLabels.length > 0 && (
          <div className="status-active">
            Loading: {activeLabels.join(', ')}
          </div>
        )}
        {!isComplete && (
          <div className="status-settled">{settledCount} of 44 settled</div>
        )}
        {isComplete && (
          <div className="status-summary">
            {doneCount} types found · {emptyCount} empty · {errorCount} failed
          </div>
        )}

        <div className="ref-bars">
          <ProgressBar
            label="References"
            completed={references?.completed ?? null}
            total={references?.total ?? null}
          />
          <ProgressBar
            label="Attachments"
            completed={attachments?.completed ?? null}
            total={attachments?.total ?? null}
          />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, completed, total }: {
  label: string;
  completed: number | null;
  total: number | null;
}) {
  const active = completed !== null && total !== null;
  const done = active && completed === total;
  const pct = active && total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="ref-bar">
      <span className="ref-bar-label">{label}</span>
      <div className="ref-bar-track">
        <div className="ref-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className={`ref-bar-count${!active ? ' inactive' : ''}`}>
        {done ? <>{total} <span className="ref-bar-check">✓</span></> : active ? `${completed}/${total}` : '—'}
      </span>
    </div>
  );
}
```

### Step 6: Wire into pages

The widget is used in two places:

1. **OAuthCallbackPage** — during initial connection after OAuth callback. The page calls `saveNewConnection` which triggers `fetchPatientData`. Show the widget while `status === 'loading'`.

2. **RecordsPage** — during connection refresh. Each connection card currently shows `prog.phase: prog.completed/prog.total`. Replace with the widget (or a compact inline variant) when `refreshing && refreshProgress`.

For OAuthCallbackPage, the widget replaces the current `statusMessage` text. For RecordsPage, it could either:
- Replace the entire card's progress area with a compact widget, or
- Show the widget in a modal/overlay during refresh

The simplest integration: show the widget inline in the connection card during refresh, and full-size on OAuthCallbackPage during initial fetch.

### Step 7: Add CSS

Copy the styles from `prototype/viz5-d.html` into `src/client/index.css`. The relevant classes are:
- `.fetch-progress` (wrapper)
- `.counter-hero`, `.counter-num`, `.counter-label`, `.counter-check`
- `.dot-strip`, `.dot-group`, `.dot` + state classes
- `.status-zone`, `.status-active`, `.status-settled`, `.status-summary`
- `.ref-bars`, `.ref-bar`, `.ref-bar-label`, `.ref-bar-track`, `.ref-bar-fill`, `.ref-bar-count`
- `@keyframes pulse`

---

## Migration Notes

### Backward compatibility

The existing `ProgressInfo` type is used by:
- `fetchPatientData`'s `onProgress` callback
- `connectionState[id].refreshProgress` in the store
- `RecordsPage.tsx` (reads `prog.phase`, `prog.completed`, `prog.total`, `prog.detail`)
- `OAuthCallbackPage.tsx` (reads `statusMessage` which is derived from `ProgressInfo`)

Option A (clean break): Replace `ProgressInfo` with `FetchProgress` everywhere. Update all consumers.

Option B (incremental): Add `FetchProgress` as a second, richer progress type. Keep `ProgressInfo` for the existing `statusMessage` fallback. The widget reads `FetchProgress`; old code reads `ProgressInfo`.

Recommend Option A — the existing progress rendering is a single line of text at each call site. Replacing it is straightforward.

### Performance

The `FetchProgress` object is emitted on every page fetch (not just every query). With 44 queries averaging ~3 pages each, that's ~130 emissions. Each triggers a Zustand `set()` and React re-render of the widget. This is fine — the widget is small and the emissions are spaced seconds apart.

Use `React.memo` on the widget and individual dot components if needed, but it's unlikely to matter.

### The friendly label mapping

`QUERY_FRIENDLY_LABELS` must stay in sync with `PATIENT_SEARCH_QUERIES`. If queries are added/removed/reordered, both arrays must be updated together. Consider merging them:

```typescript
const PATIENT_SEARCH_QUERIES = [
  { resourceType: 'Observation', params: { category: 'laboratory' }, label: 'Labs', group: 1 },
  // ...
];
```

This eliminates the parallel array sync issue.

---

## Files to create/modify

| File | Action |
|------|--------|
| `src/client/lib/smart/client.ts` | Add `FetchProgress`, `QuerySlot`, `QueryState` types. Add `QUERY_FRIENDLY_LABELS`. Update `fetchPatientData` to emit `FetchProgress`. |
| `src/client/store/records.ts` | Add `fetchProgress: FetchProgress \| null` to store. Set it during fetch, clear on completion. |
| `src/client/components/FetchProgressWidget.tsx` | **New file.** The React component. |
| `src/client/index.css` | Add widget styles (dot strip, counter, bars, pulse animation). |
| `src/client/pages/OAuthCallbackPage.tsx` | Replace `statusMessage` text with `<FetchProgressWidget>`. |
| `src/client/pages/RecordsPage.tsx` | Replace inline progress text with `<FetchProgressWidget>` during refresh. |
