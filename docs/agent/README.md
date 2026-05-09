# Agent Workspace Templates

Templates for the persistent context files an OpenClaw agent uses on its
host. These are the same files that live in `~/.openclaw/workspace/` on a
deployed Tula agent. They are reproduced here as a starting point so anyone
deploying their own Tula instance has a sane baseline.

## What's here

| File | Role |
|---|---|
| [`AGENTS.md`](AGENTS.md) | The agent's playbook — memory rules, red lines, group-chat etiquette, heartbeat behavior |
| [`SOUL.md`](SOUL.md) | The agent's personality and values — non-sycophant, opinion-having, resourceful |
| [`IDENTITY.md`](IDENTITY.md) | The agent's name, vibe, and emoji — currently set to "Tula" |
| [`HEARTBEAT.md`](HEARTBEAT.md) | Empty-by-default file the agent edits to track recurring tasks |
| [`TOOLS.md.example`](TOOLS.md.example) | Template for environment-specific notes (cameras, SSH hosts, voice prefs) — copy to `TOOLS.md` and customize |

## How to use these

When you deploy your own Tula agent on an OpenClaw host:

```bash
cp docs/agent/AGENTS.md       ~/.openclaw/workspace/AGENTS.md
cp docs/agent/SOUL.md         ~/.openclaw/workspace/SOUL.md
cp docs/agent/IDENTITY.md     ~/.openclaw/workspace/IDENTITY.md
cp docs/agent/HEARTBEAT.md    ~/.openclaw/workspace/HEARTBEAT.md
cp docs/agent/TOOLS.md.example ~/.openclaw/workspace/TOOLS.md
```

Then edit each on the host to fit your setup.

You should also create (the agent expects them, but they are personal):

| File | Purpose |
|---|---|
| `~/.openclaw/workspace/USER.md` | About the human the agent helps — name, timezone, what to call them, context |
| `~/.openclaw/workspace/MEMORY.md` | The agent's curated long-term memory (only loaded in main session, never in shared contexts) |
| `~/.openclaw/workspace/memory/` | Daily files (`YYYY-MM-DD.md`) where the agent logs raw context |

These three are intentionally **not** in this repo because they contain
personal data.

## What `AGENTS.md` does

Worth reading even if you're not deploying — it's a useful pattern for any
long-running personal AI agent. Highlights:

- **Session startup ritual**: read `SOUL.md`, `USER.md`, today's `memory/`,
  and `MEMORY.md` (only in main session) before doing anything else.
- **MEMORY.md security model**: the agent's distilled long-term memory is
  loaded only in private chats — never in group/shared contexts where it
  could leak.
- **Write it down, no mental notes**: anything the agent should remember
  goes into a file. "Mental notes" don't survive session restarts; files do.
- **Group-chat etiquette**: clear guidance on when to speak vs. stay
  silent, when to react vs. reply, the "triple-tap" anti-pattern.
- **Heartbeat vs. cron**: when to use the agent's recurring `HEARTBEAT.md`
  vs. external cron jobs.
- **Red lines**: never exfiltrate private data, prefer `trash` over `rm`,
  ask before external actions.

## What `SOUL.md` does

The shorter, more philosophical companion to `AGENTS.md`. It defines:

- Genuinely helpful, not performatively helpful (skip the "Great question!"
  filler)
- Has opinions — the agent is allowed to disagree and prefer things
- Resourceful before asking — read the file, check context, then ask
- Respects intimacy — the agent is a guest in someone's life

## What `IDENTITY.md` does

A short identity card the agent reads at session start. Name, "creature"
(what kind of agent this is), vibe, emoji. Defaults are set for "Tula" but
swap freely — this is your agent.

## Provenance

These templates originated in the private operational backup of a deployed
Tula agent. They are reproduced here verbatim because they are general,
reusable patterns with no PII or operator state.

Personal files (`USER.md`, `MEMORY.md`, `memory/*.md`, `TOOLS.md` after
customization) stay on the agent host and never enter this repo.
