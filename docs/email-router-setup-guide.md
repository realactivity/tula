# Email Router Setup Guide

A step-by-step guide to configuring Tula's email ingestion system using Microsoft 365, himalaya, and Exchange transport rules. This guide picks up where the [deployment guide](deployment-guide.md) leaves off. By the end, Tula will be able to receive health-related emails, classify them, and notify you via Telegram.

**Time required:** 60 to 90 minutes

**Estimated cost:** No additional cost beyond the existing Azure VM and M365 license

**Prerequisites:**

- A working OpenClaw deployment with Telegram connected (complete the [deployment guide](deployment-guide.md) first)
- A Microsoft 365 tenant with Exchange Online (partner, business, or enterprise)
- Admin access to the Microsoft 365 Admin Center and Azure Portal
- SSH access to your VM

## Before You Begin

Ensure you have the following ready:

- Your VM's public IP address and SSH credentials
- Access to the Microsoft 365 Admin Center at [admin.microsoft.com](https://admin.microsoft.com)
- Access to the Azure Portal at [portal.azure.com](https://portal.azure.com)
- Access to the Exchange Admin Center at [admin.exchange.microsoft.com](https://admin.exchange.microsoft.com)
- The email address you will use as your authorized sender (e.g., `pswider@yourdomain.com`)

---

## Step 1: Create a Dedicated Mailbox for Tula

Tula needs its own mailbox. Do not use your personal email. A dedicated mailbox isolates health data ingestion and makes the transport rules clean.

1. Log into the Microsoft 365 Admin Center at [admin.microsoft.com](https://admin.microsoft.com).
2. Go to **Users > Active users > Add a user**.
3. Enter the following:
   - **First name:** Tula
   - **Last name:** Health Agent
   - **Display name:** Tula Health Agent
   - **Username:** `tula` (this becomes `tula@yourdomain.com`)
4. Assign a license that includes Exchange Online (Exchange Online Plan 1 is sufficient). If you are a Microsoft partner, check your partner benefits for available licenses.
5. Set a temporary password and sign in once at [outlook.office.com](https://outlook.office.com) to complete the account setup.
6. Note the full email address. This is Tula's inbox.

### Verify IMAP Is Enabled

Most M365 tenants have IMAP enabled by default, but some disable it via policy. Verify using Exchange Online PowerShell:

```powershell
# Connect to Exchange Online (install the module first if needed)
# Install-Module -Name ExchangeOnlineManagement
Connect-ExchangeOnline

# Check IMAP status
Get-CASMailbox -Identity tula@yourdomain.com | Select-Object ImapEnabled
```

If the result shows `False`, enable it:

```powershell
Set-CASMailbox -Identity tula@yourdomain.com -ImapEnabled $true
```

> **Tip:** If you see "The term 'Connect-ExchangeOnline' is not recognized," install the Exchange Online PowerShell module first: `Install-Module -Name ExchangeOnlineManagement` in an elevated PowerShell window.

---

## Step 2: Lock Down the Mailbox

This is the most important security step. Two Exchange transport rules restrict who can send email to Tula and who Tula can send email to. For the full security rationale, see the [security model](security-model.md).

### Create the Inbound Rule (Sender Allowlist)

This rule rejects any email sent to Tula's mailbox that is not from your authorized address. The message never reaches the inbox.

**In the Exchange Admin Center** (admin.exchange.microsoft.com):

1. Go to **Mail flow > Rules**.
2. Click **+ Add a rule > Create a new rule**.
3. Configure:
   - **Name:** `Tula - Allow only authorized senders`
   - **Apply this rule if:** The recipient is `tula@yourdomain.com`
   - **And:** The sender is NOT `yourname@yourdomain.com`
   - **Do the following:** Reject the message with the explanation `This mailbox only accepts messages from authorized senders.`
4. Set **Priority** to 0 (highest).
5. Set **Mode** to Enforce.
6. Click **Save**.

Or via PowerShell:

```powershell
New-TransportRule -Name "Tula - Allow only authorized senders" `
  -SentTo "tula@yourdomain.com" `
  -ExceptIfFrom "yourname@yourdomain.com" `
  -RejectMessageReasonText "This mailbox only accepts messages from authorized senders." `
  -Priority 0 `
  -Enabled $true
```

### Create the Outbound Rule (Recipient Restriction)

This rule prevents Tula from sending email to anyone except your authorized address. This is the data exfiltration control. Even if a prompt injection succeeds, Tula cannot email your health data to an unauthorized recipient.

```powershell
New-TransportRule -Name "Tula - Restrict outbound recipients" `
  -From "tula@yourdomain.com" `
  -ExceptIfSentTo "yourname@yourdomain.com" `
  -RejectMessageReasonText "This mailbox can only send to authorized recipients." `
  -Priority 0 `
  -Enabled $true
```

### Test the Rules

Send a test email from your authorized address to Tula's mailbox. It should arrive. Then send a test email from a different address (a personal Gmail, for example). It should bounce with the rejection message.

> **Important:** Transport rules can take up to 30 minutes to propagate. If your test email from an unauthorized sender still arrives, wait and try again.

### Adding Authorized Senders Later

When you want a caregiver or family member to forward emails to Tula:

```powershell
Set-TransportRule -Identity "Tula - Allow only authorized senders" `
  -ExceptIfFrom "yourname@yourdomain.com", "caregiver@example.com"
```

For the outbound rule, add authorized recipients the same way:

```powershell
Set-TransportRule -Identity "Tula - Restrict outbound recipients" `
  -ExceptIfSentTo "yourname@yourdomain.com", "caregiver@example.com"
```

---

## Step 3: Register an App in Azure Entra ID

Microsoft requires OAuth2 for IMAP access to Exchange Online. Basic authentication (username and password) is deprecated and disabled. You need to register an application in your Azure tenant that himalaya will use to authenticate.

**In the Azure Portal** (portal.azure.com):

1. Go to **Microsoft Entra ID > App registrations > New registration**.
2. Enter:
   - **Name:** `Tula Email Agent`
   - **Supported account types:** Accounts in this organizational directory only (single tenant)
   - **Redirect URI:** Select **Web**, enter `http://localhost:9999`
3. Click **Register**.
4. On the Overview page, note:
   - **Application (client) ID:** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Directory (tenant) ID:** `yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy`

### Create a Client Secret

1. Go to **Certificates & secrets > New client secret**.
2. **Description:** `Tula himalaya`
3. **Expires:** 24 months
4. Click **Add**.
5. **Immediately copy the Value** (not the Secret ID). You will not see it again after navigating away.

> **Warning:** Treat the client secret like a password. Do not paste it in any chat, email, or public location. You will enter it directly into the himalaya configuration file on your VM.

### Configure API Permissions

1. Go to **API permissions > Add a permission**.
2. Select the **APIs my organization uses** tab.
3. Search for **Office 365 Exchange Online** and select it.
4. Select **Delegated permissions**.
5. Check **IMAP.AccessAsUser.All** and click **Add permissions**.
6. Go back to **Add a permission > Microsoft Graph > Delegated permissions**.
7. Add: **SMTP.Send**, **offline_access**, **openid**, **profile**.
8. Click **Grant admin consent for [your organization]** and confirm.

The permissions list should show:

| API | Permission | Type | Status |
|-----|-----------|------|--------|
| Office 365 Exchange Online | IMAP.AccessAsUser.All | Delegated | Granted |
| Microsoft Graph | SMTP.Send | Delegated | Granted |
| Microsoft Graph | offline_access | Delegated | Granted |
| Microsoft Graph | openid | Delegated | Granted |
| Microsoft Graph | profile | Delegated | Granted |

> **Tip:** If the "Grant admin consent" button is grayed out, you need a Global Administrator to grant consent. As a Microsoft partner on your own tenant, you likely have this role already.

---

## Step 4: Install Himalaya on the VM

SSH into your VM:

```bash
ssh -i C:\path\to\your-key.pem azureuser@YOUR_VM_IP
```

Check if himalaya is already installed:

```bash
himalaya --version
```

If not found, download and install the latest release:

```bash
curl -sSL https://github.com/pimalaya/himalaya/releases/latest/download/himalaya-x86_64-linux-gnu.tar.gz -o /tmp/himalaya.tar.gz
tar -xzf /tmp/himalaya.tar.gz -C /tmp/
sudo mv /tmp/himalaya /usr/local/bin/
chmod +x /usr/local/bin/himalaya
himalaya --version
```

> **Note:** The pre-built binary should include OAuth2 support. If you encounter OAuth2 errors later, you may need to build from source with the `oauth2` feature flag: `cargo install himalaya --features oauth2,keyring`. This requires installing the Rust toolchain first: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

---

## Step 5: Configure Himalaya for Microsoft 365

Create the himalaya configuration directory and file:

```bash
mkdir -p ~/.config/himalaya
nano ~/.config/himalaya/config.toml
```

Paste the following configuration, replacing the placeholder values with your actual credentials:

```toml
[accounts.tula]
email = "tula@yourdomain.com"
display-name = "Tula Health Agent"
default = true

backend.type = "imap"
backend.host = "outlook.office365.com"
backend.port = 993
backend.encryption.type = "tls"
backend.login = "tula@yourdomain.com"

backend.auth.type = "oauth2"
backend.auth.method = "xoauth2"
backend.auth.client-id = "YOUR_APPLICATION_CLIENT_ID"
backend.auth.client-secret.raw = "YOUR_CLIENT_SECRET_VALUE"
backend.auth.auth-url = "https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/authorize"
backend.auth.token-url = "https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token"
backend.auth.pkce = true
backend.auth.scopes = ["https://outlook.office365.com/IMAP.AccessAsUser.All", "offline_access"]

message.send.backend.type = "smtp"
message.send.backend.host = "smtp-mail.outlook.com"
message.send.backend.port = 587
message.send.backend.encryption.type = "start-tls"
message.send.backend.login = "tula@yourdomain.com"

message.send.backend.auth.type = "oauth2"
message.send.backend.auth.method = "xoauth2"
message.send.backend.auth.client-id = "YOUR_APPLICATION_CLIENT_ID"
message.send.backend.auth.client-secret.raw = "YOUR_CLIENT_SECRET_VALUE"
message.send.backend.auth.auth-url = "https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/authorize"
message.send.backend.auth.token-url = "https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token"
message.send.backend.auth.pkce = true
message.send.backend.auth.scopes = ["https://outlook.office365.com/SMTP.Send", "offline_access"]
```

Set restrictive permissions on the configuration file:

```bash
chmod 600 ~/.config/himalaya/config.toml
```

> **Security note:** Storing the client secret as `raw` in the config is acceptable for initial setup. For production, move it to a file with restricted permissions and reference it with a command:
> ```toml
> backend.auth.client-secret.cmd = "cat /home/azureuser/.secrets/tula-oauth-secret"
> ```
> Create the secrets file:
> ```bash
> mkdir -p ~/.secrets
> echo "YOUR_CLIENT_SECRET" > ~/.secrets/tula-oauth-secret
> chmod 600 ~/.secrets/tula-oauth-secret
> ```

---

## Step 6: Complete the OAuth2 Flow

This is the one step that requires a browser. The OAuth2 authorization flow presents a Microsoft consent screen where you sign in as `tula@yourdomain.com` and grant the application permission to access the mailbox. Your VM has no browser, so you use an SSH tunnel to forward the redirect.

### Open an SSH Tunnel

On your **local PC** (not the VM), open a new PowerShell or Terminal window and create a tunnel:

```powershell
ssh -L 9999:localhost:9999 -i C:\path\to\your-key.pem azureuser@YOUR_VM_IP
```

This forwards port 9999 on the VM to port 9999 on your local machine. Leave this connection open.

### Run the Account Configuration

In your **existing SSH session** on the VM:

```bash
himalaya account configure tula
```

Himalaya will print a URL that looks like:

```
https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/authorize?client_id=...&redirect_uri=http%3A%2F%2Flocalhost%3A9999&scope=...
```

Copy that entire URL and paste it into your **local PC's browser**. Sign in as `tula@yourdomain.com` with the password you set during mailbox creation. Grant the requested permissions.

After granting consent, the browser will redirect to `http://localhost:9999/...`. Because of the SSH tunnel, this reaches himalaya's temporary HTTP server running on the VM. Himalaya captures the authorization code and exchanges it for access and refresh tokens.

You should see a success message in the terminal.

> **Common error:** "cannot wait for oauth2 redirection" - This usually means the SSH tunnel is not active or the redirect URI in your Entra ID app registration does not match `http://localhost:9999`. Verify both.

> **Alternative: Device Code Flow** - If your version of himalaya supports device authorization (`himalaya account configure --help` to check), you can authenticate by entering a code at [microsoft.com/devicelogin](https://microsoft.com/devicelogin) from any browser without needing a tunnel.

---

## Step 7: Test Email Connectivity

With the OAuth flow complete, test that himalaya can access Tula's mailbox:

```bash
# List inbox messages
himalaya envelope list

# List available folders
himalaya folder list
```

You should see the inbox contents (or an empty list if no emails have been sent yet).

**Full test:** From your authorized email address, send a test email to `tula@yourdomain.com` with the subject "Test from authorized sender." Then run:

```bash
himalaya envelope list
```

You should see the test email. Read it:

```bash
himalaya message read 1
```

If you see the email content, himalaya is connected and authenticated. Phase 1 of the [email router design](email-router-design.md) is complete.

> **Common error:** "Authentication failed" or "NO AUTHENTICATE failed" - The OAuth2 tokens may not have been saved correctly. Run `himalaya account configure tula` again to re-authorize. Ensure IMAP is enabled for the mailbox (Step 1).

> **Common error:** Empty envelope list after sending email - Transport rules can take up to 30 minutes to propagate. If you just created the inbound rule, your test email may have been rejected. Wait for propagation and send another test email.

---

## Step 8: Set Up Inbox Polling

Tula needs to check for new email automatically. A cron job polls the inbox every 60 seconds using himalaya. When new unseen messages are detected, OpenClaw processes them.

### Option A: OpenClaw Cron (Recommended)

Use OpenClaw's built-in scheduling to poll and process email:

```bash
openclaw cron add \
  --name "email-check" \
  --cron "* * * * *" \
  --session isolated \
  --message "Check for new unread emails using himalaya. List any unseen messages. For each new message, read it and report the sender, subject, and date."
```

This runs every minute. When Tula finds new messages, it reads them and sends you a Telegram notification.

### Option B: System Cron with a Shell Script

If you prefer system-level cron:

```bash
mkdir -p ~/.openclaw/workspace/tula/scripts
nano ~/.openclaw/workspace/tula/scripts/check-email.sh
```

```bash
#!/bin/bash
# Check for unseen emails in Tula's mailbox
UNSEEN=$(himalaya envelope list --output json 2>/dev/null | jq '[.[] | select(.flags | test("Seen") | not)] | length' 2>/dev/null)

if [ "$UNSEEN" -gt 0 ] && [ "$UNSEEN" != "null" ]; then
    echo "Found $UNSEEN new email(s)"
    himalaya envelope list --output json | jq -r '.[] | select(.flags | test("Seen") | not) | "From: \(.from.name // .from.addr) | Subject: \(.subject)"'
fi
```

```bash
chmod +x ~/.openclaw/workspace/tula/scripts/check-email.sh

# Add to crontab
crontab -e
```

Add this line:

```
* * * * * /home/azureuser/.openclaw/workspace/tula/scripts/check-email.sh >> /home/azureuser/.openclaw/workspace/tula/logs/email-check.log 2>&1
```

Create the logs directory:

```bash
mkdir -p ~/.openclaw/workspace/tula/logs
```

### Test Polling

Send yourself an email from your authorized address to Tula's mailbox. Wait up to 60 seconds. Confirm that Tula sends you a Telegram notification with the sender and subject.

---

## Step 9: Create the FHIR Directory Structure

Set up the local storage directories for classified health data. These directories follow the FHIR R4 resource structure defined in the [email router design](email-router-design.md):

```bash
mkdir -p ~/.openclaw/workspace/tula/fhir/{Observation/{laboratory,vital-signs,wearable},DiagnosticReport/{laboratory,imaging},MedicationStatement,Appointment,DocumentReference,Patient}
mkdir -p ~/.openclaw/workspace/tula/inbox/{raw,processed}
mkdir -p ~/.openclaw/workspace/tula/attachments

# Set restrictive permissions on health data directories
chmod -R 700 ~/.openclaw/workspace/tula/fhir
chmod -R 700 ~/.openclaw/workspace/tula/inbox
chmod -R 700 ~/.openclaw/workspace/tula/attachments
```

Verify the structure:

```bash
find ~/.openclaw/workspace/tula/fhir -type d | sort
```

Expected output:

```
/home/azureuser/.openclaw/workspace/tula/fhir
/home/azureuser/.openclaw/workspace/tula/fhir/Appointment
/home/azureuser/.openclaw/workspace/tula/fhir/DiagnosticReport
/home/azureuser/.openclaw/workspace/tula/fhir/DiagnosticReport/imaging
/home/azureuser/.openclaw/workspace/tula/fhir/DiagnosticReport/laboratory
/home/azureuser/.openclaw/workspace/tula/fhir/DocumentReference
/home/azureuser/.openclaw/workspace/tula/fhir/MedicationStatement
/home/azureuser/.openclaw/workspace/tula/fhir/Observation
/home/azureuser/.openclaw/workspace/tula/fhir/Observation/laboratory
/home/azureuser/.openclaw/workspace/tula/fhir/Observation/vital-signs
/home/azureuser/.openclaw/workspace/tula/fhir/Observation/wearable
/home/azureuser/.openclaw/workspace/tula/fhir/Patient
```

---

## Step 10: Create the Email Router Skill

The email router skill tells Tula how to process incoming email. Create the skill directory:

```bash
mkdir -p ~/.openclaw/workspace/tula/skills/email-router
nano ~/.openclaw/workspace/tula/skills/email-router/SKILL.md
```

The SKILL.md should contain:

1. **Sender verification.** Before processing any message, check the sender address against the authorized sender list. If the sender is not authorized, mark the message as seen and skip it silently.
2. **Classification.** Send the email metadata (from, subject, date), body excerpt (first 2000 characters), and attachment list to Claude using the classification prompt defined in the [email router design](email-router-design.md). Claude returns the content type, confidence, summary, and recommended action.
3. **Notification.** Send a Telegram notification with the content type and summary: `[laboratory_result] from Quest Diagnostics: Comprehensive metabolic panel results from March 22, 2026. 14 biomarkers, 3 flagged.`
4. **Mark as processed.** Mark the email as seen after processing to prevent re-processing on the next poll.

The skill configuration includes the authorized sender list:

```json
{
  "authorized_senders": [
    "yourname@yourdomain.com"
  ]
}
```

> **Note:** The email router skill is under active development. The SKILL.md format and exact agent instructions will be published in the repository as the skill is built. The classification prompt and content type definitions are documented in the [email router design](email-router-design.md).

---

## Step 11: Test End-to-End

Forward three different types of email from your authorized address to Tula's mailbox:

1. **A laboratory result.** Forward a lab result email or photograph a lab report and email the image. Tula should classify it as `laboratory_result`.
2. **An appointment confirmation.** Forward an appointment reminder from a doctor's office. Tula should classify it as `appointment`.
3. **A non-health email.** Forward a random newsletter or promotional email. Tula should classify it as `not_health` and skip further processing.

For each, verify:

- Telegram notification arrives within 60 seconds
- Content type is correct
- Summary is accurate
- Email is marked as seen after processing

---

## Day-to-Day Operations

### Forwarding Health Data to Tula

From your authorized email address, forward any health-related email to Tula's inbox. Tula accepts:

- Email forwards (forward the original email from your inbox)
- Photo attachments (photograph a document and email the image)
- PDF attachments (forward emails that contain lab reports, imaging reports, or other PDFs)
- Screenshots (screenshot a patient portal screen and email it)

### Checking Processing Status

Ask Tula via Telegram: "What emails have you processed today?" or "Show me recent email classifications."

### Viewing Stored Data

Ask Tula via Telegram: "What was my last fasting glucose?" or "When is my next appointment?" Tula reads the FHIR JSON files in the local storage directories.

### Monitoring the Cron Job

```bash
# Check if the cron job is running
crontab -l

# View recent polling logs (if using system cron)
tail -20 ~/.openclaw/workspace/tula/logs/email-check.log

# Check OpenClaw cron status (if using OpenClaw cron)
openclaw cron list
```

### Token Refresh

Himalaya handles OAuth2 token refresh automatically using the refresh token obtained during the initial authorization. Tokens are long-lived but not permanent. If himalaya stops authenticating after several weeks or months, re-run the OAuth flow:

```bash
himalaya account configure tula
```

---

## Troubleshooting

### "cannot wait for oauth2 redirection"

The SSH tunnel is not active, or the redirect URI in your Entra ID app registration does not match. Verify:

1. The SSH tunnel is running: `ssh -L 9999:localhost:9999 ...`
2. The Entra ID app registration has `http://localhost:9999` as a Web redirect URI
3. No other process is using port 9999 on the VM: `sudo lsof -i :9999`

### "Authentication failed" or "NO AUTHENTICATE failed"

OAuth2 tokens may have expired or were not saved correctly. Re-run:

```bash
himalaya account configure tula
```

Also verify IMAP is enabled for the mailbox:

```powershell
Get-CASMailbox -Identity tula@yourdomain.com | Select-Object ImapEnabled
```

### Transport rule not blocking unauthorized senders

Rules can take up to 30 minutes to propagate after creation. Wait and test again. Verify the rule exists and is enabled:

```powershell
Get-TransportRule -Identity "Tula - Allow only authorized senders" | Select-Object State, Priority
```

### Emails arriving but no Telegram notification

The cron job may not be running or OpenClaw may not be processing the poll results. Check:

```bash
# System cron
crontab -l
tail -20 ~/.openclaw/workspace/tula/logs/email-check.log

# OpenClaw cron
openclaw cron list

# OpenClaw service status
sudo systemctl status openclaw
```

### "himalaya: command not found"

Himalaya is not installed or not on the PATH. Check:

```bash
which himalaya
ls -la /usr/local/bin/himalaya
```

If missing, re-install following Step 4.

### OAuth consent screen shows "Need admin approval"

The API permissions have not been granted admin consent. Return to the Azure Portal, go to your app registration's API permissions page, and click "Grant admin consent for [your organization]."

---

## Quick Reference: Exchange PowerShell Commands

| Task | Command |
|------|---------|
| Connect to Exchange Online | `Connect-ExchangeOnline` |
| Check IMAP status | `Get-CASMailbox -Identity tula@yourdomain.com \| Select-Object ImapEnabled` |
| Enable IMAP | `Set-CASMailbox -Identity tula@yourdomain.com -ImapEnabled $true` |
| List transport rules | `Get-TransportRule \| Select-Object Name, State, Priority` |
| Check a specific rule | `Get-TransportRule -Identity "Tula - Allow only authorized senders"` |
| Add an authorized sender | `Set-TransportRule -Identity "Tula - Allow only authorized senders" -ExceptIfFrom "addr1@domain.com", "addr2@domain.com"` |
| Disconnect | `Disconnect-ExchangeOnline -Confirm:$false` |

## Quick Reference: Himalaya Commands

| Task | Command |
|------|---------|
| List inbox | `himalaya envelope list` |
| Read message by ID | `himalaya message read 42` |
| List folders | `himalaya folder list` |
| Search unseen messages | `himalaya envelope list --filter "NOT SEEN"` |
| Download attachments | `himalaya attachment download 42` |
| Download to specific directory | `himalaya attachment download 42 --dir ~/attachments` |
| JSON output (for scripting) | `himalaya envelope list --output json` |
| Mark as seen | `himalaya flag add 42 --flag seen` |
| Re-authorize OAuth | `himalaya account configure tula` |

---

## Next Steps

With email ingestion running and classified, the next milestones are:

1. **Build the laboratory result parser** to extract biomarker values from PDFs and photos, map them to LOINC codes, and store as FHIR Observation resources. This is the highest-value feature and the focus of Phase 3 in the [email router design](email-router-design.md).
2. **Build content type handlers** for appointments, prescriptions, imaging reports, and insurance EOBs.
3. **Configure photo ingestion** to support multimodal extraction from phone camera images via Claude or MedGemma. See the Photo Ingestion section in the [email router design](email-router-design.md).
4. **Review the security model** for additional hardening recommendations including SPF, DKIM, and DMARC verification. See the [security model](security-model.md).

---

*This guide is maintained by the Tula community. If you encounter an issue not covered here, please [open an issue](../../issues) so we can improve the documentation for everyone.*
