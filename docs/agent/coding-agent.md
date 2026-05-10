# Coding Agent — How Tula Writes Code

OpenClaw distinguishes two ways an agent like Tula can write code, and they
use different models. This doc explains both, and how to enable the
delegated path.

## Two paths

```
                         ┌──────────────────────────────────────┐
                         │ Tula (primary model: claude-opus-4-7) │
                         │  reads + plans + drafts              │
                         └──────────┬───────────────────────────┘
                                    │
                    ┌───────────────┼───────────────────────────┐
                    │                                            │
            ┌───────▼─────────┐                          ┌──────▼─────────────┐
            │ Path A          │                          │ Path B             │
            │ Direct edits    │                          │ coding-agent skill │
            │  (read/write/   │                          │  spawns specialist │
            │   edit/exec     │                          │  CLI for the work  │
            │   tools)        │                          │                    │
            └─────────────────┘                          └──────┬─────────────┘
                                                                │
                                            ┌───────────────────┼─────────┐
                                            │                   │         │
                                       Claude Code           Codex     OpenCode / Pi
                                      (Sonnet 4.6)         (gpt-5.5)
```

### Path A — Direct edits (always available)

Tula reads files, edits them, runs commands, and writes new files using
its built-in `read` / `edit` / `write` / `exec` tools. The model behind
those tool calls is **Tula's primary model** (`agents.defaults.model` in
`openclaw.json`, default `anthropic/claude-opus-4-7`).

Use this for: small fixes, single-file edits, configuration changes, doc
updates, anything that fits in a single agent turn.

### Path B — `coding-agent` skill (opt-in delegation)

OpenClaw ships a bundled skill called `coding-agent`. When invoked, it
spawns a separate, specialist coding CLI as a background process. The
spawned CLI does multi-file work — building features, refactoring, PR
review — using its own model and auth, then returns results to Tula.

Per the skill's own description, use this for:

- Building / creating new features or apps
- Reviewing PRs (spawn in temp dir)
- Refactoring large codebases
- Iterative coding that needs file exploration

Don't use it for: simple one-liner fixes, just reading code, or work in
the agent's own workspace.

## Supported delegate CLIs

| CLI | Auth | Default model | Best for | Plan needs |
|---|---|---|---|---|
| **Claude Code** (`claude`) | Anthropic OAuth | Claude Sonnet 4.6 | Smoothest if your agent already runs on Anthropic | Anthropic Pro / Max / API |
| **Codex** (`codex`) | ChatGPT OAuth or device-auth | GPT-5.5 | Strongest agentic coding benchmarks (May 2026) | ChatGPT Plus / Pro / Go (with device-auth allowed) |
| **OpenCode** (`opencode`) | Multi-provider (BYO) | User-configured | Power users wanting custom model routing | Whichever providers you wire up |
| **Pi** (`pi`) | Inflection | Pi | Niche; rarely used in coding flows | Pi account |

Coding-agent picks whichever delegate is installed. If multiple are
installed, openclaw selects per its internal preference order.

## Recommended setup for a Tula host

**Claude Code** is the path of least resistance for two reasons:

1. Your openclaw agent already authenticates to Anthropic — no new
   provider relationship to set up.
2. The Anthropic OAuth flow doesn't depend on a workspace policy that may
   block device-code authentication (a real problem with corporate
   ChatGPT accounts).

Sonnet 4.6 is genuinely excellent for coding (benchmark-competitive with
GPT-5.5 on most coding-focused evals). Use Opus 4.7 only if you find
Sonnet missing things on real tasks — switch with `/model` in the Claude
Code TUI, or pin in `~/.claude/settings.json`.

## Install

Use the included script:

```bash
ssh <your-openclaw-vm>
~/tula/scripts/install-coding-agent.sh                # installs Claude Code
~/tula/scripts/install-coding-agent.sh --cli codex    # OR install Codex instead
```

The script:

1. `sudo npm install -g` the chosen package
2. (Codex only) Drops `model = "gpt-5.5"` into `~/.codex/config.toml`
3. (Claude Code only) Merges `permissions.defaultMode: "bypassPermissions"`
   into `~/.claude/settings.json` so Claude Code can write files when
   spawned non-interactively (see "Headless permission gotcha" below)
4. Patches `~/.openclaw/openclaw.json`:
   `skills.entries.coding-agent.enabled = true` (with a backup first)
5. Verifies `openclaw skills list` shows `coding-agent ✓ ready`

## Log in (interactive — manual step)

The script doesn't log you in because OAuth flows are interactive.

### Claude Code

```bash
claude
# inside the TUI:
/login
# follow Anthropic OAuth in your browser, approve
/exit
```

### Codex

```bash
codex login --device-auth
# print a code + URL, open URL in browser, paste code, approve
```

If your ChatGPT account is in a workspace whose admin has disabled device
authentication, you'll see:

> Please contact your workspace admin to enable device code authentication

Pick **Personal account** on the OAuth screen instead, or use Claude Code.

## Verify end-to-end

```bash
openclaw skills list | grep coding-agent
# expected: ✓ ready  🧩 coding-agent
```

Then have Tula attempt a multi-file change. A good smoke-test prompt:

> Build a small Node.js CLI in `~/scratch/coding-agent-smoke/` that
> takes a number from argv and prints whether it's prime, a Fibonacci
> number, or both. 3 files plus a README. Test with 13.

Verify on the VM:

```bash
ls -la ~/scratch/coding-agent-smoke/
node ~/scratch/coding-agent-smoke/cli.mjs 13
# expected: 13 is prime and a Fibonacci number.
```

The agent should invoke the coding-agent skill, which spawns the chosen
CLI in the background. Watch for "delegating", "spawning", or skill
invocation language in the agent's response.

## Headless permission gotcha (Claude Code)

When OpenClaw spawns Claude Code as a delegate, Claude Code runs with
no TTY. Its default permission mode shows an interactive prompt before
writing any file, which there's no way to answer headlessly — so it
silently refuses to act. Symptom: the agent reports it delegated, the
target directory ends up empty, and you'll see something like
*"failed to create the app due to permission prompt unavailable in
interactive mode"*.

Fix: configure Claude Code to bypass permissions by default in
`~/.claude/settings.json`:

```json
{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "skipDangerousModePermissionPrompt": true
  }
}
```

`install-coding-agent.sh` writes this for you when you install Claude
Code. If you installed Claude Code manually, run the script with
`--no-enable` to apply just the settings change without re-touching
`openclaw.json`.

Per-project deny rules in `permissions.deny` still take precedence over
`bypassPermissions`, so you can scope sensitive paths off-limits while
keeping the rest open.

## Troubleshooting

### `command not found` for `claude` / `codex` after install

Your interactive shell PATH is broken. Fix with:

```bash
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/bin
```

If this happens repeatedly, check the tail of `~/.bashrc` for a corrupt
`export PATH=...` line — particularly one that contains a Windows-style
path like `C:\Users\...`. That's a sign someone ran `ssh "<command using
$HOME>"` from PowerShell where `$HOME` resolved on the *Windows* side
instead of being passed through to bash.

### OAuth callback "state mismatch" or "invalid_state" with Codex

The localhost-callback OAuth flow over an SSH tunnel is fragile. Use
device-auth instead:

```bash
codex login --device-auth
```

### Workspace admin blocks device authentication

The corporate ChatGPT workspace policy disables device-auth. Either:

- Sign in with a **personal** ChatGPT account on the OAuth screen
- Ask the workspace admin to enable device authentication
- Use Claude Code instead

### `coding-agent` shows `△ needs setup` instead of `✓ ready`

Either:

- No delegate CLI is installed yet — re-run `install-coding-agent.sh`
- The skill isn't enabled in `openclaw.json` — re-run the script (it's
  idempotent)
- A required binary isn't on the PATH that openclaw sees — check with
  `bash -l -c 'command -v claude codex'`

### Agent says it delegated but target directory is empty

Claude Code is failing silently on its permission prompt. See the
"Headless permission gotcha" section above. Fix:

```bash
~/tula/scripts/install-coding-agent.sh --no-enable
# this re-runs only the settings patch, doesn't touch openclaw.json
```

Then ask the agent to retry.

## Reference

- [OpenClaw skill spec](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md)
- [Claude Code docs](https://docs.anthropic.com/en/docs/agents/claude-code)
- [Codex CLI docs](https://developers.openai.com/codex)
