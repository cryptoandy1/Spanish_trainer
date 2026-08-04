"""Stage 2 driver: read tools/build/selected.json, run the regex extractors
over every selected conversation, write tools/build/regex_raw.json.
"""

from __future__ import annotations

import dataclasses
import json
from pathlib import Path

from .extractors import extract_conversation


def _asdict(obj):
    if dataclasses.is_dataclass(obj):
        return {k: _asdict(v) for k, v in dataclasses.asdict(obj).items()}
    if isinstance(obj, list):
        return [_asdict(v) for v in obj]
    return obj


def run(build_dir: Path) -> dict:
    selected_path = build_dir / "selected.json"
    selected = json.loads(selected_path.read_text(encoding="utf-8"))

    results = []
    for conv in selected["conversations"]:
        text = "\n".join(m["text"] for m in conv["messages"])
        extraction = extract_conversation(conv["id"], conv["title"], text)
        results.append(_asdict(extraction))

    payload = {
        "stage": "regex",
        "conversationCount": len(results),
        "totals": {
            "tables": sum(len(r["tables"]) for r in results),
            "conjugationTablesHighConfidence": sum(
                1 for r in results for t in r["tables"] if t["kind"] == "conjugation_positional"
            ),
            "phrasePairs": sum(len(r["phrase_pairs"]) for r in results),
            "corrections": sum(len(r["corrections"]) for r in results),
        },
        "conversations": results,
    }

    out_path = build_dir / "regex_raw.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload
