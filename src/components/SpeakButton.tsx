import { useData } from "../lib/DataContext";
import { isTtsAvailable, speak } from "../lib/speech";

export function SpeakButton({ text, className }: { text: string; className?: string }) {
  const { pack } = useData();
  if (!isTtsAvailable() || !text.trim()) return null;
  const locale = pack?.meta.speechLocale ?? "es-ES";
  return (
    <button
      type="button"
      className={"speak-button" + (className ? " " + className : "")}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, locale);
      }}
      aria-label="Произнести"
      title="Произнести"
    >
      🔊
    </button>
  );
}
