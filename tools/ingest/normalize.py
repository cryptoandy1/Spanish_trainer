"""Canonical read/write for public/data/{lang}/*.json pack files.

Shared by tools/spanish_extract/merge.py (Phase 2 batch extraction) and the
/ingest skill (Phase 3 ongoing updates) so both writers produce byte-identical
formatting for identical content — `items[]` sorted by id, indent-2 UTF-8
JSON, trailing newline. This is what keeps `git diff` small after either
writer touches a file, and what makes the idempotent-rerun guarantee
checkable with a plain `git status`.

The /ingest skill runs this as a CLI gate after using the Edit tool to
hand-add records: raw Edit-tool insertions won't necessarily land in sorted
position, so `python -m tools.ingest.normalize <file>` re-sorts and
re-serializes canonically before validate.py runs.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_pack(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_items(path: Path) -> list[dict]:
    return load_pack(path)["items"]


def write_pack(path: Path, lang: str, items: list[dict], generated_at: str | None = None) -> None:
    pack = {
        "schemaVersion": 1,
        "lang": lang,
        "generatedAt": generated_at or now_iso(),
        "items": sorted(items, key=lambda r: r["id"]),
    }
    path.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_file(path: Path) -> bool:
    """Re-sort + re-serialize an existing pack file canonically in place.

    Returns True if the file's bytes changed. Preserves the existing
    `generatedAt` — this is a formatting pass, not a content change, so it
    must not bump the timestamp (that would break the idempotent-rerun
    guarantee just like an unconditional merge write would).
    """
    before = path.read_text(encoding="utf-8")
    pack = load_pack(path)
    write_pack(path, pack["lang"], pack["items"], generated_at=pack["generatedAt"])
    after = path.read_text(encoding="utf-8")
    return before != after


def main(argv: list[str]) -> int:
    if not argv:
        print("usage: python -m tools.ingest.normalize <file.json> [<file.json>...]", file=sys.stderr)
        return 2
    changed = []
    for arg in argv:
        path = Path(arg)
        if normalize_file(path):
            changed.append(str(path))
    for path in changed:
        print(f"normalized: {path}")
    if not changed:
        print("no changes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
