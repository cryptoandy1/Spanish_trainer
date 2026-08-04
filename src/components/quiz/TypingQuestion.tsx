import { useState } from "react";
import type { FormEvent } from "react";
import type { Question } from "../../lib/quiz/session";
import type { Verdict } from "../../lib/srs";
import { gradeAnswer } from "../../lib/quiz/grade";
import { ui } from "../../lib/i18n";

export function TypingQuestion({
  question,
  strictAccents,
  onAnswer,
}: {
  question: Question;
  strictAccents: boolean;
  onAnswer: (verdict: Verdict, userAnswer: string) => void;
}) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (submitted || !value.trim()) return;
    setSubmitted(true);
    const verdict = gradeAnswer(value, question.answer, question.altAnswers ?? [], { strictAccents });
    onAnswer(verdict, value);
  }

  return (
    <div className="typing-question">
      <div className="quiz-prompt">{question.prompt}</div>
      <form onSubmit={submit} className="typing-question__form">
        <input
          type="text"
          className="typing-question__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={submitted}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button type="submit" className="btn btn--primary" disabled={submitted || !value.trim()}>
          {ui.quiz.check}
        </button>
      </form>
    </div>
  );
}
