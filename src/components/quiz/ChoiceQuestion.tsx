import { useState } from "react";
import type { Question } from "../../lib/quiz/session";
import type { Verdict } from "../../lib/srs";
import { normalize } from "../../lib/text";

export function ChoiceQuestion({
  question,
  onAnswer,
}: {
  question: Question;
  onAnswer: (verdict: Verdict, userAnswer: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const correctNorm = normalize(question.answer);

  function choose(choice: string) {
    if (chosen) return;
    setChosen(choice);
    const verdict: Verdict = normalize(choice) === correctNorm ? "correct" : "wrong";
    onAnswer(verdict, choice);
  }

  return (
    <div className="choice-question">
      <div className="quiz-prompt">{question.prompt}</div>
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
