import { useData } from "../lib/DataContext";
import { ui } from "../lib/i18n";
import { ConjugationDrill } from "../components/quiz/ConjugationDrill";

export function ConjugationPractice() {
  const { pack, loading, error } = useData();

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  return (
    <div className="page">
      <h1>{ui.nav.practiceConjugation}</h1>
      <p className="muted">
        Спрягай глаголы по временам и лицам — только те формы, что реально встречались в твоих занятиях.
      </p>
      <ConjugationDrill />
    </div>
  );
}
