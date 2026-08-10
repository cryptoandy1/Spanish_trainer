import { useEffect, useRef, useState } from "react";
import type { DeckItem } from "../lib/quiz/deck";
import { ui } from "../lib/i18n";
import {
  DEFAULT_SPEECH_RATE,
  cancelSpeech,
  isTtsAvailable,
  listVoices,
  speakAsync,
  subscribeVoices,
} from "../lib/speech";
import { seededShuffle } from "../lib/text";

/** Pause between utterances, long enough to hear where one ends. */
const GAP_MS = 400;

const RATES = [
  { value: 0.6, label: "0,6× очень медленно" },
  { value: 0.7, label: "0,7×" },
  { value: 0.8, label: "0,8×" },
  { value: 0.9, label: "0,9× по умолчанию" },
  { value: 1, label: "1× обычная" },
];

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Hands-free listening: reads each item in the target language, then its
 * translation, in shuffled order, looping until paused. Works off `DeckItem`,
 * so the phrase list and the word list share it unchanged.
 *
 * The playback loop keeps its queue and position in refs rather than state.
 * They would otherwise be dependencies of the effect that runs the loop, so
 * every advance would tear the loop down and restart it mid-utterance. Only the
 * item being *displayed* is state.
 *
 * Each run takes a token from `runRef`; every await is followed by an `alive()`
 * check, so a pause or an unmount stops the loop at the next boundary instead
 * of leaving a second one running alongside the first.
 */
export function Narrator({
  items,
  targetLocale,
  nativeLocale,
  voiceURI,
  rate,
  onVoiceChange,
  onRateChange,
}: {
  items: DeckItem[];
  targetLocale: string;
  /** Absent when the native language has no `speechLocale`: only the target side is read. */
  nativeLocale?: string;
  voiceURI?: string;
  rate?: number;
  onVoiceChange: (voiceURI: string | undefined) => void;
  onRateChange: (rate: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<DeckItem | null>(null);
  const [position, setPosition] = useState(0);
  const [voices, setVoices] = useState(() => listVoices(targetLocale));

  const orderRef = useRef<DeckItem[]>([]);
  const posRef = useRef(0);
  const runRef = useRef(0);

  // Chrome hands over an empty list on the first call and fires this later.
  useEffect(() => {
    const refresh = () => setVoices(listVoices(targetLocale));
    refresh();
    return subscribeVoices(refresh);
  }, [targetLocale]);

  useEffect(() => {
    orderRef.current = seededShuffle(items, Math.random);
    posRef.current = 0;
    setPosition(0);
    setCurrent(null);
  }, [items]);

  const effectiveRate = rate ?? DEFAULT_SPEECH_RATE;

  useEffect(() => {
    if (!playing) return;
    const myRun = ++runRef.current;
    let stopped = false;
    const alive = () => !stopped && runRef.current === myRun;

    void (async () => {
      while (alive() && orderRef.current.length > 0) {
        const item = orderRef.current[posRef.current];
        if (!item) break;
        setCurrent(item);
        setPosition(posRef.current);

        await speakAsync(item.target, targetLocale, { voiceURI, rate: effectiveRate });
        if (!alive()) break;
        await delay(GAP_MS);
        if (!alive()) break;

        if (item.native && nativeLocale) {
          // No voice override for the translation: it's a different language,
          // so the picked target-language voice would be the wrong one entirely.
          await speakAsync(item.native, nativeLocale, { rate: effectiveRate });
          if (!alive()) break;
          await delay(GAP_MS);
          if (!alive()) break;
        }

        const next = posRef.current + 1;
        if (next >= orderRef.current.length) {
          // Reshuffle on every lap so the order isn't memorised along with the items.
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
  }, [playing, targetLocale, nativeLocale, voiceURI, effectiveRate]);

  // Belt and braces: leaving the page mid-utterance must not keep talking.
  useEffect(() => () => cancelSpeech(), []);

  if (!isTtsAvailable()) {
    return <p className="muted">{ui.narrator.unsupported}</p>;
  }

  const total = orderRef.current.length || items.length;

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
        <span className="muted">{total > 0 ? `${position + 1} / ${total}` : ""}</span>
      </div>

      <div className="narrator__settings">
        {voices.length > 1 && (
          <label className="field">
            <span>{ui.narrator.voice}</span>
            <select value={voiceURI ?? ""} onChange={(e) => onVoiceChange(e.target.value || undefined)}>
              <option value="">{ui.narrator.voiceAuto}</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>{ui.narrator.rate}</span>
          <select value={effectiveRate} onChange={(e) => onRateChange(Number(e.target.value))}>
            {RATES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="muted narrator__hint">{ui.narrator.hint}</p>

      <div className="narrator__now">
        {current ? (
          <>
            <p className="narrator__target">{current.target}</p>
            <p className="narrator__native muted">{current.native}</p>
          </>
        ) : (
          <p className="muted">{ui.narrator.idle}</p>
        )}
      </div>

      {!nativeLocale && <p className="muted">{ui.narrator.noNativeVoice}</p>}
    </div>
  );
}
