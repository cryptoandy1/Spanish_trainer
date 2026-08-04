import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { DeckItem, Direction } from "../../lib/quiz/deck";
import { assembleSession, buildQuestion } from "../../lib/quiz/session";
import type { Mode, Question } from "../../lib/quiz/session";
import { applyResult, loadProgress, saveProgress } from "../../lib/srs";
import type { Verdict } from "../../lib/srs";
import { useData } from "../../lib/DataContext";
import { isRecognitionAvailable } from "../../lib/speech";
import { ChoiceQuestion } from "./ChoiceQuestion";
import { TypingQuestion } from "./TypingQuestion";
import { SpeechQuestion } from "./SpeechQuestion";
import { ResultBanner } from "./ResultBanner";
import { ProgressBar } from "./ProgressBar";
import { SpeakButton } from "../SpeakButton";
import { ui } from "../../lib/i18n";

const MODE_LABELS: Record<Mode, string> = {
  choice: ui.quiz.modeChoice,
  typing: ui.quiz.modeTyping,
  speech: ui.quiz.modeSpeech,
};

interface QuizRunnerProps {
  pool: DeckItem[];
  /** Restrict which modes the picker offers. Defaults to choice+typing(+speech, if available). */
  allowedModes?: Mode[];
  /** If set, hides the direction picker and always quizzes in this direction. */
  fixedDirection?: Direction;
}

export function QuizRunner({ pool, allowedModes, fixedDirection }: QuizRunnerProps) {
  const { settings } = useData();
  const speechOk = isRecognitionAvailable();
  const modes: Mode[] = (allowedModes ?? (["choice", "typing", "speech"] as Mode[])).filter(
    (m) => m !== "speech" || speechOk,
  );

  const [mode, setMode] = useState<Mode>(modes[0] ?? "typing");
  const [direction, setDirection] = useState<Direction>(fixedDirection ?? "native-target");
  const [queue, setQueue] = useState<DeckItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<{ verdict: Verdict; userAnswer: string } | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const progress = useMemo(() => loadProgress(settings.targetLang), [settings.targetLang]);

  function start() {
    const session = assembleSession(pool, progress, settings.sessionSize);
    setQueue(session);
    setSessionTotal(session.length);
    setIndex(0);
    setAnswered(null);
    setCorrectCount(0);
  }

  const current = queue && index < queue.length ? queue[index] : null;
  const question: Question | null = current ? buildQuestion(current, direction, mode, pool) : null;

  function handleAnswer(verdict: Verdict, userAnswer: string) {
    if (!current) return;
    setAnswered({ verdict, userAnswer });
    progress[current.itemId] = applyResult(progress[current.itemId], verdict);
    saveProgress(settings.targetLang, progress);
    if (verdict !== "wrong") setCorrectCount((c) => c + 1);
    if (verdict === "wrong" && queue) {
      setQueue([...queue, current]);
      setSessionTotal((t) => t + 1);
    }
  }

  function next() {
    setAnswered(null);
    setIndex((i) => i + 1);
  }

  if (!queue) {
    return (
      <div className="quiz-start">
        {pool.length === 0 ? (
          <p className="muted">{ui.quiz.noItems}</p>
        ) : (
          <>
            <div className="quiz-start__controls">
              {modes.length > 1 && (
                <label className="field">
                  <span>Режим</span>
                  <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                    {modes.map((m) => (
                      <option key={m} value={m}>
                        {MODE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!fixedDirection && (
                <label className="field">
                  <span>Направление</span>
                  <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
                    <option value="native-target">{ui.quiz.directionToTarget}</option>
                    <option value="target-native">{ui.quiz.directionToNative}</option>
                  </select>
                </label>
              )}
            </div>
            <button type="button" className="btn btn--primary" onClick={start}>
              {ui.quiz.start}
            </button>
          </>
        )}
      </div>
    );
  }

  if (!current || !question) {
    return (
      <div className="quiz-done">
        <h2>{ui.quiz.sessionDone}</h2>
        <p className="quiz-done__score">
          {correctCount} / {sessionTotal}
        </p>
        <button type="button" className="btn btn--primary" onClick={() => setQueue(null)}>
          {ui.quiz.start}
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-runner">
      <ProgressBar current={index} total={sessionTotal} />
      {question.context && (
        <div className="quiz-context">
          {ui.quiz.yourAnswer} <em>{question.context}</em>
        </div>
      )}
      {!answered && mode === "choice" && <ChoiceQuestion question={question} onAnswer={handleAnswer} />}
      {!answered && mode === "typing" && (
        <TypingQuestion question={question} strictAccents={settings.strictAccents} onAnswer={handleAnswer} />
      )}
      {!answered && mode === "speech" && <SpeechQuestion question={question} onAnswer={handleAnswer} />}
      {answered && (
        <>
          <div className="quiz-prompt">
            {question.prompt} <SpeakButton text={question.speakText} />
          </div>
          <ResultBanner verdict={answered.verdict} correctAnswer={question.answer} userAnswer={answered.userAnswer} />
          {question.explanation && (
            <div className="quiz-explanation">
              <ReactMarkdown>{question.explanation}</ReactMarkdown>
            </div>
          )}
          <button type="button" className="btn btn--primary" onClick={next}>
            {ui.quiz.next}
          </button>
        </>
      )}
    </div>
  );
}
