#!/usr/bin/env python
"""Extraction pipeline CLI: chatGPT_history/ -> public/data/es/*.json.

Stages, independently re-runnable, each reading the previous stage's output
from tools/build/:

    select  -- filter conversations-001.json to the ones with Spanish content
    regex   -- cheap structural extraction (tables, pairs, correction blocks)
    claude  -- claude-opus-5 pass: classify candidates, fill gaps, tag topics
    merge   -- idempotent upsert into public/data/es/*.json
    all     -- run every stage in order

Usage:
    python tools/extract.py --stage select
    python tools/extract.py --stage regex
    python tools/extract.py --stage claude --limit 2
    python tools/extract.py --stage merge --dry-run
    python tools/extract.py --stage all
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_DIR = REPO_ROOT / "chatGPT_history"
BUILD_DIR = REPO_ROOT / "tools" / "build"
DATA_DIR = REPO_ROOT / "public" / "data" / "es"

sys.path.insert(0, str(Path(__file__).resolve().parent))

from spanish_extract.select import select, to_json as select_to_json  # noqa: E402
from spanish_extract import regex_stage  # noqa: E402
from spanish_extract import merge as merge_stage  # noqa: E402


def run_select() -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    selected = select(ARCHIVE_DIR)
    payload = select_to_json(selected)
    out_path = BUILD_DIR / "selected.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"select: kept {payload['count']} conversations, {payload['totalChars']} chars")
    print(f"  (threshold: score >= {payload['minScore']}, density >= {payload['minDensity']}/1k chars)")
    print(f"  wrote {out_path.relative_to(REPO_ROOT)}")
    print()
    for c in payload["conversations"]:
        print(f"  score={c['score']:>3}  density={c['density']:>5.1f}  chars={c['chars']:>6}  {c['title']}")


def run_regex() -> None:
    selected_path = BUILD_DIR / "selected.json"
    if not selected_path.exists():
        raise SystemExit("run --stage select first (tools/build/selected.json missing)")
    payload = regex_stage.run(BUILD_DIR)
    totals = payload["totals"]
    print(f"regex: {payload['conversationCount']} conversations")
    print(f"  tables: {totals['tables']} ({totals['conjugationTablesHighConfidence']} high-confidence conjugation)")
    print(f"  phrase pairs: {totals['phrasePairs']}")
    print(f"  corrections: {totals['corrections']}")
    print(f"  wrote {(BUILD_DIR / 'regex_raw.json').relative_to(REPO_ROOT)}")


def run_claude(limit: int | None) -> None:
    from spanish_extract import claude_pass

    regex_raw_path = BUILD_DIR / "regex_raw.json"
    if not regex_raw_path.exists():
        raise SystemExit("run --stage regex first (tools/build/regex_raw.json missing)")
    claude_pass.run(REPO_ROOT, BUILD_DIR, limit=limit)
    print(f"claude: cached results in {(BUILD_DIR / 'claude_cache').relative_to(REPO_ROOT)}")


def run_merge(dry_run: bool, force: bool) -> None:
    cache_dir = BUILD_DIR / "claude_cache"
    if not cache_dir.exists() or not any(cache_dir.glob("*.json")):
        raise SystemExit("run --stage claude first (tools/build/claude_cache/ is empty)")
    counts = merge_stage.run(REPO_ROOT, BUILD_DIR, dry_run=dry_run, force=force)
    label = "merge (dry run)" if dry_run else "merge"
    print(f"{label}:")
    for key, c in counts.items():
        if key == "proposedTopics":
            print(f"  proposed topics awaiting review: {c}")
            continue
        print(f"  {key}: {c['before']} -> {c['after']} (+{c['added']} added, {c['updated']} updated)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--stage", required=True, choices=["select", "regex", "claude", "merge", "all"])
    parser.add_argument("--limit", type=int, default=None, help="claude stage: cap number of conversations")
    parser.add_argument("--dry-run", action="store_true", help="merge stage: report counts, write nothing")
    parser.add_argument("--force", action="store_true", help="merge stage: overwrite non-manual scalar fields")
    args = parser.parse_args()

    stages = ["select", "regex", "claude", "merge"] if args.stage == "all" else [args.stage]
    for stage in stages:
        if stage == "select":
            run_select()
        elif stage == "regex":
            run_regex()
        elif stage == "claude":
            run_claude(args.limit)
        elif stage == "merge":
            run_merge(args.dry_run, args.force)


if __name__ == "__main__":
    main()
