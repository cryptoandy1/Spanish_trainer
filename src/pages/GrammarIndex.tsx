import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { tr, ui } from "../lib/i18n";

export function GrammarIndex() {
  const { pack, settings, loading, error } = useData();

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  const articles = [...pack.grammar].sort((a, b) => a.order - b.order);

  return (
    <div className="page">
      <h1>{ui.nav.grammar}</h1>
      <ul className="grammar-list">
        {articles.map((a) => (
          <li key={a.id} className="grammar-list__row">
            <Link to={`/grammar/${a.id}`} className="grammar-list__item">
              <span className="grammar-list__title">{tr(a.title, settings.nativeLang)}</span>
              {a.level && <span className="badge">{a.level}</span>}
            </Link>
            <p className="muted">{tr(a.summary, settings.nativeLang)}</p>
          </li>
        ))}
      </ul>
      {articles.length === 0 && <p className="muted">Пока нет статей.</p>}
    </div>
  );
}
