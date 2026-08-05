"""Backfill `verbId` on vocab records whose lemma is a verb we have a
conjugation table for.

`VocabWord.verbId` is the schema's declared link into verbs.json ("link into
verbs.json when pos === 'verb'"), but extraction wrote the two packs
independently and almost never set it — so the vocab list had no way to know
that a word like "tener" also has a full paradigm one click away.

The link is derived, not invented: a vocab record is matched to a verb only
when normalize(lemma) == normalize(infinitive), the same normalization that
generates ids (tools/spanish_extract/ids.py), so this is reproducible and
adds no content. Records with `manual: true` are left untouched, and an
existing verbId is never overwritten.

Usage:
    python -m tools.link_vocab_verbs [--apply]
"""

from __future__ import annotations

import argparse
from pathlib import Path

from tools.ingest.normalize import load_pack, write_pack
from tools.spanish_extract.ids import normalize

DATA = Path("public/data/es")


def link(vocab: list[dict], verbs: list[dict]) -> tuple[list[dict], list[str]]:
    by_infinitive = {normalize(v["infinitive"]): v["id"] for v in verbs}
    log: list[str] = []
    out = []

    for record in vocab:
        updated = dict(record)
        if record["pos"] == "verb" and not record.get("verbId") and not record.get("manual"):
            verb_id = by_infinitive.get(normalize(record["lemma"]))
            if verb_id:
                updated["verbId"] = verb_id
                log.append(f"{record['id']}  {record['lemma']} -> {verb_id}")
        out.append(updated)

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
    print(f"\n{len(log)} vocab records linked to a verb entry")

    if log and args.apply:
        write_pack(vocab_path, vocab_pack["lang"], linked, generated_at=vocab_pack["generatedAt"])
        print(f"wrote {vocab_path}")
    elif log:
        print("dry run — pass --apply to write")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
