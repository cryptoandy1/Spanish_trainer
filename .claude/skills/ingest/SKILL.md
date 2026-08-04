---
name: ingest
description: Fold a new Spanish-learning Claude Code conversation (pasted transcript or described exchange) into public/data/es/*.json — phrases, vocab, verbs, corrections, grammar topics. Use when the user says "/ingest", "add this conversation to the trainer", or pastes a Spanish Q&A exchange and asks to save it into the app.
---

# /ingest — fold a Spanish conversation into the trainer's data

This is the Phase 3 ongoing-update path for the Spanish Trainer app
(`CLAUDE.md` at repo root has full project conventions — read it first if
this is a fresh session). Unlike `tools/extract.py` (Phase 2, one-time
batch run against the ChatGPT archive via the Anthropic API), this skill
runs **inside** Claude Code: you do the extraction yourself, by reading the
conversation, no API key needed.

Read `reference/schemas.md` in this skill's directory now — it has the
condensed field lists, id recipes, and controlled vocabularies you need
below. Don't re-derive them from `src/types/data.ts` unless something here
looks stale.

## Input

The user gives you a Spanish-learning conversation to ingest — usually
pasted directly into the chat, sometimes "ingest what we just talked
about" referring to the current session. It's the same kind of material
Phase 2 extracted from ChatGPT: phrases with translations, vocab with
glosses, verb conjugation tables, grammar explanations, and corrected
mistakes (user attempted something in Spanish, got corrected).

If nothing in the given text looks like real Spanish-learning content
(the user pasted something unrelated, or an empty/trivial exchange), say
so and stop — don't force records out of it.

## Workflow

1. **Load context.** Read `public/data/es/meta.json` (controlled
   vocabularies) and `public/data/es/topics.json` (current topic ids).
   Both can drift over time — always read live, never trust a cached
   memory of their contents from an earlier session.

2. **Extract candidates.** Read through the conversation and identify:
   - **Phrases**: full sentences/expressions with a Russian translation.
   - **Vocab**: individual words worth remembering, with lemma + POS + gloss.
   - **Verbs**: conjugation tables or forms actually shown in the
     conversation — only the forms that appear, nothing filled in from your
     own Spanish knowledge (see the anti-hallucination rule in
     `reference/schemas.md`).
   - **Corrections**: places where the user tried Spanish and got
     corrected — `attempt` (what they wrote), `correct` (the fix),
     `verdict`, `explanation`, `errorTags` from the controlled list.
   - **Grammar topics**: if the conversation was substantially a grammar
     explainer (not just a quick aside), a `GrammarTopic` with a Russian
     summary + a longer Russian markdown body.

   Assign `topics[]` from the existing `topics.json` ids where they fit.
   If something genuinely doesn't fit any existing topic, don't force it —
   propose at most one new topic to the user in your final report instead
   of silently inventing a `tp_*` id.

3. **Compute ids.** For every candidate record, run
   `python -m tools.ingest.idgen <kind> <args...>` (see the table in
   `reference/schemas.md`) to get its id. Never compute a hash by hand.

4. **Check for existing records.** Grep the target JSON file for each
   computed id.
   - **Not found** → new record. Build the full JSON object per the field
     list in `reference/schemas.md`, with `source.origin: "claude"`,
     `source.ingestBatch: "ingest-<today's date, YYYY-MM-DD>"`,
     `source.extractor: "model"` (or `"correction"` for CorrectedError).
   - **Found** → this content already exists. Only touch it if you have a
     genuinely new field to add (e.g. the existing phrase lacks a
     `literal` gloss and this conversation supplies one) — union list
     fields (`topics`, `tags`, `errorTags`, `examples`), fill empty scalar
     fields, never overwrite a non-empty scalar field, and **never touch a
     record where `manual: true`**. If there's nothing new to add, skip it
     — this is the expected common case on a re-ingest and is not an
     error.

5. **Write.** Use the Edit tool to insert new records / merge fields into
   the appropriate `public/data/es/*.json` file(s). Grammar bodies are
   separate files: create `public/data/es/grammar/<id-without-gr_-prefix>.ru.md`
   with the markdown body (derive the filename from the id itself, not a
   separately-computed slug, so it can never diverge from the id). Exact
   insertion position doesn't need to be perfect — step 6 fixes formatting.

6. **Normalize.** Run
   `python -m tools.ingest.normalize <every file you touched>` to re-sort
   `items[]` by id and re-serialize with canonical formatting. This is
   required even if you think you inserted in the right place.

7. **Validate — hard gate.** Run `python -m tools.ingest.validate`. A
   non-zero exit means something is wrong (unknown topic id, dangling
   verbId, bad shape, out-of-order items, duplicate id) — fix the data and
   re-run until it's clean. Do not report success with a failing validate.

8. **Report to the user.** Summarize what was added/updated per file
   (e.g. "+3 phrases, +1 vocab, 1 correction (already existed, skipped),
   +1 new grammar topic"), list any proposed new topics for their
   approval, and flag anything you set `needsReview: true` on and why.
   Do not commit — leave the changes in the working tree like every other
   data-writing step in this project (see CLAUDE.md: only commit when
   explicitly asked).

## Idempotency check (only if the user asks you to verify it, or you're testing the skill itself)

Re-running `/ingest` on the *same* conversation a second time should
produce **zero new records** (every id already exists, nothing new to
merge) and an empty `git diff`. If a second run adds anything, the id
computation or the exists-check in step 4 has a bug — stop and investigate
before writing anything further.
