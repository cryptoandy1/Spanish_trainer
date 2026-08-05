# Data model quick reference for /ingest

Condensed for the ingest workflow. The authoritative source is always
`src/types/data.ts` (mirrored 1:1 by `tools/spanish_extract/schema.py`) —
re-read it if a field here looks stale. Do not hand-invent a field name or
id recipe; everything below must match those two files exactly.

## Id recipes — always compute via `python -m tools.ingest.idgen`, never by hand

| Entity | Command | Recipe |
|---|---|---|
| Phrase | `idgen phrase "<text>"` | `ph_` + sha1(normalize(text))[:8] |
| VocabWord | `idgen vocab "<lemma>" <pos>` | `vc_` + sha1(normalize(lemma)+"\|"+pos)[:8] |
| Verb | `idgen verb "<infinitive>"` | `vb_` + slug(infinitive) |
| CorrectedError | `idgen correction "<attempt>" "<correct>"` | `er_` + sha1(normalize(attempt)+"\|"+normalize(correct))[:8] |
| GrammarTopic (auto) | `idgen grammar "<title>" "<summary>"` | `gr_` + slug(title)[:40] + "-" + sha1(normalize(title)+"\|"+normalize(summary))[:8] |
| Topic (only if proposing a genuinely new one — rare, see workflow) | `idgen topic "<Latin name>"` | `tp_` + slug(name) |

`normalize()` = lowercase, strip punctuation `¿¡?!.,;:…"'«»–—()[]`, collapse whitespace, strip combining diacritics (NFD). Same content always → same id, so an item that already exists in the pack just gets merged, never duplicated.

## Entity field lists (fields not listed here don't exist — don't add ad hoc ones)

**Phrase** (`phrases.json`): `id, text, tr, literal?, register?("neutral"|"formal"|"informal"|"slang"), topics[], tags?[], notes?, relatedGrammarIds?[], needsReview?, manual?, source`

**VocabWord** (`vocab.json`): `id, lemma, pos, gender?("m"|"f"|"mf"), plural?, tr, examples[]({text,tr}), topics[], verbId?, needsReview?, manual?, source`

**Verb** (`verbs.json`): `id, infinitive, tr, regularity, regularityNote?, conjugationClass?("-ar"|"-er"|"-ir"), reflexive, nonFinite{gerund?,participle?,participleIrregular?}, tenses{<tenseId>: {forms: {<personId>: {form,irregular?,example?} | null}}}, topics[], frequency?(1|2|3), needsReview?, manual?, source`
**You still never invent a conjugation form here.** Record only the forms the conversation actually showed; omit the rest. Complete paradigms are not your job — they are filled separately by `python tools/conjugate.py --stage all`, which never overwrites an attested form. **After an ingest that adds a new verb, run that command** so the new verb gets a full paradigm like the others.

**GrammarTopic** (`grammar.json` index + separate `grammar/<slug>.ru.md` body): `id, title, level?("A1".."C1"), order, summary, bodyPath{ru: "grammar/<file>.ru.md"}, examples[], relatedVerbIds?[], relatedTopicIds?[], tags?[], manual?, source`
Body markdown goes in the `.ru.md` file, never escaped into the JSON. `order: 999` for new auto-added topics (a human re-orders later if it matters).

**CorrectedError** (`corrections.json`): `id, prompt?, attempt, correct, verdict("wrong"|"partial"|"ok"), explanation, errorTags[], relatedGrammarIds?[], relatedVerbIds?[], occurredAt?, manual?, source`

**Topic** (`topics.json`): `id, name, nameTarget?, icon?, order, description?` — membership lives only on items' `topics[]`, never edit this file's list of ids from an item.

**`source` (`SourceRef`, required on every record above except Topic/WidgetItem):**
```json
{ "origin": "claude", "conversationId": "<optional local label>", "ingestBatch": "ingest-YYYY-MM-DD", "extractor": "model" }
```
`origin` is always `"claude"` for /ingest (never `"chatgpt"` — that's Phase 2 extraction only). `ingestBatch` = `"ingest-" + today's date`.

## Controlled vocabularies (read live, don't trust this list if it's gone stale)

Read `public/data/es/meta.json` for the authoritative current values before ingesting:
- `pos`: noun, verb, adj, adv, pron, prep, conj, interj, num, phrase
- `regularity`: regular, stem-changing, orthographic, irregular
- `errorTags`: conjugation, ser-estar, por-para, gender, agreement, article, preposition, pronoun-placement, enclitic, reflexive, word-order, spelling, accent, homophone, false-friend, lexical-choice, tense-choice, mood-choice
- `tenses` ids: presente, preterito_indefinido, preterito_imperfecto, preterito_perfecto, futuro_simple, condicional, presente_subjuntivo, imperfecto_subjuntivo, imperativo_afirmativo, imperativo_negativo
- `persons` ids: yo, tu, el, nosotros, vosotros, ellos

Read `public/data/es/topics.json` for the current topic id list (small, changes over time — do not hardcode it here).

If a phrase/vocab/verb genuinely doesn't fit any existing topic, propose **at most one** new topic per `/ingest` run (mirrors the Phase 2 extraction rule of ≤2 per conversation) — surface it to the user instead of silently adding to `topics.json`.

## Formatting/gating rules (non-negotiable, see CLAUDE.md)

- `items[]` sorted by id, canonical `json.dumps(..., indent=2)`-equivalent formatting — always finish with `python -m tools.ingest.normalize <changed files>`.
- `manual: true` records are immutable — never edit one, even to "fix" something.
- Never invent Spanish content, a translation, or a conjugation form the source conversation didn't actually contain. Missing → omit + `needsReview: true`.
- Always end with `python -m tools.ingest.validate` and treat a non-zero exit as a hard stop — fix the data, don't skip the gate.
