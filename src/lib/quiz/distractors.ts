import { normalize, seededShuffle, similarity } from "../text";
import { answerFor, type DeckItem, type Direction } from "./deck";

/**
 * Pick `n` multiple-choice distractors for `correct` out of `pool`.
 * Scoring favors same-topic / same-POS / similar-length / "confusable but not
 * identical" candidates, then shuffles the top-scoring band so repeated
 * questions don't always show the same three wrong answers. `rng` is seeded
 * per question id by the caller so re-rendering a question doesn't reshuffle
 * the options mid-answer.
 */
export function pickDistractors(
  correct: DeckItem,
  pool: DeckItem[],
  direction: Direction,
  n: number,
  rng: () => number,
): DeckItem[] {
  const correctAnswer = answerFor(correct, direction);
  const correctNorm = normalize(correctAnswer);

  const scored: { item: DeckItem; score: number }[] = [];
  for (const candidate of pool) {
    if (candidate.itemId === correct.itemId) continue;
    const candidateAnswer = answerFor(candidate, direction);
    const candidateNorm = normalize(candidateAnswer);
    if (candidateNorm === correctNorm) continue; // reject duplicate-meaning entries

    let score = 0;
    if (correct.topics?.length && candidate.topics?.some((t) => correct.topics!.includes(t))) score += 4;
    if (correct.pos && candidate.pos && correct.pos === candidate.pos) score += 2;
    if (correctAnswer.length > 0) {
      const ratio = candidateAnswer.length / correctAnswer.length;
      if (ratio >= 0.7 && ratio <= 1.3) score += 2;
    }
    const sim = similarity(candidateNorm, correctNorm);
    if (sim >= 0.35 && sim <= 0.8) score += 3;

    scored.push({ item: candidate, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const topBand = scored.filter((s) => s.score > 0).slice(0, 8);
  const shuffledBand = seededShuffle(topBand, rng).map((s) => s.item);
  const selected = shuffledBand.slice(0, n);

  if (selected.length < n) {
    const usedIds = new Set(selected.map((s) => s.itemId));
    const rest = seededShuffle(
      scored.filter((s) => !usedIds.has(s.item.itemId)).map((s) => s.item),
      rng,
    );
    for (const candidate of rest) {
      if (selected.length >= n) break;
      selected.push(candidate);
    }
  }
  return selected;
}
