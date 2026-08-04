import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { tr, ui } from "../lib/i18n";

export function TopicIndex() {
  const { pack, settings, loading, error } = useData();

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  const topics = [...pack.topics].sort((a, b) => a.order - b.order);

  return (
    <div className="page">
      <h1>{ui.nav.topics}</h1>
      <div className="topic-grid">
        {topics.map((t) => {
          const count =
            pack.phrases.filter((p) => p.topics.includes(t.id)).length +
            pack.vocab.filter((v) => v.topics.includes(t.id)).length +
            pack.verbs.filter((v) => v.topics.includes(t.id)).length;
          return (
            <Link key={t.id} to={`/topics/${t.id}`} className="topic-tile">
              <div className="topic-tile__icon">{t.icon}</div>
              <div className="topic-tile__name">{tr(t.name, settings.nativeLang)}</div>
              <div className="topic-tile__count">{count} карточек</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
