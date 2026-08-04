import { useState } from "react";
import type { Question } from "../../lib/quiz/session";
import type { Verdict } from "../../lib/srs";
import { gradeSpeechAlternatives } from "../../lib/quiz/grade";
import { isRecognitionAvailable, startRecognition } from "../../lib/speech";
import type { RecognitionErrorKind } from "../../lib/speech";
import { useData } from "../../lib/DataContext";
import { ui } from "../../lib/i18n";

export function SpeechQuestion({
  question,
  onAnswer,
}: {
  question: Question;
  onAnswer: (verdict: Verdict, userAnswer: string) => void;
}) {
  const { pack } = useData();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const available = isRecognitionAvailable();

  function record() {
    if (submitted || listening) return;
    setError(null);
    setListening(true);
    const locale = pack?.meta.speechLocale ?? "es-ES";
    startRecognition(locale, {
      onResult: (result) => {
        setSubmitted(true);
        const verdict = gradeSpeechAlternatives(result.alternatives, question.answer, question.altAnswers ?? []);
        onAnswer(verdict, result.alternatives[0] ?? "");
      },
      onError: (kind: RecognitionErrorKind) => {
        setListening(false);
        if (kind === "not-allowed") setError(ui.quiz.micDenied);
        else if (kind === "no-speech") setError("Речь не распознана, попробуй ещё раз.");
        else setError("Ошибка распознавания речи.");
      },
      onEnd: () => setListening(false),
    });
  }

  if (!available) {
    return <div className="speech-question speech-question--unsupported">{ui.quiz.micUnsupported}</div>;
  }

  return (
    <div className="speech-question">
      <div className="quiz-prompt">{question.prompt}</div>
      <button
        type="button"
        className={"mic-button" + (listening ? " mic-button--listening" : "")}
        onClick={record}
        disabled={submitted}
      >
        🎤 {listening ? ui.quiz.micListening : ui.quiz.speak}
      </button>
      {error && <div className="speech-question__error">{error}</div>}
    </div>
  );
}
