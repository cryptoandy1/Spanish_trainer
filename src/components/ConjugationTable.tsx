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
  const tenseMeta = meta.tenses.find((t) => t.id === tenseId);
  const caption = tenseMeta ? tr(tenseMeta.labelTr, nativeLang) || tenseMeta.label : tenseId;

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
