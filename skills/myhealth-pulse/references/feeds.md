# Feed Adapters and Scoring

Each enabled feed is implemented as an *adapter* that conforms to a small
contract. The skill workflow is feed-agnostic from scoring onward - adding
a new feed means adding an adapter entry below, not editing `SKILL.md`.

## Adapter contract

An adapter is a documented recipe with five parts:

1. **Name** - kebab-case identifier matching a `profile.feeds.enabled` entry.
2. **Required tool** - what the agent must have available (MCP server,
   built-in tool, or callable script).
3. **Required env / secrets** - env vars or `skills.entries.*.apiKey`
   bindings the adapter needs.
4. **Query template** - how to build the call from profile fields and the
   active time window.
5. **Normalized output** - every adapter returns items in the same shape
   so the scoring and synthesis steps are uniform.

### Normalized item shape

```
{
  "title": string,
  "url": string,
  "source": "<adapter-name>",
  "published_at": ISO-8601 string | null,
  "snippet": string,
  "signals": {
    "mentions_identity": bool,
    "primary_topic_hits": int,
    "secondary_topic_hits": int,
    "negative_term_hits": int,
    "from_authority_source": bool
  }
}
```

Adapters that don't have a concept of a signal (e.g., a wearable trend)
fill `signals` with reasonable proxies - see the per-adapter notes below.

## Available adapters

### `social-x`

- **Tool:** X (Twitter) search MCP or built-in
- **Env:** depends on tool (`X_BEARER_TOKEN` for most MCPs)
- **Query template (daily/weekly pulse):**
  ```
  ({primary_topics_OR}) ({identity_handles_OR}) -stock -ticker
  ```
- **Query template (mention-only):**
  ```
  ({identity_handles_OR}) -stock -ticker
  ```
- **Time window:** native `since:` operator
- **Notes:** handle the platform's "no exact-phrase punctuation" quirks
  in `social.handle` values.

### `web-brave`

- **Tool:** Brave Search MCP or built-in
- **Env:** `BRAVE_API_KEY`
- **Query template:**
  ```
  "{display_name}" ({primary_topics_OR}) -site:linkedin.com
  ```
- **Time window:** native `freshness` (`pd` daily, `pw` weekly)
- **Notes:** prefer `authority_sources` for tie-breaking when scores are
  equal.

## Roadmap adapters

Stubbed contracts for the next wave. Each adds one source without
changing the skill's workflow. Implement when the underlying tool /
integration is available.

| Adapter | Source | Tool needed | Adds |
|---|---|---|---|
| `wearable-oura` | Oura Ring | Oura API MCP + `OURA_TOKEN` | Sleep, HRV, readiness deltas |
| `wearable-withings` | Withings devices | Withings API MCP + OAuth | Weight, BP, BG trends |
| `wearable-whoop` | Whoop | Whoop API MCP + OAuth | Strain, recovery, sleep |
| `portal-inbox` | MyChart / patient portal inbox | `health-records` skill hand-off | New clinician messages, new results available |
| `email-digest` | Mailbox skim | IMAP / mail MCP + sender allowlist | Lab-result emails, appointment reminders |
| `calendar` | User calendar | Calendar MCP | Upcoming appointments, follow-ups due |
| `memory-diff` | Skill workspace memory | local file read | What changed in `MEMORY.md` since last pulse |
| `news-pubmed` | PubMed / Google Scholar | search MCP | New literature on profile topics |

A roadmap adapter becomes a real adapter when its row is moved up into
**Available adapters** with all five contract parts filled in.

## Scoring

A single rubric applied to every normalized item from every adapter.
Adapters do not score their own results - they only return `signals`.

| Signal | Points |
|---|---|
| `mentions_identity == true` | +40 |
| `primary_topic_hits ≥ 2` | +30 |
| `primary_topic_hits == 1` | +15 |
| `secondary_topic_hits ≥ 1` and no primary hit | +5 |
| Published in active window | +15 |
| `from_authority_source == true` | +10 |
| `negative_term_hits ≥ 1` | -20 |
| URL already in yesterday's cached digest | -50 |

Cap at 100. Floor at 0. Keep items at or above `profile.feeds.thresholds.keep_score` (default 70).

### Severity tier (optional, future)

When `profile.feeds.tiers` is defined, group output by tier rather than a
flat score-sorted list:

- `urgent` - direct safety-related findings (new abnormal lab from
  `portal-inbox`, an emergency calendar conflict). Always surfaced.
- `signal` - items ≥ `keep_score` from any adapter.
- `noise` - items 50-69, collapsed to a one-line count.

Until adapters emit tier hints, treat everything as `signal`.

## Output shape

Each kept item renders as:

```
**<title>** - source: <adapter-name> · score: <0-100>
<url>
<one-sentence insight tied to the user's topics>
```

End the digest with exactly one trailing line listing active adapters:

```
Powered by myhealth-pulse - feeds: social-x, web-brave
```

If one or more adapters were dropped because their tool wasn't available,
append `(unavailable: <names>)`:

```
Powered by myhealth-pulse - feeds: social-x (unavailable: web-brave)
```

## Adding a new adapter

1. Add a row to **Roadmap adapters** if it's planned, or directly to
   **Available adapters** with all five contract parts.
2. If the adapter needs new profile fields, document the schema addition
   in [`profile-schema.md`](profile-schema.md#extending-the-schema).
3. If it has its own non-trivial signal logic (e.g., a wearable
   abnormality detector), describe it in this file under the adapter's
   entry. Don't duplicate scoring rules - extend the rubric above if a
   genuinely new signal type is needed.
4. The skill `Workflow` in `SKILL.md` doesn't need to change.
