# CLAUDE.md

Guidance for Claude Code sessions working in this repo.

## What this is

A static React/Vite/TypeScript Spanish-learning app, personalized from the user's own ChatGPT/Claude question history. No backend — `public/data/es/*.json` is the entire database, fetched at runtime. See `README.md` for setup and `src/types/data.ts` for the authoritative data schema.

## Conventions that matter

- **Content-derived ids, always.** Every `Phrase`/`VocabWord`/`Verb`/`CorrectedError`/etc. id is `<prefix>_` + a short hash of its normalized content (see `src/lib/text.ts::normalize`). Never hand-invent an id — a new record with content that already exists must land on the same id as the existing one, so it merges instead of duplicating. This is what makes re-running extraction, or the `/ingest` skill, idempotent.
- **Language-pair-agnostic core.** `src/` code must not hardcode "Spanish" or "Russian". Structural language knowledge (persons, tenses, POS, error tags) lives in `public/data/es/meta.json`; every learner-facing string is a `Tr` map (`{"ru": "..."}`) read via `tr()` from `src/lib/i18n.ts`.
- **`items[]` arrays are sorted by id** in every data file, with canonical `JSON.stringify(..., null, 2)`-style formatting. Keep it that way after any edit — it's what keeps diffs small and reviewable.
- **`manual: true`** on a record makes it immutable to any automated extractor/ingest pass — never overwrite a record carrying that flag.
- **Never invent Spanish content the user didn't actually produce or see.** A verb form, translation, or example that isn't backed by the source conversation should be `null`/omitted with `needsReview: true`, not filled in from general Spanish knowledge. The whole point of this app is that it mirrors *this user's* material.
- **HashRouter, not BrowserRouter** — see `src/routes.tsx`. Intentional, for GitHub Pages deep-link support.

## Commands

```bash
npm run dev      # http://localhost:5173
npm run test     # vitest
npm run build    # tsc -b && vite build
```

## Extraction pipeline (Phase 2 — done)

`tools/extract.py` (package `tools/spanish_extract/`) runs four stages: `select` → `regex` → `claude` → `merge`, all run against the real `chatGPT_history/` archive and merged into `public/data/es/*.json` (see README for current counts). `tools/spanish_extract/ids.py` mirrors `src/lib/text.ts::normalize` exactly and is the id-generation module the `/ingest` skill also uses (via `tools/ingest/idgen.py`), so both writers land on the same id for the same content.

Two things worth knowing before touching this pipeline again:
- The `claude` stage makes **two** API calls per conversation (`ContentExtraction`: phrases/vocab/corrections; `StructureExtraction`: verbs/grammarTopics/proposedTopics), not one — a single combined structured-output schema reliably triggered a 400 ("compiled grammar is too large" / "Grammar compilation timed out") on the real API. Both calls share the same cached system-prompt text.
- `merge.py` only rewrites a pack file when it actually added/updated a record — writing unconditionally would bump `generatedAt` on every run even with no content change, breaking the idempotent-rerun guarantee. Auto-extracted `GrammarTopic` ids always carry a content-hash suffix (`ids.auto_grammar_id`), unlike the plain Latin-slug ids on hand-authored seed entries — free-text model-generated titles collide easily (two conversations both roughly titled "ser vs estar" is a real example from this corpus).

## The `/ingest` skill (Phase 3 — done)

`.claude/skills/ingest/SKILL.md` folds a new Claude Code Spanish conversation into `public/data/es/*.json` — no API key needed, the extraction is done by the Claude Code session itself. It shares id/formatting/validation logic with the Phase 2 pipeline via `tools/ingest/{idgen,normalize,validate}.py`:
- `idgen.py` re-exports `tools/spanish_extract/ids.py` directly (not a re-implementation) plus a CLI, so the two writers can never drift apart on what id a given piece of content hashes to.
- `normalize.py` holds the canonical pack read/write (sorted `items[]`, indent-2 UTF-8 JSON) that `spanish_extract/merge.py` now also imports, instead of each writer keeping its own copy.
- `validate.py` is a hard gate: Pydantic shape-checks every record against `tools/spanish_extract/schema.py`, plus referential integrity (topic ids, `verbId`, `relatedGrammarIds`/`relatedVerbIds`/`relatedTopicIds`, `errorTags`, tense/person ids, grammar `bodyPath` files all actually exist). Run as `python -m tools.ingest.validate`.

Verified live: ingested a real `claude.ai/share/...` conversation (pasted as text — `WebFetch` can't read that URL shape, it's a client-rendered SPA shell), then re-ran the identical ingest and confirmed all record ids already existed with zero new writes — the idempotent-rerun check called for in the plan doc's Phase 4 verification.
