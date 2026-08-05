import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import type { DeckItem, Direction } from "../../lib/quiz/deck";
import { assembleSession, buildQuestion } from "../../lib/quiz/session";
import type { Mode, Question } from "../../lib/quiz/session";
import { applyResult, loadProgress, saveProgress } from "../../lib/srs";
import type { Verdict } from "../../lib/srs";
import type { GradeOptions } from "../../lib/quiz/grade";
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

/** Offered session sizes. `null` means "the whole deck". */
const SIZE_OPTIONS: (number | null)[] = [20, 50, 100, null];

/** One answered question, kept so the learner can look back at it. */
interface AnswerRecord {
  item: DeckItem;
  verdict: Verdict;
  userAnswer: string;
}

interface QuizRunnerProps {
  pool: DeckItem[];
  /**
   * Candidate pool for multiple-choice distractors. Defaults to `pool`. Pass
   * the full deck when `pool` is a narrow subset (e.g. one verb's forms) —
   * most verbs in the corpus have fewer than 4 attested forms, so a scoped
   * pool would starve choice mode.
   */
  distractorPool?: DeckItem[];
  /** Restrict which modes the picker offers. Defaults to choice+typing(+speech, if available). */
  allowedModes?: Mode[];
  /** If set, hides the direction picker and always quizzes in this direction. */
  fixedDirection?: Direction;
  /**
   * Overrides for the typing-mode grading ladder. The conjugation drill
   * forces exact matching ({ strictAccents: true, typoTolerance: 0 })
   * regardless of the user's global Settings, because an ending or an
   * accent IS the answer there. Only affects typing mode — choice mode
   * compares normalized strings directly.
   */
  gradeOverrides?: Partial<Pick<GradeOptions, "strictAccents" | "typoTolerance">>;
  /**
   * Extra deck-specific controls rendered alongside the mode/size pickers on
   * the start screen (e.g. the conjugation drill's tense filter). Keeps
   * QuizRunner itself generic — it never learns what a "tense" is.
   */
  startControls?: ReactNode;
}

export function QuizRunner({
  pool,
  distractorPool,
  allowedModes,
  fixedDirection,
  gradeOverrides,
  startControls,
}: QuizRunnerProps) {
  const { settings } = useData();
  const speechOk = isRecognitionAvailable();
  const modes: Mode[] = (allowedModes ?? (["choice", "typing", "speech"] as Mode[])).filter(
    (m) => m !== "speech" || speechOk,
  );

  const [mode, setMode] = useState<Mode>(modes[0] ?? "typing");
  const [direction, setDirection] = useState<Direction>(fixedDirection ?? "native-target");
  const [sessionSize, setSessionSize] = useState<number | null>(settings.sessionSize);
  const [queue, setQueue] = useState<DeckItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<{ verdict: Verdict; userAnswer: string } | null>(null);
  const [history, setHistory] = useState<AnswerRecord[]>([]);
  /** 0 = answering the current question; >0 = looking back that many questions. */
  const [reviewOffset, setReviewOffset] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const progress = useMemo(() => loadProgress(settings.targetLang), [settings.targetLang]);

  function start() {
    const session = assembleSession(pool, progress, sessionSize ?? Number.POSITIVE_INFINITY);
    setQueue(session);
    setSessionTotal(session.length);
    setIndex(0);
    setAnswered(null);
    setHistory([]);
    setReviewOffset(0);
    setCorrectCount(0);
  }

  const current = queue && index < queue.length ? queue[index] : null;
  const question: Question | null = current ? buildQuestion(current, direction, mode, distractorPool ?? pool) : null;
  const gradeOptions: GradeOptions = {
    strictAccents: gradeOverrides?.strictAccents ?? settings.strictAccents,
    typoTolerance: gradeOverrides?.typoTolerance,
  };

  function handleAnswer(verdict: Verdict, userAnswer: string) {
    if (!current) return;
    setAnswered({ verdict, userAnswer });
    setHistory((h) => [...h, { item: current, verdict, userAnswer }]);
    progress[current.itemId] = applyResult(progress[current.itemId], verdict);
    saveProgress(settings.targetLang, progress);
    if (verdict !== "wrong") setCorrectCount((c) => c + 1);
    // A wrong answer is NOT requeued into this session: applyResult already
    // reset it to box 0 due today, so it comes back in the next session. The
    // old requeue made a 20-question session silently grow past 20 and replay
    // the same cards near the end.
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
                  <span>{ui.quiz.mode}</span>
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
                  <span>{ui.quiz.directionLabel}</span>
                  <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
                    <option value="native-target">{ui.quiz.directionToTarget}</option>
                    <option value="target-native">{ui.quiz.directionToNative}</option>
                  </select>
                </label>
              )}
              <label className="field">
                <span>{ui.quiz.sessionSize}</span>
                <select
                  value={sessionSize === null ? "all" : String(sessionSize)}
                  onChange={(e) => setSessionSize(e.target.value === "all" ? null : Number(e.target.value))}
                >
                  {SIZE_OPTIONS.map((size) => (
                    <option key={size ?? "all"} value={size === null ? "all" : String(size)}>
                      {size === null ? `${ui.quiz.sizeAll} (${pool.length})` : size}
                    </option>
                  ))}
                </select>
              </label>
              {startControls}
            </div>
            <button type="button" className="btn btn--primary" onClick={start}>
              {ui.quiz.start}
            </button>
          </>
        )}
      </div>
    );
  }

  // Read-only review of an already-answered question. Deliberately mounts no
  // question component and never touches progress — looking back must not
  // re-grade or re-schedule anything.
  if (reviewOffset > 0) {
    const reviewIdx = index - reviewOffset;
    const record = history[reviewIdx];
    const reviewQuestion = record ? buildQuestion(record.item, direction, mode, distractorPool ?? pool) : null;
    if (record && reviewQuestion) {
      return (
        <div className="quiz-runner quiz-runner--review">
          <div className="quiz-review-bar">
            <span className="muted">
              {ui.quiz.reviewTitle} · {ui.quiz.reviewPosition} {reviewIdx + 1} / {sessionTotal}
            </span>
          </div>
          <div className="quiz-prompt">
            {reviewQuestion.prompt} <SpeakButton text={reviewQuestion.speakText} />
          </div>
          {/* Replay the options with the original pick marked — read-only:
              `answeredWith` fully controls the component, and onAnswer is a
              no-op, so looking back never re-grades or re-schedules. */}
          {mode === "choice" && (
            <ChoiceQuestion question={reviewQuestion} answeredWith={record.userAnswer} onAnswer={() => {}} />
          )}
          <ResultBanner
            verdict={record.verdict}
            correctAnswer={reviewQuestion.answer}
            userAnswer={record.userAnswer}
          />
          {reviewQuestion.explanation && (
            <div className="quiz-explanation">
              <ReactMarkdown>{reviewQuestion.explanation}</ReactMarkdown>
            </div>
          )}
          <div className="quiz-review-nav">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={reviewIdx <= 0}
              onClick={() => setReviewOffset((o) => o + 1)}
            >
              {ui.quiz.prevQuestion}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setReviewOffset((o) => o - 1)}>
              {reviewOffset > 1 ? ui.quiz.nextReviewed : ui.quiz.backToCurrent}
            </button>
          </div>
        </div>
      );
    }
  }

  if (!current || !question) {
    return (
      <div className="quiz-done">
        <h2>{ui.quiz.sessionDone}</h2>
        <p className="quiz-done__score">
          {correctCount} / {sessionTotal}
        </p>
        {history.length > 0 && (
          <button type="button" className="btn btn--secondary" onClick={() => setReviewOffset(1)}>
            {ui.quiz.prevQuestion}
          </button>
        )}
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
      {/*
        The prompt lives here rather than inside each question component so it
        survives answering — the question components stay MOUNTED after the
        answer (each one already renders its own answered state: the chosen
        option marked against the correct one, the typed text still in its
        disabled input), and duplicating the prompt inside them would show it
        twice. The SpeakButton appears only once answered, since speakText is
        the target-language string — i.e. the answer itself.

        `key={index}` remounts on every question so a component's internal
        answer state can't leak into the next one.
      */}
      <div className="quiz-prompt">
        {question.prompt} {answered && <SpeakButton text={question.speakText} />}
      </div>
      {mode === "choice" && <ChoiceQuestion key={index} question={question} onAnswer={handleAnswer} />}
      {mode === "typing" && (
        <TypingQuestion key={index} question={question} options={gradeOptions} onAnswer={handleAnswer} />
      )}
      {mode === "speech" && <SpeechQuestion key={index} question={question} onAnswer={handleAnswer} />}
      {answered && (
        <>
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
      {index > 0 && (
        <div className="quiz-review-nav">
          <button type="button" className="btn btn--secondary" onClick={() => setReviewOffset(1)}>
            {ui.quiz.prevQuestion}
          </button>
        </div>
      )}
    </div>
  );
}
