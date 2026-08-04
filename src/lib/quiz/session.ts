import { dueItemIds, newItemIds, type Progress } from "../srs";
import { seededRng, seededShuffle } from "../text";
import { pickDistractors } from "./distractors";
import { answerFor, promptFor, type DeckItem, type Direction } from "./deck";

export type Mode = "choice" | "typing" | "speech";

export interface Question {
  itemId: string;
  prompt: string;
  answer: string;
  altAnswers?: string[];
  /** Present only in "choice" mode. */
  choices?: string[];
  /** Always the target-language string, for TTS playback. */
  speakText: string;
  /** Extra context line (used by the mistakes drill to show the user's original attempt). */
  context?: string;
  /** Shown after answering (used by the mistakes drill to show the "why"). */
  explanation?: string;
}

/**
 * Build one Question from a DeckItem. `pool` supplies distractor candidates
 * for choice mode (should be the full deck, not just the session subset, so
 * distractors aren't limited to whatever else happens to be due today).
 */
export function buildQuestion(
  item: DeckItem,
  direction: Direction,
  mode: Mode,
  pool: DeckItem[],
  rng: () => number = seededRng(item.itemId),
): Question {
  const prompt = promptFor(item, direction);
  const answer = answerFor(item, direction);
  const question: Question = {
    itemId: item.itemId,
    prompt,
    answer,
    altAnswers: item.altTargets,
    speakText: item.target,
    context: item.context,
    explanation: item.explanation,
  };

  if (mode === "choice") {
    const distractors = pickDistractors(item, pool, direction, 3, rng);
    const choiceAnswers = distractors.map((d) => answerFor(d, direction));
    question.choices = seededShuffle([answer, ...choiceAnswers], rng);
  }

  return question;
}

/**
 * Assemble the item ids for one practice session: overdue items first (oldest
 * due date first), then never-seen items, capped at sessionSize.
 */
export function assembleSession(pool: DeckItem[], progress: Progress, sessionSize: number): DeckItem[] {
  const ids = pool.map((p) => p.itemId);
  const due = dueItemIds(progress, ids);
  const fresh = newItemIds(progress, ids);
  const orderedIds = [...due, ...fresh];
  const byId = new Map(pool.map((p) => [p.itemId, p]));
  const items: DeckItem[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) items.push(item);
    if (items.length >= sessionSize) break;
  }
  return items;
}
