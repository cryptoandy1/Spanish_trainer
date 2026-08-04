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

## Not yet built (see the plan doc for the design)

- `tools/extract.py` — the ChatGPT-archive extraction pipeline (Phase 2).
- `.claude/skills/ingest/` — the `/ingest` skill for folding new Claude Code Spanish conversations into `public/data/es/*.json` (Phase 3).
