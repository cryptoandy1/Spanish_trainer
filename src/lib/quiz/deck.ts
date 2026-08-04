import { tr } from "../i18n";
import type { CorrectedError, Phrase, VocabWord, WidgetItem } from "../../types/data";

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

/** Mistakes drill deck — always target-direction (native prompt = the original task), typing only in practice. */
export function correctionsToDeck(corrections: CorrectedError[], nativeLang: string): DeckItem[] {
  return corrections.map((c) => ({
    itemId: c.id,
    target: c.correct,
    native: c.prompt ? tr(c.prompt, nativeLang) : c.attempt,
    context: c.attempt,
    explanation: tr(c.explanation, nativeLang),
  }));
}

export function widgetItemsToDeck(items: WidgetItem[], nativeLang: string): DeckItem[] {
  return items.map((i) => ({
    itemId: i.id,
    target: i.text,
    native: tr(i.tr, nativeLang),
  }));
}

export function answerFor(item: DeckItem, direction: Direction): string {
  return direction === "native-target" ? item.target : item.native;
}

export function promptFor(item: DeckItem, direction: Direction): string {
  return direction === "native-target" ? item.native : item.target;
}
