"""Read ANTHROPIC_API_KEY out of the gitignored .env, if present.

Called by the two stages that actually construct an Anthropic client
(`claude_pass.run`, `conjugate_pass.run`) rather than by each CLI entry point —
tools/extract.py never loaded it, so the Phase 2 claude stage only worked when
the key happened to be exported in the shell, and tools/ingest/from_inbox.py
would have inherited the same gap.

Kept dependency-free (no python-dotenv) and non-destructive: a value already
exported in the real environment always wins, which is what GitHub Actions
relies on — there is no .env there, the key arrives as a repository secret.
"""

from __future__ import annotations

import os
from pathlib import Path


def load_dotenv(repo_root: Path | None = None) -> None:
    root = repo_root or Path(__file__).resolve().parent.parent.parent
    env_path = root / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
