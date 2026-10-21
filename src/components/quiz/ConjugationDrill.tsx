import { useMemo, useState } from "react";
import { useData } from "../../lib/DataContext";
import { verbFormsToDeck } from "../../lib/quiz/deck";
import { tr } from "../../lib/i18n";
import { getItem, setItem } from "../../lib/storage";
import { QuizRunner } from "./QuizRunner";
import { VerbPrompt } from "./VerbPrompt";

/** Remembered tense picks, shared by the global drill and every per-verb drill. */
const TENSES_KEY = "st.conjTenses.v1";

/**
 * Verb-conjugation drill. Used both as the global "practice all verbs"
 * session (no verbId) and as the per-verb "Тренировать" toggle on
 * VerbDetail (verbId set). Building the full deck (`allDeck`) is cheap
 * and is always passed as the distractor pool — most verbs in the corpus
 * have too few forms of their own to supply 3 multiple-choice distractors.
 */
export function ConjugationDrill({ verbId }: { verbId?: string }) {
  const { pack, index, settings } = useData();
  // Empty means "every tense" — so a fresh visitor, or a pick that matches
  // nothing this verb has, falls back to the whole deck rather than to zero cards.
  const [picked, setPicked] = useState<string[]>(() => getItem<string[]>(TENSES_KEY, []));

  const allDeck = useMemo(
    () => (pack ? verbFormsToDeck(pack.verbs, pack.meta, settings.nativeLang) : []),
    [pack, settings.nativeLang],
  );

  const verb = verbId && index ? index.verbs.get(verbId) : undefined;
  const verbDeck = useMemo(
    () => (verb && pack ? verbFormsToDeck([verb], pack.meta, settings.nativeLang) : allDeck),
    [verb, pack, settings.nativeLang, allDeck],
  );

  // Only offer tenses this deck actually has forms for — with a sparse verb
  // that keeps the picker honest instead of listing 10 mostly-empty options.
  const availableTenses = useMemo(() => {
    if (!pack) return [];
    const counts = new Map<string, number>();
    for (const d of verbDeck) counts.set(d.pos ?? "", (counts.get(d.pos ?? "") ?? 0) + 1);
    // Target-language tense names, matching the drill prompts and the tables.
    return pack.meta.tenses
      .filter((t) => counts.has(t.id))
      .map((t) => ({ id: t.id, label: t.label || tr(t.labelTr, settings.nativeLang), count: counts.get(t.id) ?? 0 }));
  }, [pack, verbDeck, settings.nativeLang]);

  // Picks this deck can honour; the rest stay remembered for other verbs.
  const active = useMemo(
    () => availableTenses.filter((t) => picked.includes(t.id)).map((t) => t.id),
    [availableTenses, picked],
  );

  // verbFormsToDeck puts the tense id in `pos`, so filtering needs no extra lookup.
  const pool = useMemo(
    () => (active.length === 0 ? verbDeck : verbDeck.filter((d) => active.includes(d.pos ?? ""))),
    [verbDeck, active],
  );

  function updatePicked(next: string[]) {
    setPicked(next);
    setItem(TENSES_KEY, next);
  }

  function toggle(id: string) {
    updatePicked(active.includes(id) ? active.filter((t) => t !== id) : [...active, id]);
  }

  const tenseFilter =
    availableTenses.length > 1 ? (
      <fieldset className="field tense-picker">
        <legend>
          Времена <span className="muted">— можно выбрать несколько ({pool.length} форм)</span>
        </legend>
        <div className="tense-picker__chips">
          <button
            type="button"
            className={"btn btn--chip" + (active.length === 0 ? " btn--active" : "")}
            aria-pressed={active.length === 0}
            onClick={() => updatePicked([])}
          >
            Все ({verbDeck.length})
          </button>
          {availableTenses.map((t) => (
            <button
              key={t.id}
              type="button"
              className={"btn btn--chip" + (active.includes(t.id) ? " btn--active" : "")}
              aria-pressed={active.includes(t.id)}
              onClick={() => toggle(t.id)}
            >
              {t.label} <span className="btn__count">{t.count}</span>
            </button>
          ))}
        </div>
      </fieldset>
    ) : null;

  return (
    <QuizRunner
      // No remount on filter change: startControls only render before a session
      // starts, so a running session can't outlive its pool — and remounting
      // would reset the mode/size pickers on every chip click.
      pool={pool}
      distractorPool={allDeck}
      allowedModes={["choice", "typing"]}
      fixedDirection="native-target"
      gradeOverrides={{ strictAccents: true, typoTolerance: 0 }}
      startControls={tenseFilter}
      renderPrompt={(item, prompt) => {
        // verbFormsToDeck stores the verb id as the item's only topic.
        const v = index?.verbs.get(item.topics?.[0] ?? "");
        return v && pack ? (
          <VerbPrompt verb={v} prompt={prompt} meta={pack.meta} nativeLang={settings.nativeLang} />
        ) : (
          prompt
        );
      }}
    />
  );
}
