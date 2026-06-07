# Email Send (Outbound) — Separate from Inbound Router

This module handles **outbound** email for Tula skills (starting with prep-my-visit).

## Important: Separate Entra App Required

**Do NOT reuse the inbound router's app registration.**

- Inbound router: `TULA_CLIENT_ID` / `TULA_TENANT_ID` → scopes `Mail.Read`, `Mail.ReadWrite`
- This sender: `TULA_SEND_CLIENT_ID` / `TULA_SEND_TENANT_ID` → scopes `Mail.Send`, `User.Read`

The two must be completely separate Azure Entra applications. This is a hard security boundary.

## Setup

1. Create a new Entra app registration (single-tenant).
2. Grant it `Mail.Send` delegated permission + `User.Read`.
3. Add a redirect URI for public client/native (for device code).
4. Export the new IDs (recommended way):
   Edit the file `~/.tula/send.env` and replace the placeholder values.
   Then source it:
   ```bash
   source ~/.tula/send.env
   ```
   You can also add `source ~/.tula/send.env` to your `~/.bashrc` or `~/.zshrc` so it's always available.
5. First run will trigger a device-code flow for the *send* app.

## Usage

```bash
node send.mjs \
  --visit-id zepbound-90day-followup \
  --to paul@example.com \
  --subject "Your Visit Prep Package - June 2026" \
  --body "Hi Paul,<br>Your provider brief and patient brief are attached as PDFs.<br><br>Reply STOP or tell Tula 'stop emailing prep packages' to revoke." \
  --attachments "provider.pdf,patient.pdf"
```

The calling code (prep-my-visit) is responsible for:
- Confirming user intent with the exact phrase "Send"
- Verifying both PDFs exist on disk
- Using the verified email from `memory/preferences/email-delivery.json`
- Writing the AuditEvent + daily memory note after success

## Safety

- Only sends to the single verified address in preferences.
- Never sends raw FHIR/JSON.
- Thin cover note only (full clinical content stays in the PDFs).
- All sends are user-initiated with explicit "Send" confirmation.
- Revocation is immediate and permanent until re-onboarded.

## Files

- `send.mjs` — main sender
- `auth-send.mjs` — separate MSAL client for Mail.Send only
- `README.md` — this file

Cache lives at `~/.tula/msal-send-cache.json` (intentionally different from inbound cache).