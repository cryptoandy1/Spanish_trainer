"""Fill out complete conjugation paradigms for every verb in verbs.json.

Deliberate exception to the project's "never invent Spanish the user didn't
produce" rule (see CLAUDE.md): that rule governs phrases, vocab, translations
and examples, which are the whole point of a *personalized* corpus. Conjugation
paradigms are objective, closed-form grammar — the user explicitly asked for
complete tables (all tenses, participle, conditional, subjuntivo) because the
extracted data only ever covered 7.75% of the cells (358 of 4620) and most
verbs had exactly one tense.

Design mirrors claude_pass.py:
- one API call per verb, cached to build/conjugation_cache/<verbId>.json, so a
  re-run is free and idempotent;
- a FLAT list of {tense, person, form} rather than a nested tense->person map,
  because deeply nested structured-output schemas hit "compiled grammar is too
  large" 400s (learned the hard way in Phase 2);
- streaming via client.messages.stream(), not .parse(), which has an SDK guard
  that trips above ~16K max_tokens.

Merging is conservative: forms already attested in the user's conversations are
never overwritten. Where the model disagrees with an attested form, the conflict
is reported rather than silently resolved — that doubles as a free quality
check on the generation.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from pydantic import BaseModel, Field

MODEL = "claude-opus-5"


class GeneratedForm(BaseModel):
    tense: str  # meta.tenses id
    person: str  # meta.persons id
    form: str
    irregular: bool = False


class VerbParadigm(BaseModel):
    infinitive: str
    conjugationClass: str | None = None  # "-ar" | "-er" | "-ir"
    regularity: str | None = None  # meta.regularity
    reflexive: bool = False
    gerund: str | None = None
    participle: str | None = None
    participleIrregular: bool = False
    forms: list[GeneratedForm] = Field(default_factory=list)


def _load_meta(repo_root: Path) -> dict:
    return json.loads((repo_root / "public" / "data" / "es" / "meta.json").read_text(encoding="utf-8"))


def build_system_prompt(repo_root: Path) -> str:
    meta = _load_meta(repo_root)
    persons = "\n".join(f"- {p['id']}: {p['label']}" for p in meta["persons"])
    tenses = "\n".join(f"- {t['id']}: {t['label']} ({t['mood']})" for t in meta["tenses"])
    regularity = ", ".join(meta["regularity"])

    return f"""You are producing complete, standard-Spanish (Peninsular / Spain) \
conjugation paradigms for a Spanish-learning app used by a Russian speaker living in Spain.

Return EVERY cell of the paradigm for the requested verb: all tenses below, all \
persons below, using exactly these registry ids.

PERSONS:
{persons}

TENSES:
{tenses}

Rules:
1. Use the person/tense ids verbatim. Never emit an id that is not in the lists above.
2. Emit all 6 persons for every tense EXCEPT the two imperative tenses, which have no \
first-person-singular form: for imperativo_afirmativo and imperativo_negativo emit only \
tu, el, nosotros, vosotros, ellos (5 rows each). `el` means the usted form and `ellos` \
the ustedes form.
3. Peninsular Spanish: always include the vosotros forms.
4. Reflexive verbs: include the reflexive pronoun in every form, in its normal position \
— "me acuesto", "te acuestas", "os acostáis", "se acuestan". For the affirmative \
imperative the pronoun attaches to the verb ("acuéstate", "acostaos"); for the negative \
imperative it precedes it ("no te acuestes").
5. Multi-word verbs (e.g. "darse cuenta") conjugate the verb part and keep the rest: \
"me doy cuenta", "te das cuenta".
6. imperativo_negativo forms must include the "no": "no hables", "no te acuestes".
7. preterito_perfecto is the compound haber + participio: "he hablado", "has hablado".
8. Accents matter and must be exactly right — this app grades the learner's typed \
answer character by character, so a missing tilde is scored as a wrong answer.
9. Mark irregular: true only on forms that deviate from the regular pattern for that \
verb class (irregular stems, irregular endings, stem changes). Regular forms get false.
10. regularity must be one of: {regularity}. Judge it from the verb's actual behaviour, \
not from any label supplied to you — the existing data is known to be mislabelled in \
places.
11. conjugationClass is the infinitive ending: "-ar", "-er" or "-ir" (for a reflexive \
verb, the ending of its non-reflexive stem: acostarse -> "-ar").
"""


def build_user_message(verb: dict) -> str:
    parts = [f"Verb: {verb['infinitive']}"]
    if verb.get("tr", {}).get("ru"):
        parts.append(f"Russian meaning (context only): {verb['tr']['ru']}")
    if verb.get("reflexive"):
        parts.append("This verb is reflexive.")

    attested: list[str] = []
    for tense_id, tense in (verb.get("tenses") or {}).items():
        for person_id, form in (tense.get("forms") or {}).items():
            if form and form.get("form"):
                attested.append(f"  {tense_id}/{person_id} = {form['form']}")
    if attested:
        parts.append(
            "Forms already recorded from the learner's own study conversations "
            "(use them to confirm you have the right verb and the right register; "
            "if you believe one is wrong, still return the correct standard form):"
        )
        parts.append("\n".join(attested))

    parts.append("Return the complete paradigm.")
    return "\n\n".join(parts)


def generate_paradigm(client, repo_root: Path, verb: dict, attempts: int = 4) -> VerbParadigm:
    system = [
        {
            "type": "text",
            "text": build_system_prompt(repo_root),
            "cache_control": {"type": "ephemeral"},
        }
    ]
    # A 77-call run over a home connection reliably hits at least one dropped
    # socket (observed: WinError 10054 mid-run), and without a retry the whole
    # batch dies partway. Cached verbs are skipped on resume, so this only ever
    # re-asks for the one verb that failed.
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            # ~56 forms x a short JSON row each; 16000 is ample, and stream()
            # sidesteps the .parse() timeout guard regardless.
            with client.messages.stream(
                model=MODEL,
                max_tokens=16000,
                output_config={"effort": "high"},
                system=system,
                messages=[{"role": "user", "content": build_user_message(verb)}],
                output_format=VerbParadigm,
            ) as stream:
                message = stream.get_final_message()
            return message.parsed_output
        except Exception as exc:  # noqa: BLE001 — network/transport errors are all retryable here
            last_error = exc
            if attempt == attempts:
                break
            delay = 2**attempt
            print(f"    attempt {attempt}/{attempts} failed ({type(exc).__name__}); retrying in {delay}s")
            time.sleep(delay)
    raise RuntimeError(f"failed to generate paradigm for {verb['infinitive']} after {attempts} attempts") from last_error


def run(repo_root: Path, build_dir: Path, limit: int | None = None, force: bool = False) -> None:
    import anthropic  # deferred: only needed when this stage actually runs

    verbs = json.loads((repo_root / "public" / "data" / "es" / "verbs.json").read_text(encoding="utf-8"))["items"]
    cache_dir = build_dir / "conjugation_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    client = anthropic.Anthropic()  # resolves ANTHROPIC_API_KEY or `ant auth login`

    todo = verbs[:limit] if limit is not None else verbs
    for i, verb in enumerate(todo, 1):
        cache_path = cache_dir / f"{verb['id']}.json"
        if cache_path.exists() and not force:
            print(f"[{i}/{len(todo)}] cached: {verb['infinitive']}")
            continue
        print(f"[{i}/{len(todo)}] generating: {verb['infinitive']}")
        paradigm = generate_paradigm(client, repo_root, verb)
        cache_path.write_text(json.dumps(paradigm.model_dump(), ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Merge


def merge(repo_root: Path, build_dir: Path, dry_run: bool = False) -> dict:
    """Fold cached paradigms into verbs.json. Attested forms win; disagreements
    are reported, never silently applied."""
    from tools.ingest.normalize import load_pack, write_pack

    meta = _load_meta(repo_root)
    valid_tenses = {t["id"] for t in meta["tenses"]}
    valid_persons = {p["id"] for p in meta["persons"]}
    valid_regularity = set(meta["regularity"])

    verbs_path = repo_root / "public" / "data" / "es" / "verbs.json"
    pack = load_pack(verbs_path)
    cache_dir = build_dir / "conjugation_cache"

    stats = {"verbs": 0, "cellsAdded": 0, "cellsKept": 0, "conflicts": [], "skippedRows": 0}

    for verb in pack["items"]:
        cache_path = cache_dir / f"{verb['id']}.json"
        if not cache_path.exists():
            continue
        paradigm = json.loads(cache_path.read_text(encoding="utf-8"))
        stats["verbs"] += 1

        tenses = verb.setdefault("tenses", {})
        for row in paradigm.get("forms", []):
            tense_id, person_id, form = row.get("tense"), row.get("person"), (row.get("form") or "").strip()
            if tense_id not in valid_tenses or person_id not in valid_persons or not form:
                stats["skippedRows"] += 1
                continue
            bucket = tenses.setdefault(tense_id, {"forms": {}})["forms"]
            existing = bucket.get(person_id)
            if existing and existing.get("form"):
                stats["cellsKept"] += 1
                if existing["form"].strip() != form:
                    stats["conflicts"].append(
                        {
                            "verb": verb["infinitive"],
                            "cell": f"{tense_id}/{person_id}",
                            "attested": existing["form"],
                            "generated": form,
                        }
                    )
                continue
            entry = {"form": form}
            if row.get("irregular"):
                entry["irregular"] = True
            bucket[person_id] = entry
            stats["cellsAdded"] += 1

        non_finite = verb.setdefault("nonFinite", {})
        for key in ("gerund", "participle"):
            value = (paradigm.get(key) or "").strip()
            if value and not (non_finite.get(key) or "").strip():
                non_finite[key] = value
        if paradigm.get("participleIrregular"):
            non_finite["participleIrregular"] = True

        # regularity/conjugationClass in the extracted data are sparse and known
        # to be wrong in places (cerrar was tagged "regular" despite being e->ie),
        # so the generated judgement replaces them outright rather than filling
        # only when empty.
        if paradigm.get("regularity") in valid_regularity:
            verb["regularity"] = paradigm["regularity"]
        if paradigm.get("conjugationClass") in ("-ar", "-er", "-ir"):
            verb["conjugationClass"] = paradigm["conjugationClass"]
        # Paradigms are complete now, so the "incomplete data" flag is stale.
        verb.pop("needsReview", None)

        # Keep each tense's persons in meta order for a stable, readable diff.
        for tense_id, tense in list(tenses.items()):
            forms = tense.get("forms") or {}
            tense["forms"] = {p["id"]: forms[p["id"]] for p in meta["persons"] if p["id"] in forms}
        verb["tenses"] = {t["id"]: tenses[t["id"]] for t in meta["tenses"] if t["id"] in tenses}

    if not dry_run and (stats["cellsAdded"] or stats["verbs"]):
        write_pack(verbs_path, pack["lang"], pack["items"], generated_at=pack["generatedAt"])

    return stats
