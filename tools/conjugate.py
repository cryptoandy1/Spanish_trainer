#!/usr/bin/env python
"""Fill complete conjugation paradigms into public/data/es/verbs.json.

The extraction pipeline only ever captured the conjugation cells that literally
appeared in the user's study conversations — 358 of 4620 (7.75%), with most
verbs having a single tense. This tool asks the API for the full standard
paradigm of each verb and fills the gaps, leaving every attested form untouched.

Two stages:
    generate  -- one API call per verb, cached to tools/build/conjugation_cache/
    merge     -- fold the cache into verbs.json (attested forms always win)

Usage:
    python tools/conjugate.py --stage generate --limit 2   # spot-check first
    python tools/conjugate.py --stage generate             # all verbs
    python tools/conjugate.py --stage merge --dry-run
    python tools/conjugate.py --stage all

Re-running is free and idempotent: cached verbs are skipped, and a merge that
adds nothing rewrites nothing. Run it again after /ingest adds a new verb.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BUILD_DIR = REPO_ROOT / "tools" / "build"

sys.path.insert(0, str(REPO_ROOT))

from tools.spanish_extract import conjugate_pass  # noqa: E402


def run_generate(limit: int | None, force: bool) -> None:
    # .env loading lives in conjugate_pass.run() now (shared with claude_pass,
    # which had the same need and no such loader) — see spanish_extract/env.py.
    conjugate_pass.run(REPO_ROOT, BUILD_DIR, limit=limit, force=force)
    print(f"generate: cached paradigms in {(BUILD_DIR / 'conjugation_cache').relative_to(REPO_ROOT)}")


def run_merge(dry_run: bool) -> None:
    cache_dir = BUILD_DIR / "conjugation_cache"
    if not cache_dir.exists() or not any(cache_dir.glob("*.json")):
        raise SystemExit("run --stage generate first (tools/build/conjugation_cache/ is empty)")

    stats = conjugate_pass.merge(REPO_ROOT, BUILD_DIR, dry_run=dry_run)
    label = "merge (dry run)" if dry_run else "merge"
    print(f"{label}:")
    print(f"  verbs processed: {stats['verbs']}")
    print(f"  cells added:     {stats['cellsAdded']}")
    print(f"  cells kept (already attested): {stats['cellsKept']}")
    if stats["skippedRows"]:
        print(f"  rows skipped (unknown tense/person or blank): {stats['skippedRows']}")

    conflicts = stats["conflicts"]
    if conflicts:
        print(f"\n  {len(conflicts)} disagreement(s) between attested and generated forms.")
        print("  The attested form was kept in every case — review these by hand:")
        for c in conflicts:
            print(f"    {c['verb']:<16} {c['cell']:<34} attested={c['attested']!r}  generated={c['generated']!r}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--stage", required=True, choices=["generate", "merge", "all"])
    parser.add_argument("--limit", type=int, default=None, help="generate stage: cap number of verbs")
    parser.add_argument("--force", action="store_true", help="generate stage: ignore the cache and re-ask")
    parser.add_argument("--dry-run", action="store_true", help="merge stage: report counts, write nothing")
    args = parser.parse_args()

    for stage in (["generate", "merge"] if args.stage == "all" else [args.stage]):
        if stage == "generate":
            run_generate(args.limit, args.force)
        elif stage == "merge":
            run_merge(args.dry_run)


if __name__ == "__main__":
    main()
