# Tula Check-in Wallet

A **web wallet** for the [SMART Health Check-in 1.0 draft](https://smart-health-checkin.org/spec/spec.html). A Verifier (EHR check-in page or kiosk) opens this page; the patient reviews the origin and each requested item; the wallet returns a signed, encrypted SMART response.

This is a single-user, **synthetic-patient** reference. It is not a hospital product and must never hold real PHI.

Connectathon target: CMS Kill the Clipboard Connectathon #2, Tuesday 3 November 2026, 2:00-5:00 PM ET. Aim to have a public https URL up by Tuesday 27 October 2026.

## What it does

- Opens at an https wallet URL when a Verifier calls `window.open`.
- Shows the Verifier origin from the browser (`MessageEvent.origin`), never from the message body. Copy: "A website is asking for your health information".
- Lets the patient share or decline each item.
- Returns FHIR R4 (`4.0.1`, `application/fhir+json`) with US Core profiles where the minimum scenarios ask for them: Patient, Condition (problems), AllergyIntolerance, MedicationRequest, Immunization.
- **Insurance card:** always `unavailable` (or `declined` if the patient turns it off). Tula policy is health data only. No Coverage resource is stored.
- Renders an inline Questionnaire (PHQ-2) and returns a QuestionnaireResponse whose `questionnaire` equals the requested canonical.
- Keeps the SMART JSON under 512 KB.
- Ships one synthetic chart: **Dylan Meyer** / PCP **Dr. Dave Matthews**.

The `@smart-health-checkin/client` library (Apache-2.0) handles `postMessage`, request parsing, item matching, response checks, mdoc wrapping, and HPKE encryption.

## Minimum scenarios

| Scenario | Request | Expected wallet behavior |
|---|---|---|
| 1. Share records | `records.json` | Health items `fulfilled`. Coverage `unavailable`. Origin shown. |
| 2. Fill in a form | `form-phq2.json` | Inline PHQ-2 rendered. Answers `fulfilled` with exact canonical. |
| 3. Decline one item | `records.json` | Patient declines Immunizations. That item is `declined`. |

Official runs use the [SMART Testing EHR](https://smart-health-checkin.org/connectathon/testing-ehr/). This repo's unit tests cover the SMART JSON layer with `checkWalletResponse`. Live Testing EHR results need a public URL and a human at the EHR.

Also handled: unknown `content.kind` -> `unsupported` (advanced unknown-selector). Forms by URL are fetched when no inline Questionnaire is present; fetch failure is `unsupported`.

Not in this first cut: SMART Health Cards, large-response padding, form-by-reference GAD-7 as a first-class fixture, native Android/iOS wallets.

## Run locally

```bash
cd apps/check-in-wallet
npm install
npm test
npm run dev
```

- Wallet: http://localhost:5173/
- Local verifier (same-origin dry run): http://localhost:5173/demo.html

The landing page appears when you open the wallet yourself. A Verifier must open it with `window.open` so `window.opener` is set.

### Test against the SMART Testing EHR from your machine

1. `npm run build && npm run preview` (https is not required for a first look; the Testing EHR needs a public https URL to open you as a listed wallet).
2. For a public tunnel during development, use any static https host or a tunnel in front of `vite preview`. Do not put real PHI on that host.
3. In the Testing EHR, add the wallet URL as a custom web wallet, pick share-records / fill-form / decline-item, and send.

## Deploy plan (public https URL)

**Do not buy domains or deploy to production from this PR.** A human should pick one of these and flip the participant status from `not-yet` to `up`.

### Proposed URL

`https://realactivity.github.io/tula/check-in-wallet/`

This is a GitHub Pages project site on the existing `realactivity/tula` repo. The build is static files in `dist/`. No server, no PHI store, no secrets.

Alternative if Pages is not acceptable: Azure Static Web Apps or any static host on a RealActivity domain, for example `https://checkin.realactivity.ai/`. That needs DNS and a human owner.

### GitHub Pages steps (human)

1. In the repo settings, enable GitHub Pages. Source: GitHub Actions. This is a one-time admin step.
2. Merge this PR to `main`. The [`check-in-wallet-pages.yml`](../../.github/workflows/check-in-wallet-pages.yml) workflow runs `npm ci && npm test && npm run build`, places `dist/` under `check-in-wallet/`, and publishes to Pages. `base: "./"` in `vite.config.ts` keeps the app working on the `/tula/check-in-wallet/` subpath. The site root `/tula/` redirects to the wallet via [`pages-root.html`](pages-root.html). If the merge lands before Pages is enabled, rerun the workflow from the Actions tab.
3. Confirm https, that `/` shows the landing page, and that `/demo.html` still opens the wallet. The production build sets a Content-Security-Policy meta tag. `frame-ancestors` is ignored in a meta tag, so the host should also send `Content-Security-Policy: frame-ancestors 'none'`.
5. Register the wallet: submit the [connectathon registration form](https://smart-health-checkin.org/connectathon/) using [`participant.example.json`](participant.example.json). Set `status` to `up` only after the URL loads for anyone.
6. Self-test the three minimum scenarios against the SMART Testing EHR and file results.

### Why static hosting is enough

The wallet is a front-end page. The Verifier opens it; `serveWebWallet` talks through `postMessage`; records are bundled JavaScript, not fetched from a clinical system. There is no OAuth, no database, and no server-side key custody.

## Registration

[`participant.example.json`](participant.example.json) follows [schema.json](https://smart-health-checkin.org/connectathon/participants/schema.json).

Human decisions before filing:

- Confirm the public URL.
- Confirm the contact (name + GitHub, Slack, or email). Pull requests from a listed GitHub username merge automatically on the connectathon repo.
- Confirm `status`: leave `not-yet` until the URL is reachable.
- Confirm the component `id` (`tula-web-wallet`) is unique across participants.

## Patient chart

Dylan Meyer, fictional, age 51, born 1975-03-14:

- Problems: essential hypertension, prediabetes, hyperlipidemia
- Allergy: penicillin (rash)
- Medication: Lisinopril 10 mg daily (Dr. Dave Matthews)
- Immunizations: influenza 2025-10-15, COVID-19 2025-09-20, Tdap 2021-05-18
- Insurance: none on file

Aligned with Tula eval persona notes in `evals/memory-diff/fixtures/MEMORY.md`. No Coverage resources.

## Project layout

```
apps/check-in-wallet/
  src/main.ts              Wallet page
  src/wallet.ts            serveWebWallet wiring
  src/ui.ts                Consent, forms, landing
  src/respond.ts           SMART response builder
  src/questionnaire.ts     Inline and by-URL forms
  src/patient.ts           Synthetic FHIR bundle
  src/policy.ts            Insurance / health-data-only
  src/demo.ts              Local verifier
  src/fixtures/            Connectathon request copies
  src/tests/               Vitest + checkWalletResponse
  participant.example.json Registration draft
```

## License

Apache-2.0, same as Tula. Runtime dependency `@smart-health-checkin/client` is Apache-2.0 (SMART Health IT). See the root [`NOTICE`](../../NOTICE).
