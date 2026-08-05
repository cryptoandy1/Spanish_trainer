import { useMemo, useState } from "react";
import { useData } from "../../lib/DataContext";
import { verbFormsToDeck } from "../../lib/quiz/deck";
import { tr } from "../../lib/i18n";
import { QuizRunner } from "./QuizRunner";

const ALL_TENSES = "__all__";

/**
 * Verb-conjugation drill. Used both as the global "practice all verbs"
 * session (no verbId) and as the per-verb "Тренировать" toggle on
 * VerbDetail (verbId set). Building the full deck (`allDeck`) is cheap
 * and is always passed as the distractor pool — most verbs in the corpus
 * have too few forms of their own to supply 3 multiple-choice distractors.
 */
export function ConjugationDrill({ verbId }: { verbId?: string }) {
  const { pack, index, settings } = useData();
  const [tenseId, setTenseId] = useState<string>(ALL_TENSES);

  const allDeck = useMemo(
    () => (pack ? verbFormsToDeck(pack.verbs, pack.meta, settings.nativeLang) : []),
    [pack, settings.nativeLang],
  );

  const verb = verbId && index ? index.verbs.get(verbId) : undefined;
  const verbDeck = useMemo(
    () => (verb && pack ? verbFormsToDeck([verb], pack.meta, settings.nativeLang) : allDeck),
    [verb, pack, settings.nativeLang, allDeck],
  );

  // verbFormsToDeck puts the tense id in `pos`, so filtering needs no extra lookup.
  const pool = useMemo(
    () => (tenseId === ALL_TENSES ? verbDeck : verbDeck.filter((d) => d.pos === tenseId)),
    [verbDeck, tenseId],
  );

  // Only offer tenses this deck actually has forms for — with a sparse verb
  // that keeps the picker honest instead of listing 10 mostly-empty options.
  const availableTenses = useMemo(() => {
    if (!pack) return [];
    const present = new Set(verbDeck.map((d) => d.pos));
    // Target-language tense names, matching the drill prompts and the tables.
    return pack.meta.tenses
      .filter((t) => present.has(t.id))
      .map((t) => ({ id: t.id, label: t.label || tr(t.labelTr, settings.nativeLang) }));
  }, [pack, verbDeck, settings.nativeLang]);

  const tenseFilter =
    availableTenses.length > 1 ? (
      <label className="field">
        <span>Время</span>
        <select value={tenseId} onChange={(e) => setTenseId(e.target.value)}>
          <option value={ALL_TENSES}>Все ({verbDeck.length})</option>
          {availableTenses.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <QuizRunner
      // Remount on filter change so a running session can't outlive the pool it was built from.
      key={tenseId}
      pool={pool}
      distractorPool={allDeck}
      allowedModes={["choice", "typing"]}
      fixedDirection="native-target"
      gradeOverrides={{ strictAccents: true, typoTolerance: 0 }}
      startControls={tenseFilter}
    />
  );
}
