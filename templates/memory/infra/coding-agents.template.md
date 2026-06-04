# Coding agents available

<!--
L2 / load-on-demand. Which coding agents are wired up on this host, how to
spawn each, and which ones DON'T work (so you don't promise them). The notes
below capture openclaw-platform knowledge that holds across tenants; fill in
the tenant-specific status (versions, verified dates) as you confirm them.
Mark each agent working / not-working with the date you last verified.
-->

## <Agent name, e.g. Claude Code> (status: <working / not available>)
- **Harness:** <how it's wired, e.g. ACP harness on this host>
- **Binary:** <path, e.g. /usr/bin/claude> - version <fill in>
- **Spawn:** `sessions_spawn` with `runtime: "acp"` and the correct `agentId`.
  <!-- Platform gotcha worth keeping: the agentId is often NOT the human name.
       Record the exact working value here once verified - a wrong agentId
       fails with spawn_failed. -->
- **When to use:** real agentic coding tasks (multi-file builds, refactors,
  longer autonomous work). Don't delegate trivial edits - the agent's own
  read/write/edit/exec tools handle those.
- **Last verified:** <YYYY-MM-DD>

### Permission config (platform note)
<!--
For headless file writes through the ACPX plugin, the harness typically needs
permissive tool-approval settings in openclaw.json under
plugins.entries.acpx.config (e.g. permissionMode: "approve-all",
nonInteractivePermissions: "deny"). Without it, writes hang on a permission
prompt that can't be answered non-interactively. "approve-all" is flagged
dangerous because it auto-approves every tool call - decide per tenant whether
that's acceptable scoped to this VM. Always keep a .bak of openclaw.json before
editing. Record the exact working config here once confirmed.
-->

### This agent's own workspace
<!-- A spawned coding agent may boot into its own subdirectory with its OWN
     AGENTS.md (e.g. ~/.openclaw/workspace/claude/). Don't confuse the host
     agent's AGENTS.md with the coding agent's. Note the path here. -->

## Agents that are NOT available
<!-- List any coding agent that has been tried and does NOT work, with the
     failure mode, so future-you doesn't promise it. e.g. "Codex: ACP spawn
     returns 'Could not initialize ACP session runtime'; no binary on PATH." -->

## Host agent's own tools (always available)
- `read`, `write`, `edit`, `exec` - for quick code changes, file ops, shell commands. No need to delegate trivial edits.
