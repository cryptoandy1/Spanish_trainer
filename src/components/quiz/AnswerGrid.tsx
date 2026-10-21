import type { Verdict } from "../../lib/srs";
import { ui } from "../../lib/i18n";

interface AnswerGridProps {
  total: number;
  /** Verdicts of the questions answered so far, in session order. */
  verdicts: Verdict[];
  /** The live question (=== total once the session is over). Clickable even before it's answered. */
  current: number;
  /** Question highlighted as "you are here" (the live or the reviewed one). */
  highlighted?: number;
  /** Jump to an answered question or back to the live one; squares still ahead are inert. */
  onSelect: (i: number) => void;
}

/**
 * One numbered square per question in the session: green once answered
 * correctly, red if wrong, neutral while still ahead. Any non-"wrong" verdict
 * counts as correct — the same line QuizRunner's score uses.
 */
export function AnswerGrid({ total, verdicts, current, highlighted, onSelect }: AnswerGridProps) {
  if (total === 0) return null;
  return (
    <div className="answer-grid" role="list" aria-label={ui.quiz.answerGrid}>
      {Array.from({ length: total }, (_, i) => {
        const v = verdicts[i];
        const state = v === undefined ? "" : v === "wrong" ? " answer-grid__cell--wrong" : " answer-grid__cell--correct";
        return (
          <button
            key={i}
            type="button"
            role="listitem"
            className={"answer-grid__cell" + state + (i === highlighted ? " answer-grid__cell--current" : "")}
            disabled={v === undefined && i !== current}
            aria-current={i === highlighted ? "step" : undefined}
            onClick={() => onSelect(i)}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
