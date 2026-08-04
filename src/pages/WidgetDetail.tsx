import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { tr, ui } from "../lib/i18n";
import { WidgetGrid } from "../components/WidgetGrid";
import { QuizRunner } from "../components/quiz/QuizRunner";
import { widgetItemsToDeck } from "../lib/quiz/deck";

export function WidgetDetail() {
  const { widgetId } = useParams();
  const { index, settings, loading, error } = useData();
  const [practicing, setPracticing] = useState(false);

  const widget = widgetId && index ? index.widgets.get(widgetId) : undefined;
  const deck = useMemo(
    () => (widget ? widgetItemsToDeck(widget.items, settings.nativeLang) : []),
    [widget, settings.nativeLang],
  );

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !index) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  if (!widget) {
    return (
      <div className="page">
        <p className="error-text">Раздел не найден.</p>
        <Link to="/reference">← {ui.nav.reference}</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/reference" className="back-link">
        ← {ui.nav.reference}
      </Link>
      <h1>
        {widget.icon} {tr(widget.title, settings.nativeLang)}
      </h1>
      {widget.practiceable && (
        <button type="button" className="btn btn--secondary" onClick={() => setPracticing((p) => !p)}>
          {practicing ? "Показать список" : "Тренировать"}
        </button>
      )}
      {practicing ? <QuizRunner pool={deck} /> : <WidgetGrid widget={widget} nativeLang={settings.nativeLang} />}
    </div>
  );
}
