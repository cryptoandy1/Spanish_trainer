import { useMemo, useState } from "react";
import type { Phrase } from "../types/data";
import { tr } from "../lib/i18n";
import { SpeakButton } from "./SpeakButton";

/**
 * Numbered, searchable list of every phrase. Mirrors VocabList — same classes,
 * same search-then-count shape — so the two list pages stay recognisably one UI.
 *
 * Search matches the Spanish and the translation, and also the literal gloss
 * when the source supplied one, so looking up a half-remembered Russian wording
 * finds the phrase.
 */
export function PhraseList({ phrases, nativeLang }: { phrases: Phrase[]; nativeLang: string }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return phrases
      .filter((p) => {
        if (!q) return true;
        return (
          p.text.toLowerCase().includes(q) ||
          tr(p.tr, nativeLang).toLowerCase().includes(q) ||
          tr(p.literal, nativeLang).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.text.localeCompare(b.text));
  }, [phrases, query, nativeLang]);

  return (
    <>
      <input
        type="search"
        className="search-input"
        placeholder="Поиск фразы…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="muted">
        {filtered.length} из {phrases.length}
      </p>
      <ol className="vocab-list">
        {filtered.map((p, i) => (
          <li key={p.id} className="vocab-list__item">
            <span className="vocab-list__num">{i + 1}.</span>
            <div className="vocab-list__body">
              <div className="vocab-list__row">
                <span className="vocab-list__lemma">{p.text}</span>
                <SpeakButton text={p.text} />
                {p.register && p.register !== "neutral" && (
                  <span className="item-card__tag">{p.register}</span>
                )}
              </div>
              <div className="vocab-list__example">
                <span className="muted">{tr(p.tr, nativeLang)}</span>
              </div>
              {tr(p.literal, nativeLang) && (
                <div className="vocab-list__example">
                  <span className="muted">досл.: {tr(p.literal, nativeLang)}</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {filtered.length === 0 && <p className="muted">Ничего не найдено.</p>}
    </>
  );
}
