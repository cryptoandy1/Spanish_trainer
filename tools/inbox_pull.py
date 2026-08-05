"""Pull conversations shared from the phone into the local `inbox/` folder.

The phone can't run the ingest pipeline, and this repository is public, so raw
transcripts can't be dropped into it directly. Instead the phone writes them to
a separate PRIVATE repository (`cryptoandy1/spanish-inbox`) via the GitHub API
— see the shortcut recipe in the /ingest skill — and this script moves them
from there onto this machine:

    remote private repo  ->  local inbox/  ->  /ingest  ->  public/data/*.json

Files are deleted from the private repo once they are safely written locally,
so the same conversation is never pulled twice. That deletion is the only
destructive step, and it happens strictly after the local write succeeds.

Authentication piggybacks on the `gh` CLI (already logged in for this project),
so no token is stored anywhere in this repo.

Usage:
    python -m tools.inbox_pull            # pull, then delete from the remote
    python -m tools.inbox_pull --keep     # pull but leave the remote copies
    python -m tools.inbox_pull --list     # just show what's waiting
"""

from __future__ import annotations

import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path

INBOX_REPO = "cryptoandy1/spanish-inbox"
REMOTE_DIR = "inbox"
LOCAL_INBOX = Path("inbox")
TEXT_SUFFIXES = {".md", ".txt"}


def gh_api(path: str, method: str = "GET", fields: dict[str, str] | None = None) -> object | None:
    """Call the GitHub API through `gh`. Returns None on 404 (nothing there yet)."""
    argv = ["gh", "api", "-X", method, path]
    for key, value in (fields or {}).items():
        argv += ["-f", f"{key}={value}"]
    result = subprocess.run(argv, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        if "404" in result.stderr or "Not Found" in result.stderr:
            return None
        print(result.stderr.strip(), file=sys.stderr)
        raise SystemExit(f"gh api failed: {method} {path}")
    return json.loads(result.stdout) if result.stdout.strip() else None


def list_remote() -> list[dict]:
    listing = gh_api(f"repos/{INBOX_REPO}/contents/{REMOTE_DIR}")
    if not listing:
        return []
    if isinstance(listing, dict):  # a single file where a directory was expected
        listing = [listing]
    return [f for f in listing if f["type"] == "file" and Path(f["name"]).suffix.lower() in TEXT_SUFFIXES]


def unique_path(name: str) -> Path:
    """Never overwrite an existing local file — same-named drops get a suffix."""
    candidate = LOCAL_INBOX / name
    stem, suffix, n = candidate.stem, candidate.suffix, 2
    while candidate.exists():
        candidate = LOCAL_INBOX / f"{stem}-{n}{suffix}"
        n += 1
    return candidate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keep", action="store_true", help="don't delete the remote copies after pulling")
    parser.add_argument("--list", action="store_true", dest="list_only", help="show what's waiting and exit")
    args = parser.parse_args(argv)

    files = list_remote()
    if not files:
        print(f"nothing waiting in {INBOX_REPO}/{REMOTE_DIR}")
        return 0

    print(f"{len(files)} file(s) waiting in {INBOX_REPO}/{REMOTE_DIR}:")
    for f in files:
        print(f"  {f['name']}  ({f['size']} bytes)")
    if args.list_only:
        return 0

    LOCAL_INBOX.mkdir(exist_ok=True)
    pulled = []
    for f in files:
        blob = gh_api(f"repos/{INBOX_REPO}/contents/{f['path']}")
        if not isinstance(blob, dict) or "content" not in blob:
            print(f"  SKIP {f['name']}: no inline content (too large?)", file=sys.stderr)
            continue
        text = base64.b64decode(blob["content"]).decode("utf-8")

        target = unique_path(f["name"])
        target.write_text(text, encoding="utf-8")
        pulled.append((f, target))
        print(f"  pulled -> {target}")

    # Deletion happens only after every local write above succeeded.
    if not args.keep:
        for f, _ in pulled:
            gh_api(
                f"repos/{INBOX_REPO}/contents/{f['path']}",
                method="DELETE",
                fields={"message": f"pulled {f['name']} into the trainer", "sha": f["sha"]},
            )
        print(f"removed {len(pulled)} file(s) from the private inbox repo")

    print(f"\n{len(pulled)} conversation(s) in {LOCAL_INBOX}/ — run /ingest to fold them into the data")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
