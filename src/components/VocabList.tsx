import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { VocabWord } from "../types/data";
import { tr, ui } from "../lib/i18n";
import { useListOrder } from "../lib/listOrder";
import { ListOrderControls } from "./ListOrderControls";
import { SpeakButton } from "./SpeakButton";

/**
 * Numbered, searchable list of the whole vocabulary. Shows the first attested
 * example per word when the source conversation had one — examples are never
 * invented, so most words show none.
 */
export function VocabList({ words, nativeLang }: { words: VocabWord[]; nativeLang: string }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words
      .filter((w) => !q || w.lemma.toLowerCase().includes(q) || tr(w.tr, nativeLang).toLowerCase().includes(q))
      .sort((a, b) => a.lemma.localeCompare(b.lemma));
  }, [words, query, nativeLang]);

  const order = useListOrder(filtered);

  return (
    <>
      <input
        type="search"
        className="search-input"
        placeholder="Поиск слова…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="list-toolbar">
        <p className="muted">
          {filtered.length} из {words.length}
        </p>
        <ListOrderControls order={order} />
      </div>
      <ol className="vocab-list">
        {order.ordered.map((w, i) => {
          const example = w.examples?.[0];
          return (
            <li key={w.id} className="vocab-list__item">
              <span className="vocab-list__num">{i + 1}.</span>
              <div className="vocab-list__body">
                <div className="vocab-list__row">
                  {/*
                    A verb links straight to its conjugation page. `verbId` is
                    the data's own record of that link (backfilled by
                    tools/link_vocab_verbs.py), so the word is clickable
                    exactly when a paradigm actually exists for it — no
                    guessing from `pos === "verb"`, which would produce dead
                    links for the ~40 verb words with no verbs.json entry.
                  */}
                  {w.verbId ? (
                    <Link to={`/verbs/${w.verbId}`} className="vocab-list__lemma vocab-list__lemma--link">
                      {w.lemma}
                    </Link>
                  ) : (
                    <span className="vocab-list__lemma">{w.lemma}</span>
                  )}
                  {w.gender && <span className="item-card__tag">{w.gender}</span>}
                  <span className="item-card__tag item-card__tag--pos">{w.pos}</span>
                  <SpeakButton text={w.lemma} />
                  {w.verbId && (
                    <Link to={`/verbs/${w.verbId}`} className="item-card__tag item-card__tag--link">
                      {ui.nav.practiceConjugation} →
                    </Link>
                  )}
                  <span className="vocab-list__tr">{tr(w.tr, nativeLang)}</span>
                </div>
                {example && (
                  <div className="vocab-list__example">
                    <em>{example.text}</em>
                    {tr(example.tr, nativeLang) && <span className="muted"> — {tr(example.tr, nativeLang)}</span>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {filtered.length === 0 && <p className="muted">Ничего не найдено.</p>}
    </>
  );
}
