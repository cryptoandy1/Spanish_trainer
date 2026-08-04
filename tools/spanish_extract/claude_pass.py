"""Stage 3: claude — two claude-opus-5 API calls per selected conversation.

Implements the plan doc design: classify the regex stage's low-confidence
candidates, fill missing glosses, assign topics from the fixed registry
(propose <=2 new topics per conversation for human approval, never invent
silently), tag corrections from the fixed error-tag taxonomy, and summarize
grammar-explainer conversations into GrammarTopic bodies.

Hard rule (enforced in the system prompt, not just in code): never complete
a conjugation table from the model's own Spanish knowledge — an unattested
form is omitted, not invented.

Two calls, not one: a single combined structured-output schema (phrases +
vocab + verbs + corrections + grammarTopics + proposedTopics) reliably hits
"compiled grammar is too large" / "Grammar compilation timed out" 400s on
the API — confirmed empirically (2026-08-04) by bisecting the schema.
Splitting into a "content" call (phrases/vocab/corrections) and a
"structure" call (verbs/grammarTopics/proposedTopics) keeps each schema
well under the limit; both calls share the identical cached system prompt
text so the second call reads the first call's prompt cache instead of
paying a second write.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

MODEL = "claude-opus-5"

# ---------------------------------------------------------------------------
# What the model returns for one conversation. Deliberately leaner than the
# final app schema (schema.py) — ids, source refs, and ingestBatch are added
# by merge.py after parsing, not by the model.

Tr = dict[str, str]


class VerbForm(BaseModel):
    """One conjugated form. Flat (not nested by tense->person) to keep the
    structured-output schema shallow — deeply nested arrays-of-arrays blow
    up the compiled decoding grammar (observed: 400 'compiled grammar is
    too large' with a tense->forms nested structure on this many top-level
    array fields)."""

    tense: str  # meta.tenses id
    person: str  # meta.persons id
    form: str  # omit the row entirely if unattested in source; never invent
    irregular: bool = False


class VerbCandidate(BaseModel):
    infinitive: str
    translationsRu: list[str] = Field(default_factory=list)
    regularity: str  # meta.regularity
    reflexive: bool = False
    gerund: str | None = None
    participle: str | None = None
    participleIrregular: bool | None = None
    forms: list[VerbForm] = Field(default_factory=list)
    topicIds: list[str] = Field(default_factory=list)
    needsReview: bool = False


class PhraseCandidate(BaseModel):
    text: str
    translationRu: str
    literalRu: str | None = None
    register: Literal["neutral", "formal", "informal", "slang"] | None = None
    topicIds: list[str] = Field(default_factory=list)
    isRealPhrase: bool  # false => travel noise / proper noun / not language content


class VocabCandidate(BaseModel):
    lemma: str
    pos: str  # meta.pos
    gender: Literal["m", "f", "mf"] | None = None
    translationRu: str
    exampleText: str | None = None
    exampleTranslationRu: str | None = None
    topicIds: list[str] = Field(default_factory=list)
    isRealVocab: bool


class CorrectionCandidate(BaseModel):
    attempt: str
    correct: str
    verdict: Literal["wrong", "partial", "ok"]
    explanationRu: str
    errorTagIds: list[str] = Field(default_factory=list)  # meta.errorTags
    isRealCorrection: bool  # false => not an actual corrected-mistake block


class GrammarTopicCandidate(BaseModel):
    titleRu: str
    summaryRu: str
    bodyMarkdownRu: str
    level: Literal["A1", "A2", "B1", "B2", "C1"] | None = None
    tagIds: list[str] = Field(default_factory=list)


class ProposedTopic(BaseModel):
    slug: str  # latin, used to build tp_<slug>
    nameRu: str
    nameTarget: str | None = None
    icon: str | None = None
    descriptionRu: str | None = None


class ContentExtraction(BaseModel):
    """Call 1: the high-volume, low-nesting candidates."""

    phrases: list[PhraseCandidate] = Field(default_factory=list)
    vocab: list[VocabCandidate] = Field(default_factory=list)
    corrections: list[CorrectionCandidate] = Field(default_factory=list)


class StructureExtraction(BaseModel):
    """Call 2: the deeper-nested / rarer candidates."""

    verbs: list[VerbCandidate] = Field(default_factory=list)
    grammarTopics: list[GrammarTopicCandidate] = Field(default_factory=list)
    proposedTopics: list[ProposedTopic] = Field(default_factory=list)  # max 2


class ConversationExtractionResult(BaseModel):
    """Combined shape written to claude_cache/<id>.json — merge.py reads this."""

    phrases: list[PhraseCandidate] = Field(default_factory=list)
    vocab: list[VocabCandidate] = Field(default_factory=list)
    verbs: list[VerbCandidate] = Field(default_factory=list)
    corrections: list[CorrectionCandidate] = Field(default_factory=list)
    grammarTopics: list[GrammarTopicCandidate] = Field(default_factory=list)
    proposedTopics: list[ProposedTopic] = Field(default_factory=list)  # max 2


# ---------------------------------------------------------------------------


def _load_meta(repo_root: Path) -> dict:
    meta_path = repo_root / "public" / "data" / "es" / "meta.json"
    return json.loads(meta_path.read_text(encoding="utf-8"))


def _load_topics(repo_root: Path) -> list[dict]:
    topics_path = repo_root / "public" / "data" / "es" / "topics.json"
    return json.loads(topics_path.read_text(encoding="utf-8"))["items"]


def build_system_prompt(repo_root: Path) -> str:
    meta = _load_meta(repo_root)
    topics = _load_topics(repo_root)

    persons = ", ".join(f"{p['id']} ({p['label']})" for p in meta["persons"])
    tenses = ", ".join(f"{t['id']} ({t['label']})" for t in meta["tenses"])
    pos = ", ".join(meta["pos"])
    regularity = ", ".join(meta["regularity"])
    error_tags = ", ".join(meta["errorTags"])
    topic_list = "\n".join(
        f"- {t['id']}: {t['name'].get('ru', '')} / {t.get('nameTarget', '')}" for t in topics
    )

    return f"""You are extracting a personal Spanish-learning corpus from one ChatGPT \
conversation between a Russian-speaking learner and an assistant. The output feeds a \
learning app that must only ever contain material the user actually saw in this \
conversation.

HARD RULES (never violate these):
1. Never invent Spanish content the user didn't actually produce or see in this \
conversation. A verb form, translation, or example that isn't backed by the source \
text must be omitted (form: null) with needsReview: true on the parent record — never \
filled in from your own general Spanish knowledge, even if you're confident it's correct.
2. Conjugation tables: only report forms that literally appear in the conversation \
text. If a cell is blank/missing in the source, omit that (tense, person) row from \
`forms` entirely — do not include a guessed form.
3. Classify, don't fabricate: for phrases/vocab/corrections, set isRealPhrase / \
isRealVocab / isRealCorrection to false for anything that is travel-diary noise, a \
proper noun with no translation value, an artifact of table formatting, or otherwise \
not genuine language-learning content (e.g. a Catalan neighborhood name paired with a \
Russian description is NOT a phrase to learn).
4. Topics: assign only from this fixed registry by id. If truly nothing fits, propose \
at most 2 new topics (via proposedTopics) for human review — never invent a topic id \
that isn't in the registry or in your own proposedTopics.

Registry — persons: {persons}
Registry — tenses: {tenses}
Registry — parts of speech: {pos}
Registry — verb regularity: {regularity}
Registry — error tags: {error_tags}
Registry — topics:
{topic_list}

You will be given the full conversation transcript (user/assistant turns) plus a set \
of candidate matches from a cheap regex pre-pass (tables, phrase pairs, correction \
blocks). Treat the regex candidates as a hint of where to look, not as ground truth — \
verify each against the actual transcript text, correct any misparse, and also catch \
anything the regex pass missed. Extract:
- Phrases: full sentences/utterances worth learning, with their Russian translation.
- Vocab: individual words/short terms with lemma, part of speech, translation.
- Verbs: conjugation tables actually present, mapped to the person/tense registries \
above by position (never by parsing header text — a table's rows are always \
positional in the order given by the source).
- Corrections: the user's own mistakes and the assistant's corrections, verdict, and \
explanation.
- Grammar topics: if this conversation is fundamentally a grammar explainer (not just \
a translation or vocab Q&A), summarize it as one GrammarTopic with a markdown body in \
Russian.
"""


def build_user_message(
    conversation: dict,
    regex_extraction: dict | None,
    focus: str,
) -> str:
    transcript = "\n\n".join(
        f"[{m['role'].upper()}]\n{m['text']}" for m in conversation["messages"]
    )
    parts = [
        f"Conversation title: {conversation['title']}",
        f"For this pass, only extract: {focus}. (Other categories are handled by a "
        "separate pass over the same transcript — do not worry about them here.)",
        "TRANSCRIPT:",
        transcript,
    ]
    if regex_extraction is not None:
        parts.append("REGEX PRE-PASS CANDIDATES (hints only, verify against transcript):")
        parts.append(json.dumps(regex_extraction, ensure_ascii=False, indent=2))
    return "\n\n".join(parts)


def _system_block(repo_root: Path) -> list[dict]:
    return [
        {
            "type": "text",
            "text": build_system_prompt(repo_root),
            "cache_control": {"type": "ephemeral"},
        }
    ]


def _parse_via_stream(client, model: str, max_tokens: int, system: list[dict], user_content: str, output_format):
    """client.messages.parse() hits an SDK ValueError above ~16K max_tokens
    ("Streaming is required for operations that may take longer than 10
    minutes") because it calculates a non-streaming timeout even when the
    caller doesn't need one — but Cyrillic-heavy output routinely needs
    >16K tokens for the largest conversations. client.messages.stream(...)
    supports the same output_format/.parsed_output contract while actually
    streaming, so it doesn't hit that guard.
    """
    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        output_config={"effort": "high"},
        system=system,
        messages=[{"role": "user", "content": user_content}],
        output_format=output_format,
    ) as stream:
        message = stream.get_final_message()
    return message.parsed_output


def extract_conversation(
    client,
    repo_root: Path,
    conversation: dict,
    regex_extraction: dict | None,
) -> ConversationExtractionResult:
    system_block = _system_block(repo_root)

    # Cyrillic-heavy output (Russian translations/explanations for every
    # phrase/vocab/correction) burns output tokens much faster than the
    # transcript's char count suggests — 16000 truncated mid-JSON on the
    # largest (44950-char) conversation. 32000 is comfortable headroom.
    content = _parse_via_stream(
        client,
        MODEL,
        32000,
        system_block,
        build_user_message(conversation, regex_extraction, "phrases, vocab, and corrections"),
        ContentExtraction,
    )

    structure = _parse_via_stream(
        client,
        MODEL,
        32000,  # some conversations have several full conjugation tables; 16000 also truncated
        system_block,
        build_user_message(
            conversation,
            regex_extraction,
            "verb conjugation tables, grammar-topic summaries, and any proposed new topics",
        ),
        StructureExtraction,
    )

    return ConversationExtractionResult(
        phrases=content.phrases,
        vocab=content.vocab,
        corrections=content.corrections,
        verbs=structure.verbs,
        grammarTopics=structure.grammarTopics,
        proposedTopics=structure.proposedTopics,
    )


def run(repo_root: Path, build_dir: Path, limit: int | None = None, force: bool = False) -> None:
    import anthropic  # deferred: only needed when this stage actually runs

    selected = json.loads((build_dir / "selected.json").read_text(encoding="utf-8"))
    regex_raw = json.loads((build_dir / "regex_raw.json").read_text(encoding="utf-8"))
    regex_by_id = {c["conversation_id"]: c for c in regex_raw["conversations"]}

    cache_dir = build_dir / "claude_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    client = anthropic.Anthropic()  # resolves ANTHROPIC_API_KEY or `ant auth login`

    conversations = selected["conversations"]
    if limit is not None:
        conversations = conversations[:limit]

    for i, conv in enumerate(conversations, 1):
        cache_path = cache_dir / f"{conv['id']}.json"
        if cache_path.exists() and not force:
            print(f"[{i}/{len(conversations)}] cached: {conv['title']}")
            continue

        print(f"[{i}/{len(conversations)}] extracting: {conv['title']}")
        result = extract_conversation(client, repo_root, conv, regex_by_id.get(conv["id"]))
        cache_path.write_text(
            json.dumps(result.model_dump(), ensure_ascii=False, indent=2), encoding="utf-8"
        )
