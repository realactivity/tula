# UX Redesign: Unified Connections Model

## Core Insight

Connections are the user's persistent asset. Sessions are transient envelopes.
Everything is "collect first, share later."

## Current Problems

1. **Two separate flows** with duplicated code:
   - `/collect` → `/collect/select` → `/collect/callback` (self-service, local-only)
   - `/connect/:sid` → `/connect/:sid/select` → `/connect/:sid/callback` (AI-driven, encrypt+upload)
   
   These do the same thing (OAuth → FHIR fetch → store data) with different wrappers.

2. **Provider card shows "Epic FHIR Sandbox"** — useless when you have two records
   from the same system. Need patient name + DOB.

3. **Encrypt+upload happens during connection** — tightly coupled.
   Should only happen when user explicitly "sends to AI."

4. **Landing page presents two "options"** that are really the same flow
   with different starting points.

## New Mental Model

```
┌─────────────────────────────────────────────────┐
│  CONNECTIONS (persistent, browser-side)          │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Camila Lopez (DOB: 1987-09-12)          │    │
│  │ Epic FHIR Sandbox · 2.3 MB · 5m ago     │    │
│  │ [🔄 Refresh]  [🗑️ Remove]              │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │ John Smith (DOB: 1955-03-21)            │    │
│  │ Kaiser Permanente · 1.1 MB · 2d ago     │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [➕ Add New Connection]                         │
│                                                 │
│  [📥 Download JSON] [🤖 Download as AI Skill]  │
└─────────────────────────────────────────────────┘
```

When an AI session link arrives (`/connect/:sid`), you see the SAME screen
but with checkboxes and a "Send to AI" button:

```
┌─────────────────────────────────────────────────┐
│  Share Health Records with AI                   │
│                                                 │
│  ☑ Camila Lopez · Epic FHIR Sandbox · 2.3 MB   │
│    Data from 5m ago  [🔄 Refresh]              │
│                                                 │
│  ☐ John Smith · Kaiser Permanente · 1.1 MB      │
│    Data from 2d ago  [🔄 Refresh]              │
│                                                 │
│  [➕ Add New Provider]                           │
│                                                 │
│  [✅ Send 1 connection to AI]                   │
└─────────────────────────────────────────────────┘
```

## Route Structure (simplified)

### Before
```
/                     HomePage (landing)
/collect              CollectPage (local collection hub)
/collect/select       CollectProviderSelectPage
/collect/callback     OAuthCallbackPage (via wildcard)
/connect/:sid         ConnectPage (AI-session hub)
/connect/:sid/select  ProviderSelectPage
/connect/:sid/callback OAuthCallbackPage
/connections          ConnectionsPage (new, management)
```

### After
```
/                     HomePage (landing — simplified)
/records              RecordsPage (THE hub — shows connections, actions)
/records/add          ProviderSelectPage (one version, always)
/records/callback     OAuthCallbackPage (always saves to connections DB)
/connect/:sid         SessionPage (thin wrapper: loads session context, shows RecordsPage in "session mode")
```

Key insight: `/records` and `/connect/:sid` render the SAME component
with different context (session vs. standalone).

## RecordsPage: The Unified Hub

Two modes, determined by whether a `sessionId` is in context:

### Standalone mode (`/records`)
- Show all connections with patient info
- Actions: Add new, Refresh, Remove, Download JSON, Download AI Skill
- No encrypt/upload, no session awareness
- This replaces both `/collect` and `/connections`

### Session mode (`/connect/:sid` → renders RecordsPage with session context)
- Show all connections with CHECKBOXES
- Actions: Add new, Refresh, Send to AI
- "Send to AI" = encrypt selected connections' cached data → upload → finalize
- Adding a new provider navigates to `/records/add?session=:sid`
  (after OAuth callback, redirects back to `/connect/:sid`)

## Patient Identity on Connection Cards

After FHIR fetch, extract from the Patient resource:

```typescript
// In fetchPatientData result or post-processing
const patient = ehrData.fhir.find(r => r.resourceType === 'Patient');
const patientName = patient?.name?.[0];
const display = [
  patientName?.given?.join(' '),
  patientName?.family
].filter(Boolean).join(' ');
const dob = patient?.birthDate; // "1987-09-12"
```

Store in `SavedConnection`:
```typescript
interface SavedConnection {
  // ... existing fields
  patientDisplayName: string | null;  // "Camila Lopez"
  patientBirthDate: string | null;    // "1987-09-12"
}
```

Card display:
```
 Camila Lopez (DOB: 1987-09-12)
 Epic FHIR Sandbox · 2.3 MB · 5 min ago
```

## When Encrypt+Upload Happens

### Before
- During OAuthCallbackPage: fetch → encrypt → upload → finalize
- Tightly coupled to session

### After
- OAuthCallbackPage: fetch → save to connections DB → redirect back
- Encrypt+upload ONLY when user clicks "Send to AI" on the session page
- This means the callback page is simple: exchange code, fetch FHIR, save connection, done.

## Landing Page Redesign

Drop the two-option framing. Single narrative:

```
🏥 Health Record Skill
Connect your AI to your health records via SMART on FHIR

[📦 Manage My Records]       ← goes to /records
[📥 Download AI Skill]       ← goes to /skill.zip

How it works:
1. Collect your records from patient portals
2. Ask your AI to analyze them (or download as a skill package)
```

The "Download Skill" is for the pre-bundled skill.zip.
"Manage My Records" is the hub where everything happens.

## Implementation Plan

### Phase 1: Data model changes
- Add `patientDisplayName`, `patientBirthDate` to `SavedConnection`
- Extract patient identity after FHIR fetch, save to connection
- Update connection card component to show patient info

### Phase 2: Unify the callback
- OAuthCallbackPage always saves to connections DB
- Never encrypts/uploads during callback
- Redirect logic: if came from a session → back to `/connect/:sid`, else → `/records`

### Phase 3: RecordsPage (replaces CollectPage + ConnectionsPage)
- Shows connections from IndexedDB
- Standalone mode: manage, download
- Session mode: checkboxes, send to AI
- Shared ProviderSelectPage (remove CollectProviderSelectPage duplication)

### Phase 4: ConnectPage → thin session wrapper
- Fetches session info (public key, status)
- Renders RecordsPage with session context
- "Send to AI" button triggers encrypt+upload+finalize

### Phase 5: Landing page simplification
- Single clear CTA
- Remove two-option confusion

### Phase 6: Cleanup
- Delete CollectPage, CollectProviderSelectPage
- Delete old ConnectionsPage
- Consolidate routes

## Files to Change

| File | Action |
|---|---|
| `src/client/lib/connections.ts` | Add `patientDisplayName`, `patientBirthDate` fields |
| `src/client/pages/OAuthCallbackPage.tsx` | Decouple from encrypt/upload; always save to connections |
| `src/client/pages/RecordsPage.tsx` | **NEW** — unified hub, replaces CollectPage + ConnectionsPage |
| `src/client/pages/ConnectPage.tsx` | Thin wrapper: load session, render RecordsPage in session mode |
| `src/client/pages/HomePage.tsx` | Simplify landing |
| `src/client/pages/ProviderSelectPage.tsx` | Make session-agnostic (works for both flows) |
| `src/client/App.tsx` | Updated routes |
| `src/server.ts` | Updated routes |
| `src/client/pages/CollectPage.tsx` | **DELETE** |
| `src/client/pages/CollectProviderSelectPage.tsx` | **DELETE** |
| `src/client/pages/ConnectionsPage.tsx` | **DELETE** (merged into RecordsPage) |
