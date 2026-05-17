# Voice Integration

How to give your Tula agent a phone number. The agent picks up, knows
your records, and can carry a conversation.

This document captures the architecture, setup path, costs, and known
limitations of OpenClaw's first-party voice integration as of 2026.
The hospital-scale, multi-tenant, HIPAA-governed counterpart lives in
Aria and is documented separately in that private repo.

## Why this exists

Tula already gives you an AI that knows your chart, your labs, your
recent imaging, your medication history, your visits with your PCP,
and your longitudinal trends. Today you reach that agent through
Telegram or a chat interface. That's fine when you're at a screen.

The voice integration extends the same agent to a phone number you
own. You call it. It answers. You ask "what's my A1c trending?" or
"draft a message to my PCP about the BP readings this week" hands-free
while you're driving, walking, or making dinner. The agent has all the
same context it has in chat (workspace memory, FHIR cache, recent
PDFs); the only difference is the transport.

Every existing patient-facing voice AI product in the market in 2026
is built for a hospital or payer to deploy at scale to serve their
populations. None of them are designed for a single patient to deploy
themselves against their own records. The voice integration closes
that gap for personal Tula.

## What OpenClaw provides

OpenClaw shipped the [`@openclaw/voice-call`](https://docs.openclaw.ai/plugins/voice-call)
plugin in version `2026.4.24`. It is the first-party voice transport
and supports Twilio, Telnyx, Plivo, and a `mock` provider for local
development.

Capabilities (per the upstream docs):

- Outbound notifications (the agent calls you)
- Multi-turn conversations (you call the agent)
- Full-duplex realtime voice via Gemini Live (bidirectional audio with
  function-call support)
- Streaming transcription as an alternative when realtime is not
  desired (STT through OpenAI, Deepgram, etc., then TTS back)
- Inbound calls with allowlist policies
- `openclaw_agent_consult` tool, which lets the voice model escalate
  to the full OpenClaw agent for queries that need deeper reasoning,
  then return to voice with the result

The plugin runs inside the OpenClaw Gateway process. If you run a
remote Gateway, install and configure on the Gateway host and restart.

## Architecture

```
+----------+    PSTN     +---------+   webhook   +---------------+   tool calls   +-------------+
|  Caller  | <---------> | Twilio  | <---------> |   OpenClaw    | <------------> | Tula skills |
+----------+             +---------+  Media       |   Gateway     |   (FHIR,       +-------------+
                                     Streams      | (voice-call   |    PDFs,
                                     (WSS)        |   plugin)     |    pulse,
                                                  +---------------+    memory)
```

What flows where:

- Carrier-side: Twilio handles the PSTN leg, places or receives the
  call, manages TwiML, and opens a Media Streams WebSocket back to
  the OpenClaw Gateway with raw audio frames.
- Gateway-side: the `voice-call` plugin terminates the WebSocket,
  pipes audio to either Gemini Live (realtime mode) or an STT/LLM/TTS
  pipeline (streaming mode), and routes function-calls to the agent.
- Skill-side: when the conversation needs facts the voice model does
  not carry in its short-term context (recent labs, a pulse digest,
  what changed since the last visit), the `openclaw_agent_consult`
  tool delegates to the full Tula agent, which invokes the relevant
  skill, and the answer comes back into the voice loop.

Two important consequences of this architecture:

1. **Voice runs on a different model than the rest of Tula.** Real-time
   bidirectional voice needs a model built for it (Gemini Live is the
   bundled default). Your everyday chat agent (Claude Sonnet 4.6 or
   whatever you have configured via copilot-sdk) is reached as a tool
   from inside the voice loop, not as the primary voice brain.
2. **Skills designed for chat may need tweaks for voice.** A digest
   that renders as a markdown table is unreadable when spoken. A
   skill that returns ten ranked items is too much for a voice reply.
   Voice-aware skill output is shorter, sequential, and assumes the
   listener will ask follow-up questions rather than scan a screen.

## Setup walkthrough

This is the personal-deployment path. Hospital-scale multi-tenant
voice routing is an Aria concern; see that repo for that path.

### Prerequisites

- A working Tula deployment (the [deployment guide](deployment-guide.md)).
- A Twilio account with a verified phone number you own.
  ([twilio.com](https://www.twilio.com/), local US phone numbers are
  about $1/month plus per-minute usage.)
- A publicly reachable webhook URL for OpenClaw's Gateway. Three
  common options:
  - A stable domain you own pointed at the Gateway host
  - [Tailscale Funnel](https://tailscale.com/kb/1223/tailscale-funnel) routing a public URL into the Gateway
  - [ngrok](https://ngrok.com/) for development (pin the exact URL
    in `publicUrl` so signature verification works)
- A model API key for the voice loop. Gemini Live requires a Google
  AI Studio API key; the streaming-mode alternative wants OpenAI or
  Deepgram for STT and a TTS provider key.

### Install the plugin

```bash
ssh ra-agent01
openclaw plugins install @openclaw/voice-call
# restart the Gateway so the plugin loads
sudo systemctl restart openclaw     # or however your Gateway is supervised
```

### Configure provider

In `~/.openclaw/openclaw.json`, add a `voice-call` entry under
`plugins.entries`. Minimum shape for Twilio:

```json5
{
  plugins: {
    entries: {
      "voice-call": {
        enabled: true,
        config: {
          provider: "twilio",
          fromNumber: "+15550001234",   // your Twilio number
          sessionScope: "per-phone",
          twilio: {
            accountSid: "ACxxxxxxxx",
            authToken: { source: "env", id: "TWILIO_AUTH_TOKEN" },
          },
          serve: {
            port: 3334,
            path: "/voice/webhook",
          },
          publicUrl: "https://your-stable-domain.example/voice/webhook",
          outbound: { defaultMode: "conversation" },
          realtime: { enabled: true },
          numbers: {
            "+15550001234": {
              inboundGreeting: "Hi Paul. What do you want to look at?",
              responseSystemPrompt: "You are Paul's personal health agent. Keep voice replies short and conversational. For anything that needs records, lab values, or recent context, use openclaw_agent_consult.",
            },
          },
        },
      },
    },
  },
}
```

See the [upstream docs](https://docs.openclaw.ai/plugins/voice-call#configuration)
for the full schema and every option.

### Verify

```bash
openclaw voicecall setup     # validates config, webhook reachability, missing keys
openclaw voicecall smoke     # dry-run, no actual call
openclaw voicecall smoke --to "+1yourcell" --yes   # actual short outbound notify
```

If setup fails on a private webhook URL, the plugin refuses to start
the provider rather than silently accepting carrier traffic it cannot
route. Fix the public URL and re-run.

### Wire inbound

In the Twilio console, point your number's "A CALL COMES IN" webhook
to `https://your-stable-domain.example/voice/webhook` (or whichever
path you set). Save. Call your number. The agent should greet you per
the `inboundGreeting` and accept questions.

## Cost and latency

**Cost (single-user, US).** Twilio inbound local minutes are around
$0.0085/minute. Outbound is similar plus per-second. Realtime audio
over Media Streams adds streaming-cost cents per minute. Add the
voice-loop LLM (Gemini Live or your STT/LLM/TTS stack). A heavy
personal user at 30 minutes/day lands in the $30-60/month range on
top of the $30/month Tula VM. Light use (a few minutes a day) is
under $10.

**Latency.** Realtime mode targets sub-second turn-taking. The
critical path is: caller speaks > Twilio Media Streams forwards
audio frames > Gemini Live processes > response audio frames return >
Twilio plays. Tool calls (via `openclaw_agent_consult` into the
full agent and a Tula skill) add the agent's own model latency to
that call's response time, so design skill responses to be terse
and acceptable to play back without a long pause.

**Cost of bad design.** A voice loop that calls `openclaw_agent_consult`
for every utterance, where each consult bills against a premium
Copilot quota, exhausts that quota fast. Design the voice prompt and
the consult-tool description so the voice model only escalates when
it genuinely needs records or memory it does not carry.

## Known limitations

The `@openclaw/voice-call` plugin is new (April 2026) and has open
issues that anyone deploying it should know about:

- [openclaw/openclaw#8276](https://github.com/openclaw/openclaw/issues/8276)
  describes outbound calls returning empty TwiML and disconnecting
  immediately.
- [openclaw/openclaw#11554](https://github.com/openclaw/openclaw/issues/11554)
  lists multiple critical issues, including stream token validation
  failures blocking inbound calls and call-state cleanup failures
  causing "maximum concurrent calls" errors.
- Some of these are closed as `not_planned` upstream. Expect to
  either patch the plugin yourself or wait for the next major
  release before relying on it for anything beyond personal
  experimentation.

If you patch the plugin, upstream the fix.

## Skill design for voice

A few rules of thumb when designing or modifying a Tula skill so it
behaves well when consulted from a voice loop:

- Keep the primary spoken response to one or two sentences. Anything
  longer should be offered with a "want me to keep going?" handoff.
- Avoid tables, dense bullets, and long URLs in voice-targeted
  outputs. The voice model will try to read them and it will not
  sound good.
- Prefer "the last reading was X on Y" over "your trend shows a
  multi-data-point pattern with values of A, B, C, D, E."
- If a skill normally produces structured output (`med-pdf` JSON,
  `myhealth-pulse` digest), provide a voice-friendly summarizer
  inside the skill or alongside it.
- Refusal behavior in voice should be just as firm as in chat. Voice
  callers are not entitled to clinical advice, and the agent should
  state that directly when asked.

The existing skills will work as-is via `openclaw_agent_consult`,
but the spoken result will be a transcript of the markdown they
return. Iterate on per-skill voice prompts as you use the feature.

## Privacy and HIPAA

For a single user deploying Tula for themselves, HIPAA does not
apply. You are not a covered entity managing other people's protected
health information. The voice loop talks about your records to you
on your phone using your number.

For an organization (a clinic, a health system, a payer) deploying
voice-mediated AI to serve patients, the picture changes
substantially. Twilio's [ConversationRelay product became HIPAA-
eligible in March 2025](https://www.twilio.com/en-us/changelog/conversationrelay-is-now-hipaa-eligible),
which is the path organizations should take. The OpenClaw
`voice-call` plugin currently uses the older Programmable Voice +
Media Streams pattern, not ConversationRelay directly, so an
organization adopting voice at scale today either contributes a
ConversationRelay backend to the plugin or builds the integration
themselves.

This is one of the seams between Tula (personal scale, no HIPAA
exposure) and Aria (hospital scale, full HIPAA / BAA chain). Aria
documents the multi-tenant voice path separately, including how
voice-mediated agent actions feed the governance score.

## What we want for a second-generation voice integration

Capturing the wishlist so it survives across sessions:

- A **ConversationRelay backend** for the `voice-call` plugin, so the
  HIPAA-eligible Twilio path is first-class.
- **Better caller-identity binding** so an inbound call from a known
  number resumes the existing per-phone session even after the
  plugin or the Gateway restarts.
- **Per-skill voice-friendly summarizers**, registered the same way
  skills register chat output, so the voice loop can ask "give me
  the voice version of `med-pdf`'s output" rather than reading the
  full structured response.
- **Refusal calibration metrics** for voice, separate from chat, so
  governance can track whether the agent over-refuses or
  under-refuses on the voice channel specifically.
- **Audit emission for every voice turn** with the same shape as
  chat, so a downstream governance layer can compute audit
  completeness regardless of channel.

The first item benefits anyone deploying voice. The other four are
mostly in scope for Aria's governance work but originate in skill
authoring conventions that belong here.

## See also

- [`@openclaw/voice-call` plugin docs](https://docs.openclaw.ai/plugins/voice-call)
- [Twilio ConversationRelay docs](https://www.twilio.com/docs/voice/conversationrelay)
- [Tula deployment guide](deployment-guide.md)
- [Tula cost guide](cost-guide.md)
- [`OPEN_CORE.md`](../OPEN_CORE.md) for the Tula/Aria split as it applies to voice
