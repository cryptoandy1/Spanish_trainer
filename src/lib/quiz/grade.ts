import { levenshtein, normalize, normalizeLoose } from "../text";
import type { Verdict } from "../srs";

export interface GradeOptions {
  /** From Settings — if true, an accent-only mismatch no longer counts as correct. */
  strictAccents: boolean;
  /**
   * Speech-recognition transcripts are unreliable about diacritics, so speech
   * mode always ignores accents (regardless of strictAccents) and loosens the
   * typo-tolerance band.
   */
  speechMode?: boolean;
}

/**
 * Grade a single typed/spoken answer against the correct answer.
 * Ladder (checked in order): exact -> accent-only diff -> case/punctuation-only
 * diff -> alt-answer match -> small-edit-distance typo -> wrong.
 */
export function gradeAnswer(
  userAnswer: string,
  correctAnswer: string,
  altAnswers: string[],
  options: GradeOptions,
): Verdict {
  const raw = userAnswer.trim();
  if (raw === correctAnswer) return "perfect";
  if (!raw) return "wrong";

  const looseUser = normalizeLoose(raw);
  const looseCorrect = normalizeLoose(correctAnswer);
  const normUser = normalize(raw);
  const normCorrect = normalize(correctAnswer);

  if (normUser === normCorrect) {
    if (looseUser === looseCorrect) {
      // Only case/punctuation differed — no accent issue at all.
      return "correct";
    }
    // Diacritics were the only difference.
    if (options.speechMode) return "correct"; // ASR can't be trusted on accents; never penalize
    return options.strictAccents ? "wrong" : "accent";
  }

  for (const alt of altAnswers) {
    if (normalize(alt) === normUser) return "correct";
  }

  const maxLen = Math.max(normUser.length, normCorrect.length);
  const dist = levenshtein(normUser, normCorrect);
  const typoTolerance = options.speechMode
    ? Math.max(2, Math.floor(maxLen / 6))
    : Math.max(1, Math.floor(maxLen / 10));
  if (dist > 0 && dist <= typoTolerance) return "typo";

  return "wrong";
}

/** Grade a set of ASR alternatives (best-first) and return the best verdict achieved. */
export function gradeSpeechAlternatives(
  alternatives: string[],
  correctAnswer: string,
  altAnswers: string[] = [],
): Verdict {
  const rank: Record<Verdict, number> = { perfect: 4, correct: 3, accent: 2, typo: 1, wrong: 0 };
  let best: Verdict = "wrong";
  for (const alt of alternatives) {
    const v = gradeAnswer(alt, correctAnswer, altAnswers, { strictAccents: false, speechMode: true });
    if (rank[v] > rank[best]) best = v;
  }
  return best;
}
