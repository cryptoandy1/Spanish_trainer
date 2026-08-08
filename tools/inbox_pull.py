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

Deletion can also be deferred, which is what CI does: `--keep` pulls and
records what it took in `tools/build/inbox_manifest.json`, and a later
`--purge-manifest` deletes exactly those files. In a workflow the extraction can
still fail validation after the pull, and dropping the remote copy before the
records are safely in a pull request would lose the conversation for good.

Authentication piggybacks on the `gh` CLI (already logged in for this project),
so no token is stored anywhere in this repo. In GitHub Actions, `gh` reads
GH_TOKEN from the environment instead.

Usage:
    python -m tools.inbox_pull                    # pull, then delete from the remote
    python -m tools.inbox_pull --keep             # pull, record a manifest, delete nothing
    python -m tools.inbox_pull --purge-manifest   # delete what the manifest lists
    python -m tools.inbox_pull --list             # just show what's waiting
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
MANIFEST = Path("tools/build/inbox_manifest.json")


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
        # A 404 here is ambiguous: the inbox/ directory genuinely doesn't exist
        # (normal — it only exists while something is waiting), OR the token
        # can't see the repository at all. GitHub deliberately answers 404
        # rather than 403 for private repos, so the two are indistinguishable
        # from this call alone.
        #
        # Worth telling apart: an expired or wrong token would otherwise report
        # "nothing waiting" forever, and the automation would look healthy while
        # silently ingesting nothing. Asking for the repo itself settles it.
        if gh_api(f"repos/{INBOX_REPO}") is None:
            raise SystemExit(
                f"cannot see {INBOX_REPO} — the token is missing, expired, or lacks "
                f"'Contents: Read and write' on that repository (GitHub reports this as 404)"
            )
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


def delete_remote(entries: list[dict]) -> None:
    for entry in entries:
        gh_api(
            f"repos/{INBOX_REPO}/contents/{entry['path']}",
            method="DELETE",
            fields={"message": f"pulled {entry['name']} into the trainer", "sha": entry["sha"]},
        )


def purge_manifest() -> int:
    if not MANIFEST.exists():
        print(f"no manifest at {MANIFEST} — nothing to purge")
        return 0
    entries = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if not entries:
        print("manifest is empty — nothing to purge")
        MANIFEST.unlink()
        return 0
    delete_remote(entries)
    print(f"removed {len(entries)} file(s) from {INBOX_REPO}:")
    for entry in entries:
        print(f"  {entry['name']}")
    MANIFEST.unlink()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keep", action="store_true", help="don't delete the remote copies after pulling")
    parser.add_argument("--list", action="store_true", dest="list_only", help="show what's waiting and exit")
    parser.add_argument(
        "--purge-manifest",
        action="store_true",
        dest="purge",
        help="delete the remote files recorded by an earlier --keep run, then drop the manifest",
    )
    args = parser.parse_args(argv)

    if args.purge:
        return purge_manifest()

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

    # Record what was taken before deleting anything, so a deferred purge
    # (--purge-manifest) can delete exactly these and nothing that arrived in
    # the meantime.
    manifest = [{"name": f["name"], "path": f["path"], "sha": f["sha"]} for f, _ in pulled]
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # Deletion happens only after every local write above succeeded.
    if args.keep:
        print(f"kept remote copies; recorded {len(manifest)} file(s) in {MANIFEST}")
    else:
        delete_remote(manifest)
        print(f"removed {len(pulled)} file(s) from the private inbox repo")
        MANIFEST.unlink(missing_ok=True)

    print(f"\n{len(pulled)} conversation(s) in {LOCAL_INBOX}/ — run /ingest to fold them into the data")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
