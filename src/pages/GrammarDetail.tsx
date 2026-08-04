import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useData } from "../lib/DataContext";
import { loadDataText } from "../lib/dataLoader";
import { tr, ui } from "../lib/i18n";
import { ExampleLine } from "../components/ExampleLine";

export function GrammarDetail() {
  const { grammarId } = useParams();
  const { pack, index, settings, loading, error } = useData();
  const [body, setBody] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);

  const article = grammarId && index ? index.grammar.get(grammarId) : undefined;

  useEffect(() => {
    if (!article) return;
    const path = article.bodyPath[settings.nativeLang] ?? Object.values(article.bodyPath)[0];
    if (!path) return;
    setBody(null);
    setBodyError(null);
    loadDataText(settings.targetLang, path)
      .then(setBody)
      .catch((e: unknown) => setBodyError(e instanceof Error ? e.message : String(e)));
  }, [article, settings.nativeLang, settings.targetLang]);

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack || !index) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  if (!article) {
    return (
      <div className="page">
        <p className="error-text">Статья не найдена.</p>
        <Link to="/grammar">← {ui.nav.grammar}</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/grammar" className="back-link">
        ← {ui.nav.grammar}
      </Link>
      <h1>{tr(article.title, settings.nativeLang)}</h1>
      {bodyError && <p className="error-text">{bodyError}</p>}
      {body && (
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        </div>
      )}
      {article.examples.length > 0 && (
        <section>
          <h2>Примеры</h2>
          {article.examples.map((ex, i) => (
            <ExampleLine key={i} example={ex} nativeLang={settings.nativeLang} />
          ))}
        </section>
      )}
    </div>
  );
}
