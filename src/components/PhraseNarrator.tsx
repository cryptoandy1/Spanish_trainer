import { useEffect, useRef, useState } from "react";
import type { Phrase } from "../types/data";
import { tr, ui } from "../lib/i18n";
import { cancelSpeech, isTtsAvailable, listVoices, speakAsync, subscribeVoices } from "../lib/speech";
import { seededShuffle } from "../lib/text";

/** Pause between utterances, long enough to hear where one ends. */
const GAP_MS = 400;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Hands-free listening: reads each phrase in the target language, then its
 * translation, in shuffled order, looping forever until paused.
 *
 * The playback loop keeps its queue and position in refs rather than state.
 * They would otherwise be dependencies of the effect that runs the loop, so
 * every advance would tear the loop down and restart it mid-phrase. Only the
 * phrase being *displayed* is state.
 *
 * Each run takes a token from `runRef`; every await is followed by an `alive()`
 * check, so a pause or an unmount stops the loop at the next boundary instead
 * of leaving a second one running alongside the first.
 */
export function PhraseNarrator({
  phrases,
  nativeLang,
  targetLocale,
  nativeLocale,
  voiceURI,
  onVoiceChange,
}: {
  phrases: Phrase[];
  nativeLang: string;
  targetLocale: string;
  /** Absent when the native language has no `speechLocale`: only the target side is read. */
  nativeLocale?: string;
  /** Chosen target-language voice; undefined means automatic. */
  voiceURI?: string;
  onVoiceChange: (voiceURI: string | undefined) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<Phrase | null>(null);
  const [position, setPosition] = useState(0);
  const [voices, setVoices] = useState(() => listVoices(targetLocale));

  const orderRef = useRef<Phrase[]>([]);
  const posRef = useRef(0);
  const runRef = useRef(0);

  // Chrome hands over an empty list on the first call and fires this later.
  useEffect(() => {
    const refresh = () => setVoices(listVoices(targetLocale));
    refresh();
    return subscribeVoices(refresh);
  }, [targetLocale]);

  useEffect(() => {
    orderRef.current = seededShuffle(phrases, Math.random);
    posRef.current = 0;
    setPosition(0);
    setCurrent(null);
  }, [phrases]);

  useEffect(() => {
    if (!playing) return;
    const myRun = ++runRef.current;
    let stopped = false;
    const alive = () => !stopped && runRef.current === myRun;

    void (async () => {
      while (alive() && orderRef.current.length > 0) {
        const phrase = orderRef.current[posRef.current];
        if (!phrase) break;
        setCurrent(phrase);
        setPosition(posRef.current);

        await speakAsync(phrase.text, targetLocale, voiceURI);
        if (!alive()) break;
        await delay(GAP_MS);
        if (!alive()) break;

        const translation = tr(phrase.tr, nativeLang);
        if (translation && nativeLocale) {
          // No voice override for the translation: it's a different language,
          // so the picked Spanish voice would be the wrong one entirely.
          await speakAsync(translation, nativeLocale);
          if (!alive()) break;
          await delay(GAP_MS);
          if (!alive()) break;
        }

        const next = posRef.current + 1;
        if (next >= orderRef.current.length) {
          // Reshuffle on every lap so the order isn't memorised along with the phrases.
          orderRef.current = seededShuffle(orderRef.current, Math.random);
          posRef.current = 0;
        } else {
          posRef.current = next;
        }
      }
    })();

    return () => {
      stopped = true;
      cancelSpeech();
    };
  }, [playing, nativeLang, targetLocale, nativeLocale, voiceURI]);

  // Belt and braces: leaving the page mid-phrase must not keep talking.
  useEffect(() => () => cancelSpeech(), []);

  if (!isTtsAvailable()) {
    return <p className="muted">{ui.narrator.unsupported}</p>;
  }

  const total = orderRef.current.length || phrases.length;

  return (
    <div className="narrator">
      <div className="narrator__controls">
        <button
          type="button"
          className="btn btn--primary narrator__toggle"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? ui.narrator.pause : ui.narrator.play}
        >
          {playing ? "⏸" : "▶"} {playing ? ui.narrator.pause : ui.narrator.play}
        </button>
        <span className="muted">
          {total > 0 ? `${position + 1} / ${total}` : ""}
        </span>
      </div>

      {voices.length > 1 && (
        <label className="field narrator__voice">
          <span>{ui.narrator.voice}</span>
          <select
            value={voiceURI ?? ""}
            onChange={(e) => onVoiceChange(e.target.value || undefined)}
          >
            <option value="">{ui.narrator.voiceAuto}</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="muted narrator__hint">{ui.narrator.hint}</p>

      {current ? (
        <div className="narrator__now">
          <p className="narrator__target">{current.text}</p>
          <p className="narrator__native muted">{tr(current.tr, nativeLang)}</p>
        </div>
      ) : (
        <div className="narrator__now">
          <p className="muted">{ui.narrator.idle}</p>
        </div>
      )}

      {!nativeLocale && <p className="muted">{ui.narrator.noNativeVoice}</p>}
    </div>
  );
}
