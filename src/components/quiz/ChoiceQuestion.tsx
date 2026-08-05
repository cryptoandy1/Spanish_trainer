import { useState } from "react";
import type { Question } from "../../lib/quiz/session";
import type { Verdict } from "../../lib/srs";
import { normalize } from "../../lib/text";

export function ChoiceQuestion({
  question,
  answeredWith,
  onAnswer,
}: {
  question: Question;
  /**
   * Replays an already-given answer in read-only marked form (the look-back
   * review view). When set, the component is fully controlled by it and its
   * own click state is irrelevant — so review can't accidentally re-grade.
   */
  answeredWith?: string;
  onAnswer: (verdict: Verdict, userAnswer: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = answeredWith ?? picked;
  const correctNorm = normalize(question.answer);

  function choose(choice: string) {
    if (chosen) return;
    setPicked(choice);
    const verdict: Verdict = normalize(choice) === correctNorm ? "correct" : "wrong";
    onAnswer(verdict, choice);
  }

  return (
    <div className="choice-question">
      <div className="choice-question__options">
        {(question.choices ?? []).map((choice) => {
          const isCorrect = normalize(choice) === correctNorm;
          const isChosen = chosen === choice;
          let cls = "choice-option";
          if (chosen) {
            if (isCorrect) cls += " choice-option--correct";
            else if (isChosen) cls += " choice-option--wrong";
          }
          return (
            <button key={choice} type="button" className={cls} onClick={() => choose(choice)} disabled={!!chosen}>
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
}
