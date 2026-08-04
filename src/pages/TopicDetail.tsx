import { Link, useParams } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { tr, ui } from "../lib/i18n";
import { PhraseCard } from "../components/PhraseCard";
import { VocabCard } from "../components/VocabCard";

export function TopicDetail() {
  const { topicId } = useParams();
  const { pack, index, settings, loading, error } = useData();

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack || !index) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  const topic = topicId ? index.topics.get(topicId) : undefined;
  if (!topic) {
    return (
      <div className="page">
        <p className="error-text">Тема не найдена.</p>
        <Link to="/topics">← {ui.nav.topics}</Link>
      </div>
    );
  }

  const phrases = pack.phrases.filter((p) => p.topics.includes(topic.id));
  const vocab = pack.vocab.filter((v) => v.topics.includes(topic.id));
  const verbs = pack.verbs.filter((v) => v.topics.includes(topic.id));
  const isEmpty = phrases.length === 0 && vocab.length === 0 && verbs.length === 0;

  return (
    <div className="page">
      <Link to="/topics" className="back-link">
        ← {ui.nav.topics}
      </Link>
      <h1>
        {topic.icon} {tr(topic.name, settings.nativeLang)}
      </h1>
      {topic.description && <p className="muted">{tr(topic.description, settings.nativeLang)}</p>}

      {phrases.length > 0 && (
        <section>
          <h2>Фразы</h2>
          <div className="card-list">
            {phrases.map((p) => (
              <PhraseCard key={p.id} phrase={p} nativeLang={settings.nativeLang} />
            ))}
          </div>
        </section>
      )}
      {vocab.length > 0 && (
        <section>
          <h2>Слова</h2>
          <div className="card-list">
            {vocab.map((v) => (
              <VocabCard key={v.id} word={v} nativeLang={settings.nativeLang} />
            ))}
          </div>
        </section>
      )}
      {verbs.length > 0 && (
        <section>
          <h2>Глаголы</h2>
          <ul>
            {verbs.map((v) => (
              <li key={v.id}>
                <Link to={`/verbs/${v.id}`}>{v.infinitive}</Link> — {tr(v.tr, settings.nativeLang)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {isEmpty && <p className="muted">Пока нет карточек по этой теме.</p>}
    </div>
  );
}
