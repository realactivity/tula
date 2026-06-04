# Voice (TTS)

<!--
L2 / load-on-demand. Text-to-speech provider and voice config. Fill in per
tenant once voice is set up; delete the body and say "no TTS configured" if
it isn't.
-->

- **Configured:** <YYYY-MM-DD>
- **Provider:** <e.g. Microsoft Edge neural TTS via node-edge-tts — no API key, $0>
- **Voice:** <voice id> <!-- choose one that matches {{AGENT_NAME}}'s persona -->
- **Mode:** <e.g. auto: "inbound" — user speaks, agent speaks; user types, agent types. No voice-spam on routine work.>
- **Output format:** <e.g. audio-24khz-48kbitrate-mono-mp3 — delivered as a native voice note on the messaging channel>
- **Config location:** `messages.tts.*` in `~/.openclaw/openclaw.json`
- **Slash commands:** `/tts status`, `/tts audio <text>`, `/tts off`

## Upgrade path (if quality matters)
<!-- List paid/higher-quality options the tenant could move to (voice cloning,
     native Opus, etc.) so the choice is documented, not re-litigated. -->

## Gotcha (platform note)
Editing the `messages` block in `openclaw.json`: add to the EXISTING `messages` block, don't create a second one — two `messages` blocks collapse to invalid config. Config writes may log `config change detected; evaluating reload (messages.tts)` and defer the actual reload until the session quiets (same deferred-reload pattern noted in known-issues.md).
