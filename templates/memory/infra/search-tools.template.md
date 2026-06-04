# Web & social search tools

<!--
L2 / load-on-demand. Which search providers are configured and how they're
wired. Fill in per tenant. The config-key paths below are openclaw-platform
locations and hold across tenants; the keys themselves live in openclaw.json
(NOT backed up) and must never be written here.
-->

## General web - `web_search`
- **Provider:** <e.g. Brave Search API via @openclaw/brave-plugin>
- **Configured:** <YYYY-MM-DD>
- **Key location:** `plugins.entries.<provider>.config.webSearch.apiKey` (in openclaw.json - not in this file, not in backup)
- **Provider selector:** `tools.web.search.provider = "<provider>"`
- **Notes:** <typical latency, whether it returns real URLs vs. synthesis, useful filters, any fallback provider configured>

## Social / X - `x_search`
- **Provider:** <e.g. xAI Grok>
- **Configured:** <YYYY-MM-DD>
- **Key location:** `plugins.entries.<provider>.config.webSearch.apiKey`
- **Tool config:** `plugins.entries.<provider>.config.xSearch.enabled = true`
- **Parameters:** `query`, `allowed_x_handles`, `excluded_x_handles`, `from_date`, `to_date`, and media-understanding flags.
- **Notes:** <latency, whether it returns citations, any identity-binding gotchas - see parked-bugs.md if relevant>

## Installer footgun (platform note)
`openclaw plugins install` rewrites `openclaw.json`, and the config validator blocks the install if `tools.web.search.provider` references a plugin that isn't installed yet. **Workaround:** keep the provider on a working value during install, then flip it after. The installer auto-creates a `.bak` of the pre-install config.

## Gateway-restart gotcha (platform note)
Running `openclaw gateway restart` mid-conversation SIGTERMs the agent's own exec context. The restart still succeeds (verify via status next turn). Don't panic when the tool result vanishes - the gateway is back in <10s.
