"""Stage 2: regex — cheap structural extraction over selected conversations.

Produces *candidates*, not final records: markdown tables, ES/RU phrase-pair
lines, and correction blocks are pattern-matched and tagged with a
confidence level, but final classification (is this really a phrase? a
proper noun? travel noise like "Gorg / Progrés"?) is deferred to the
`claude` stage, which sees the same raw conversation text plus these
candidates as a head start. This stage intentionally over-recalls rather
than under-recalls — a false positive here costs one wasted candidate for
the model to reject; a false negative is data silently lost.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Markdown table parsing

CANONICAL_PERSON_ORDER = ["yo", "tu", "el", "nosotros", "vosotros", "ellos"]

_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_CYRILLIC_RE = re.compile(r"[Ѐ-ӿ]")
_LATIN_LETTER_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]")
_SEP_CELL_RE = re.compile(r"^:?-+:?$")

VERB_LEXICON_HEADER_WORDS = {
    "глагол", "глаголы", "инфинитив", "verbo", "verbos", "infinitivo",
}
TRANSLATION_HEADER_WORDS = {
    "перевод", "значение", "translation", "meaning", "перевод.",
}


def _strip_bold(s: str) -> str:
    return _BOLD_RE.sub(r"\1", s).strip()


def _split_row(line: str) -> list[str]:
    inner = line.strip()
    if inner.startswith("|"):
        inner = inner[1:]
    if inner.endswith("|"):
        inner = inner[:-1]
    return [c.strip() for c in inner.split("|")]


@dataclass
class Table:
    header: list[str]
    rows: list[list[str]]
    start_line: int


def find_tables(text: str) -> list[Table]:
    lines = text.split("\n")
    tables: list[Table] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].strip()
        if line.startswith("|") and line.endswith("|") and i + 1 < n:
            sep_line = lines[i + 1].strip()
            if sep_line.startswith("|") and sep_line.endswith("|"):
                sep_cells = _split_row(sep_line)
                if sep_cells and all(_SEP_CELL_RE.match(c.replace(" ", "")) for c in sep_cells if c):
                    header = _split_row(line)
                    j = i + 2
                    rows: list[list[str]] = []
                    while j < n:
                        row_line = lines[j].strip()
                        if not (row_line.startswith("|") and row_line.endswith("|")):
                            break
                        rows.append(_split_row(row_line))
                        j += 1
                    tables.append(Table(header=header, rows=rows, start_line=i))
                    i = j
                    continue
        i += 1
    return tables


def _has_cyrillic(s: str) -> bool:
    return bool(_CYRILLIC_RE.search(s))


def _has_latin(s: str) -> bool:
    return bool(_LATIN_LETTER_RE.search(s))


@dataclass
class TableCandidate:
    kind: str  # "conjugation_positional" | "word_pair_lexicon" | "verb_lexicon_table" | "other_table"
    confidence: str  # "high" | "low"
    header: list[str]
    rows: list[list[str]]
    persons: list[str] | None = None  # set for conjugation_positional, positional order
    start_line: int = 0


def classify_table(table: Table) -> TableCandidate:
    header = table.header
    rows = table.rows
    header_norm = [_strip_bold(h).strip().lower() for h in header]

    # Rule from the plan: rows are ALWAYS positional (yo, tu, el, nosotros,
    # vosotros, ellos) regardless of header wording — never parse header
    # text to identify which person a row is. A 2-col, 6-row table is
    # therefore high-confidence conjugation data no matter what it's called.
    if len(header) == 2 and len(rows) == 6:
        return TableCandidate(
            kind="conjugation_positional",
            confidence="high",
            header=header,
            rows=rows,
            persons=CANONICAL_PERSON_ORDER,
            start_line=table.start_line,
        )

    if len(header) == 2:
        cyr_col0 = sum(1 for r in rows if len(r) > 0 and _has_cyrillic(r[0]))
        cyr_col1 = sum(1 for r in rows if len(r) > 1 and _has_cyrillic(r[1]))
        lat_col0 = sum(1 for r in rows if len(r) > 0 and _has_latin(r[0]))
        lat_col1 = sum(1 for r in rows if len(r) > 1 and _has_latin(r[1]))
        if rows and ((cyr_col0 and lat_col1) or (cyr_col1 and lat_col0)):
            return TableCandidate(
                kind="word_pair_lexicon",
                confidence="medium",
                header=header,
                rows=rows,
                start_line=table.start_line,
            )

    if any(w in header_norm for w in VERB_LEXICON_HEADER_WORDS):
        return TableCandidate(
            kind="verb_lexicon_table",
            confidence="medium",
            header=header,
            rows=rows,
            start_line=table.start_line,
        )

    return TableCandidate(
        kind="other_table",
        confidence="low",
        header=header,
        rows=rows,
        start_line=table.start_line,
    )


def extract_tables(text: str) -> list[TableCandidate]:
    return [classify_table(t) for t in find_tables(text)]


# ---------------------------------------------------------------------------
# ES/RU phrase pairs (3 layouts: inline bullet, two-line block, dialogue-pair)
#
# Common gate: Latin-scripted text on the left of a dash, Cyrillic-scripted
# text on the right. NOT sufficient on its own (also matches travel-diary
# noise like "- **Gorg / Progrés** — развивающийся..."); every match here is
# a low-confidence candidate for the claude stage to accept/reject.

_INLINE_PAIR_RE = re.compile(
    r"^\s*(?:[-*]\s*)?(?:[—–]\s*)?(?P<es>[^\n—–]+?)\s*[—–]\s*(?P<ru>[^\n]+)$",
    re.MULTILINE,
)
_BLOCK_LINE_A_RE = re.compile(r"^\s*\*\*(?P<es>[^*\n]+)\*\*\s*$", re.MULTILINE)


@dataclass
class PhrasePairCandidate:
    es: str
    ru: str
    layout: str  # "inline" | "two_line_block"
    line: int


def extract_phrase_pairs(text: str) -> list[PhrasePairCandidate]:
    lines = text.split("\n")
    candidates: list[PhrasePairCandidate] = []
    claimed_lines: set[int] = set()

    for m in _INLINE_PAIR_RE.finditer(text):
        es_raw = m.group("es")
        ru_raw = m.group("ru")
        if "❌" in es_raw or "✅" in es_raw or "❌" in ru_raw or "✅" in ru_raw:
            continue
        es = _strip_bold(es_raw)
        ru = _strip_bold(ru_raw)
        if not es or not ru:
            continue
        if not _has_latin(es) or _has_cyrillic(es):
            continue
        if not _has_cyrillic(ru):
            continue
        line_no = text.count("\n", 0, m.start())
        candidates.append(PhrasePairCandidate(es=es, ru=ru, layout="inline", line=line_no))
        claimed_lines.add(line_no)

    for m in _BLOCK_LINE_A_RE.finditer(text):
        line_no = text.count("\n", 0, m.start())
        if line_no in claimed_lines or line_no + 1 >= len(lines):
            continue
        es = _strip_bold(m.group("es"))
        if not es or not _has_latin(es) or _has_cyrillic(es):
            continue
        next_line = lines[line_no + 1].strip()
        nm = re.match(r"^[—–]\s*(?P<ru>.+)$", next_line)
        if not nm:
            continue
        ru = _strip_bold(nm.group("ru"))
        if "❌" in ru or "✅" in ru or not _has_cyrillic(ru):
            continue
        candidates.append(
            PhrasePairCandidate(es=es, ru=ru, layout="two_line_block", line=line_no)
        )
        claimed_lines.add(line_no + 1)

    return candidates


# ---------------------------------------------------------------------------
# Correction blocks: ❌/✅ marker pairs, usually under a numbered heading,
# a genuine corpus of the user's own demonstrated mistakes.

_MARKER_LINE_RE = re.compile(r"^.*[❌✅].*$", re.MULTILINE)
_MARK_CHAR_RE = re.compile(r"[❌✅]")
MAX_PAIR_LINE_GAP = 4
CONTEXT_LINES = 3


@dataclass
class CorrectionCandidate:
    attempt: str
    correct: str
    context: str
    line: int


def _extract_bold_or_text(line: str) -> str:
    bolds = _BOLD_RE.findall(line)
    for b in bolds:
        if _has_latin(b):
            return b.strip()
    # no bold span with Latin content: fall back to the marker-stripped line
    return _MARK_CHAR_RE.sub("", line).strip(" -\t")


def extract_corrections(text: str) -> list[CorrectionCandidate]:
    lines = text.split("\n")
    marker_lines: list[tuple[int, str, str]] = []  # (line_no, marker, phrase)
    for i, line in enumerate(lines):
        if "❌" in line:
            marker_lines.append((i, "wrong", _extract_bold_or_text(line)))
        elif "✅" in line:
            marker_lines.append((i, "correct", _extract_bold_or_text(line)))

    candidates: list[CorrectionCandidate] = []
    used: set[int] = set()
    for idx, (line_no, marker, phrase) in enumerate(marker_lines):
        if idx in used or not phrase:
            continue
        # look ahead for the nearest opposite marker within MAX_PAIR_LINE_GAP lines
        for j in range(idx + 1, len(marker_lines)):
            other_line_no, other_marker, other_phrase = marker_lines[j]
            if other_line_no - line_no > MAX_PAIR_LINE_GAP:
                break
            if j in used or other_marker == marker or not other_phrase:
                continue
            wrong = phrase if marker == "wrong" else other_phrase
            correct = other_phrase if marker == "wrong" else phrase
            start = max(0, min(line_no, other_line_no) - CONTEXT_LINES)
            end = min(len(lines), max(line_no, other_line_no) + CONTEXT_LINES + 1)
            context = "\n".join(lines[start:end])
            candidates.append(
                CorrectionCandidate(attempt=wrong, correct=correct, context=context, line=line_no)
            )
            used.add(idx)
            used.add(j)
            break

    return candidates


# ---------------------------------------------------------------------------


@dataclass
class ConversationExtraction:
    conversation_id: str
    title: str
    tables: list[TableCandidate] = field(default_factory=list)
    phrase_pairs: list[PhrasePairCandidate] = field(default_factory=list)
    corrections: list[CorrectionCandidate] = field(default_factory=list)


def extract_conversation(conversation_id: str, title: str, text: str) -> ConversationExtraction:
    return ConversationExtraction(
        conversation_id=conversation_id,
        title=title,
        tables=extract_tables(text),
        phrase_pairs=extract_phrase_pairs(text),
        corrections=extract_corrections(text),
    )
