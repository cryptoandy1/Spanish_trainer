import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { dueCount, loadProgress } from "../lib/srs";
import { ui } from "../lib/i18n";

export function Dashboard() {
  const { pack, settings, loading, error } = useData();

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  const progress = loadProgress(settings.targetLang);
  const tiles: { to: string; title: string; icon: string; count: number; due?: number }[] = [
    {
      to: "/practice/phrases",
      title: ui.nav.practicePhrases,
      icon: "💬",
      count: pack.phrases.length,
      due: dueCount(
        progress,
        pack.phrases.map((p) => p.id),
      ),
    },
    {
      to: "/practice/vocab",
      title: ui.nav.practiceVocab,
      icon: "📚",
      count: pack.vocab.length,
      due: dueCount(
        progress,
        pack.vocab.map((v) => v.id),
      ),
    },
    {
      to: "/practice/mistakes",
      title: ui.nav.mistakes,
      icon: "🩹",
      count: pack.corrections.length,
      due: dueCount(
        progress,
        pack.corrections.map((c) => c.id),
      ),
    },
    { to: "/verbs", title: ui.nav.verbs, icon: "🔤", count: pack.verbs.length },
    { to: "/topics", title: ui.nav.topics, icon: "🗂️", count: pack.topics.length },
    { to: "/grammar", title: ui.nav.grammar, icon: "📖", count: pack.grammar.length },
    { to: "/reference", title: ui.nav.reference, icon: "🧩", count: pack.widgets.length },
  ];

  return (
    <div className="page">
      <h1>{ui.appName}</h1>
      <div className="dashboard-grid">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="dashboard-tile">
            <div className="dashboard-tile__icon">{t.icon}</div>
            <div className="dashboard-tile__title">{t.title}</div>
            <div className="dashboard-tile__count">{t.count} карточек</div>
            {typeof t.due === "number" && t.due > 0 && <div className="dashboard-tile__due">{t.due} к повторению</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
