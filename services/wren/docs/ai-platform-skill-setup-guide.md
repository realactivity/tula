# Using the Health Record Assistant — Setup Guide

This skill lets AI connect to your patient portal, fetch your health records,
and analyze them — all end-to-end encrypted. Setup depends on which AI tool
you're using.

There are two skill variants:
- **Agent skill** — Claude/Codex runs scripts that connect live to your patient portal
- **Local skill** — Your health data is already bundled in the download (no network needed)

---

## Claude Code (CLI)

Claude Code runs as a local process with full network access. The agent skill's
scripts work out of the box.

### Setup

1. Install [Bun](https://bun.sh) if you don't have it:
   ```
   curl -fsSL https://bun.sh/install | bash
   ```
2. Download and unzip the skill:
   ```
   curl -O https://health-skillz.joshuamandel.com/skill.zip
   unzip skill.zip
   ```
3. Start Claude Code inside the skill folder:
   ```
   cd health-record-assistant
   claude
   ```
4. Ask about your health records. Claude will run the scripts automatically —
   create a session, show you a link to sign into your patient portal,
   then decrypt and analyze your data.

**No special settings needed.** Network access is allowed by default.

---

## Codex CLI

OpenAI's Codex CLI is similar to Claude Code — a terminal-based coding agent
with shell access.

### Setup

1. Install Bun (same as above)
2. Download and unzip the skill
3. Run Codex in the skill folder:
   ```
   cd health-record-assistant
   codex
   ```
4. Paste the contents of `SKILL.md` as your initial prompt, or tell Codex to
   read it:
   > Read SKILL.md and help me connect my health records.

Codex CLI can run the same `bun scripts/create-session.ts` and
`bun scripts/finalize-session.ts` scripts. It has full network access by
default.

**Note:** Codex CLI doesn't have a native "skill" concept — you're essentially
giving it the instructions and scripts as context. The SKILL.md file tells it
what to do.

---

## Claude.ai Web (Cowork UI)

Claude.ai supports uploading Skills as zip files. The agent skill needs
network access, which is **off by default** — you must enable it.

### Setup

1. Go to [claude.ai](https://claude.ai)
2. **Install the skill:**
   - Click your profile icon (bottom-left) → **Settings**
   - Go to **Profile** → **Claude Skills**
   - Click **Add Skill** and upload `skill.zip`
3. **Enable network access** (required for the agent skill):
   - In Settings, go to **Profile** → **Analysis tool**
   - Toggle ON: **"Allow connections to outside services"**
   - Without this, the sandbox blocks all HTTP requests and the scripts will
     fail with network errors
4. Start a new conversation and ask about your health records.

### If you prefer no network access (local skill)

Use the web app to collect your records first, then download a skill zip
with your data bundled in:

1. Go to the Health Record Assistant web app → **My Health Records**
2. Connect your patient portals and collect data
3. Download the **skill zip with data** included
4. Upload that zip to Claude Skills (step 2 above)
5. No need to enable network access — the data is already in the zip

---

## Codex App (Web UI)

OpenAI's Codex app is a web-based coding agent with a cloud sandbox.

### Setup

1. Go to [chatgpt.com/codex](https://chatgpt.com/codex) (or the Codex app)
2. Create a new task
3. Upload `skill.zip` or the individual files from the skill as project files
4. In your prompt, tell Codex to read `SKILL.md` and follow the instructions
5. Codex's cloud sandbox can run Bun and make HTTP requests — the scripts
   should work as-is

**Note:** Codex runs in a cloud VM, not locally. Check that Bun is available in
the sandbox (it may need `curl -fsSL https://bun.sh/install | bash` first).
Network access to external services should be available by default.

---

## Quick Reference

| Platform | Skill type | Network setup needed? | How to load skill |
|---|---|---|---|
| Claude Code (CLI) | Agent | No — allowed by default | `unzip skill.zip && cd health-record-assistant` |
| Codex CLI | Agent | No — allowed by default | Unzip, run codex in that folder |
| Claude.ai (Cowork) | Agent | **Yes** — Settings → Profile → Analysis tool → "Allow connections to outside services" | Settings → Profile → Claude Skills → Add Skill |
| Claude.ai (Cowork) | Local | No | Same upload, but use the data-bundled zip |
| Codex App | Agent | No — sandbox has network | Upload files to project |

---

## Troubleshooting

**"Network error" or "fetch failed" in Claude.ai:**
You forgot to enable external connections. Go to **Settings → Profile → Analysis tool** and turn on **"Allow connections to outside services"**.

**"Bun not found":**
Install Bun first: `curl -fsSL https://bun.sh/install | bash`

**Scripts time out / hang on "polling":**
Make sure you completed sign-in at the link the AI showed you, selected records, and clicked **"Send ... to AI"** on the session page.

**Skill doesn't appear after upload in Claude.ai:**
The zip must contain a folder with a `SKILL.md` at the top level (e.g. `health-record-assistant/SKILL.md`). Re-download if needed.
