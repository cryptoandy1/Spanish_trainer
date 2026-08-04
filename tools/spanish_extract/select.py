"""Stage 1: select — filter conversations-001.json down to the ones that
actually contain Spanish-learning material.

Verified live against the real archive (2026-08-04): score >= 6 AND
density >= 3.0 hits/1000 chars -> 27 conversations, 370,865 chars. A raw
score threshold alone (e.g. >=15) is too loose and pulls in unrelated
conversations (travel diary / history) that happen to mention a Spanish
place name a few times.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from .conversations import Conversation, load_conversations

SPANISH_SIGNAL_RE = re.compile(
    r"(испанск|español|castellano|subjuntivo|pretérito|gerundio|conjuga|[áéíóúñ¿¡])",
    re.IGNORECASE,
)

MIN_SCORE = 6
MIN_DENSITY = 3.0  # hits per 1000 chars


@dataclass
class SelectedConversation:
    conversation: Conversation
    score: int
    density: float


def score_conversation(text: str) -> tuple[int, float]:
    score = len(SPANISH_SIGNAL_RE.findall(text))
    density = (score / len(text)) * 1000 if text else 0.0
    return score, density


def select(archive_dir: Path | str) -> list[SelectedConversation]:
    conversations = load_conversations(archive_dir)
    kept: list[SelectedConversation] = []
    for conv in conversations:
        text = conv.full_text
        score, density = score_conversation(text)
        if score >= MIN_SCORE and density >= MIN_DENSITY:
            kept.append(SelectedConversation(conversation=conv, score=score, density=density))
    kept.sort(key=lambda sc: sc.conversation.id)
    return kept


def to_json(selected: list[SelectedConversation]) -> dict:
    return {
        "stage": "select",
        "minScore": MIN_SCORE,
        "minDensity": MIN_DENSITY,
        "count": len(selected),
        "totalChars": sum(len(sc.conversation.full_text) for sc in selected),
        "conversations": [
            {
                "id": sc.conversation.id,
                "title": sc.conversation.title,
                "createTime": sc.conversation.create_time,
                "score": sc.score,
                "density": round(sc.density, 2),
                "chars": len(sc.conversation.full_text),
                "messages": [
                    {"role": m.role, "text": m.text, "createTime": m.create_time}
                    for m in sc.conversation.messages
                ],
            }
            for sc in selected
        ],
    }
