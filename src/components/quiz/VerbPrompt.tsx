import { useState } from "react";
import { Link } from "react-router-dom";
import type { LanguageMeta, Verb } from "../../types/data";
import { ConjugationTable } from "../ConjugationTable";

interface VerbPromptProps {
  verb: Verb;
  /** The drill prompt, `${infinitive} — tense, person` (see verbFormsToDeck). */
  prompt: string;
  meta: LanguageMeta;
  nativeLang: string;
}

/**
 * Conjugation-drill prompt with a clickable infinitive that unfolds every
 * tense table of that verb right under the question, so a lookup doesn't
 * cost the running session. Opening it before answering does reveal the
 * answer — that's the learner's call, it's a study aid, not an exam.
 */
export function VerbPrompt({ verb, prompt, meta, nativeLang }: VerbPromptProps) {
  const [open, setOpen] = useState(false);
  const rest = prompt.startsWith(verb.infinitive) ? prompt.slice(verb.infinitive.length) : ` · ${prompt}`;
  const tenseIds = meta.tenses
    .filter((t) => verb.tenses[t.id])
    .sort((a, b) => a.order - b.order)
    .map((t) => t.id);

  return (
    <>
      <span>
        <button
          type="button"
          className="verb-prompt__verb"
          aria-expanded={open}
          title="Показать все спряжения"
          onClick={() => setOpen((o) => !o)}
        >
          {verb.infinitive}
        </button>
        {rest}
      </span>
      {open && (
        <div className="verb-prompt__tables">
          <div className="verb-prompt__head">
            <Link to={`/verbs/${verb.id}`}>Страница глагола →</Link>
            <button type="button" className="btn btn--chip" onClick={() => setOpen(false)}>
              Скрыть
            </button>
          </div>
          <div className="conj-table-grid">
            {tenseIds.map((tenseId) => (
              <ConjugationTable
                key={tenseId}
                meta={meta}
                tense={verb.tenses[tenseId]}
                tenseId={tenseId}
                nativeLang={nativeLang}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
