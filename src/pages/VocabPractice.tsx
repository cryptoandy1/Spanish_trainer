import { useMemo } from "react";
import { useData } from "../lib/DataContext";
import { vocabToDeck } from "../lib/quiz/deck";
import { QuizRunner } from "../components/quiz/QuizRunner";
import { ui } from "../lib/i18n";

export function VocabPractice() {
  const { pack, settings, loading, error } = useData();
  const deck = useMemo(
    () => (pack ? vocabToDeck(pack.vocab, settings.nativeLang) : []),
    [pack, settings.nativeLang],
  );

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  return (
    <div className="page">
      <h1>{ui.nav.practiceVocab}</h1>
      <p className="muted">Тренировка отдельных слов из твоей истории занятий испанским.</p>
      <QuizRunner pool={deck} />
    </div>
  );
}
