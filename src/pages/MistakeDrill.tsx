import { useMemo } from "react";
import { useData } from "../lib/DataContext";
import { correctionsToDeck } from "../lib/quiz/deck";
import { QuizRunner } from "../components/quiz/QuizRunner";
import { ui } from "../lib/i18n";

export function MistakeDrill() {
  const { pack, settings, loading, error } = useData();
  const deck = useMemo(
    () => (pack ? correctionsToDeck(pack.corrections, settings.nativeLang) : []),
    [pack, settings.nativeLang],
  );

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  return (
    <div className="page">
      <h1>{ui.nav.mistakes}</h1>
      <p className="muted">
        Реальные ошибки, которые ты уже делал и исправлял в занятиях — с объяснением, почему это неправильно.
      </p>
      <QuizRunner pool={deck} allowedModes={["typing"]} fixedDirection="native-target" />
    </div>
  );
}
