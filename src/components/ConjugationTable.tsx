import type { LanguageMeta, VerbTense } from "../types/data";
import { tr } from "../lib/i18n";
import { SpeakButton } from "./SpeakButton";

export function ConjugationTable({
  meta,
  tense,
  tenseId,
  nativeLang,
}: {
  meta: LanguageMeta;
  tense: VerbTense;
  tenseId: string;
  nativeLang: string;
}) {
  // Tense captions stay in the TARGET language (meta.tenses[].label, e.g.
  // "Pretérito indefinido") rather than the native gloss — these are the
  // grammar terms the learner meets in course material, so translating them
  // here only adds a second vocabulary to map. Person labels below still use
  // the native gloss, where the translation genuinely disambiguates.
  const tenseMeta = meta.tenses.find((t) => t.id === tenseId);
  const caption = tenseMeta?.label || tenseId;

  return (
    <table className="conj-table">
      <caption>{caption}</caption>
      <tbody>
        {meta.persons.map((person) => {
          const form = tense.forms[person.id];
          return (
            <tr key={person.id}>
              <td className="conj-table__person">{tr(person.labelTr, nativeLang) || person.label}</td>
              <td className="conj-table__form">
                {form ? (
                  <>
                    <span className={form.irregular ? "conj-table__irregular" : undefined}>{form.form}</span>
                    <SpeakButton text={form.form} />
                  </>
                ) : (
                  <span className="conj-table__missing">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
