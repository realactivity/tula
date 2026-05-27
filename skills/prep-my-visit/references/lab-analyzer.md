# Pre-visit lab analyzer

## Categories

### Category A: standing orders pending

Detect active or draft `ServiceRequest` resources that have no linked completed result.

Return:

- ordering provider
- order date
- test name
- nearest available lab context when present
- plain-language action: complete the standing order

This category is highest confidence because the order already exists.

### Category B: discuss-with-doctor candidates

Propose no more than three lab candidates with clear pre-visit value.

Each candidate must include:

- one-sentence clinical rationale
- named guideline source
- source year or version
- discuss-with-doctor wording
- optional portal snippet draft

Required wording posture:

- allowed: "ask your doctor whether..."
- not allowed: "get this test now", "you should order..."

### Category C: direct-to-consumer option

Only consider when:

- patient explicitly opted in
- Category A and B are unavailable or insufficient
- test is broadly available without provider order

Never surface:

- DTC genetics recommendations
- specialty hormone panels outside accepted guidance
- tests requiring provider-only interpretation pathways

## Ranking rule

When more than three Category B candidates are defensible:

1. prioritize relevance to active visit reason
2. prioritize recency and unresolved status
3. keep top three, place remaining candidates in a suppressed list

## Validation checklist

Before final output:

- every Category B has citation metadata
- Category B count <= 3
- no imperative auto-order language
- Category C appears only when opt-in is true
