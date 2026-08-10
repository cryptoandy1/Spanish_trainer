import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { phrasesToDeck } from "../lib/quiz/deck";
import { QuizRunner } from "../components/quiz/QuizRunner";
import { PhraseList } from "../components/PhraseList";
import { PhraseNarrator } from "../components/PhraseNarrator";
import { ui } from "../lib/i18n";

type Mode = "practice" | "list" | "narrator";

export function PhrasePractice() {
  const { pack, registry, settings, setSettings, loading, error } = useData();
  // Hooks must run before the early returns below (rules of hooks).
  const [mode, setMode] = useState<Mode>("practice");
  const deck = useMemo(
    () => (pack ? phrasesToDeck(pack.phrases, settings.nativeLang) : []),
    [pack, settings.nativeLang],
  );
  // The narrator reads the translation too, so it needs a voice for the native
  // language as well as the target one. Both come from the data rather than
  // being hardcoded — see the language-pair-agnosticism rule in CLAUDE.md.
  const nativeLocale = useMemo(
    () => registry?.natives.find((n) => n.code === settings.nativeLang)?.speechLocale,
    [registry, settings.nativeLang],
  );

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error || !pack) return <p className="error-text">Не удалось загрузить данные: {error}</p>;

  const modes: { id: Mode; label: string }[] = [
    { id: "practice", label: ui.phrases.modePractice },
    { id: "list", label: ui.phrases.modeList },
    { id: "narrator", label: ui.phrases.modeNarrator },
  ];

  return (
    <div className="page">
      <h1>{ui.nav.practicePhrases}</h1>
      <p className="muted">Тренировка целых фраз из твоей истории занятий испанским.</p>

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

      {mode === "practice" && <QuizRunner pool={deck} allowedModes={["choice"]} />}
      {mode === "list" && <PhraseList phrases={pack.phrases} nativeLang={settings.nativeLang} />}
      {mode === "narrator" && (
        <PhraseNarrator
          phrases={pack.phrases}
          nativeLang={settings.nativeLang}
          targetLocale={pack.meta.speechLocale}
          nativeLocale={nativeLocale}
          voiceURI={settings.voiceURI}
          onVoiceChange={(voiceURI) => setSettings((prev) => ({ ...prev, voiceURI }))}
        />
      )}
    </div>
  );
}
