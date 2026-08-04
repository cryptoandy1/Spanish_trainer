"""Content-derived id generation for the /ingest skill.

Re-exports tools.spanish_extract.ids directly rather than re-implementing —
the whole point of content-derived ids is that extract.py and /ingest land
on the same id for the same content, and a second parallel implementation
is exactly how that guarantee would rot. This module's only job on top of
the shared logic is a CLI, so the /ingest skill computes ids by running
code (`python -m tools.ingest.idgen ...`) instead of hand-computing a hash.

Usage:
    python -m tools.ingest.idgen phrase "Text"
    python -m tools.ingest.idgen vocab "lemma" pos
    python -m tools.ingest.idgen verb "infinitive"
    python -m tools.ingest.idgen correction "attempt" "correct"
    python -m tools.ingest.idgen grammar "title" "summary"
    python -m tools.ingest.idgen topic "Latin Name"
"""

from __future__ import annotations

import sys

from tools.spanish_extract.ids import (
    auto_grammar_id,
    correction_id,
    grammar_id,
    normalize,
    normalize_loose,
    phrase_id,
    slug,
    topic_id,
    vocab_id,
    verb_id,
)

__all__ = [
    "auto_grammar_id",
    "correction_id",
    "grammar_id",
    "normalize",
    "normalize_loose",
    "phrase_id",
    "slug",
    "topic_id",
    "vocab_id",
    "verb_id",
]

_COMMANDS = {
    "phrase": (phrase_id, 1),
    "vocab": (vocab_id, 2),
    "verb": (verb_id, 1),
    "correction": (correction_id, 2),
    "grammar": (auto_grammar_id, 2),
    "topic": (topic_id, 1),
}


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in _COMMANDS:
        print(f"usage: python -m tools.ingest.idgen <{'|'.join(_COMMANDS)}> <args...>", file=sys.stderr)
        return 2
    kind, args = argv[0], argv[1:]
    fn, nargs = _COMMANDS[kind]
    if len(args) != nargs:
        print(f"{kind} expects {nargs} argument(s), got {len(args)}", file=sys.stderr)
        return 2
    print(fn(*args))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
