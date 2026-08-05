"""Post-write pipeline: everything that must happen after records land in
public/data/es/*.json, in one command.

The /ingest skill used to spell these out as separate steps, which is exactly
how tools/link_vocab_verbs.py got forgotten when it was added — a new verb
would get its conjugation table but no link from the word list. Ordering
matters and is not obvious, so it lives here rather than in prose:

1. normalize  — re-sort items[] by id, canonical formatting. Must run before
                validate, which rejects out-of-order items.
2. conjugate  — fill complete paradigms for any newly added verb. Never
                overwrites a form attested in a conversation. Writes verbs.json,
                so it has to run before the final normalize/validate pass.
3. link       — backfill verbId on vocab whose lemma is now a known verb.
                Must follow conjugate: a verb added in this batch only becomes
                linkable once it exists in verbs.json.
4. normalize  — again, because steps 2-3 wrote files.
5. validate   — hard gate: shapes plus referential integrity.

Exit code is non-zero if validation fails, so this is safe to use as a gate in
a script or a CI job.

Usage:
    python -m tools.ingest.finish
    python -m tools.ingest.finish --skip-conjugate   # no verbs were touched
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

DATA = Path("public/data/es")
PACKS = ["phrases.json", "vocab.json", "verbs.json", "topics.json", "grammar.json", "widgets.json", "corrections.json"]


def _run(label: str, argv: list[str]) -> int:
    print(f"\n=== {label}")
    result = subprocess.run([sys.executable, *argv])
    return result.returncode


def _normalize() -> int:
    files = [str(DATA / name) for name in PACKS if (DATA / name).exists()]
    return _run("normalize", ["-m", "tools.ingest.normalize", *files])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-conjugate",
        action="store_true",
        help="skip paradigm filling (safe to leave on: it is a no-op when no verb was added, just slower)",
    )
    args = parser.parse_args(argv)

    if code := _normalize():
        return code

    if not args.skip_conjugate:
        if code := _run("conjugate", ["tools/conjugate.py", "--stage", "all"]):
            return code

    if code := _run("link vocab -> verbs", ["-m", "tools.link_vocab_verbs", "--apply"]):
        return code

    if code := _normalize():
        return code

    if code := _run("validate", ["-m", "tools.ingest.validate"]):
        print("\nFAILED: data does not validate — fix the records and re-run", file=sys.stderr)
        return code

    print("\nall good — review `git diff` before committing")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
