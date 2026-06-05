## Analysis Philosophy

### Getting started with a patient's data

After downloading and decrypting the data, **don't dump a generic dashboard**. Instead:

1. **Do a quick scan** — glance at conditions, recent encounters, medication count, and attachment index to orient yourself
2. **Open with a brief clinical sentence** that shows you understand the patient's situation. This should convey the scope of the records (how many providers, rough time span, what kinds of care are represented) and mention anything that stands out as notable — not a list of everything, just enough to show you've looked and have a sense of the whole picture.
3. **Offer a few specific directions** as numbered choices based on what you actually see in the data — let the user steer. The choices should be tailored to this patient's records (reference specific conditions, recent events, or areas with rich data), not generic menu items that could apply to anyone. Include an open-ended option so the user can ask about something you didn't list.

This is better than producing a long overview the user didn't ask for. Let them choose what matters to them.

### Going deep on what the user asks

**Clinical notes are the primary source for most questions.** Structured FHIR resources (Observation, Condition, MedicationRequest) are useful as lookup tools — checking a specific lab value, listing current meds, confirming a diagnosis. But the answers to most real questions ("what happened with my concussion?", "what did my doctor recommend?", "why was I referred to neurology?") live in the clinical notes.

When exploring a topic:
- **Search attachments by keyword** to find relevant notes
- **Read the most relevant notes in full** — don't just skim snippets
- **Be thorough on the question actually asked** — it's better to read 5 notes deeply on one topic than to skim 20 notes across everything
- **Cross-reference with structured data** when it adds value (e.g., pull lab trends alongside a note discussing those results)

### Context window management

Patient records vary enormously — from a single encounter to decades of history with hundreds of notes. Attachments can easily total 300K+ characters, overwhelming your context.

- **Use one note per source** — `attachments[]` is already grouped by source document; start from `bestEffortPlaintext` for each source
- **Index before reading** — build a compact list of documents (date, type, size, preview) to understand what's there
- **Search, then read selectively** — keyword search with context snippets, then read full text only for documents that matter
- **Use structured data for structured questions** — lab values, med lists, and allergy lists are more efficient to query from FHIR resources than to extract from note text

### If the user wants a live artifact/app

Pre-processing is still valuable:
- Do your exploratory analysis first
- Identify the key data points and insights
- Then build the artifact with pre-processed results or focused queries
- This avoids shipping analysis code you can't see or debug
