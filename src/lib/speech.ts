// Text-to-speech (universal browser support) and speech-recognition
// (Chrome/Edge/Safari only — NOT Firefox) wrappers. Both are feature-detected
// so callers can hide UI affordances gracefully rather than throwing.

export function isTtsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cachedVoices: SpeechSynthesisVoice[] | null = null;

function loadVoices(): SpeechSynthesisVoice[] {
  if (!isTtsAvailable()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices ?? voices;
}

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = loadVoices();
  return (
    voices.find((v) => v.lang === locale) ??
    voices.find((v) => v.lang.startsWith(locale.split("-")[0])) ??
    undefined
  );
}

/** Speak `text` in the given BCP-47 locale (e.g. "es-ES"). No-op if unsupported. */
export function speak(text: string, locale: string): void {
  if (!isTtsAvailable() || !text.trim()) return;
  window.speechSynthesis.cancel(); // don't stack overlapping utterances
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = locale;
  const voice = pickVoice(locale);
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

// Chrome/Edge expose SpeechRecognition under the webkit-prefixed name; Firefox
// implements neither. Typed loosely since lib.dom.d.ts doesn't ship these types.
interface MinimalSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onerror: ((event: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isRecognitionAvailable(): boolean {
  return getRecognitionCtor() != null;
}

export interface RecognitionResult {
  alternatives: string[]; // best-first
}

export type RecognitionErrorKind = "not-allowed" | "no-speech" | "network" | "other";

export interface RecognitionHandle {
  stop: () => void;
}

/**
 * Start a single-utterance recognition session.
 * onResult fires once with up to maxAlternatives transcripts (best first).
 * onError fires with a normalized error kind; onEnd always fires last.
 */
export function startRecognition(
  locale: string,
  handlers: {
    onResult: (result: RecognitionResult) => void;
    onError: (kind: RecognitionErrorKind) => void;
    onEnd: () => void;
  },
): RecognitionHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    handlers.onError("other");
    return null;
  }
  const recognizer = new Ctor();
  recognizer.lang = locale;
  recognizer.continuous = false;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 3;

  recognizer.onresult = (event) => {
    const result = event.results?.[0];
    if (!result) return;
    const alternatives: string[] = [];
    for (let i = 0; i < result.length; i++) {
      alternatives.push(result[i].transcript);
    }
    handlers.onResult({ alternatives });
  };
  recognizer.onerror = (event) => {
    const code = event?.error as string | undefined;
    if (code === "not-allowed" || code === "permission-denied") handlers.onError("not-allowed");
    else if (code === "no-speech") handlers.onError("no-speech");
    else if (code === "network") handlers.onError("network");
    else handlers.onError("other");
  };
  recognizer.onend = handlers.onEnd;

  try {
    recognizer.start();
  } catch {
    handlers.onError("other");
    return null;
  }
  return { stop: () => recognizer.stop() };
}
