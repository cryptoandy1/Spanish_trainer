"""Build the pull-request body for the automated inbox ingest.

Lives in a file rather than a heredoc inside .github/workflows/ingest.yml: a
Python heredoc nested in an indented YAML `run:` block keeps the indentation,
which is a syntax error in Python and an invisible one in YAML.

Two modes, called before and after the extraction:

    python -m tools.ci.pr_body --snapshot > before.json
    ... extraction runs ...
    python -m tools.ci.pr_body --body before.json > pr_body.md

The before/after comparison is taken from files on disk, deliberately not from
`git show origin/master:...` — the workflow has already committed to a branch by
then, and resolving the base ref in a shallow CI checkout is a needless way to
get this wrong.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DATA = Path("public/data/es")
SELECTED = Path("tools/build/selected.json")
PACKS = ["phrases", "vocab", "verbs", "grammar", "corrections"]
LABELS = {
    "phrases": "фразы",
    "vocab": "слова",
    "verbs": "глаголы",
    "grammar": "статьи",
    "corrections": "исправления",
}


def counts() -> dict[str, int]:
    out = {}
    for name in PACKS:
        path = DATA / f"{name}.json"
        if path.exists():
            out[name] = len(json.loads(path.read_text(encoding="utf-8"))["items"])
    return out


def snapshot() -> dict:
    """Everything the PR body needs to describe the run as a delta.

    `needsReview` is counted here rather than only after the run: the repo
    already carries flagged records from earlier ingests, and reporting the
    absolute total would tell the reviewer to go look at 22 records when this
    run added three.
    """
    return {"counts": counts(), "needsReview": len(needs_review_ids())}


def conversation_titles() -> list[str]:
    if not SELECTED.exists():
        return []
    selected = json.loads(SELECTED.read_text(encoding="utf-8"))
    return [c["title"] for c in selected.get("conversations", [])]


def needs_review_ids() -> list[str]:
    """Records whose translation was supplied rather than taken from the source.

    Surfaced in the PR body on purpose: these are the ones most worth a glance
    before merging (see the `needsReview` rule in CLAUDE.md).
    """
    flagged = []
    for name in ("phrases", "vocab", "verbs"):
        path = DATA / f"{name}.json"
        if not path.exists():
            continue
        for item in json.loads(path.read_text(encoding="utf-8"))["items"]:
            if item.get("needsReview"):
                flagged.append(item["id"])
    return flagged


def build_body(baseline_path: Path) -> str:
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    before = baseline["counts"]
    after = counts()
    lines = ["Разобрано автоматически из inbox (`.github/workflows/ingest.yml`).", ""]

    changed = [(n, before.get(n, 0), after[n]) for n in PACKS if n in after and after[n] != before.get(n, 0)]
    if changed:
        lines += ["| раздел | было | стало |", "|---|---|---|"]
        for name, b, a in changed:
            lines.append(f"| {LABELS.get(name, name)} | {b} | {a} (+{a - b}) |")
    else:
        lines.append("Количество записей не изменилось — обновились только поля существующих.")

    titles = conversation_titles()
    if titles:
        lines += ["", "**Разговоры:**", ""] + [f"- {t}" for t in titles]

    new_flagged = len(needs_review_ids()) - baseline.get("needsReview", 0)
    if new_flagged > 0:
        lines += [
            "",
            f"**Новых записей с `needsReview: true`: {new_flagged}** — у них перевод "
            "дописан извлекателем, а не взят из разговора. Их стоит просмотреть в диффе "
            "внимательнее остальных.",
        ]

    lines += ["", "Мерж запускает пересборку сайта через Pages."]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--snapshot", action="store_true", help="print current record counts as JSON")
    group.add_argument("--body", metavar="BASELINE_JSON", help="print the PR body in markdown")
    args = parser.parse_args(argv)

    if args.snapshot:
        json.dump(snapshot(), sys.stdout, ensure_ascii=False, indent=2)
        print()
    else:
        sys.stdout.write(build_body(Path(args.body)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
