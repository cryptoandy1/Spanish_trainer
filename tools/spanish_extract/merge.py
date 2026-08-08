"""Stage 4: merge — idempotent field-level upsert of claude_cache/*.json
extractions into public/data/es/*.json.

Idempotency is the load-bearing design decision (see CLAUDE.md): every
record id is a hash of its normalized content (tools/spanish_extract/ids.py),
so re-running merge on unchanged source data must produce byte-identical
output. List fields (topics, tags, errorTags, examples, alsoSeenIn) union by
value; scalar fields fill only when currently empty, unless --force.
`manual: true` on an existing record makes it completely immutable here.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tools.ingest.normalize import load_items as _load_pack
from tools.ingest.normalize import write_pack as _write_pack
from . import ids as idlib

LIST_FIELDS = {
    "topics",
    "tags",
    "errorTags",
    "examples",
    "alsoSeenIn",
    "relatedGrammarIds",
    "relatedVerbIds",
}

# Fields the extractor/merge is allowed to touch. `id`, `manual`, and
# anything not listed here are left alone once a record exists.
SCALAR_FILL_FIELDS = {
    "text", "tr", "literal", "register", "notes", "needsReview",
    "lemma", "pos", "gender", "plural", "verbId",
    "infinitive", "regularity", "regularityNote", "conjugationClass",
    "reflexive", "nonFinite", "tenses", "frequency",
    "title", "level", "summary", "bodyPath",
    "prompt", "attempt", "correct", "verdict", "explanation", "occurredAt",
}


def _merge_record(existing: dict, incoming: dict, force: bool) -> dict:
    if existing.get("manual"):
        return existing

    merged = dict(existing)
    for key, value in incoming.items():
        if key in ("id", "source", "manual"):
            continue
        if key in LIST_FIELDS:
            current = merged.get(key) or []
            for item in value or []:
                if item not in current:
                    current.append(item)
            merged[key] = current
        elif key in SCALAR_FILL_FIELDS:
            if force or not merged.get(key):
                merged[key] = value

    # source.alsoSeenIn tracks additional conversations a record was seen in
    src = merged.get("source", {})
    incoming_conv = incoming.get("source", {}).get("conversationId")
    if incoming_conv and incoming_conv != src.get("conversationId"):
        also = src.get("alsoSeenIn") or []
        if incoming_conv not in also:
            also = also + [incoming_conv]
        src["alsoSeenIn"] = also
        merged["source"] = src

    return merged


def upsert(items: list[dict], new_records: list[dict], force: bool) -> tuple[list[dict], int, int]:
    """Returns (merged_items, n_added, n_updated)."""
    by_id = {item["id"]: item for item in items}
    added = 0
    updated = 0
    for record in new_records:
        rid = record["id"]
        if rid in by_id:
            merged = _merge_record(by_id[rid], record, force)
            if merged != by_id[rid]:
                updated += 1
            by_id[rid] = merged
        else:
            by_id[rid] = record
            added += 1
    ordered = sorted(by_id.values(), key=lambda r: r["id"])
    return ordered, added, updated


# ---------------------------------------------------------------------------
# Candidate -> record conversion


def _source_ref(conv: dict, extractor: str, ingest_batch: str) -> dict:
    return {
        # Carried on the conversation rather than threaded through all five
        # record builders: Phase 2 reads the ChatGPT archive and leaves it
        # absent (-> "chatgpt"), while tools/ingest/from_inbox.py stamps
        # "claude" on each conversation it synthesizes.
        "origin": conv.get("origin", "chatgpt"),
        "conversationId": conv["id"],
        "conversationTitle": conv["title"],
        "ingestBatch": ingest_batch,
        "extractor": extractor,
    }


def phrase_record(cand: dict, conv: dict, ingest_batch: str) -> dict | None:
    if not cand.get("isRealPhrase"):
        return None
    return {
        "id": idlib.phrase_id(cand["text"]),
        "text": cand["text"],
        "tr": {"ru": cand["translationRu"]},
        **({"literal": {"ru": cand["literalRu"]}} if cand.get("literalRu") else {}),
        **({"register": cand["register"]} if cand.get("register") else {}),
        "topics": cand.get("topicIds") or [],
        "source": _source_ref(conv, "model", ingest_batch),
    }


def vocab_record(cand: dict, conv: dict, ingest_batch: str) -> dict | None:
    if not cand.get("isRealVocab"):
        return None
    examples = []
    if cand.get("exampleText"):
        examples.append({"text": cand["exampleText"], "tr": {"ru": cand.get("exampleTranslationRu") or ""}})
    return {
        "id": idlib.vocab_id(cand["lemma"], cand["pos"]),
        "lemma": cand["lemma"],
        "pos": cand["pos"],
        **({"gender": cand["gender"]} if cand.get("gender") else {}),
        "tr": {"ru": cand["translationRu"]},
        "examples": examples,
        "topics": cand.get("topicIds") or [],
        "source": _source_ref(conv, "model", ingest_batch),
    }


def correction_record(cand: dict, conv: dict, ingest_batch: str) -> dict | None:
    if not cand.get("isRealCorrection"):
        return None
    return {
        "id": idlib.correction_id(cand["attempt"], cand["correct"]),
        "attempt": cand["attempt"],
        "correct": cand["correct"],
        "verdict": cand["verdict"],
        "explanation": {"ru": cand["explanationRu"]},
        "errorTags": cand.get("errorTagIds") or [],
        "source": _source_ref(conv, "correction", ingest_batch),
    }


def verb_record(cand: dict, conv: dict, ingest_batch: str) -> dict:
    tenses: dict[str, dict] = {}
    for f in cand.get("forms", []):
        tense_bucket = tenses.setdefault(f["tense"], {"forms": {}})
        tense_bucket["forms"][f["person"]] = {"form": f["form"], "irregular": f.get("irregular", False)}
    return {
        "id": idlib.verb_id(cand["infinitive"]),
        "infinitive": cand["infinitive"],
        "tr": {"ru": "; ".join(cand.get("translationsRu") or [])},
        "regularity": cand["regularity"],
        "reflexive": cand.get("reflexive", False),
        "nonFinite": {
            "gerund": cand.get("gerund"),
            "participle": cand.get("participle"),
            "participleIrregular": cand.get("participleIrregular"),
        },
        "tenses": tenses,
        "topics": cand.get("topicIds") or [],
        "needsReview": cand.get("needsReview", False),
        "source": _source_ref(conv, "table", ingest_batch),
    }


def grammar_record_and_body(cand: dict, conv: dict, ingest_batch: str) -> tuple[dict, str, str] | None:
    """Returns (index_record, body_relative_path, body_markdown), or None to skip.

    A candidate with a blank title or summary is dropped. The model does
    occasionally emit one (observed: a wholly empty grammar topic alongside a
    good one from the same conversation), and it used to sail through: an empty
    string is a structurally valid `Tr` value, so validate.py accepted it and
    the grammar list rendered a blank, unclickable row. Now caught at both ends
    — here, and as a hard gate in tools/ingest/validate.py.
    """
    if not cand.get("titleRu", "").strip() or not cand.get("summaryRu", "").strip():
        return None
    gid = idlib.auto_grammar_id(cand["titleRu"], cand["summaryRu"])
    # Derive the filename from the id itself (gid minus the "gr_" prefix),
    # not a separately-computed slug — otherwise a degenerate/unsafe slug
    # (e.g. one containing "/") can diverge from the id and break the path.
    body_rel = f"grammar/{gid[len('gr_'):]}.ru.md"
    record = {
        "id": gid,
        "title": {"ru": cand["titleRu"]},
        **({"level": cand["level"]} if cand.get("level") else {}),
        "order": 999,
        "summary": {"ru": cand["summaryRu"]},
        "bodyPath": {"ru": body_rel},
        "examples": [],
        **({"tags": cand["tagIds"]} if cand.get("tagIds") else {}),
        "source": _source_ref(conv, "model", ingest_batch),
    }
    return record, body_rel, cand["bodyMarkdownRu"]


# ---------------------------------------------------------------------------


def run(repo_root: Path, build_dir: Path, dry_run: bool, force: bool, batch_prefix: str = "extract") -> dict:
    data_dir = repo_root / "public" / "data" / "es"
    cache_dir = build_dir / "claude_cache"
    selected = json.loads((build_dir / "selected.json").read_text(encoding="utf-8"))
    conv_by_id = {c["id"]: c for c in selected["conversations"]}

    # "extract-<date>" for the Phase 2 archive run, "ingest-<date>" when driven
    # from the inbox — same convention the /ingest skill writes by hand.
    ingest_batch = f"{batch_prefix}-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"

    new_phrases, new_vocab, new_verbs, new_corrections, new_grammar = [], [], [], [], []
    grammar_bodies: dict[str, str] = {}
    proposed_topics: list[dict] = []

    for cache_file in sorted(cache_dir.glob("*.json")):
        conv_id = cache_file.stem
        conv = conv_by_id.get(conv_id)
        if conv is None:
            continue
        result = json.loads(cache_file.read_text(encoding="utf-8"))

        for p in result.get("phrases", []):
            rec = phrase_record(p, conv, ingest_batch)
            if rec:
                new_phrases.append(rec)
        for v in result.get("vocab", []):
            rec = vocab_record(v, conv, ingest_batch)
            if rec:
                new_vocab.append(rec)
        for vb in result.get("verbs", []):
            new_verbs.append(verb_record(vb, conv, ingest_batch))
        for c in result.get("corrections", []):
            rec = correction_record(c, conv, ingest_batch)
            if rec:
                new_corrections.append(rec)
        for g in result.get("grammarTopics", []):
            built = grammar_record_and_body(g, conv, ingest_batch)
            if built is None:
                continue
            rec, body_rel, body_md = built
            new_grammar.append(rec)
            grammar_bodies[body_rel] = body_md
        for pt in result.get("proposedTopics", []):
            proposed_topics.append({**pt, "conversationId": conv_id, "conversationTitle": conv["title"]})

    counts = {}
    packs = [
        ("phrases.json", "phrases", new_phrases),
        ("vocab.json", "vocab", new_vocab),
        ("verbs.json", "verbs", new_verbs),
        ("corrections.json", "corrections", new_corrections),
        ("grammar.json", "grammar", new_grammar),
    ]
    for filename, key, new_records in packs:
        path = data_dir / filename
        existing = _load_pack(path) if path.exists() else []
        merged, added, updated = upsert(existing, new_records, force)
        counts[key] = {"before": len(existing), "after": len(merged), "added": added, "updated": updated}
        # Skip the write entirely when nothing changed — writing unconditionally
        # would bump generatedAt every run even with byte-identical items,
        # breaking the idempotent-rerun guarantee (git status must stay clean).
        if not dry_run and (added or updated or not path.exists()):
            _write_pack(path, "es", merged)

    if not dry_run:
        grammar_dir = data_dir / "grammar"
        grammar_dir.mkdir(parents=True, exist_ok=True)
        for rel_path, body_md in grammar_bodies.items():
            full_path = data_dir / rel_path
            if not full_path.exists():
                full_path.write_text(body_md, encoding="utf-8")

        if proposed_topics:
            (build_dir / "proposed_topics.json").write_text(
                json.dumps(proposed_topics, ensure_ascii=False, indent=2), encoding="utf-8"
            )

    counts["proposedTopics"] = len(proposed_topics)
    return counts
