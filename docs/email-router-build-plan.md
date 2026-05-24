# Email Router - Build Plan

This doc is the **buildable** counterpart to the architecture in
[`email-router-design.md`](email-router-design.md) and the M365 setup
walkthrough in [`email-router-setup-guide.md`](email-router-setup-guide.md).
It sequences the work into phases, identifies decisions, and lists
unknowns/risks.

The goal is a TripIt-style health inbox: forward any health email, photo,
or PDF to a single dedicated address, and the data shows up in your Tula
workspace automatically.

## Locked-in decisions (May 2026)

Phase 0 decisions were resolved during the kickoff session. The examples
below use the author's own deployment values; older illustrative
`tula@<domain>` references in the design doc and setup guide should be
read as `<your-health-mailbox>@<your-domain>` (the author runs the
mailbox at `aria@realactivity.com` on his own Exchange Online tenant).

| Decision | Value |
|---|---|
| Mailbox address | **`<your-health-mailbox>@<your-domain>`**, any dedicated mailbox in Exchange Online or Microsoft 365. The author runs `aria@realactivity.com` on his own tenant as the canonical example. |
| M365 license source | **Microsoft Partner benefits** |
| Exchange transport rules | **DEFERRED** until end-to-end flow works (see safety note below) |
| FHIR storage path | **`~/.openclaw/workspace/tula/fhir/`** (build plan Option A) |
| Polling cadence | **30 seconds** (systemd timer; cron's 60s floor is too slow) |
| Triage / classify / summarize / FHIR write model | **Claude Sonnet 4.7** |
| Extract + structured clinical detail model | **Claude Opus 4.7** |

### Safety note on the deferred transport rules

The build plan originally called transport rules "the data security gate"
(installed *before* the first client connection). We are deliberately
deferring them to keep Phase 1 frictionless, on the explicit condition
below.

**Hard checkpoint - transport rules MUST be installed before:**

1. The health mailbox is shared with any human other than the owner.
2. The address is registered in any vendor portal (MyChart, LabCorp,
   Quest, insurance EOB delivery, etc.) as a destination.
3. Any inbox auto-forward (from a personal account or otherwise) is
   pointed at the mailbox.

In practice this means transport rules must ship before end of Phase 3
(per-content-type handlers writing real FHIR) - because Phase 3 is the
first time it's tempting to do a real-vendor test. Treat this as a
release gate, not a nice-to-have.

## Deviation from the existing setup guide

The setup guide describes **himalaya** as the email client. This build
plan replaces that with **Microsoft Graph API** called from a Node script
inside a tula skill. Reasons:

- Already have Node 22 on the VM for `med-pdf` scripts; no new toolchain.
- Microsoft's `@azure/identity` + `@microsoft/microsoft-graph-client`
  npm packages are mature, support device-code OAuth (which avoided the
  Codex callback drama earlier in this stack), and natively handle binary
  attachment downloads, refresh tokens, retries, and throttling.
- No need to install/maintain a separate Rust binary.
- Future-friendly: Microsoft Graph supports subscription webhooks; we can
  upgrade from polling -> push later without changing the rest of the
  pipeline.

We will keep `email-router-setup-guide.md` for the M365 / Entra ID /
transport-rule steps (which are unchanged) and **skip** the himalaya
steps entirely. The Entra ID permissions list changes to:

| API | Permission | Type |
|---|---|---|
| Microsoft Graph | `Mail.Read` | Delegated |
| Microsoft Graph | `Mail.ReadWrite` (for marking seen / moving to Processed) | Delegated |
| Microsoft Graph | `Mail.Send` (only if Tula sends replies; optional Phase 5) | Delegated |
| Microsoft Graph | `offline_access` | Delegated |
| Microsoft Graph | `User.Read` | Delegated |

(Replaces the `IMAP.AccessAsUser.All` and `SMTP.Send` Office 365 Exchange
Online permissions in the original guide.)

## Phases

### Phase 0 - Prerequisites and decisions

Before writing any code:

1. **Mailbox identity** - what is `tula@<domain>`?
   - Choose: `realactivity.com`? `tula.realactivity.ai`? new domain?
   - Must be Exchange Online, not just an alias on a personal mailbox.

2. **Authorized senders** - who can email Tula?
   - At minimum: the user's own work address (`pswider@realactivity.com`).
   - Optionally: caregivers, a spouse, a partner clinic.
   - These go into the Exchange transport rule allowlist.

3. **M365 license source**
   - Existing tenant + spare Exchange Online Plan 1 license, OR
   - Microsoft Partner benefits (if applicable), OR
   - New Exchange Online subscription ($4 USD/user/month as of 2026).

4. **Storage path** - where do FHIR JSON files live on the VM?
   - **Option A** - `~/.openclaw/workspace/tula/fhir/` (per the design doc;
     keeps tula data adjacent to but separate from agent skills).
   - **Option B** - `~/.openclaw/workspace/skills/email-router/data/`
     (skill-scoped; gets backed up alongside the skill via `agent-backup.sh`
     unless explicitly excluded).
   - **Recommend A** - separates content from code. The `agent-backup`
     script's exclusion list can grow to keep PHI out of the backup.

5. **Polling cadence**
   - Cron every 60s (per design), OR
   - Openclaw heartbeat (driven by the agent itself, see `AGENTS.md`).
   - **Recommend cron** - independent of agent state, runs even when the
     agent is idle.

6. **Multimodal model for photo extraction**
   - **Claude Sonnet 4.6** (in Tula's primary auth path) - cheapest,
     strong on document OCR.
   - **Claude Opus 4.7** - strongest, more expensive.
   - **MedGemma 4B local** - free at runtime, requires GPU on the VM
     (B2s does not have one; would require VM upgrade).
   - **Recommend Sonnet 4.6** for Phase 1; revisit if accuracy is poor.

7. **VM/M365 state to confirm**
   - Mailbox exists? Transport rules in place? Entra app registered?
   - I can check the VM side; you confirm the M365 side from the admin
     portal.

### Phase 1 - Email connectivity (no skill yet)

1. **Verify VM state** - Node version, `~/.openclaw/workspace/tula/`
   directory existence.
2. **M365 mailbox** - ✅ already exists on the author's tenant: `aria@realactivity.com`. Substitute your own mailbox for your deployment.
3. ~~**Exchange transport rules**~~ - deferred per the locked-in
   decisions above. Re-enter the timeline before Phase 3 ships any real
   data.
4. **Entra ID app registration** - register `Tula Email Agent` per
   setup guide Step 3, but with the **Graph delegated permissions** in
   the table above, not the IMAP/SMTP permissions in the original guide.
   Required Authentication config: **Allow public client flows: Yes**
   (device-code flow won't work without this).
5. **Smoke-test connectivity** - a small Node project at
   [`scripts/email-smoke-test/`](../scripts/email-smoke-test/) that:
   - Authenticates via device code (`@azure/identity`'s
     `DeviceCodeCredential`), prints code + URL.
   - Calls `client.api('/me/messages')` and prints subject + sender +
     received-time of the 5 most recent messages.
   - Persists the MSAL token cache to a chmod-600 file under
     `~/.tula/` so subsequent runs don't require re-authenticating.

**Deliverable**: poll the mailbox from the VM and read recent emails.
No parsing, no skill, no FHIR yet.

**Estimated effort**: 30-45 minutes (mailbox already exists; transport
rules deferred; only Entra app registration + smoke-test run remain).

### Phase 2 - Build the `email-router` tula skill

Follow the [skills development guide](skills-development.md) and the
[`med-pdf`](../skills/med-pdf/) reference template:

```
skills/email-router/
├── SKILL.md                                <- openclaw house style
├── references/
│   ├── classification-prompt.md            <- from email-router-design.md
│   ├── loinc-codes.md                      <- LOINC table from design doc
│   ├── fhir-shapes.md                      <- Observation/DiagnosticReport
│   └── content-types.md                    <- per-type handler details
└── scripts/
    ├── poll.mjs                            <- Graph fetch new messages
    ├── classify.mjs                        <- Claude classification
    ├── dispatch.mjs                        <- route by content_type
    └── auth.mjs                            <- device-code OAuth + refresh
```

`SKILL.md` shape:
- USE FOR: Paul forwarded a health-related email/photo/PDF to Tula's
  mailbox, OR asks "process my inbox", OR "what's new in my Tula inbox?"
- DO NOT USE FOR: composing outbound email, ad-hoc HTTP requests, anything
  that doesn't touch the Tula mailbox specifically.
- WORKFLOW (numbered):
  1. Authenticate (refresh from cached token; device-code if first time)
  2. List unread messages in INBOX
  3. For each: download metadata + body + attachments
  4. Run `classify.mjs` against the message
  5. Run `dispatch.mjs` to invoke the per-type handler
  6. Mark seen, move to `Processed` folder
- TROUBLESHOOTING:
  - Graph 401: token expired -> run device-code flow again
  - Rate-limit (429): exponential backoff
  - Attachment >150MB: skip with notice (Graph API limit)

Eval suite (`evals/email-router/tasks/`):
- `positive-trigger-1` - lab PDF email
- `positive-trigger-2` - photo of pill bottle (image attachment)
- `positive-trigger-3` - appointment confirmation
- `negative-trigger-1` - non-health newsletter
- `negative-trigger-2` - phishing-style spam (should never trigger)
- `phi-boundary` - third-party PHI mention (don't store outside workspace)
- `safety` - message from sender not on allowlist (should be rejected
  pre-skill at the transport layer; a defense-in-depth test that the
  skill ALSO checks the sender)

**Deliverable**: the Tula agent can be told "process the new emails" and
the skill polls Graph, classifies, and stages - without yet writing FHIR.

**Estimated effort**: 3-4 hours.

### Phase 3 - FHIR storage and per-content-type handlers

Implement the handlers from `email-router-design.md`. Reuse what we
already have:

| Handler | Reuses | Effort |
|---|---|---|
| `laboratory_result` | wraps `skills/med-pdf/scripts/parse_labs.mjs` + adds LOINC mapping + FHIR JSON write | Medium |
| `imaging_report` | wraps `skills/med-pdf/scripts/parse_imaging.mjs` | Medium |
| `appointment` | new - extract date/time/provider/location | Small |
| `prescription` | new - med name, dose, frequency, prescriber | Small |
| `insurance_eob` | new - store as DocumentReference | Small |
| `provider_message` | new - store as DocumentReference | Small |
| `genomic_report` | new - heavy file handling, partial extraction | Medium |
| `device_reading` | new - many vendors emit FHIR-ish JSON | Small |
| `photo / image` | new - multimodal call (Claude Sonnet) | Medium |

Two of those handlers are basically free wrappers around the existing
`med-pdf` skill. This validates the skill graph: `email-router` invokes
`med-pdf` for lab/imaging parsing.

**Deliverable**: forwarding a Quest PDF email results in a fully extracted
FHIR DiagnosticReport on disk plus a Telegram summary.

**Estimated effort**: 1-2 days for all handlers. Lab + imaging + photo
alone is ~half a day.

### Phase 4 - Continuous polling + Telegram notifications

1. **Systemd timer on the VM** (not cron - cron's 60s floor is too slow
   for the locked-in 30s cadence). Pattern:
   ```ini
   # /etc/systemd/system/tula-email-poll.timer
   [Timer]
   OnBootSec=30s
   OnUnitActiveSec=30s
   Unit=tula-email-poll.service
   ```
   The service unit runs the poll script with `flock -n` to prevent
   overlap if a poll runs long (same protection pattern as `agent-cron.sh`).
2. After each successful classification + extraction, the skill calls
   the agent's existing Telegram channel to post a summary.
3. The agent's `MEMORY.md` gets longitudinal updates ("HbA1c trending
   down: 6.8 -> 6.4 -> 6.2").

**Deliverable**: end-to-end TripIt-style flow. Forward a lab PDF, get
a Telegram message in <2 minutes with extracted values and trend deltas.

**Estimated effort**: 2-3 hours.

### Phase 5 - Operational polish

- Sender allowlist updates via Telegram ("add caregiver to authorized
  senders" -> updates the Exchange transport rule via Graph API).
- De-identification engine (future per design doc) - strip PHI before
  any non-local processing.
- Confidence-flagged extractions surfaced via Telegram for user
  verification before commit.
- FHIR Bundle export ("send my Q4 labs to Dr. Patel as a single
  attachment").

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Workspace admin blocks device-code OAuth (we hit this with Codex) | Medium | Use **personal** Microsoft account on the OAuth screen, OR negotiate a tenant policy exception for the Tula app, OR use confidential-client (client credentials) auth with a service principal |
| OAuth refresh token expiry mid-session | Low | `@azure/identity` handles refresh automatically; persist the cache to `~/.tula/oauth-cache.json` with `chmod 600` |
| Attachment too large (>150 MB Graph limit) | Low | Notify and skip; offer manual upload to scratch dir as fallback |
| LLM classification mis-routes a sensitive email | Medium | Confidence threshold + Telegram review; transport rule is the hard boundary |
| Multimodal cost on photo path balloons | Low | Per-call cost tracker, monthly budget cap, fall-back to OCR-only if budget exceeded |
| Prompt injection from a malicious lab PDF | Medium | Outbound transport rule prevents data exfiltration; LLM prompts use clear separation between instructions and content |
| Race between cron tick and skill in-progress | Low | `flock` (same pattern as `agent-cron.sh`) |

## What to do next session

Phase 0 decisions are resolved (see top of doc). Remaining Phase 1 work:

1. **Register the Entra ID app** at https://entra.microsoft.com ->
   App registrations -> New registration. Single-tenant. Allow public
   client flows = **Yes**. Add **delegated** Graph permissions:
   `Mail.Read`, `Mail.ReadWrite`, `User.Read`, `offline_access`. Grant
   admin consent. Record the Application (client) ID and Directory
   (tenant) ID.
2. **Run the smoke test** from
   [`scripts/email-smoke-test/`](../scripts/email-smoke-test/) on the
   VM (see its README).
3. **Authorized sender list** - still owed. Defaults to
   `pswider@realactivity.com` only. Needed before transport rules ship
   in Phase 3.
4. **Phase 2 skill scaffold** once the smoke test passes:
   `skills/email-router/` modeled on `skills/med-pdf/`, plus the first
   `evals/email-router/tasks/` entry.
