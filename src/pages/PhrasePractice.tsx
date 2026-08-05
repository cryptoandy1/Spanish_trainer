import { useMemo } from "react";
import { useData } from "../lib/DataContext";
import { phrasesToDeck } from "../lib/quiz/deck";
import { QuizRunner } from "../components/quiz/QuizRunner";
import { ui } from "../lib/i18n";

export function PhrasePractice() {
  const { pack, settings, loading, error } = useData();
  const deck = useMemo(
    () => (pack ? phrasesToDeck(pack.phrases, settings.nativeLang) : []),
    [pack, settings.nativeLang],
  );

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  return (
    <div className="page">
      <h1>{ui.nav.practicePhrases}</h1>
      <p className="muted">Тренировка целых фраз из твоей истории занятий испанским.</p>
      <QuizRunner pool={deck} allowedModes={["choice"]} />
    </div>
  );
}
