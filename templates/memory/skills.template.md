# Workspace skills (mine)

<!--
L2 / load-on-demand. Catalog of skills authored specifically for this tenant's
job. Standard openclaw skills live at the runtime install path
(e.g. /usr/lib/node_modules/openclaw/skills/) and don't need an entry here.

Add one block per skill as it's built. Keep entries factual: what it does,
where it lives, when it was built, how it's triggered, and any boundaries it
enforces. Empty catalog is fine for a fresh tenant — fill it as you build.
-->

## How they fit together
<!-- Once there is more than one skill, describe the pipeline: which skill
     feeds which, and the shared boundaries they all enforce (e.g. no data
     egress, no diagnosis, no auto-send). Delete until relevant. -->

<!-- ===== PER-SKILL TEMPLATE — copy one block per skill =====

## `<skill-name>`
- **Purpose:** <one line>
- **Path:** <~/.openclaw/workspace/skills/<skill-name>/>
- **Emoji:** <optional>
- **Built:** <YYYY-MM-DD>
- **Triggers:** <what fires it>
- **Cache / output:** <where it reads/writes, if any>
- **Boundaries:** <what it will NOT do>
- **Validation / eval status:** <eval suite result + date, if run>

============================================================ -->

## Skill-authoring stack
<!--
If this tenant authors its own skills, document the toolchain here: where the
source of truth lives (git repo vs. deployed workspace), the house rules, the
reference/template skill, the eval framework and how to run it, and any
hard-won lessons (grader patterns that proved fragile, etc.). Delete this
section if the tenant only consumes off-the-shelf skills.
-->
