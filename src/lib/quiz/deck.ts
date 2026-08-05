import { tr, ui } from "../i18n";
import type { LanguageMeta, Phrase, Verb, VocabWord, WidgetItem } from "../../types/data";

export type Direction = "native-target" | "target-native";

/** One practicable item, normalized to a common shape the quiz engine works with. */
export interface DeckItem {
  itemId: string;
  target: string; // canonical target-language text
  native: string; // native-language gloss
  altTargets?: string[]; // accepted alternative target-language spellings
  topics?: string[];
  pos?: string;
  /** Extra context shown above the prompt for the mistakes drill (the original task/attempt). */
  context?: string;
  /** Shown after answering, e.g. the "why" explanation for a corrected mistake. */
  explanation?: string;
}

export function phrasesToDeck(phrases: Phrase[], nativeLang: string): DeckItem[] {
  return phrases.map((p) => ({
    itemId: p.id,
    target: p.text,
    native: tr(p.tr, nativeLang),
    topics: p.topics,
  }));
}

export function vocabToDeck(vocab: VocabWord[], nativeLang: string): DeckItem[] {
  return vocab.map((v) => ({
    itemId: v.id,
    target: v.lemma,
    native: tr(v.tr, nativeLang),
    topics: v.topics,
    pos: v.pos,
  }));
}

export function widgetItemsToDeck(items: WidgetItem[], nativeLang: string): DeckItem[] {
  return items.map((i) => ({
    itemId: i.id,
    target: i.text,
    native: tr(i.tr, nativeLang),
  }));
}

/** True if a verb has at least one attested form to drill. */
export function hasConjugationCells(verb: Verb): boolean {
  return Object.values(verb.tenses).some((tense) => Object.values(tense.forms).some((f) => f?.form?.trim()));
}

/**
 * Conjugation-drill deck — one DeckItem per attested (verb, tense, person)
 * cell. Always one-directional (native-target): the prompt is a composite
 * "infinitive — tense, person" spec, the answer is always the conjugated
 * form. Never offer target-native for this deck — several forms are
 * ambiguous across tenses/persons (e.g. "hablamos" is both presente and
 * pretérito indefinido nosotros), so going form -> spec has no single
 * correct answer.
 *
 * Fully data-driven, per CLAUDE.md's language-agnostic-core rule: no tense
 * or person id/name is hardcoded anywhere in this function. `meta.tenses` /
 * `meta.persons` are the only source of which cells exist and how they're
 * labeled. A tense present on the verb but absent from meta.tenses (should
 * never happen — tools/ingest/validate.py gates this) simply contributes no
 * cells, since there's no label to build a prompt from.
 *
 * `tense.forms[personId]` is a genuinely sparse map in the real data: a
 * missing form is an ABSENT KEY, not an explicit `null` (though the type
 * allows null too) — so cells are only emitted where `form?.form` is
 * truthy, never based on `!== null`.
 */
export function verbFormsToDeck(verbs: Verb[], meta: LanguageMeta, nativeLang: string): DeckItem[] {
  const tensesSorted = [...meta.tenses].sort((a, b) => a.order - b.order);
  const items: DeckItem[] = [];

  for (const verb of verbs) {
    const verbLabel = tr(verb.tr, nativeLang);
    for (const tenseMeta of tensesSorted) {
      const tense = verb.tenses[tenseMeta.id];
      if (!tense) continue;
      // Tense names stay in the target language everywhere in the app (see
      // ConjugationTable) — `label`, never the native `labelTr` gloss. Person
      // labels below DO use the native gloss.
      const tenseLabel = tenseMeta.label || tr(tenseMeta.labelTr, nativeLang);

      for (const person of meta.persons) {
        const form = tense.forms[person.id];
        if (!form?.form?.trim()) continue;
        const personLabel = tr(person.labelTr, nativeLang) || person.label;

        const explanationParts: string[] = [`**${verb.infinitive}** — ${verbLabel}`];
        if (form.irregular) explanationParts.push(`_${ui.quiz.irregularForm}_`);
        if (form.example) {
          explanationParts.push(`> ${form.example.text}\n> ${tr(form.example.tr, nativeLang)}`);
        }

        items.push({
          itemId: `cj_${verb.id}_${tenseMeta.id}_${person.id}`,
          target: form.form,
          // `native` here is the SPEC of the form to produce (a composite
          // target-language prompt), not a translation gloss — same pattern
          // a composite prompt rather than a plain gloss.
          native: `${verb.infinitive} — ${tenseLabel}, ${personLabel}`,
          // Repurposed as distractor-affinity channels (pickDistractors is
          // the only consumer of topics/pos): topics = [verb.id] so
          // same-verb forms score +4 and get preferred as wrong answers
          // over unrelated verbs — deliberately NOT verb.topics, which
          // would instead pull in every verb sharing a subject theme and
          // dilute the signal. pos = tenseId biases same-tense siblings.
          topics: [verb.id],
          pos: tenseMeta.id,
          explanation: explanationParts.join("\n\n"),
        });
      }
    }
  }

  return items;
}

export function answerFor(item: DeckItem, direction: Direction): string {
  return direction === "native-target" ? item.target : item.native;
}

export function promptFor(item: DeckItem, direction: Direction): string {
  return direction === "native-target" ? item.native : item.target;
}
