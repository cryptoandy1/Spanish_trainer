import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { tr, ui } from "../lib/i18n";

export function VerbIndex() {
  const { pack, settings, loading, error } = useData();
  const [query, setQuery] = useState("");

  const verbs = useMemo(() => {
    if (!pack) return [];
    const q = query.trim().toLowerCase();
    return pack.verbs
      .filter(
        (v) =>
          !q ||
          v.infinitive.toLowerCase().includes(q) ||
          tr(v.tr, settings.nativeLang).toLowerCase().includes(q),
      )
      .sort((a, b) => a.infinitive.localeCompare(b.infinitive));
  }, [pack, query, settings.nativeLang]);

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  return (
    <div className="page">
      <h1>{ui.nav.verbs}</h1>
      <input
        type="search"
        className="search-input"
        placeholder="Поиск глагола…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="verb-list">
        {verbs.map((v) => (
          <li key={v.id}>
            <Link to={`/verbs/${v.id}`} className="verb-list__item">
              <span className="verb-list__infinitive">{v.infinitive}</span>
              <span className={`badge badge--${v.regularity}`}>{v.regularity}</span>
              <span className="verb-list__tr">{tr(v.tr, settings.nativeLang)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {verbs.length === 0 && <p className="muted">Ничего не найдено.</p>}
    </div>
  );
}
