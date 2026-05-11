# email-smoke-test

Phase 1 connectivity test for the email-router. Authenticates against
Microsoft Graph via device-code flow, then lists the 5 most recent
messages in `aria@realactivity.com`'s INBOX.

This is **throwaway scaffolding**. Phase 2 lifts the auth + polling
plumbing into `skills/email-router/scripts/` and deletes this directory.

See [`docs/email-router-build-plan.md`](../../docs/email-router-build-plan.md)
for the broader plan.

## Prerequisites

- Ubuntu VM with Node ≥ 22.16 (the OpenClaw VM already satisfies this —
  it ships with Node 24 per `docs/deployment-guide.md` Step 3).
- `aria@realactivity.com` mailbox in Exchange Online (already created).
- An **Entra ID app registration** with the right Graph permissions.

## One-time Entra ID setup

Do this in the M365 admin Web UI; cannot be automated from here.

1. Sign in at <https://entra.microsoft.com> with an account that has
   Application Administrator (or Global Administrator) rights on the
   tenant that owns `realactivity.com`.
2. **Identity → Applications → App registrations → New registration.**
   - Name: `Tula Email Agent`
   - Supported account types: **Single tenant**
   - Redirect URI: leave blank (device-code flow doesn't need one)
   - Click **Register**.
3. On the new app's overview page, note these two values — you'll need
   them as environment variables on the VM:
   - **Application (client) ID**
   - **Directory (tenant) ID**
4. **Authentication** blade → scroll to **Advanced settings** → set
   **Allow public client flows: Yes**. Save. Without this, device-code
   flow fails with `AADSTS7000218`.
5. **API permissions** blade → **Add a permission → Microsoft Graph →
   Delegated permissions**, then add all four:
   - `Mail.Read`
   - `Mail.ReadWrite`
   - `User.Read` (default; usually already there)
   - `offline_access`
   - (do NOT add `Mail.Send` yet — that's a Phase 5 capability)
6. Click **Grant admin consent for `<tenant>`**. The status column for
   each permission should flip to "Granted for `<tenant>`".

## Run it on the VM

```bash
ssh azureuser@<your-vm-ip>

# 1. Pull the repo if you haven't already
cd ~/tula && git pull          # or: git clone https://github.com/pswider/tula.git ~/tula

# 2. Install deps for the smoke test
cd ~/tula/scripts/email-smoke-test
npm install

# 3. Export the Entra IDs from Step 3 above
export TULA_CLIENT_ID=00000000-0000-0000-0000-000000000000
export TULA_TENANT_ID=00000000-0000-0000-0000-000000000000

# 4. First run — device-code prompt
node smoke-test.mjs
```

On first run you'll see something like:

```
Acquiring access token for Microsoft Graph...
  Scopes: https://graph.microsoft.com/Mail.Read, ...

  Open this URL in any browser:
    https://microsoft.com/devicelogin
  Enter this code:
    A1B2-C3D4
```

Open that URL on your laptop or phone, paste the code, sign in as
`aria@realactivity.com`. Approve the consent screen (the four delegated
permissions you granted above).

The script then continues:

```
Token acquired. Expires at 2026-05-10T22:15:43.000Z.

Fetching identity (/me)...
  Signed in as: Aria <aria@realactivity.com>

Fetching 5 most recent messages from INBOX...

  2026-05-10T19:32:10Z  Quest Diagnostics <noreply@questdiagnostics.com>
    Your test results are ready
  ...

OK — 5 message(s) listed.
```

## Subsequent runs

The MSAL token cache lives at `~/.tula/aria-graph` (chmod 700 dir,
unencrypted file — this is the documented pattern for headless servers
without a desktop keychain daemon). Refresh tokens are good for ~90
days of inactivity. So:

```bash
node smoke-test.mjs           # silent re-auth from cache
node smoke-test.mjs --top 10  # list 10 instead of 5
node smoke-test.mjs --auth-only  # just refresh tokens, skip Graph call
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `TULA_CLIENT_ID is not set.` | Forgot to `export` the env vars. They're per-shell — add to `~/.bashrc` or a `.env` loader if you want them sticky. |
| `AADSTS7000218: ... must have client_secret or use public_client` | Authentication blade → "Allow public client flows" wasn't set to Yes. |
| `AADSTS65001: The user or administrator has not consented` | Admin consent step on the API permissions blade was skipped. |
| `AADSTS50020: User account ... does not exist in tenant` | You signed in as a personal Microsoft account on the device-code page. Sign in as `aria@realactivity.com` (or whatever account owns the mailbox in this tenant). |
| `Error: ENOENT ~/.tula/...` | Permission issue writing the cache; ensure `~/.tula/` is owned by the current user and is mode 700. |
| First `npm install` warns about deprecated packages | Safe to ignore; same as the OpenClaw install. |

## What's intentionally NOT in this script

- **No transport rules.** Per the locked-in decisions in the build
  plan, transport rules are deferred until Phase 3. Until then, keep
  the mailbox address private.
- **No FHIR write, no classification, no Telegram.** Those are Phase 2+.
  This script only proves we can read the inbox.
- **No `Mail.Send`.** Phase 5.
- **No webhook subscriptions.** Future upgrade path; polling is the
  Phase 1-4 transport.
