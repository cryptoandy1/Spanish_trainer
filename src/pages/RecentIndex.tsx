import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { collectRecentBatches, type RecentBatch } from "../lib/recent";
import { tr, ui } from "../lib/i18n";
import { PhraseList } from "../components/PhraseList";
import { VocabList } from "../components/VocabList";

function batchLabel(b: RecentBatch): string {
  const kind = ui.recent.kinds[b.kind] ?? b.kind;
  return b.date ? `${kind} ${new Date(b.date).toLocaleDateString("ru-RU")}` : kind;
}

export function RecentIndex() {
  const { pack, settings, loading, error } = useData();
  const batches = useMemo(() => (pack ? collectRecentBatches(pack) : []), [pack]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  const selected = batches.find((b) => b.id === selectedId) ?? batches[0];

  return (
    <div className="page">
      <h1>{ui.recent.title}</h1>
      <p className="muted">{ui.recent.hint}</p>

      <div className="mode-switch">
        {batches.map((b) => (
          <button
            key={b.id}
            type="button"
            className={"btn btn--secondary" + (b.id === selected?.id ? " btn--active" : "")}
            aria-pressed={b.id === selected?.id}
            onClick={() => setSelectedId(b.id)}
          >
            {batchLabel(b)} · {b.total}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {selected.phrases.length > 0 && (
            <section>
              <h2>
                {ui.nav.practicePhrases} ({selected.phrases.length})
              </h2>
              <PhraseList phrases={selected.phrases} nativeLang={settings.nativeLang} />
            </section>
          )}

          {selected.vocab.length > 0 && (
            <section>
              <h2>
                {ui.nav.practiceVocab} ({selected.vocab.length})
              </h2>
              <VocabList words={selected.vocab} nativeLang={settings.nativeLang} />
            </section>
          )}

          {selected.verbs.length > 0 && (
            <section>
              <h2>
                {ui.nav.verbs} ({selected.verbs.length})
              </h2>
              <ul className="verb-list">
                {selected.verbs.map((v) => (
                  <li key={v.id}>
                    <Link to={`/verbs/${v.id}`} className="verb-list__item">
                      <span className="verb-list__infinitive">{v.infinitive}</span>
                      <span className={`badge badge--${v.regularity}`}>{v.regularity}</span>
                      <span className="verb-list__tr">{tr(v.tr, settings.nativeLang)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {selected.grammar.length > 0 && (
            <section>
              <h2>
                {ui.nav.grammar} ({selected.grammar.length})
              </h2>
              <ul className="grammar-list">
                {selected.grammar.map((a) => (
                  <li key={a.id} className="grammar-list__row">
                    <Link to={`/grammar/${a.id}`} className="grammar-list__item">
                      <span className="grammar-list__title">{tr(a.title, settings.nativeLang)}</span>
                      {a.level && <span className="badge">{a.level}</span>}
                    </Link>
                    <p className="muted">{tr(a.summary, settings.nativeLang)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {batches.length === 0 && <p className="muted">Пока пусто.</p>}
    </div>
  );
}
