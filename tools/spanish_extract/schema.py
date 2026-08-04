"""Pydantic models mirroring src/types/data.ts 1:1.

This is the single schema, kept logic-identical (field names, optionality,
literal unions) with the TS interfaces so tools/extract.py output round-trips
through public/data/es/*.json without translation.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

LangCode = str
Tr = dict[LangCode, str]

SourceOrigin = Literal["chatgpt", "claude", "manual"]
Extractor = Literal["table", "lexicon", "pair", "correction", "model", "seed"]
ErrorVerdict = Literal["wrong", "partial", "ok"]
WidgetKind = Literal["swatch-grid", "icon-grid", "table", "list"]


class Example(BaseModel):
    text: str
    tr: Tr


class SourceRef(BaseModel):
    origin: SourceOrigin
    conversationId: str | None = None
    conversationTitle: str | None = None
    createdAt: str | None = None
    ingestBatch: str
    extractor: Extractor | None = None
    alsoSeenIn: list[str] | None = None


class Pack(BaseModel):
    schemaVersion: Literal[1] = 1
    lang: str
    generatedAt: str
    items: list


class Phrase(BaseModel):
    id: str
    text: str
    tr: Tr
    literal: Tr | None = None
    register: Literal["neutral", "formal", "informal", "slang"] | None = None
    topics: list[str] = Field(default_factory=list)
    tags: list[str] | None = None
    notes: Tr | None = None
    relatedGrammarIds: list[str] | None = None
    needsReview: bool | None = None
    manual: bool | None = None
    source: SourceRef


class VocabWord(BaseModel):
    id: str
    lemma: str
    pos: str
    gender: Literal["m", "f", "mf"] | None = None
    plural: str | None = None
    tr: Tr
    examples: list[Example] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    verbId: str | None = None
    needsReview: bool | None = None
    manual: bool | None = None
    source: SourceRef


class VerbForm(BaseModel):
    form: str
    irregular: bool | None = None
    example: Example | None = None


class VerbTense(BaseModel):
    forms: dict[str, VerbForm | None] = Field(default_factory=dict)


class NonFinite(BaseModel):
    gerund: str | None = None
    participle: str | None = None
    participleIrregular: bool | None = None


class Verb(BaseModel):
    id: str
    infinitive: str
    tr: Tr
    regularity: str
    regularityNote: Tr | None = None
    conjugationClass: Literal["-ar", "-er", "-ir"] | None = None
    reflexive: bool
    nonFinite: NonFinite = Field(default_factory=NonFinite)
    tenses: dict[str, VerbTense] = Field(default_factory=dict)
    topics: list[str] = Field(default_factory=list)
    frequency: Literal[1, 2, 3] | None = None
    needsReview: bool | None = None
    manual: bool | None = None
    source: SourceRef


class Topic(BaseModel):
    id: str
    name: Tr
    nameTarget: str | None = None
    icon: str | None = None
    order: int
    description: Tr | None = None


class GrammarTopic(BaseModel):
    id: str
    title: Tr
    level: Literal["A1", "A2", "B1", "B2", "C1"] | None = None
    order: int
    summary: Tr
    bodyPath: dict[LangCode, str]
    examples: list[Example] = Field(default_factory=list)
    relatedVerbIds: list[str] | None = None
    relatedTopicIds: list[str] | None = None
    tags: list[str] | None = None
    manual: bool | None = None
    source: SourceRef


class CorrectedError(BaseModel):
    id: str
    prompt: Tr | None = None
    attempt: str
    correct: str
    verdict: ErrorVerdict
    explanation: Tr
    errorTags: list[str] = Field(default_factory=list)
    relatedGrammarIds: list[str] | None = None
    relatedVerbIds: list[str] | None = None
    occurredAt: str | None = None
    manual: bool | None = None
    source: SourceRef


class WidgetItem(BaseModel):
    id: str
    text: str
    tr: Tr
    icon: str | None = None
    swatch: str | None = None
    value: float | None = None
    imageUrl: str | None = None
    note: Tr | None = None
    examples: list[Example] | None = None


class WidgetSet(BaseModel):
    id: str
    kind: WidgetKind
    title: Tr
    icon: str | None = None
    order: int
    practiceable: bool
    items: list[WidgetItem] = Field(default_factory=list)
