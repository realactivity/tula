# Health Skillz - Design Document

Last updated: 2026-02-13 (local repository state)

## Overview

Health Skillz is a Bun + React application that helps a user collect SMART on FHIR records from one or more providers, keep a local cached copy in the browser, optionally redact sensitive terms, and either:

1. share encrypted records with an AI session, or
2. export records locally (JSON or local skill zip).

The core architectural property is end-to-end encryption for AI-session uploads: health payloads are encrypted in-browser and uploaded in chunked ciphertext form. The server stores and serves ciphertext chunks and cannot decrypt them.

## Goals

### Primary goals

1. Standards-based SMART on FHIR data retrieval.
2. Multi-provider aggregation in a single user workflow.
3. Browser-side privacy controls (non-destructive redaction profiles).
4. End-to-end encrypted sharing to AI sessions.
5. Local-first usability: cached records, JSON export, and local skill packaging.

### Non-goals

1. Server-side clinical data processing.
2. Long-term server retention of plaintext health records.
3. User-account identity system (session/token model is used instead).

## Runtime Architecture

### High-level components

1. Bun HTTP server (`src/server.ts`)
2. React SPA (`src/client/*`)
3. SQLite session store (`data/health-skillz.db`)
4. SMART/FHIR provider endpoints (external)
5. AI skill scripts (`skill/health-record-assistant/scripts/*`)

### Two operating modes

1. Standalone records mode
   - Routes under `/records/*`
   - User can connect providers, refresh, redact, browse, and export
2. AI session mode
   - Route `/connect/:sessionId`
   - Same records UX plus encrypted upload/finalize flow to AI session

## Frontend Routes

Defined in `src/client/App.tsx` and mirrored in Bun server static route map for direct loads.

1. `/` - Home
2. `/records` - Records hub
3. `/records/add` - Provider selection
4. `/records/callback` - OAuth callback
5. `/records/redaction` - Redaction Studio
6. `/records/browser` - Data Browser
7. `/connect/:sessionId` - Session-scoped records hub
8. `/connect/callback` - Shared OAuth callback

Unknown frontend paths are redirected client-side to `/`.

## Session and Upload Lifecycle

### Session creation

1. AI generates ECDH P-256 keypair.
2. AI calls `POST /api/session` with `publicKey` (JWK).
3. Server creates `sessionId` and stores public key in SQLite.
4. AI gives user `userUrl` (`/connect/:sessionId`).

### Browser claim and upload attempt

1. Browser opens `/connect/:sessionId` and calls `GET /api/session/:sessionId`.
2. Browser creates/loads a per-session `finalizeToken` in `sessionStorage`.
3. On send, browser derives deterministic per-provider keys (`SHA-256(sessionId:connectionId)`, first 8 bytes hex).
4. Browser starts an upload attempt via `POST /api/upload/start/:sessionId` with:
   - `finalizeToken`
   - `selectedProviderKeys[]`
5. Server issues `attemptMeta.attemptId` and locks provider set for that attempt.

### Chunk upload

1. Browser serializes provider payload JSON.
2. Browser gzip-compresses and chunks compressed bytes (`CHUNK_SIZE = 5MB` in client crypto module).
3. For each chunk:
   - generate ephemeral ECDH keypair
   - derive AES-256-GCM key
   - encrypt chunk
   - upload via `POST /api/receive-ehr` with `attemptId`, `providerKey`, `chunk`, and `totalChunks` (`-1` until final known count)
4. Server validates fields, chunk bounds, and chunk size envelope; stores chunk metadata + ciphertext base64.

### Finalization

1. Browser calls `POST /api/finalize/:sessionId` with `finalizeToken` + `attemptId`.
2. Server verifies:
   - token match
   - active attempt match
   - all locked providers complete
3. Server marks session `finalized`.
4. AI polls `GET /api/poll/:sessionId`, then downloads binary chunk ciphertext via `/api/chunks/...` and decrypts locally.

## Data Acquisition Pipeline (Client)

Implemented in `src/client/lib/smart/client.ts`.

### Phase 1: Patient-scoped resource queries

The client runs a fixed set of patient-scoped queries (44 progress slots), including:

1. Patient
2. Observation categories (labs, vitals, social history, etc.)
3. Condition categories
4. DiagnosticReport categories
5. DocumentReference
6. CarePlan / ServiceRequest variants
7. Core resources (AllergyIntolerance, Encounter, MedicationRequest, etc.)

Requests are paginated and concurrency-limited (`MAX_CONCURRENT_REQUESTS = 5`).

### Phase 2: Reference chasing

The client discovers and fetches referenced resources for a bounded set of types:

1. Practitioner
2. PractitionerRole
3. Organization
4. Location
5. Medication
6. Specimen
7. Questionnaire
8. Provenance

### Phase 3: Attachment extraction

Attachment sources are `DocumentReference.content[].attachment` and `DiagnosticReport.presentedForm[]`.

Extraction behavior (`src/client/lib/smart/attachments.ts`):

1. Preserve each original rendition as `originals[contentIndex]`.
2. Extract text depending on MIME type:
   - HTML/XHTML -> text
   - XML -> C-CDA narrative-aware extraction, else generic XML text extraction
   - RTF -> `rtf.js` rendering path
   - text/* and JSON -> raw text
3. Choose `bestEffortFrom` by MIME preference and textual usefulness.
4. Strip inline `attachment.data` / `presentedForm.data` from FHIR resources after extraction to avoid duplication.

## Local Data Storage Model

### Browser storage

1. `sessionStorage`
   - OAuth state by nonce
   - session finalize token
   - session selection state
   - upload attempt id
2. IndexedDB (`health_skillz_connections`)
   - connection metadata store
   - cached FHIR data store

### Connection metadata

```typescript
interface SavedConnection {
  id: string;
  providerName: string;
  fhirBaseUrl: string;
  tokenEndpoint: string;
  clientId: string;
  patientId: string;
  refreshToken: string;
  canRefresh?: boolean;
  scopes: string;
  createdAt: string;
  lastRefreshedAt: string;
  lastFetchedAt: string | null;
  dataSizeBytes: number | null;
  status: 'active' | 'expired' | 'error';
  lastError?: string;
  patientDisplayName?: string | null;
  patientBirthDate?: string | null;
  cachedResourceTypeCounts?: Record<string, number> | null;
  cachedAttachmentCount?: number | null;
}
```

### Cached health data

```typescript
interface CachedFhirData {
  connectionId: string;
  fhir: Record<string, any[]>;
  attachments: ProcessedAttachment[];
  fetchedAt: string;
}
```

### Canonical attachment structure

```typescript
interface ProcessedAttachment {
  source: {
    resourceType: string;
    resourceId: string;
  };
  bestEffortFrom: number | null;
  bestEffortPlaintext: string | null;
  originals: ProcessedAttachmentOriginal[]; // index aligned to source content index
}

interface ProcessedAttachmentOriginal {
  contentIndex: number;
  contentType: string;
  contentPlaintext: string | null;
  contentBase64: string | null;
  sourceFormatCode?: string | null;
  sourceFormatDisplay?: string | null;
  sourceFormatSystem?: string | null;
  sourceProfiles?: string[] | null;
  sourceTypeCode?: string | null;
  sourceTypeDisplay?: string | null;
  sourceTypeSystem?: string | null;
  sourceTypeText?: string | null;
}
```

## Redaction System

Implemented in `src/client/lib/redaction.ts` and UI in `src/client/pages/RedactionStudioPage.tsx`.

### Profile model

1. Multiple named profiles stored in `localStorage`.
2. Active profile (editing target) and applied profile (runtime use) are distinct.
3. Applied profile is ignored when it has zero terms.
4. Optional `stripAttachmentBase64` behavior per profile.

### Suggestion pipeline

Two-pass approach:

1. Seed extraction from structured records (currently constrained to `Patient` + `RelatedPerson` plus selected reference/resource hints) and attachment plaintext
2. Fuzzy scan of cached FHIR + attachment text to collect variants and occurrence counts
3. Grouping into categories (`Name`, `Address`, `Identifier`, `Phone`, `Email`, `SSN`, `Dates`, `Other`)

### Redaction behavior

When a profile is applied, redaction is used for:

1. Send to AI
2. Download JSON
3. Download local skill zip payload

Matching behavior includes:

1. Canonicalized term matching (dates, phone, email, SSN, tokenized text)
2. Flexible regexes robust to punctuation/spacing variation
3. Attachment-specific fuzzy patterns for compacted plaintext
4. Built-in detectors always active while profile is applied:
   - SSN pattern
   - phone pattern
   - email pattern
   - labeled identifier pattern

Structured-object escalation:

1. HumanName-like objects: if one sensitive element matches, redact full name fields.
2. Address-like objects: if core address fields match, redact all strings in the address object.
3. Identifier-like objects: if core identifier fields match, redact all strings in the identifier object.

## Data Browser

Implemented in `src/client/pages/DataBrowserPage.tsx`.

### UX model

1. Source selector (all connected cached records)
2. Content type selector (union of resource types across selected sources)
3. Per-resource rendering with in-place `Formatted`/`JSON` toggle
4. Attachment rendering inline with the source resource (for resources that contain attachments)

### Rendering strategy

1. Summary-first fields for common resource keys.
2. Remaining content rendered as dense tree lines (reduced box nesting).
3. Opaque IDs/references are shortened for readability.
4. Progressive row rendering to avoid blocking on large datasets.

### Attachment rendering modes

By selected best-effort original:

1. HTML -> sandboxed iframe (`srcDoc`, sanitized)
2. RTF -> rendered HTML via `rtf.js`
3. XML -> formatted text block (with flavor labeling)
4. Other plaintext -> preformatted text
5. Optional JSON toggle to inspect full attachment object

## Security Model

### Encryption and keying

1. Key exchange: ECDH P-256
2. Data encryption: AES-256-GCM per chunk
3. Per-chunk ephemeral keys
4. Server stores only encrypted chunks for AI-session payloads

### OAuth client auth model

SMART token exchange uses `private_key_jwt` assertions (`src/client/lib/smart/client-assertion.ts`).

This project intentionally publishes the signing private JWKS under:

- `/.well-known/jwks-intentionally-publishing-private-keys-which-are-not-sensitive-in-this-architecture.json`

Rationale in code: confidentiality relies on PKCE + per-user tokens + end-to-end payload encryption, and this setup is used to satisfy vendor confidential-client requirements for refresh token issuance.

### Transport and browser hardening

Server applies:

1. CSP
2. `X-Content-Type-Options: nosniff`
3. `X-Frame-Options: DENY`
4. `Referrer-Policy: strict-origin-when-cross-origin`
5. `Permissions-Policy` restrictions

CORS policy is pinned to `new URL(baseURL).origin` for API routes.

### Upload abuse controls

1. Chunk index and total bounds validation
2. per-request ciphertext base64 length cap based on `UPLOAD_CHUNK_SIZE_BYTES`
3. bounded server request body size (`MAX_REQUEST_BODY_SIZE` derived from chunk envelope)
4. attempt locking + token checks prevent cross-attempt mixups

## API Reference

All JSON endpoints include CORS/security headers.

### `POST /api/session`

Create session. Requires `publicKey` JWK.

Request:

```json
{
  "publicKey": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
  "simulateError": "500"
}
```

`simulateError` is optional test behavior (`500|timeout|badresp|disconnect`).

Response:

```json
{
  "sessionId": "...",
  "userUrl": "https://.../connect/<sessionId>",
  "pollUrl": "https://.../api/poll/<sessionId>"
}
```

### `GET /api/session/:sessionId`

Returns session metadata used by browser.

Response:

```json
{
  "sessionId": "...",
  "publicKey": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
  "status": "pending",
  "providerCount": 0,
  "pendingChunks": {
    "abcd1234ef567890": { "receivedChunks": [0, 1], "totalChunks": 10 }
  },
  "attemptMeta": {
    "attemptId": "uuid",
    "selectedProviderKeys": ["abcd1234ef567890"],
    "status": "active",
    "createdAt": "2026-02-13T...Z"
  },
  "hasFinalizeToken": true
}
```

### `GET /api/poll/:sessionId?timeout=<seconds>`

Long-poll for readiness.

Pending response:

```json
{
  "ready": false,
  "status": "collecting",
  "providerCount": 1
}
```

Ready response (metadata only; no ciphertext bytes):

```json
{
  "ready": true,
  "providerCount": 1,
  "providers": [
    {
      "providerIndex": 0,
      "version": 3,
      "totalChunks": 10,
      "chunks": [
        {
          "index": 0,
          "ephemeralPublicKey": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
          "iv": "base64..."
        }
      ]
    }
  ]
}
```

### `GET /api/chunks/:sessionId/meta`

Returns provider chunk metadata for finalized sessions.

### `GET /api/chunks/:sessionId/:providerIndex/:chunkIndex`

Returns raw binary ciphertext bytes for one chunk.

### `POST /api/upload/start/:sessionId`

Start/reset active upload attempt and lock selected provider set.

Request:

```json
{
  "finalizeToken": "uuid-or-random-token",
  "selectedProviderKeys": ["abcd1234ef567890", "0123abcd4567ef89"]
}
```

Response:

```json
{
  "success": true,
  "attemptMeta": {
    "attemptId": "uuid",
    "selectedProviderKeys": ["abcd1234ef567890", "0123abcd4567ef89"],
    "status": "active",
    "createdAt": "2026-02-13T...Z"
  },
  "pendingChunks": {}
}
```

### `POST /api/upload/reset/:sessionId`

Discard partial chunks and clear active attempt lock.

Request:

```json
{ "finalizeToken": "uuid-or-random-token" }
```

### `POST /api/receive-ehr`

Upload one encrypted chunk.

Request:

```json
{
  "sessionId": "...",
  "finalizeToken": "...",
  "attemptId": "...",
  "version": 3,
  "providerKey": "abcd1234ef567890",
  "totalChunks": -1,
  "chunk": {
    "index": 0,
    "ephemeralPublicKey": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
    "iv": "base64...",
    "ciphertext": "base64..."
  }
}
```

Notes:

1. `attemptId` is required.
2. `totalChunks = -1` means unknown until final chunk.
3. `ciphertext` length is capped by server chunk-size envelope.

Response:

```json
{
  "success": true,
  "attemptId": "...",
  "providerCount": 1,
  "redirectTo": "https://.../connect/<sessionId>?provider_added=true"
}
```

### `POST /api/finalize/:sessionId`

Finalize active attempt.

Request:

```json
{
  "finalizeToken": "...",
  "attemptId": "..."
}
```

Response:

```json
{ "success": true, "providerCount": 2 }
```

### `GET /api/vendors`

Returns configured vendor map (including optional gated test providers).

### `GET /api/skill-template`

Returns local-skill template content (markdown + references) for browser-side zip assembly.

### `GET /skill.zip`

Returns agent-oriented skill package (scripts + references + SKILL.md).

### `GET /health-record-assistant.md`

Returns generated markdown instructions for the agent skill variant.

### `POST /api/log-error`

Stores sanitized client diagnostics (non-sensitive fields only).

### Health/static/util endpoints

1. `GET /health`
2. `GET /static/brands/*` (only this static subtree is served)
3. `GET /.well-known/jwks*.json`

### Gated testing/debug endpoints

1. `GET /test/<size>mb/*` (enabled by `ENABLE_TEST_PROVIDER`)
2. `GET /random/<size>.MB.bin` (enabled by `ENABLE_RANDOM_BIN_ENDPOINT`)

## Configuration and Environment

### Config file

Server reads `CONFIG_PATH` (default `./config.json`).

Important config fields:

1. `server.port`
2. `server.baseURL`
3. `brands[].clientId`
4. `brands[].redirectURL` (default: `${baseURL}/connect/callback`)

### Environment variables

1. `CONFIG_PATH` - config file path
2. `PORT` - overrides config port
3. `BASE_URL` - overrides config baseURL
4. `NODE_ENV` - affects prod/dev behavior and CSP script allowances
5. `ENABLE_TEST_PROVIDER` - enable test provider routes
6. `ENABLE_RANDOM_BIN_ENDPOINT` - enable random binary endpoint
7. `UPLOAD_CHUNK_SIZE_BYTES` - server chunk-size envelope for upload validation

## Current File Structure

```text
health-skillz/
├── src/
│   ├── server.ts
│   ├── index.html
│   └── client/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── pages/
│       │   ├── HomePage.tsx
│       │   ├── ConnectPage.tsx
│       │   ├── ProviderSelectPage.tsx
│       │   ├── OAuthCallbackPage.tsx
│       │   ├── RecordsPage.tsx
│       │   ├── RedactionStudioPage.tsx
│       │   └── DataBrowserPage.tsx
│       ├── components/
│       │   ├── RecordsHeaderBar.tsx
│       │   ├── ProviderSearch.tsx
│       │   ├── ProviderCard.tsx
│       │   ├── ProviderList.tsx
│       │   ├── StatusMessage.tsx
│       │   ├── FetchProgressWidget.tsx
│       │   └── UploadProgressWidget.tsx
│       ├── lib/
│       │   ├── api.ts
│       │   ├── storage.ts
│       │   ├── crypto.ts
│       │   ├── connections.ts
│       │   ├── redaction.ts
│       │   ├── skill-builder.ts
│       │   └── smart/
│       │       ├── launch.ts
│       │       ├── oauth.ts
│       │       ├── client-assertion.ts
│       │       ├── client.ts
│       │       └── attachments.ts
│       └── store/
│           ├── records.ts
│           └── brands.ts
├── skill/
│   ├── build-skill.ts
│   ├── partials/
│   │   └── fhir-guide.md
│   └── health-record-assistant/
│       ├── scripts/
│       │   ├── create-session.ts
│       │   └── finalize-session.ts
│       └── references/
├── scripts/
│   ├── download-brands.ts
│   ├── package-skill.ts
│   └── generate-jwks.ts
├── static/
│   └── brands/
├── data/
│   └── health-skillz.db
└── docs/
    └── design/
        └── DESIGN.md
```

## Notes and Tradeoffs

1. Browser stores plaintext cached records in IndexedDB for local usability features.
2. AI-session data transfer is encrypted, but local cached data is not at-rest encrypted.
3. Upload chunk size is currently fixed at 5MB in client crypto logic; server validation envelope is configurable.
4. Data Browser prioritizes readability and progressive rendering over exact JSON visual parity in formatted mode (JSON mode remains available per resource/attachment).
