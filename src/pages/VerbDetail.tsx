import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { tr, ui } from "../lib/i18n";
import { hasConjugationCells } from "../lib/quiz/deck";
import { ConjugationTable } from "../components/ConjugationTable";
import { ConjugationDrill } from "../components/quiz/ConjugationDrill";
import { SpeakButton } from "../components/SpeakButton";

export function VerbDetail() {
  const { verbId } = useParams();
  const { pack, index, settings, loading, error } = useData();
  const [practicing, setPracticing] = useState(false);

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack || !index) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  const verb = verbId ? index.verbs.get(verbId) : undefined;
  if (!verb) {
    return (
      <div className="page">
        <p className="error-text">Глагол не найден.</p>
        <Link to="/verbs">← {ui.nav.verbs}</Link>
      </div>
    );
  }

  const tenseIds = Object.keys(verb.tenses).sort((a, b) => {
    const ao = pack.meta.tenses.find((t) => t.id === a)?.order ?? 999;
    const bo = pack.meta.tenses.find((t) => t.id === b)?.order ?? 999;
    return ao - bo;
  });

  return (
    <div className="page">
      <Link to="/verbs" className="back-link">
        ← {ui.nav.verbs}
      </Link>
      <h1>
        {verb.infinitive} <SpeakButton text={verb.infinitive} />
      </h1>
      <p className="verb-detail__tr">{tr(verb.tr, settings.nativeLang)}</p>
      <div className="verb-detail__badges">
        <span className={`badge badge--${verb.regularity}`}>{verb.regularity}</span>
        {verb.conjugationClass && <span className="badge">{verb.conjugationClass}</span>}
        {verb.reflexive && <span className="badge">возвратный</span>}
      </div>
      {verb.regularityNote && <p className="muted">{tr(verb.regularityNote, settings.nativeLang)}</p>}

      {(verb.nonFinite.gerund || verb.nonFinite.participle) && (
        <section>
          <h2>Неличные формы</h2>
          <ul className="non-finite-list">
            {verb.nonFinite.gerund && (
              <li>
                Герундий: <strong>{verb.nonFinite.gerund}</strong> <SpeakButton text={verb.nonFinite.gerund} />
              </li>
            )}
            {verb.nonFinite.participle && (
              <li>
                Причастие: <strong>{verb.nonFinite.participle}</strong>{" "}
                <SpeakButton text={verb.nonFinite.participle} />
              </li>
            )}
          </ul>
        </section>
      )}

      <section>
        <h2>Спряжение</h2>
        {hasConjugationCells(verb) && (
          <button type="button" className="btn btn--secondary" onClick={() => setPracticing((p) => !p)}>
            {practicing ? ui.quiz.showTable : ui.quiz.practiceToggle}
          </button>
        )}
        {practicing ? (
          <ConjugationDrill verbId={verb.id} />
        ) : (
          <>
            <div className="conj-table-grid">
              {tenseIds.map((tenseId) => (
                <ConjugationTable
                  key={tenseId}
                  meta={pack.meta}
                  tense={verb.tenses[tenseId]}
                  tenseId={tenseId}
                  nativeLang={settings.nativeLang}
                />
              ))}
            </div>
            {tenseIds.length === 0 && <p className="muted">Пока нет данных о спряжении.</p>}
          </>
        )}
      </section>
    </div>
  );
}
