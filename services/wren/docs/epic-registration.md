# Registering Wren with Epic on FHIR

> A step-by-step guide to obtaining your own **patient-facing, read-only** Epic
> Client ID so a self-hosted Wren instance can pull records from real Epic
> organizations.

---

## At a glance

| | |
|---|---|
| **What you register** | A patient-facing, read-only, USCDI SMART on FHIR R4 app |
| **Where** | [fhir.epic.com](https://fhir.epic.com) (Epic on FHIR developer portal) |
| **Cost** | Free. No commercial agreement, no per-hospital fees |
| **What you get** | A Non-Production Client ID and a Production Client ID |
| **Who approves you** | Nobody approves per app. Epic auto-distributes to eligible orgs |
| **Realistic time** | About 1 day to register and sandbox-test; a few days to roughly 2 weeks to be live at real orgs |

> **Read this first.** This guide covers only the **read-only patient-access
> lane**. It is the easy, free path because U.S. regulation (the 21st Century
> Cures Act) requires Epic's customers to support patient-directed access via
> third-party apps. Anything beyond it (write access, clinician-facing launch,
> non-standard APIs) is a different, slower, paid path and is out of scope here.

---

## Contents

1. [Key concepts (read once)](#key-concepts-read-once)
2. [Prerequisites](#prerequisites)
3. [The steps](#the-steps)
   - [Step 1. Create the app](#step-1-create-the-app)
   - [Step 2. Set the app type and APIs](#step-2-set-the-app-type-and-apis)
   - [Step 3. Choose your scopes](#step-3-choose-your-scopes)
   - [Step 4. Add redirect URIs](#step-4-add-redirect-uris)
   - [Step 5. Register your signing keys (JWKS)](#step-5-register-your-signing-keys-jwks)
   - [Step 6. Test on the sandbox](#step-6-test-on-the-sandbox)
   - [Step 7. Promote to production](#step-7-promote-to-production)
   - [Step 8. Activate at your hospitals](#step-8-activate-at-your-hospitals)
   - [Step 9. Wire the Client ID into Wren](#step-9-wire-the-client-id-into-wren)
4. [Field rules that prevent `invalid_client`](#field-rules-that-prevent-invalid_client)
5. [Troubleshooting](#troubleshooting)
6. [Timeline expectations](#timeline-expectations)
7. [Printable checklist](#printable-checklist)

---

## Key concepts (read once)

A few things that are not obvious and save hours of confusion later.

**"App ID" vs "Client ID."**
The credential you actually need is the **Client ID** (a GUID). When you create
an app, Epic issues **two** of them: one for Non-Production (the sandbox) and
one for Production (real organizations). The numeric "App ID" you may see in the
portal is just Epic's internal management identifier and is assigned for you.

**Hospitals do not approve your app one by one.**
For a qualifying read-only USCDI app, Epic's **Automatic Client ID
Distribution** pushes your Production Client ID to every eligible organization.
No hospital IT person reviews or clicks anything. This is the single biggest
misconception about Epic integration.

**There are two distribution lanes, and your scopes decide which one.**

| Lane | Triggered by | Per-organization work |
|---|---|---|
| **Lane 1** | No refresh tokens (no `offline_access`) | None. Fully automatic |
| **Lane 2** | Refresh tokens (`offline_access` requested) | You confirm your key per org in the portal. Still not the hospital; you |

> **Why this matters.** If you do not need silent/background refreshing, omit
> `offline_access` and you stay in Lane 1, which is completely hands-off. If you
> want persistent connections, you accept a small, one-time, per-org click that
> you perform yourself.

---

## Prerequisites

Before you open the portal, have these ready.

- [ ] A free **Epic on FHIR account**. Sign up at [fhir.epic.com](https://fhir.epic.com).
- [ ] Wren's **public signing keys** generated. From the `services/wren` directory:
  ```bash
  bun run generate-jwks
  ```
  This writes `data/jwks.json` (public keys), which Wren serves at
  `{baseURL}/.well-known/jwks.json`. You will register this in Step 5.
- [ ] Your **redirect URIs** decided (see Step 4): one for local development and
  one for your deployed Wren domain.

---

## The steps

### Step 1. Create the app

1. Sign in at [fhir.epic.com](https://fhir.epic.com).
2. Go to **Build Apps** (also shown as **My Apps**), then **Create**.
3. Give it a **name** (for example, `Wren`).
4. Save.

**Result:** Epic assigns a **Non-Production Client ID** and a **Production
Client ID**. Copy both somewhere safe now.

```text
Non-Production Client ID:  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Production Client ID:      xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

### Step 2. Set the app type and APIs

| Setting | Value |
|---|---|
| **Application audience / type** | **Patients** (patient-facing) |
| **SMART on FHIR version** | **R4** |
| **Incoming APIs** | The USCDI v1/v3 (US Core) **read** resources you need |

Select the read APIs that match what Wren pulls, for example:

- Patient, Observation, Condition, AllergyIntolerance
- MedicationRequest, Immunization, Procedure, Encounter
- DocumentReference, DiagnosticReport, CarePlan, Goal

> **Field rule: read-only, USCDI-only.** Do not select any write APIs and do
> not add non-USCDI APIs. Staying read-only and USCDI-only is exactly what keeps
> you in the free auto-distribution lane.

---

### Step 3. Choose your scopes

Use patient-level read scopes:

```text
openid fhirUser launch/patient patient/*.read
```

- `patient/*.read` grants read access across the patient's resources.
  (Wren's config expresses the same intent as `patient/*.rs`, meaning
  read + search.)
- Add **`offline_access`** only if you want refresh tokens / persistent
  connections. Remember this moves you to **Lane 2** (Step 8).

> **Tip.** Start without `offline_access` for the simplest possible path. Add it
> later if you decide you want background refresh.

---

### Step 4. Add redirect URIs

Add **every** origin Wren will run at. These must match **exactly**, including
scheme, host, port, and path.

```text
Local development:  http://localhost:3009/connect/callback
Production:         https://<your-wren-domain>/connect/callback
```

> **Heads-up.** A redirect URI mismatch is one of the most common causes of a
> failed token exchange. If you change Wren's port or domain, come back and
> update this list.

---

### Step 5. Register your signing keys (JWKS)

Wren is a confidential client, which is what lets it receive refresh tokens.
Epic must be able to validate the JWT that Wren signs.

1. Wren serves its public keys at `{baseURL}/.well-known/jwks.json`.
2. In the app's authentication settings, register your public keys.

> **Field rule: upload keys directly, and use RSA only.**
> When you later activate per organization (Step 8), prefer **direct JWKS
> upload** over the "JWK Set URL (Recommended)" option. Roughly one in five
> organizations blocks the outbound network request needed to fetch a JWK Set
> URL, and the failure is silent (`invalid_client` with no detail). Also,
> **strip any EC / ES384 keys** and upload **RSA keys only**: Epic accepts EC
> keys at registration but rejects them at the per-organization level.

---

### Step 6. Test on the sandbox

Validate the whole flow against fake data before going near production.

1. Put your **Non-Production Client ID** into Wren's `epic-sandbox` brand.
2. Start Wren and open the connect flow.
3. Log in with Epic's sandbox test patient:
   ```text
   Username: fhircamila
   Password: epicepic1
   ```
4. Confirm the full round trip: connect, log in, consent, fetch, decrypt.

> **Why this matters.** The sandbox is permissive and isolated. If the flow
> works here, your app configuration (scopes, redirect, keys) is sound, and any
> later production failure points to org-level propagation rather than your app.

---

### Step 7. Promote to production

1. In the app, mark it **production-ready** (also shown as **ready for
   production**).
2. Because it is a read-only USCDI patient app, this triggers **Automatic Client
   ID Distribution**: your Production Client ID propagates to eligible Epic
   organizations.

> **Heads-up.** Allow up to about **12 hours** for any configuration change to
> reach customer sites. Network-wide availability can be as quick as ~48 hours,
> but treat propagation as overnight, not instant.

---

### Step 8. Activate at your hospitals

**Skip this entire step if you did not request `offline_access` (Lane 1).**

If you requested refresh tokens (Lane 2), your client is automatically queued at
each organization, but the sync only completes once you confirm your credential
per org:

1. Open your app's **Review & Manage Downloads** page in the portal.
2. For each of your hospitals, activate it and **paste your RSA JWKS directly**
   (not the JWK Set URL), for both Non-Production and Production.

> **Why this matters.** This is **you** clicking in your own developer portal,
> not a hospital approving you. For your handful of hospitals it is a few clicks
> each. (The "thousands of clicks" horror stories come from vendors activating
> hundreds of organizations at once, which is not your situation.)

---

### Step 9. Wire the Client ID into Wren

Put your **Production Client ID** into Wren's config and restart.

```jsonc
// config.local.json  ->  brands[]  ->  epic-prod
{
  "name": "epic-prod",
  "file": "./brands/epic-prod.json",
  "tags": ["epic", "prod"],
  "clientId": "YOUR_PRODUCTION_CLIENT_ID",
  "scopes": "patient/*.rs",
  "redirectURL": "https://<your-wren-domain>/connect/callback"
}
```

Restart Wren so it reloads the config:

```bash
CONFIG_PATH=./config.local.json bun run start
```

> **Note.** `config.local.json` is gitignored, so your real Client ID is never
> committed. Keep it that way.

---

## Field rules that prevent `invalid_client`

These are the lessons that turn a multi-day debugging spiral into a smooth
setup. Internalize all four.

1. **Direct JWKS upload, never JWK Set URL.** About 20% of orgs block the
   outbound fetch and fail silently.
2. **RSA keys only.** Strip EC / ES384 before uploading. They pass registration
   but fail per-org validation.
3. **Redirect URIs match exactly.** Scheme, host, port, and path.
4. **Expect propagation lag.** Up to ~12 hours per change. Do not assume a fix
   failed until the next day.

---

## Troubleshooting

| Symptom | Most likely cause | What to do |
|---|---|---|
| `invalid_client` with `null` detail at token exchange | JWKS not validating: JWK Set URL blocked, EC key, or keys not propagated | Switch to direct RSA JWKS upload; wait for propagation |
| Epic error **before** login, or "app not found" | Redirect URI not registered for this Client ID | Add the exact redirect URI in Step 4 |
| Login works, then a generic error after consent | Token exchange / client auth failure | Re-check JWKS and that the right (prod vs non-prod) Client ID is in use |
| One organization just will not activate | Server-side issue at a newer org | Not your bug; retry later, it often resolves |

> **Mental model.** `invalid_client` is Epic saying "I do not accept this
> client's identity." It is almost always about the **keys** or the **redirect
> URI**, not your application code.

---

## Timeline expectations

| Phase | Realistic duration |
|---|---|
| Account + app registration + sandbox test | About 1 day |
| Production promotion (auto-distribution) | About 2 to 5 business days; sometimes ~48 hours |
| Per-org quirks (only if an org blocks JWKS fetch) | Days, occasionally up to ~2 weeks |

The work itself is short. Most of the calendar time is waiting on Epic's
propagation, which you cannot speed up by working harder.

---

## Printable checklist

```text
[ ] Epic on FHIR account created
[ ] App created; Non-Prod + Prod Client IDs saved
[ ] App type = Patients; FHIR version = R4
[ ] Read-only, USCDI-only APIs selected
[ ] Scopes set (offline_access only if persistent refresh is needed)
[ ] Redirect URIs added (dev + prod), exact match
[ ] Public JWKS registered; RSA keys only; direct upload
[ ] Sandbox tested with fhircamila / epicepic1
[ ] App marked production-ready
[ ] Per-org activation done (Lane 2 only)
[ ] Production Client ID wired into Wren config; restarted
```

---

*Wren is a derivative of [health-skillz](https://github.com/jmandel/health-skillz)
by Josh Mandel (MIT). The hard-won Epic registration lessons in this guide
originate from his public field notes. Wren and the registration process are not
affiliated with or endorsed by Epic Systems Corporation.*
