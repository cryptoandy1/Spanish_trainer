"""Headless ingest of `inbox/*.md|*.txt` — the CI counterpart of the /ingest skill.

The /ingest skill needs a Claude Code session to do the extraction, so it can't
run in GitHub Actions. This module drives the same Phase 2 pipeline that
`tools/extract.py` uses against the ChatGPT archive, but fed from plain text
files instead:

    inbox/*.md  ->  tools/build/selected.json  ->  regex  ->  claude  ->  merge

Only the first arrow is new code. `regex_stage.run` and `claude_pass.run` read
`selected.json` and need nothing from it beyond
`conversations[{id, title, messages:[{role, text}]}]`, so synthesizing that
shape is the whole adapter — the extraction logic, prompts, schemas, id recipes
and merge semantics are all shared with the archive pipeline and cannot drift.

Run `python -m tools.ingest.finish` afterwards (the workflow does): this module
deliberately stops at merge, leaving paradigm filling, linking and validation to
the single post-write gate.

Usage:
    python -m tools.ingest.from_inbox                 # process inbox/
    python -m tools.ingest.from_inbox --dry-run       # extract, write no data
    python -m tools.ingest.from_inbox --archive       # move files to inbox/processed/
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BUILD_DIR = REPO_ROOT / "tools" / "build"
INBOX = REPO_ROOT / "inbox"
TEXT_SUFFIXES = {".md", ".txt"}

sys.path.insert(0, str(REPO_ROOT))

from tools.spanish_extract import merge as merge_stage  # noqa: E402
from tools.spanish_extract import regex_stage  # noqa: E402

# Speaker markers seen in real pasted transcripts. Anything matching switches
# the current role; unmatched lines belong to whoever is speaking. Roles only
# matter for the model in claude_pass (they let it tell the user's attempt from
# the correction) — regex_stage concatenates all messages regardless.
_ASSISTANT_RE = re.compile(r"^\s*(?:\*\*)?(?:claude|chatgpt|assistant|бот|ассистент)(?:\*\*)?\s*[:：]", re.I)
_USER_RE = re.compile(r"^\s*(?:\*\*)?(?:я|ты|you|user|me|вопрос)(?:\*\*)?\s*[:：]", re.I)


def split_messages(text: str) -> list[dict]:
    """Split a transcript into role-tagged messages.

    Falls back to a single `user` message when no markers are present — which
    is the common case for a straight copy-paste out of the Claude app, and is
    harmless: the model still sees the whole exchange, just unlabelled.
    """
    lines = text.splitlines()
    messages: list[dict] = []
    role = "user"
    buffer: list[str] = []

    def flush() -> None:
        body = "\n".join(buffer).strip()
        if body:
            messages.append({"role": role, "text": body, "createTime": None})

    for line in lines:
        if _ASSISTANT_RE.match(line):
            flush()
            role, buffer = "assistant", [_strip_marker(line)]
        elif _USER_RE.match(line):
            flush()
            role, buffer = "user", [_strip_marker(line)]
        else:
            buffer.append(line)
    flush()

    if not messages:
        return [{"role": "user", "text": text.strip(), "createTime": None}]
    return messages


def _strip_marker(line: str) -> str:
    return line.split(":", 1)[1].strip() if ":" in line else ""


def derive_title(text: str) -> str:
    """First markdown heading, else the first non-empty line, trimmed."""
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()[:120]
        return stripped[:60].rstrip() + ("…" if len(stripped) > 60 else "")
    return "(untitled)"


def conversation_id(text: str) -> str:
    """Content-derived, so re-sending the same transcript hits the same cache
    entry and merges instead of duplicating — the same guarantee the record ids
    give (see CLAUDE.md). Deliberately NOT the filename: the phone stamps a
    timestamp into that, so two drops of one conversation would look distinct.
    """
    return "inbox-" + hashlib.sha1(text.strip().encode("utf-8")).hexdigest()[:8]


def inbox_files() -> list[Path]:
    if not INBOX.exists():
        return []
    return sorted(p for p in INBOX.iterdir() if p.is_file() and p.suffix.lower() in TEXT_SUFFIXES and p.name != "README.md")


def build_selected(files: list[Path]) -> dict:
    """Synthesize the `selected.json` that regex/claude stages read.

    Mirrors `spanish_extract.select.to_json` — same keys, same nesting. The
    scoring fields it carries (score/density) are informational there and unused
    downstream, so they're reported as 0 here rather than faked.
    """
    conversations = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        if not text.strip():
            print(f"  skip (empty): {path.name}")
            continue
        conversations.append(
            {
                "id": conversation_id(text),
                "title": derive_title(text),
                "createTime": None,
                "score": 0,
                "density": 0,
                "chars": len(text),
                # Read by merge._source_ref: marks these records as coming from
                # a Claude conversation rather than the ChatGPT archive.
                "origin": "claude",
                "sourceFile": path.name,
                "messages": split_messages(text),
            }
        )

    return {
        "stage": "select",
        "minScore": 0,
        "minDensity": 0,
        "count": len(conversations),
        "totalChars": sum(c["chars"] for c in conversations),
        "conversations": conversations,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="extract and report, write no data files")
    parser.add_argument("--archive", action="store_true", help="move processed files to inbox/processed/")
    args = parser.parse_args(argv)

    files = inbox_files()
    if not files:
        print("inbox/ is empty — nothing to ingest")
        return 0

    print(f"{len(files)} file(s) in inbox/:")
    for path in files:
        print(f"  {path.name}")

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    selected = build_selected(files)
    if not selected["conversations"]:
        print("nothing usable in inbox/")
        return 0

    (BUILD_DIR / "selected.json").write_text(json.dumps(selected, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nselect: {selected['count']} conversation(s), {selected['totalChars']} chars")
    for conv in selected["conversations"]:
        print(f"  {conv['id']}  {len(conv['messages'])} message(s)  {conv['title']}")

    print("\n=== regex")
    payload = regex_stage.run(BUILD_DIR)
    totals = payload["totals"]
    print(f"  tables: {totals['tables']}, phrase pairs: {totals['phrasePairs']}, corrections: {totals['corrections']}")

    print("\n=== claude (API)")
    from tools.spanish_extract import claude_pass

    claude_pass.run(REPO_ROOT, BUILD_DIR)

    print("\n=== merge")
    counts = merge_stage.run(REPO_ROOT, BUILD_DIR, dry_run=args.dry_run, force=False, batch_prefix="ingest")
    for key, c in counts.items():
        if key == "proposedTopics":
            print(f"  proposed topics awaiting review: {c}")
            continue
        print(f"  {key}: {c['before']} -> {c['after']} (+{c['added']} added, {c['updated']} updated)")

    if args.archive and not args.dry_run:
        processed = INBOX / "processed"
        processed.mkdir(exist_ok=True)
        for path in files:
            path.replace(processed / path.name)
        print(f"\narchived {len(files)} file(s) to {processed.relative_to(REPO_ROOT)}/")

    print("\nnow run: python -m tools.ingest.finish")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
