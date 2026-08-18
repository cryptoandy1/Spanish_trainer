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

A Spanish-learning conversation, from one of three places. It's the same
kind of material Phase 2 extracted from ChatGPT: phrases with
translations, vocab with glosses, verb conjugation tables, grammar
explanations, and corrected mistakes (user attempted something in
Spanish, got corrected).

1. **Pasted into the chat** — the common case.
2. **"ingest what we just talked about"** — the current session.
3. **The `inbox/` folder** — when `/ingest` is invoked with no text, or
   the user says "process the inbox". Handle every `.md`/`.txt` file in
   `inbox/` (ignore `README.md`), as a single batch: extract them all,
   then run the pipeline in step 6 once. When a file's first line is a
   markdown heading, use it as `source.conversationTitle`. After the
   batch validates clean, move each processed file to
   `inbox/processed/` (create it if needed) so a re-run doesn't reprocess
   it. Nothing under `inbox/` is ever committed — it's gitignored,
   because this repo is public and raw transcripts must stay out of git
   history.

If the phone channel is in play, the user may first ask you to run
`python -m tools.inbox_pull`, which downloads conversations shared from
the phone into `inbox/`. See "The phone channel" at the bottom.

If nothing in the given text looks like real Spanish-learning content
(the user pasted something unrelated, or an empty/trivial exchange), say
so and stop — don't force records out of it. In inbox mode, skip that
file, leave it in place, and say which one you skipped.

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
     `reference/schemas.md`). Full paradigms are filled by a separate tool,
     not by you — see step 6.

     **Every verb the conversation contains gets a `verbs.json` record**
     (user's instruction, 2026-08-09), not just the ones the conversation
     conjugated — a verb that only appears inside an example sentence
     counts. If `verbs.json` has no entry for it, create one: `tenses: {}`,
     `nonFinite: {}`, `regularity: "regular"` as a placeholder (step 6's
     `conjugate.py` replaces regularity/conjugationClass outright and fills
     the paradigm), and copy `tr`/`topics`/`source` from the vocab record.
     A `pos: "verb"` vocab entry with no verb record is a defect — it's a
     dead link in the word list. **The reverse is a defect too:** every verb
     record needs a `pos: "verb"` vocab record with the bare infinitive as
     lemma and `verbId` set — the word list is built from `vocab.json` only,
     so a verb stubbed in `verbs.json` alone is invisible there (this
     happened to 21 verbs in ingest-2026-08-17). Always write both records
     together; `finish` will backfill and then fail validation if you
     forget, but don't rely on it. **Do not do this for a lemma that isn't an
     infinitive** (`hay`, `buscando`, `darse de baja`, `empezar a` are real
     examples from the backlog) — flag those to the user instead.
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

6. **Finish — one command, hard gate.** Run
   `python -m tools.ingest.finish`. It runs, in the order that matters:
   normalize (re-sort `items[]`, canonical formatting) → `conjugate.py`
   (complete paradigms for any new verb; never overwrites an attested
   form, a no-op when no verb was added) → `link_vocab_verbs.py` (so a
   new verb is clickable from the word list) → normalize again →
   validate.

   A non-zero exit means the data is wrong (unknown topic id, dangling
   verbId, bad shape, out-of-order items, duplicate id) — fix the records
   and re-run until it's clean. **Never report success on a failing
   finish.** Don't run the underlying tools individually; the ordering
   between them is the whole reason this wrapper exists.

7. **Report to the user.** Summarize what was added/updated per file
   (e.g. "+3 phrases, +1 vocab, 1 correction (already existed, skipped),
   +1 new grammar topic"), list any proposed new topics for their
   approval, and flag anything you set `needsReview: true` on and why.
   Do not commit — leave the changes in the working tree like every other
   data-writing step in this project (see CLAUDE.md: only commit when
   explicitly asked).

## The phone channel

Conversations happen on the phone, where none of this pipeline can run —
and this repo is public, so the phone can't drop raw transcripts into it
either. The route is a separate **private** repository used as a drop box:

```
phone (share sheet)  ->  github.com/cryptoandy1/spanish-inbox  (private)
                     ->  python -m tools.inbox_pull   ->  inbox/
                     ->  /ingest                      ->  public/data/es/*.json
                     ->  commit + push                ->  Pages redeploys
```

`python -m tools.inbox_pull` downloads whatever is waiting into `inbox/`
and deletes the remote copies (after the local write succeeds, never
before). `--list` shows what's waiting without pulling; `--keep` leaves
the remote copies alone. It authenticates through the `gh` CLI, so no
token is stored in this repo.

Run it whenever the user says the phone has something waiting, then
continue with inbox mode above.

**This path is now also automated** (`.github/workflows/ingest.yml` +
`tools/ingest/from_inbox.py`): a drop triggers a headless run that opens a
pull request. So by the time the user asks you to ingest something, the
workflow may already have done it — check whether an open `ingest/*` PR
covers the same conversation before extracting it again. Running this skill
by hand is still the better path when the user wants care taken: the API
extractor is looser about inventing sentences and occasionally emits an
empty grammar topic.

## Idempotency check (only if the user asks you to verify it, or you're testing the skill itself)

Re-running `/ingest` on the *same* conversation a second time should
produce **zero new records** (every id already exists, nothing new to
merge) and an empty `git diff`. If a second run adds anything, the id
computation or the exists-check in step 4 has a bug — stop and investigate
before writing anything further.
