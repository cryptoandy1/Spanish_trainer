import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { vocabToDeck } from "../lib/quiz/deck";
import { QuizRunner } from "../components/quiz/QuizRunner";
import { VocabList } from "../components/VocabList";
import { ui } from "../lib/i18n";

export function VocabPractice() {
  const { pack, settings, loading, error } = useData();
  // Hooks must run before the early returns below (rules of hooks).
  const [practicing, setPracticing] = useState(false);
  const deck = useMemo(() => (pack ? vocabToDeck(pack.vocab, settings.nativeLang) : []), [pack, settings.nativeLang]);

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  return (
    <div className="page">
      <h1>{ui.nav.practiceVocab}</h1>
      <p className="muted">Слова из твоей истории занятий испанским.</p>
      <button type="button" className="btn btn--secondary" onClick={() => setPracticing((p) => !p)}>
        {practicing ? ui.quiz.showList : ui.quiz.practiceToggle}
      </button>
      {practicing ? (
        <QuizRunner pool={deck} />
      ) : (
        <VocabList words={pack.vocab} nativeLang={settings.nativeLang} />
      )}
    </div>
  );
}
