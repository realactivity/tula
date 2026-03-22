# Deployment Guide

A step-by-step guide to deploying a personal AI health agent on Microsoft Azure using OpenClaw, accessible through Telegram. Written during a real deployment session, including every error encountered and how it was resolved.

**Time required:** 60 to 90 minutes

**Estimated cost:** Approximately $30 to $50 per month (Azure VM plus API tokens)

**Prerequisites:** Basic comfort with a command line. No Linux experience required. This guide was written by a Windows Server administrator of 25 years deploying his first Linux server.

## Before You Begin

Ensure you have the following accounts and tools ready:

- A Microsoft Azure account with a payment method (free trial works)
- A Telegram account on your phone
- An Anthropic account for Claude API access at [console.anthropic.com](https://console.anthropic.com)
- A Google account for Gemini API access at [aistudio.google.com/apikeys](https://aistudio.google.com/apikeys)
- A computer with PowerShell or Terminal for SSH
- Optionally: Termius or JuiceSSH on your phone for mobile SSH access

---

## Step 1: Create the Azure Virtual Machine

1. Log into the Azure Portal at [portal.azure.com](https://portal.azure.com).
2. Click "Create a resource" and select "Virtual Machine."
3. **Image:** Select **Ubuntu Server 24.04 LTS**. Do not select Windows Server.
4. **Size:** Select **B2s** (2 vCPUs, 4 GB RAM). This costs approximately $30/month and is sufficient for an AI orchestration agent. The heavy computation happens at the API provider level, not on your VM.
5. **Authentication:** Choose **SSH public key**. Azure will generate a key pair. Download the `.pem` private key file and save it in a secure location (for example, a folder called `keychain` on your local drive).
6. **Networking:** Leave defaults. Ensure SSH (port 22) is allowed in the inbound port rules.
7. Click "Review + Create" and then "Create." Wait for the deployment to complete.
8. Note your VM's **public IP address** from the Azure portal overview page.

> **Tip:** Choose a region close to you for lower latency. East US or West US 2 are good defaults for US-based users.

---

## Step 2: Connect to Your VM via SSH

### Fix Key Permissions (Windows)

SSH refuses to use a private key file that other users can read. Before connecting, you must restrict permissions on your `.pem` file. Open PowerShell and run the following commands, replacing the path with your actual key location:

```powershell
# Remove inherited permissions
icacls "C:\path\to\your-key.pem" /inheritance:r

# Grant read access only to your user account
icacls "C:\path\to\your-key.pem" /grant:r "YOUR_USERNAME:(R)"

# Remove all other accounts
icacls "C:\path\to\your-key.pem" /remove "BUILTIN\Users"
icacls "C:\path\to\your-key.pem" /remove "BUILTIN\Administrators"
icacls "C:\path\to\your-key.pem" /remove "NT AUTHORITY\SYSTEM"
```

Verify that only your account has access:

```powershell
icacls "C:\path\to\your-key.pem"
```

The output should show only your username with `(R)` permission.

> **Important:** Azure cloud-init configuration files in `/etc/ssh/sshd_config.d/` may override SSH settings. If you encounter permission issues later, this is likely the cause. See the Troubleshooting section.

### Connect

```powershell
ssh -i C:\path\to\your-key.pem azureuser@YOUR_VM_IP_ADDRESS
```

Type `yes` when asked about the host fingerprint. You should see an Ubuntu welcome message with system statistics. You are now on your Linux server.

---

## Step 3: Update the System and Install Node.js

Update all system packages. This is the Linux equivalent of running Windows Update on a fresh machine:

```bash
sudo apt update && sudo apt upgrade -y
```

This may take several minutes. When it completes, install Node.js. OpenClaw requires Node.js 22.16 or newer. Node.js 24 is recommended:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify the installation:

```bash
node --version
```

Expected output: `v24.x.x` (or `v22.x.x` minimum).

> **Note:** The `sudo` command runs a command with administrator privileges. It is the Linux equivalent of "Run as Administrator" in Windows. It is pronounced "sue-doo" and stands for "superuser do."

---

## Step 4: Install OpenClaw

Install OpenClaw globally using npm:

```bash
sudo npm install -g openclaw@latest
```

This takes approximately one minute. You may see warnings about deprecated packages. These are safe to ignore.

Verify the installation:

```bash
openclaw --version
```

> **Common error:** If you run `npm install -g openclaw@latest` without `sudo`, you will receive an `EACCES: permission denied` error. The `sudo` prefix is required for global npm installations.

---

## Step 5: Create Your Telegram Bot

Before running the OpenClaw setup wizard, create your Telegram bot so you have the token ready.

1. Open Telegram on your phone.
2. Search for **@BotFather** and start a chat.
3. Send: `/newbot`
4. When asked for a **display name**, enter the name you want for your agent (e.g., "Tula").
5. When asked for a **username**, enter a unique name ending in `bot` (e.g., `tula_health_bot`).
6. BotFather will reply with a **bot token**. It looks like: `7123456789:AAH1234abcd5678efgh9012ijkl`
7. Save this token securely. You will need it during the OpenClaw onboarding wizard.

> **Warning:** Your bot token is equivalent to a password. Never share it in a chat, post it online, or paste it in any public location. If you accidentally expose it, message @BotFather with `/revoke` to invalidate the old token and generate a new one.

---

## Step 6: Obtain Your API Keys

You need API keys for the AI models your agent will use. Obtain these in your local computer's browser before starting the onboarding wizard.

### Anthropic API Key (for Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up or log in.
2. Navigate to **API Keys** in the left sidebar.
3. Click **Create Key** and name it (e.g., "Tula").
4. Copy the key and save it securely.
5. Add billing. For personal use, $10 to $20 of initial credits is sufficient.

### Google Gemini API Key (for Web Search)

1. Go to [aistudio.google.com/apikeys](https://aistudio.google.com/apikeys) and sign in with your Google account.
2. Click **Create API Key**.
3. Copy the key and save it securely.

> **Tip:** Store API keys in a password manager. Enter them directly into the terminal during setup. Never share them in any chat or document.

---

## Step 7: Run the OpenClaw Onboarding Wizard

In your SSH session, run the onboarding wizard:

```bash
openclaw onboard
```

The wizard walks through the configuration step by step. The following sections describe the recommended selections at each prompt.

### Model/Auth Provider

Select **Anthropic**. Then choose **Anthropic API key** (not the setup-token option). Paste your Anthropic API key when prompted.

### Default Model

Select **Claude Sonnet 4.6**. This model provides the best balance of reasoning capability and cost efficiency for a personal health agent. Claude Opus is more capable but significantly more expensive and can be added as a routing target later.

### Search Provider

Select **Gemini (Google Search)**. Paste your Google API key when prompted.

### Skills

The wizard presents a list of installable skills. Recommended starting selections:

- **himalaya** - Email client integration for sending and receiving email
- **nano-pdf** - PDF parsing for reading laboratory reports and health documents
- **clawhub** - Skill registry that allows your agent to discover and install new skills as needed

All other skills can be added later. Select only these three to keep the initial setup straightforward.

### Hooks

Enable the following:

- **command-logger** - Logs agent actions for debugging and auditing
- **session-memory** - Enables context retention across conversations, essential for a health agent that needs to recall prior biomarker data and journal entries

Skip `boot-md` and `bootstrap-extra-files`.

### Hatch Your Bot

Select **Hatch in TUI** to launch the agent in the terminal for immediate testing.

### Agent Personality

The wizard prompts for a name, creature type, and personality description. Enter whatever is appropriate for your use case. This shapes how the agent communicates and can be changed later.

---

## Step 8: Connect Telegram

After the wizard finishes and your agent is running in the TUI, open Telegram on your phone and message your bot. Send:

```
/start
```

The bot will reply with a **pairing code** (e.g., `U6RXEU2P`).

Exit the TUI by pressing `Ctrl+C` or typing `/exit`. Then run the pairing approval command, replacing the code with your own:

```bash
openclaw pairing approve telegram YOUR_PAIRING_CODE
```

Return to Telegram and send your bot a message. It should respond with an AI-generated reply.

> **Note:** If your commands are being intercepted by the agent rather than executing on the system, you are still inside the OpenClaw TUI. Press `Ctrl+C` or type `/exit` to return to the standard terminal prompt.

---

## Step 9: Install the Daemon (Always-On Service)

Without the daemon, your agent only runs while the TUI is open in a terminal session. Closing the SSH connection terminates the agent. The daemon registers OpenClaw as a systemd service that starts automatically on boot, survives SSH disconnections, and restarts automatically if it crashes.

```bash
sudo openclaw daemon install
```

This is the Linux equivalent of setting a Windows Service to "Automatic" startup type.

Verify the service is running:

```bash
sudo systemctl status openclaw
```

Test it: close your SSH session entirely, then send a message to your bot on Telegram. It should still respond.

---

## Step 10: Enable Mobile SSH Access (Optional)

To manage your server from a mobile device, install an SSH application such as Termius (Android/iOS) or JuiceSSH (Android).

Azure VMs default to SSH key authentication only. To enable password-based authentication for convenience on mobile:

### Set a Password

```bash
sudo passwd azureuser
```

### Enable Password Authentication

Azure's cloud-init configuration overrides the main SSH config. You must update the override files directly:

```bash
sudo sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/50-cloud-init.conf
sudo sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/60-cloudimg-settings.conf
sudo systemctl restart ssh
```

> **Important:** Ubuntu 24.04 uses `ssh` as the service name, not `sshd`. Running `sudo systemctl restart sshd` will fail with "Unit sshd.service not found."

### Connect from Mobile

In your SSH application, create a new host with:

- **Hostname:** Your VM's public IP address
- **Port:** 22
- **Username:** azureuser
- **Password:** The password you set above

> **Security consideration:** Enabling password authentication on a public IP address allows brute-force login attempts. Use a strong, unique password. For production deployments, consider using Tailscale for private VPN access or configuring fail2ban for brute-force protection.

---

## Day-to-Day Operations

### Talking to Your Agent

Message your bot in Telegram. Conversations are natural language. The agent remembers context within a session if the session-memory hook is enabled.

### Updating OpenClaw

```bash
openclaw update
```

This pulls the latest stable release, syncs plugins, and restarts the gateway.

### Checking Service Status

```bash
openclaw gateway status
sudo systemctl status openclaw
```

### Viewing Logs

```bash
journalctl -u openclaw --since '1 hour ago'
```

### Updating Ubuntu

Run this weekly to keep your server patched:

```bash
sudo apt update && sudo apt upgrade -y
```

### Backing Up Configuration

```bash
openclaw backup create
```

---

## Cost Summary

| Item | Monthly Estimate |
|------|-----------------|
| Azure B2s VM (Ubuntu 24.04 LTS) | ~$30 |
| Anthropic API (Claude Sonnet 4.6) | ~$5 - $15 |
| Gemini API (Web Search) | ~$0 - $5 |
| **Total** | **~$35 - $50** |

Costs increase with image-intensive skills (DICOM interpretation, genomic analysis). See the [cost guide](cost-guide.md) for detailed breakdowns.

---

## Troubleshooting

### "UNPROTECTED PRIVATE KEY FILE" when connecting via SSH

The `.pem` file permissions are too open. Additional users or groups have read access. Run `icacls` on the file to check permissions, then remove all accounts except your own. See Step 2 for the complete commands.

### "Permission denied (publickey)" from a mobile SSH application

Azure VMs default to key-only authentication. Password authentication must be explicitly enabled in the cloud-init override files located in `/etc/ssh/sshd_config.d/`. See Step 10 for the specific files and commands.

### "EACCES: permission denied" when installing OpenClaw

The `sudo` prefix is missing. Run:

```bash
sudo npm install -g openclaw@latest
```

### "Failed to restart sshd.service: Unit sshd.service not found"

Ubuntu 24.04 uses `ssh` as the service name, not `sshd`. Run:

```bash
sudo systemctl restart ssh
```

### Agent stops responding after closing SSH

The daemon has not been installed. Run:

```bash
sudo openclaw daemon install
```

### Telegram bot responds with "access not configured" and a pairing code

The pairing has not been approved. Run the following command with your pairing code:

```bash
openclaw pairing approve telegram YOUR_PAIRING_CODE
```

### Terminal commands are being sent to the agent instead of the system

You are inside the OpenClaw TUI (the interactive chat interface). Press `Ctrl+C` or type `/exit` to return to the standard terminal prompt.

### SSH key permissions appear correct but connection still fails

Azure cloud-init creates override files in `/etc/ssh/sshd_config.d/` that take precedence over `/etc/ssh/sshd_config`. Check these files:

```bash
sudo grep -i "PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*
```

If any file in `sshd_config.d/` contains `PasswordAuthentication no`, it will override settings in the main config file.

---

## Quick Reference: Linux for Windows Administrators

| Concept | Windows | Linux (Ubuntu) |
|---------|---------|---------------|
| Run as administrator | Right-click, Run as Admin | `sudo command` |
| Install software | `winget install` / MSI | `sudo apt install package` |
| Update system | Windows Update | `sudo apt update && sudo apt upgrade` |
| Manage services | `services.msc` / `sc.exe` | `sudo systemctl status/start/stop service` |
| View service logs | Event Viewer | `journalctl -u servicename` |
| Remote access | RDP (`mstsc`) | SSH (`ssh user@ip`) |
| File permissions | NTFS ACLs / `icacls` | `chmod` / `chown` |
| Edit a text file | Notepad | `nano filename` |
| List files | `dir` | `ls -la` |
| File path format | `C:\Users\you` | `/home/you` |
| Background service | Windows Service (Automatic) | systemd daemon |
| Task scheduler | Task Scheduler | `cron` |

---

## Next Steps

With your agent running and accessible through Telegram, consider the following:

1. **Configure email integration** using the himalaya skill to enable forwarding laboratory results and health documents to your agent.
2. **Build custom health skills** for laboratory parsing, journaling, and biomarker tracking. See the [community skill ideas](community-skills.md) for inspiration.
3. **Set up scheduled tasks** using OpenClaw's cron system for daily check-ins, weekly research synthesis, and automated health summaries.
4. **Configure healthcare AI models** for medical image interpretation, laboratory report extraction, and medical speech recognition. Tula supports purpose-built healthcare models from Google (MedGemma, MedASR) and Microsoft (MedImageInsight, CXRReportGen). See the [model routing reference](model-routing.md) for configuration details.
5. **Review security hardening** including firewall configuration (`ufw`), fail2ban for brute-force protection, and Tailscale for private VPN access.

---

*This guide is maintained by the Tula community. If you encounter an issue not covered here, please [open an issue](../../issues) so we can improve the documentation for everyone.*
