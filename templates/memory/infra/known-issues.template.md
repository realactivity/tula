# Known infra issues (with fixes)

_Things that go wrong on this VM. If symptoms match, apply the fix and move on._

<!--
L2 / load-on-demand. The difference between this file and parked-bugs.md:
parked bugs are UNSOLVED (need a fix); known issues are SOLVED and RECURRING
(here's the recipe when it happens again). When a parked bug gets a reliable
fix recipe, it graduates here. One block per issue.
-->

<!-- ===== PER-ISSUE TEMPLATE - copy one block per recurring issue =====

## <Short symptom headline>
- **Symptom:** <what the user/agent observes>
- **Cause:** <the underlying reason>
- **Fix:**
  ```bash
  <exact commands>
  ```
- **Full notes:** <pointer to the daily note where this was first diagnosed>

============================================================ -->

## Gateway restart kills the session (platform note)
- **Symptom:** Running `openclaw gateway restart` mid-conversation SIGTERMs the agent's exec context; the tool result vanishes.
- **Cause:** Expected - the restart tears down the runtime hosting the agent.
- **Fix:** Just continue after the restart. Gateway comes back in <10s. Verify with `openclaw status` next turn.

## Plugin install footgun (platform note)
- **Symptom:** `openclaw plugins install <name>` fails with a config-validator error referencing `tools.web.search.provider`.
- **Cause:** The installer rewrites `openclaw.json`; the validator blocks the install if the search provider references a plugin not yet installed.
- **Fix:** Keep `tools.web.search.provider` on a working value during install, then flip after. The installer auto-creates a `.bak`.

## Config writes trigger "deferred reload" (platform note)
- **Symptom:** Gateway logs `config change detected; evaluating reload (...)` then `restart still deferred after Nms with M operation(s)...`.
- **Cause:** The runtime defers config reloads while an agent run is in flight; if it never gets a quiet moment, the change doesn't apply.
- **Fix:** Restart the gateway during an idle moment, or wait for natural quiet.

<!-- Tenant-specific recurring issues (e.g. a bot crash-loop with a known
     symlink fix) go below as you discover them. -->
