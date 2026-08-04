# Испанский тренажёр (Spanish Trainer)

Personal Spanish-learning web app built from a mined ChatGPT/Claude question history. React + Vite + TypeScript, fully static (no backend) — all data lives in `public/data/` as JSON and is fetched at runtime.

See `.claude/plans/binary-humming-pond.md` (or the equivalent plan doc) for the full design: data model, quiz engine, extraction pipeline, and the `/ingest` skill.

## Status

**Phase 1 (skeleton) — done.** Every route is real and working against a small hand-authored seed dataset: 15 phrases, 20 vocab words, 3 verbs (ser/estar/tener), 4 topics, 2 grammar articles, 3 corrections, and 5 fully-populated reference widgets (colors/numbers/days/months/countries). All three practice modes (multiple choice, typing, speech) work; progress persists in `localStorage` via a Leitner-box scheduler.

**Phase 2 (real extraction from `chatGPT_history/`) — not started.** Will populate the same JSON files from the actual archive via `tools/extract.py`.

**Phase 3 (`/ingest` Claude Code skill) — not started.** Will let new Spanish Q&A from Claude Code sessions be folded into the same data files without an API key.

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm run test      # vitest — unit tests for text/grade/distractors/srs
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve the production build locally
```

## Data layout

```
public/data/
  languages.json       # language-pack registry (target/native pairs)
  es/
    meta.json           # persons, tenses, POS, regularity, error tags — the ONLY Spanish-specific structural knowledge
    phrases.json  vocab.json  verbs.json  topics.json  corrections.json  widgets.json
    grammar.json         # index; prose bodies live in grammar/*.ru.md
```

Every record carries a content-derived id (e.g. `ph_1a2b3c4d` = `"ph_" + sha1(normalize(text))[:8]`) so re-running extraction or the `/ingest` skill merges instead of duplicating. See `src/types/data.ts` for the full schema.

## Extraction pipeline (Phase 2, not yet built)

`tools/extract.py` will mine `chatGPT_history/conversations-001.json` (the only export file with Spanish-learning content) in four stages: `select` (filter conversations) → `regex` (structural extraction: conjugation tables, lexicon tables, ES/RU phrase pairs, corrected-mistake blocks) → `claude` (an `claude-opus-5` API pass to classify ambiguous candidates and fill gaps) → `merge` (idempotent upsert into `public/data/es/*.json`).

Running the `claude` stage will need Anthropic credentials — either:

```bash
ant auth login
# or
$env:ANTHROPIC_API_KEY = "sk-ant-..."   # PowerShell, current session
```

## Language-pair agnosticism

Nothing in `src/` hardcodes "Spanish" or "Russian" beyond `meta.json` and the `Tr` (translation) maps in the data files — see `src/types/data.ts` for exactly which fields are pair-specific vs. universal. Adding a second target language means adding `public/data/<code>/*.json` and an entry in `languages.json`; no component changes needed.
