# Examples

Four realistic outputs covering the common cases. All examples use the
synthetic user persona "Dylan Meyer" (`@dylanmeyer`, he/him, age 51) -
fictional user with a professional interest in clinical AI and
health-data interoperability. Safe to publish and reuse in eval fixtures.

## Daily pulse (mixed feeds, normal volume)

Input: `Run myhealth-pulse`

Profile resolved from `~/.openclaw/workspace/memory/profile.yaml`. Both
`social-x` and `web-brave` adapters available.

```
**Why USCDI v4 is the quiet inflection point for clinical AI** - source: web-brave · score: 88
https://www.healthcareitnews.com/news/uscdi-v4-clinical-ai-inflection
Aligns with Dylan's interop + AI thesis - v4 finally adds the data
classes ambient AI vendors have been faking with custom mappings.

**.@dylanmeyer thread on FHIR-to-LLM round-trip grounding** - source: social-x · score: 84
https://x.com/dylanmeyer/status/...
Direct mention of Dylan; thread argues the bottleneck is no longer
extraction but bidirectional grounding. Worth a quote-RT.

**STAT: ambient documentation vendors add SMART on FHIR write-back** - source: web-brave · score: 76
https://www.statnews.com/...
Hits two primary topics (clinical workflows + SMART on FHIR). One to
watch for next week's pulse.

Powered by myhealth-pulse - feeds: social-x, web-brave
```

## Mention-driven alert (mention-only query)

Input: `Any mentions of me in clinical AI discussions today?`

```
**@drnatasha replying to @dylanmeyer on FHIR consent UX** - source: social-x · score: 92
https://x.com/drnatasha/status/...
Direct reply on a thread Dylan started Tuesday. Pushes back on the
"consent-by-context" framing - worth engaging.

**HIStalk roundup quotes Dylan Meyer on USCDI v4** - source: web-brave · score: 86
https://histalk2.com/...
First HIStalk pickup this quarter. Authority source, primary topic.

Powered by myhealth-pulse - feeds: social-x, web-brave
```

## Low-signal day

Input: `Run myhealth-pulse`

```
Quiet period in your feeds - nothing above the relevance threshold in
the last 24h.

Consider enabling `news-pubmed` - there's steady literature on your
primary topics that the social and web adapters miss. See
references/feeds.md.

Powered by myhealth-pulse - feeds: social-x, web-brave
```

## Partial run (one adapter unavailable)

Input: `Run myhealth-pulse`, `BRAVE_API_KEY` not set in the environment.

```
**.@dylanmeyer thread on FHIR-to-LLM round-trip grounding** - source: social-x · score: 84
https://x.com/dylanmeyer/status/...
Direct mention of Dylan; one item from the social side only.

Powered by myhealth-pulse - feeds: social-x (unavailable: web-brave)
```
