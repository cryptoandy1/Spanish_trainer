# Испанский тренажёр (Spanish Trainer)

Personal Spanish-learning web app built from a mined ChatGPT/Claude question history. React + Vite + TypeScript, fully static (no backend) — all data lives in `public/data/` as JSON and is fetched at runtime.

See `.claude/plans/binary-humming-pond.md` (or the equivalent plan doc) for the full design: data model, quiz engine, extraction pipeline, and the `/ingest` skill.

## Status

**Phase 1 (skeleton) — done.** Every route works end-to-end; originally verified against a small hand-authored seed dataset (still present, `manual: true`, immutable to the extractor). All three practice modes (multiple choice, typing, speech) work; progress persists in `localStorage` via a Leitner-box scheduler.

**Phase 2 (real extraction from `chatGPT_history/`) — done.** `tools/extract.py`'s four stages (`select` → `regex` → `claude` → `merge`) ran against the real 27-conversation archive and merged into `public/data/es/*.json`. Current dataset: **1,622 phrases, 659 vocab words, 75 verbs, 76 corrections, 42 grammar articles** (up from the 15/20/3/3/2-item seed set). The `claude` stage runs two structured-output calls per conversation (a single combined schema hit the API's compiled-grammar-size limit — see the docstring in `tools/spanish_extract/claude_pass.py`). Re-running `--stage merge` on unchanged cached extractions is a verified no-op (`git status` clean). 16 model-proposed new topics are sitting in `tools/build/proposed_topics.json`, awaiting a human decision on whether to add them to `topics.json` — the extractor never adds topics on its own.

**Phase 3 (`/ingest` Claude Code skill) — done.** Lets new Spanish Q&A from Claude Code sessions be folded into the same data files without an API key — the session itself does the extraction. Shares id/formatting/validation logic with Phase 2 via `tools/ingest/{idgen,normalize,validate}.py`; see `.claude/skills/ingest/SKILL.md`. Live-tested against a real conversation (+6 phrases, +9 vocab, +2 verbs, +2 corrections, +2 grammar topics); re-ingesting the same conversation a second time added zero records, confirming the idempotency guarantee.

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

## Extraction pipeline (Phase 2)

`tools/extract.py` mines `chatGPT_history/conversations-001.json` (the only export file with Spanish-learning content) in four stages: `select` (filter conversations) → `regex` (structural extraction: conjugation tables, lexicon tables, ES/RU phrase pairs, corrected-mistake blocks) → `claude` (a `claude-opus-5` API pass to classify ambiguous candidates and fill gaps) → `merge` (idempotent upsert into `public/data/es/*.json`).

```bash
python -m pip install -r tools/requirements.txt
python tools/extract.py --stage select   # verified: 27 conversations, 370,865 chars
python tools/extract.py --stage regex    # verified: tables/pairs/corrections candidates written to tools/build/regex_raw.json
python tools/extract.py --stage claude --limit 2   # needs credentials, see below; spot-check before running all 27
python tools/extract.py --stage merge --dry-run    # review counts before a real merge
```

Running the `claude` stage needs Anthropic credentials — either:

```bash
ant auth login
# or
$env:ANTHROPIC_API_KEY = "sk-ant-..."   # PowerShell, current session
```

## Language-pair agnosticism

Nothing in `src/` hardcodes "Spanish" or "Russian" beyond `meta.json` and the `Tr` (translation) maps in the data files — see `src/types/data.ts` for exactly which fields are pair-specific vs. universal. Adding a second target language means adding `public/data/<code>/*.json` and an entry in `languages.json`; no component changes needed.
