"""Load chatGPT_history/conversations-001.json and reconstruct message order.

conversation.mapping is a tree keyed by node id; message create_time is
provably unreliable (assistant replies sometimes stamped before the user
message they answer — verified against the real archive), so order is
reconstructed by walking mapping[current_node].parent links back to the
root and reversing, never by sorting on create_time.

conversations-000.json and conversations-002.json are never opened here —
only conversations-001.json has Spanish-learning content (see
CHATGPT_HISTORY_FILE below).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

CHATGPT_HISTORY_FILE = "conversations-001.json"

# Roles worth keeping; ChatGPT exports may also carry "system"/"tool" nodes
# (hidden memory/plugin context) that are not part of the visible dialogue.
_KEPT_ROLES = {"user", "assistant"}


@dataclass
class Message:
    role: str  # "user" | "assistant"
    text: str
    create_time: float | None = None


@dataclass
class Conversation:
    id: str
    title: str
    create_time: float | None
    messages: list[Message] = field(default_factory=list)

    @property
    def full_text(self) -> str:
        return "\n".join(m.text for m in self.messages)


def _extract_text(content: dict | None) -> str:
    if not content:
        return ""
    content_type = content.get("content_type")
    if content_type not in ("text", "multimodal_text"):
        # code/execution_output/thoughts/reasoning_recap/tether_* etc: not
        # visible dialogue text, skip.
        return ""
    parts = content.get("parts") or []
    pieces = [p for p in parts if isinstance(p, str)]
    return "\n".join(p for p in pieces if p.strip())


def _walk_to_root(mapping: dict, current_node: str | None) -> list[str]:
    if not current_node or current_node not in mapping:
        return []
    chain: list[str] = []
    node_id: str | None = current_node
    seen: set[str] = set()
    while node_id is not None and node_id not in seen:
        seen.add(node_id)
        chain.append(node_id)
        node_id = mapping[node_id].get("parent")
    chain.reverse()
    return chain


def _to_conversation(raw: dict) -> Conversation:
    mapping = raw.get("mapping") or {}
    node_ids = _walk_to_root(mapping, raw.get("current_node"))

    messages: list[Message] = []
    for node_id in node_ids:
        node = mapping.get(node_id) or {}
        msg = node.get("message")
        if not msg:
            continue
        author = msg.get("author") or {}
        role = author.get("role")
        if role not in _KEPT_ROLES:
            continue
        text = _extract_text(msg.get("content"))
        if not text.strip():
            continue
        messages.append(Message(role=role, text=text, create_time=msg.get("create_time")))

    return Conversation(
        id=raw.get("conversation_id") or raw.get("id"),
        title=raw.get("title") or "(untitled)",
        create_time=raw.get("create_time"),
        messages=messages,
    )


def load_conversations(archive_dir: Path | str) -> list[Conversation]:
    """Load and order every conversation in conversations-001.json.

    Uses json.load (never regex over raw bytes) so non-ASCII \\uXXXX escapes
    decode correctly.
    """
    path = Path(archive_dir) / CHATGPT_HISTORY_FILE
    with path.open(encoding="utf-8") as f:
        raw_conversations = json.load(f)
    return [_to_conversation(c) for c in raw_conversations]
