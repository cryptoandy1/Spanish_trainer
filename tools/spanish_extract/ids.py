"""Content-derived id generation.

Mirrors src/lib/text.ts (normalize/normalizeLoose/slug) and the id recipes
documented in src/types/data.ts exactly. Must stay logic-identical to
tools/ingest/idgen.py — the whole point of content-derived ids is that a
Python extractor run and a Claude Code /ingest run land on the same id for
the same content and therefore merge instead of duplicating.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata

_PUNCT_RE = re.compile(r"[¿¡?!.,;:…\"'«»–—()\[\]]")
_WS_RE = re.compile(r"\s+")


def normalize_loose(s: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace — keep diacritics."""
    s = s.lower()
    s = _PUNCT_RE.sub("", s)
    s = _WS_RE.sub(" ", s)
    return s.strip()


def normalize(s: str) -> str:
    """normalize_loose() plus stripping combining diacritical marks (NFD).

    Python's `re` has no \\p{Mn} class, so we decompose and drop characters
    unicodedata reports as combining marks (category Mn) one by one — same
    result as the JS `.replace(/\\p{Mn}/gu, "")` in src/lib/text.ts.
    """
    s = normalize_loose(s)
    s = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")


_SLUG_UNSAFE_RE = re.compile(r"[^a-z0-9]+")


def slug(s: str) -> str:
    """ASCII-safe slug for ids: lowercase, latin, hyphens.

    Only intended for genuinely Latin-script input (verb infinitives, hand-
    picked topic/grammar titles) — see verb_id()/topic_id()/grammar_id().
    Any character outside [a-z0-9] (accented Latin already stripped by
    normalize(), non-Latin scripts, or stray punctuation like a literal "/"
    in a title) collapses to a single hyphen, so the result can never embed
    a path separator or other filesystem-unsafe character.
    """
    return _SLUG_UNSAFE_RE.sub("-", normalize(s)).strip("-")


def _sha1_8(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:8]


def phrase_id(text: str) -> str:
    return "ph_" + _sha1_8(normalize(text))


def vocab_id(lemma: str, pos: str) -> str:
    return "vc_" + _sha1_8(normalize(lemma) + "|" + pos)


def verb_id(infinitive: str) -> str:
    return "vb_" + slug(infinitive)


def correction_id(attempt: str, correct: str) -> str:
    return "er_" + _sha1_8(normalize(attempt) + "|" + normalize(correct))


def _slug_or_hash(prefix: str, s: str, min_len: int = 3) -> str:
    """slug(s), falling back to a content hash when the slug degenerates
    (e.g. a non-Latin-script title collapses to "" or a couple of stray
    characters once non-[a-z0-9] runs are stripped) — guarantees a stable,
    non-colliding, filesystem-safe id regardless of the source script.
    """
    candidate = slug(s)
    if len(candidate) >= min_len:
        return f"{prefix}_{candidate}"
    return f"{prefix}_{_sha1_8(normalize(s))}"


def topic_id(name_latin: str) -> str:
    return _slug_or_hash("tp", name_latin)


def grammar_id(title: str) -> str:
    return _slug_or_hash("gr", title)


def auto_grammar_id(title: str, summary: str) -> str:
    """Content-derived id for auto-extracted grammar topics.

    Unlike grammar_id() (a human-picked Latin slug, for hand-authored seed
    content), model-generated titles are free-text and can collide — e.g.
    two different conversations both roughly titled "ser vs estar" — so
    this always appends a content hash for uniqueness, keeping a short
    human-readable prefix when the title has enough Latin content for one.
    Deterministic in (title, summary), so re-running merge on unchanged
    cached extractions is still idempotent.
    """
    readable = slug(title)[:40].strip("-")
    digest = _sha1_8(normalize(title) + "|" + normalize(summary))
    return f"gr_{readable}-{digest}" if readable else f"gr_{digest}"
