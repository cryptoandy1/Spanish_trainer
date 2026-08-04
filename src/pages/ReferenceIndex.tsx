import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { tr, ui } from "../lib/i18n";

export function ReferenceIndex() {
  const { pack, settings, loading, error } = useData();

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  const widgets = [...pack.widgets].sort((a, b) => a.order - b.order);

  return (
    <div className="page">
      <h1>{ui.nav.reference}</h1>
      <div className="dashboard-grid">
        {widgets.map((w) => (
          <Link key={w.id} to={`/reference/${w.id}`} className="dashboard-tile">
            <div className="dashboard-tile__icon">{w.icon}</div>
            <div className="dashboard-tile__title">{tr(w.title, settings.nativeLang)}</div>
            <div className="dashboard-tile__count">{w.items.length} карточек</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
