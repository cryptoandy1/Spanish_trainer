"""Repair records whose id is not derived from their content, merging the
duplicates that mistake creates.

Why this exists: the Phase 1 seed data was hand-authored with invented ids
(`vc_a1b2c3d4`, `ph_1a0b3c4d` — literally sequential hex), violating the
content-derived-id rule in CLAUDE.md. Every such record is invisible to the
merge step of extraction and /ingest: those writers look a record up by its
content hash, miss the seed copy, and append a second record for the same
word or phrase. The user-visible symptom is duplicates in the vocab list.

The repair is therefore not "delete duplicates" but "give every record the id
its content implies, and fold together whatever collides as a result". Once
ids are canonical, re-running extraction over the same corpus merges into
these records instead of duplicating them again.

Usage:
    python -m tools.repair_ids public/data/es/vocab.json [--apply]

Without --apply it only reports (dry run). Records carrying `manual: true`
are never touched, per CLAUDE.md.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from tools.ingest.normalize import load_pack, write_pack
from tools.spanish_extract.ids import normalize, phrase_id, vocab_id

# Per-pack: how to compute the canonical id, and which field names the record
# for reporting. Verbs are absent on purpose — verb ids are `vb_<slug>` of the
# infinitive and were verified already correct.
CANONICAL = {
    "vocab": (lambda r: vocab_id(r["lemma"], r["pos"]), "lemma"),
    "phrases": (lambda r: phrase_id(r["text"]), "text"),
}


def _example_key(ex: dict) -> str:
    return normalize(ex.get("text", ""))


def merge_into(keep: dict, drop: dict) -> dict:
    """Fold `drop` into `keep`, keeping `keep`'s identity and provenance.

    `keep` is the record that already carries the canonical id — i.e. the one
    extracted from the real conversations — so its `tr` and `source` win. The
    seed record can still hold material the extraction never saw (a usage
    note, a plural, its own attested examples), and that is preserved rather
    than dropped: nothing here invents content, it only unions two records
    that were always meant to be one.
    """
    merged = dict(keep)

    seen = {_example_key(ex) for ex in merged.get("examples", [])}
    for ex in drop.get("examples", []):
        if _example_key(ex) not in seen:
            merged.setdefault("examples", []).append(ex)
            seen.add(_example_key(ex))

    merged["topics"] = sorted(set(merged.get("topics", [])) | set(drop.get("topics", [])))

    # Scalar fields the seed may have and the extraction may not. Never
    # overwrite a value the canonical record already has.
    for field in ("gender", "plural", "notes", "literal", "register", "level"):
        if field in drop and not merged.get(field):
            merged[field] = drop[field]

    # A record is only still "needs review" if BOTH copies thought so.
    if not drop.get("needsReview"):
        merged.pop("needsReview", None)

    return merged


def repair(items: list[dict], canonical_id, label_field: str) -> tuple[list[dict], list[str]]:
    by_id = {r["id"]: r for r in items}
    out: dict[str, dict] = {}
    log: list[str] = []

    for record in items:
        rid = record["id"]
        want = canonical_id(record)

        if rid == want:
            out.setdefault(rid, record)
            continue

        if record.get("manual"):
            log.append(f"SKIP (manual: true) {rid} — {record[label_field]!r} wants {want}")
            out[rid] = record
            continue

        twin = by_id.get(want) or out.get(want)
        if twin is None:
            fixed = dict(record)
            fixed["id"] = want
            out[want] = fixed
            log.append(f"REID  {rid} -> {want}  {record[label_field]!r} (no duplicate existed)")
        else:
            out[want] = merge_into(out.get(want, twin), record)
            log.append(f"MERGE {rid} into {want}  {record[label_field]!r}")

    return list(out.values()), log


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", help="pack file, e.g. public/data/es/vocab.json")
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = parser.parse_args(argv)

    path = Path(args.path)
    kind = path.stem
    if kind not in CANONICAL:
        print(f"no id recipe for {kind!r}; known: {', '.join(sorted(CANONICAL))}", file=sys.stderr)
        return 2

    canonical_id, label_field = CANONICAL[kind]
    pack = load_pack(path)
    items = pack["items"]
    repaired, log = repair(items, canonical_id, label_field)

    for line in log:
        print(line)
    print(f"\n{len(items)} records -> {len(repaired)} ({len(items) - len(repaired)} duplicates folded)")

    if not log:
        print("nothing to repair")
        return 0

    if args.apply:
        write_pack(path, pack["lang"], repaired, generated_at=pack["generatedAt"])
        print(f"wrote {path}")
    else:
        print("dry run — pass --apply to write")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
