"""Hard gate for public/data/{lang}/*.json after any edit — run by both
tools/spanish_extract/merge.py (via tests) and the /ingest skill, always as
the last step before a write is considered done.

Two independent checks:
1. Shape — every item parses against the Pydantic models in
   tools/spanish_extract/schema.py, the same mirror of src/types/data.ts
   used everywhere else in this pipeline.
2. Referential integrity — every id an item points at (topics[], verbId,
   relatedGrammarIds, relatedVerbIds, relatedTopicIds, errorTags, pos,
   regularity, tense/person ids, grammar bodyPath files) actually exists.
   Nothing in src/ enforces this at runtime — a dangling id fails silently
   as a blank spot in the UI — so this is the only place it's caught.

Usage:
    python -m tools.ingest.validate [--lang es] [repo_root]
Exit code 0 = clean, 1 = errors found (printed to stderr, one per line).
"""

from __future__ import annotations

import sys
from pathlib import Path

from pydantic import ValidationError

from tools.spanish_extract import schema as sch

_PACKS = [
    ("phrases.json", "phrases", sch.Phrase),
    ("vocab.json", "vocab", sch.VocabWord),
    ("verbs.json", "verbs", sch.Verb),
    ("topics.json", "topics", sch.Topic),
    ("grammar.json", "grammar", sch.GrammarTopic),
    ("corrections.json", "corrections", sch.CorrectedError),
]


def _load(path: Path) -> dict:
    import json

    return json.loads(path.read_text(encoding="utf-8"))


def validate(repo_root: Path, lang: str = "es") -> list[str]:
    errors: list[str] = []
    data_dir = repo_root / "public" / "data" / lang
    meta = _load(data_dir / "meta.json")
    valid_persons = {p["id"] for p in meta["persons"]}
    valid_tenses = {t["id"] for t in meta["tenses"]}
    valid_pos = set(meta["pos"])
    valid_regularity = set(meta["regularity"])
    valid_error_tags = set(meta["errorTags"])

    packs: dict[str, list[dict]] = {}
    for filename, key, model in _PACKS:
        path = data_dir / filename
        if not path.exists():
            errors.append(f"{filename}: missing")
            continue
        pack = _load(path)
        items = pack.get("items", [])
        packs[key] = items

        ids_seen: dict[str, int] = {}
        prev_id = ""
        for i, item in enumerate(items):
            item_id = item.get("id", f"<no id at index {i}>")
            ids_seen[item_id] = ids_seen.get(item_id, 0) + 1
            if item_id < prev_id:
                errors.append(f"{filename}: items[] not sorted by id at {item_id!r} (after {prev_id!r})")
            prev_id = item_id
            try:
                model.model_validate(item)
            except ValidationError as e:
                errors.append(f"{filename}:{item_id}: shape error — {e.errors()[0]['msg']} at {e.errors()[0]['loc']}")
        for item_id, count in ids_seen.items():
            if count > 1:
                errors.append(f"{filename}: duplicate id {item_id!r} ({count}x)")

    topic_ids = {t["id"] for t in packs.get("topics", [])}
    verb_ids = {v["id"] for v in packs.get("verbs", [])}
    grammar_ids = {g["id"] for g in packs.get("grammar", [])}

    def check_topics(filename: str, item_id: str, topics: list[str]) -> None:
        for tid in topics or []:
            if tid not in topic_ids:
                errors.append(f"{filename}:{item_id}: unknown topic id {tid!r}")

    def check_grammar_refs(filename: str, item_id: str, ids_: list[str] | None) -> None:
        for gid in ids_ or []:
            if gid not in grammar_ids:
                errors.append(f"{filename}:{item_id}: unknown grammar id {gid!r}")

    def check_verb_refs(filename: str, item_id: str, ids_: list[str] | None) -> None:
        for vid in ids_ or []:
            if vid not in verb_ids:
                errors.append(f"{filename}:{item_id}: unknown verb id {vid!r}")

    def check_not_blank(filename: str, item_id: str, field: str, value: object) -> None:
        """A required Tr field must carry actual text, not just be present.

        The shape check above can't catch this: `{"ru": ""}` is a structurally
        valid Tr. But a phrase with a blank translation, or a grammar topic with
        a blank title, renders as an empty row in the UI — and an unattended CI
        ingest has nobody watching to notice. Observed for real: the API
        extractor emitted a grammar topic with an empty title AND summary, and
        it validated clean.
        """
        if not isinstance(value, dict) or not any(str(v).strip() for v in value.values()):
            errors.append(f"{filename}:{item_id}: {field} is blank")

    for p in packs.get("phrases", []):
        check_topics("phrases.json", p["id"], p.get("topics"))
        check_grammar_refs("phrases.json", p["id"], p.get("relatedGrammarIds"))
        check_not_blank("phrases.json", p["id"], "tr", p.get("tr"))
        if not str(p.get("text", "")).strip():
            errors.append(f"phrases.json:{p['id']}: text is blank")

    for v in packs.get("vocab", []):
        check_topics("vocab.json", v["id"], v.get("topics"))
        check_not_blank("vocab.json", v["id"], "tr", v.get("tr"))
        if v.get("pos") not in valid_pos:
            errors.append(f"vocab.json:{v['id']}: unknown pos {v.get('pos')!r}")
        if v.get("verbId") and v["verbId"] not in verb_ids:
            errors.append(f"vocab.json:{v['id']}: unknown verbId {v['verbId']!r}")

    # Every verb must be reachable from the word list. The Слова page (and the
    # per-batch view in Недавнее) is built from vocab.json alone, so a verb
    # that exists only in verbs.json is invisible there — 21 verbs shipped
    # that way in ingest-2026-08-17. tools/link_vocab_verbs.py (run by
    # tools/ingest/finish.py before this gate) creates the missing vocab
    # record; this check is what makes forgetting it a hard failure.
    linked_verb_ids = {v["verbId"] for v in packs.get("vocab", []) if v.get("verbId")}

    for vb in packs.get("verbs", []):
        check_topics("verbs.json", vb["id"], vb.get("topics"))
        if vb["id"] not in linked_verb_ids:
            errors.append(
                f"verbs.json:{vb['id']}: no vocab record links to it (verb is invisible in the word list;"
                " run python -m tools.link_vocab_verbs --apply)"
            )
        if vb.get("regularity") not in valid_regularity:
            errors.append(f"verbs.json:{vb['id']}: unknown regularity {vb.get('regularity')!r}")
        for tense_id, tense in (vb.get("tenses") or {}).items():
            if tense_id not in valid_tenses:
                errors.append(f"verbs.json:{vb['id']}: unknown tense id {tense_id!r}")
            for person_id in (tense.get("forms") or {}):
                if person_id not in valid_persons:
                    errors.append(f"verbs.json:{vb['id']}: unknown person id {person_id!r} in tense {tense_id!r}")

    for g in packs.get("grammar", []):
        check_verb_refs("grammar.json", g["id"], g.get("relatedVerbIds"))
        check_not_blank("grammar.json", g["id"], "title", g.get("title"))
        check_not_blank("grammar.json", g["id"], "summary", g.get("summary"))
        for tid in g.get("relatedTopicIds") or []:
            if tid not in topic_ids:
                errors.append(f"grammar.json:{g['id']}: unknown topic id {tid!r}")
        for lang_code, rel_path in (g.get("bodyPath") or {}).items():
            if not (data_dir / rel_path).exists():
                errors.append(f"grammar.json:{g['id']}: bodyPath[{lang_code!r}] file missing: {rel_path}")

    for c in packs.get("corrections", []):
        check_grammar_refs("corrections.json", c["id"], c.get("relatedGrammarIds"))
        check_verb_refs("corrections.json", c["id"], c.get("relatedVerbIds"))
        for tag in c.get("errorTags") or []:
            if tag not in valid_error_tags:
                errors.append(f"corrections.json:{c['id']}: unknown errorTag {tag!r}")

    return errors


def main(argv: list[str]) -> int:
    lang = "es"
    args = list(argv)
    if "--lang" in args:
        i = args.index("--lang")
        lang = args[i + 1]
        del args[i : i + 2]
    repo_root = Path(args[0]) if args else Path(__file__).resolve().parents[2]

    errors = validate(repo_root, lang)
    if errors:
        for e in errors:
            print(e, file=sys.stderr)
        print(f"\n{len(errors)} error(s)", file=sys.stderr)
        return 1
    print("validate: clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
