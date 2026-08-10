import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { vocabToDeck } from "../lib/quiz/deck";
import { QuizRunner } from "../components/quiz/QuizRunner";
import { VocabList } from "../components/VocabList";
import { Narrator } from "../components/Narrator";
import { ui } from "../lib/i18n";

type Mode = "list" | "practice" | "narrator";

export function VocabPractice() {
  const { pack, registry, settings, setSettings, loading, error } = useData();
  // Hooks must run before the early returns below (rules of hooks).
  // The word list stays the default here (unlike Phrases): it's the page's
  // main use, and that predates the mode switch.
  const [mode, setMode] = useState<Mode>("list");
  const deck = useMemo(() => (pack ? vocabToDeck(pack.vocab, settings.nativeLang) : []), [pack, settings.nativeLang]);
  const nativeLocale = useMemo(
    () => registry?.natives.find((n) => n.code === settings.nativeLang)?.speechLocale,
    [registry, settings.nativeLang],
  );

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  const modes: { id: Mode; label: string }[] = [
    { id: "list", label: ui.phrases.modeList },
    { id: "practice", label: ui.phrases.modePractice },
    { id: "narrator", label: ui.phrases.modeNarrator },
  ];

  return (
    <div className="page">
      <h1>{ui.nav.practiceVocab}</h1>
      <p className="muted">Слова из твоей истории занятий испанским.</p>

      <div className="mode-switch">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            className={"btn btn--secondary" + (mode === m.id ? " btn--active" : "")}
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "list" && <VocabList words={pack.vocab} nativeLang={settings.nativeLang} />}
      {mode === "practice" && <QuizRunner pool={deck} />}
      {mode === "narrator" && (
        <Narrator
          items={deck}
          targetLocale={pack.meta.speechLocale}
          nativeLocale={nativeLocale}
          voiceURI={settings.voiceURI}
          rate={settings.speechRate}
          onVoiceChange={(voiceURI) => setSettings((prev) => ({ ...prev, voiceURI }))}
          onRateChange={(speechRate) => setSettings((prev) => ({ ...prev, speechRate }))}
        />
      )}
    </div>
  );
}
