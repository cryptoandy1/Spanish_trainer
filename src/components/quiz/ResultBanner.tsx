import type { Verdict } from "../../lib/srs";
import { ui } from "../../lib/i18n";

const verdictClass: Record<Verdict, string> = {
  perfect: "result-banner--correct",
  correct: "result-banner--correct",
  accent: "result-banner--accent",
  typo: "result-banner--accent",
  wrong: "result-banner--wrong",
};

const verdictMessage: Record<Verdict, string> = {
  perfect: ui.quiz.correct,
  correct: ui.quiz.correct,
  accent: ui.quiz.accent,
  typo: ui.quiz.typo,
  wrong: ui.quiz.wrong,
};

export function ResultBanner({
  verdict,
  correctAnswer,
  userAnswer,
}: {
  verdict: Verdict;
  correctAnswer: string;
  userAnswer?: string;
}) {
  // Also shown for the near-miss verdicts (accent/typo), not just "wrong":
  // those count as correct for scheduling, but the learner still needs to see
  // the exact form next to what they actually wrote.
  const showCorrection = verdict === "wrong" || verdict === "accent" || verdict === "typo";
  return (
    <div className={`result-banner ${verdictClass[verdict]}`}>
      <div className="result-banner__message">{verdictMessage[verdict]}</div>
      {showCorrection && (
        <div className="result-banner__answer">
          {userAnswer && (
            <div>
              {ui.quiz.yourAnswer} <strong>{userAnswer}</strong>
            </div>
          )}
          <div>
            {ui.quiz.correctAnswerWas} <strong>{correctAnswer}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
