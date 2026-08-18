"""Keep vocab.json and verbs.json in sync, in both directions.

`VocabWord.verbId` is the schema's declared link into verbs.json ("link into
verbs.json when pos === 'verb'"), but extraction wrote the two packs
independently and almost never set it — so the vocab list had no way to know
that a word like "tener" also has a full paradigm one click away.

Direction 1 — vocab -> verb: backfill `verbId` on a `pos: "verb"` record whose
lemma matches a known infinitive. The link is derived, not invented: a match
requires normalize(lemma) == normalize(infinitive), the same normalization
that generates ids (tools/spanish_extract/ids.py). Records with `manual: true`
are left untouched, and an existing verbId is never overwritten.

Direction 2 — verb -> vocab: every verbs.json record must be reachable from
the word list, i.e. at least one vocab record must point at it via `verbId`.
The word list (Слова, and the per-batch view in Недавнее) is built from
vocab.json only, so a verb that exists solely in verbs.json is invisible
there — which is exactly what happened to 21 verbs in ingest-2026-08-17
(the /ingest run stubbed verbs.json and forgot the vocab side). For such a
verb this tool creates a `pos: "verb"` vocab record with the bare infinitive
as lemma, copying `tr`, `topics`, `needsReview` and `source` from the verb
record — again derived, not invented: no new Spanish, no new Russian.

Usage:
    python -m tools.link_vocab_verbs [--apply]
"""

from __future__ import annotations

import argparse
from pathlib import Path

from tools.ingest.normalize import load_pack, write_pack
from tools.spanish_extract.ids import normalize, vocab_id

DATA = Path("public/data/es")


def vocab_stub_for_verb(verb: dict) -> dict:
    """The vocab record a verbs.json entry implies. Everything is copied from
    the verb record; the id is content-derived like every other id, so a later
    ingest that adds the same word by hand lands on this record and merges."""
    stub = {
        "id": vocab_id(verb["infinitive"], "verb"),
        "lemma": verb["infinitive"],
        "pos": "verb",
        "tr": dict(verb["tr"]),
        "examples": [],
        "topics": list(verb.get("topics") or []),
        "verbId": verb["id"],
        "source": dict(verb["source"]),
    }
    if verb.get("needsReview"):
        stub["needsReview"] = True
    return stub


def link(vocab: list[dict], verbs: list[dict]) -> tuple[list[dict], list[str]]:
    by_infinitive = {normalize(v["infinitive"]): v["id"] for v in verbs}
    log: list[str] = []
    out = []

    # Direction 1: vocab -> verb.
    for record in vocab:
        updated = dict(record)
        if record["pos"] == "verb" and not record.get("verbId") and not record.get("manual"):
            verb_id = by_infinitive.get(normalize(record["lemma"]))
            if verb_id:
                updated["verbId"] = verb_id
                log.append(f"{record['id']}  {record['lemma']} -> {verb_id}")
        out.append(updated)

    # Direction 2: verb -> vocab. Computed after direction 1 so a lemma that
    # was just linked counts as coverage and no duplicate stub is created.
    covered = {r["verbId"] for r in out if r.get("verbId")}
    existing_ids = {r["id"] for r in out}
    for verb in verbs:
        if verb["id"] in covered:
            continue
        stub = vocab_stub_for_verb(verb)
        if stub["id"] in existing_ids:
            # Same lemma+pos already exists but points elsewhere (or nowhere and
            # is manual) — don't fight it, just report.
            log.append(f"!! {verb['id']}  {verb['infinitive']}: vocab {stub['id']} exists but does not link to it")
            continue
        out.append(stub)
        existing_ids.add(stub["id"])
        covered.add(verb["id"])
        log.append(f"{stub['id']}  {verb['infinitive']} <- {verb['id']} (new vocab record)")

    return out, log


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = parser.parse_args(argv)

    vocab_path = DATA / "vocab.json"
    vocab_pack = load_pack(vocab_path)
    verbs = load_pack(DATA / "verbs.json")["items"]

    linked, log = link(vocab_pack["items"], verbs)
    for line in log:
        print(line)
    print(f"\n{len(log)} vocab/verb link(s) changed")

    if log and args.apply:
        write_pack(vocab_path, vocab_pack["lang"], linked, generated_at=vocab_pack["generatedAt"])
        print(f"wrote {vocab_path}")
    elif log:
        print("dry run — pass --apply to write")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
