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

/**
 * The voice list arrives asynchronously in Chrome — the first `getVoices()` is
 * usually empty. Anything that shows voices to the user has to re-read on this
 * event or it renders an empty picker forever.
 */
export function subscribeVoices(onChange: () => void): () => void {
  if (!isTtsAvailable()) return () => {};
  const handler = () => onChange();
  window.speechSynthesis.addEventListener("voiceschanged", handler);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", handler);
}

/** Minimal shape of what ranking needs, so the logic is testable without the DOM. */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  voiceURI?: string;
}

// Vendors mark their good voices in the name and nowhere else — there is no
// quality field in the Web Speech API. These are the words Microsoft, Google
// and Apple actually use: "Microsoft Alvaro Online (Natural)", "Premium",
// "Enhanced". Picking on them is the difference between a 1990s robot and
// something that sounds like a person, and it is the single biggest lever on
// how the narrator sounds.
const GOOD_VOICE_WORDS = /natural|neural|premium|enhanced|online|wavenet|studio/i;

/**
 * Best-first ordering of the voices usable for `locale`.
 *
 * Voices for another language are dropped entirely — a Russian voice reading
 * Spanish is worse than no preference at all.
 */
export function rankVoices<T extends VoiceLike>(voices: T[], locale: string): T[] {
  const base = locale.split("-")[0].toLowerCase();
  const usable = voices.filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith(base));

  return usable
    .map((voice, index) => {
      const lang = voice.lang.toLowerCase().replace("_", "-");
      let score = 0;
      if (lang === locale.toLowerCase()) score += 4; // es-ES over es-MX for a learner in Spain
      if (GOOD_VOICE_WORDS.test(voice.name)) score += 3;
      // Cloud voices are usually the better ones; Apple's "Enhanced" locals are
      // caught by the name test above, so this doesn't demote them.
      if (voice.localService === false) score += 1;
      return { voice, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.voice);
}

/** Voices offered in the narrator's picker, best first. */
export function listVoices(locale: string): SpeechSynthesisVoice[] {
  return rankVoices(loadVoices(), locale);
}

function pickVoice(locale: string, voiceURI?: string): SpeechSynthesisVoice | undefined {
  const voices = loadVoices();
  if (voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === voiceURI);
    if (chosen) return chosen;
    // Falls through when a remembered voice is gone (another machine, another
    // browser) rather than going silent.
  }
  return rankVoices(voices, locale)[0];
}

/**
 * Rewrite a phrase for reading aloud.
 *
 * 28 phrases are written as transformations — `Doy el libro a Juan. → Se lo
 * doy.`, `Estoy leyéndolo. = Lo estoy leyendo.`, `¡Dáselo! / ¡No se lo des!`.
 * Synthesizers swallow those symbols silently, so the two halves run together
 * with no pause and the intonation collapses. Turning each into sentence
 * punctuation is what gives the reading its phrasing back.
 *
 * Only separators surrounded by spaces are touched: `tonto/a` is one word with
 * a gender ending, not two alternatives, and must not become "tonto, a".
 */
export function textForSpeech(text: string): string {
  return text
    .replace(/\s*(?:→|->)\s*/g, ". ")
    .replace(/\s+[=/]\s+/g, ", ")
    .replace(/([.!?])\s*[.,]\s*/g, "$1 ") // "…doy. . Se lo doy." -> "…doy. Se lo doy."
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Speak `text` in the given BCP-47 locale (e.g. "es-ES"). No-op if unsupported. */
export function speak(text: string, locale: string, voiceURI?: string): void {
  if (!isTtsAvailable() || !text.trim()) return;
  window.speechSynthesis.cancel(); // don't stack overlapping utterances
  const utter = new SpeechSynthesisUtterance(textForSpeech(text));
  utter.lang = locale;
  const voice = pickVoice(locale, voiceURI);
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

/** Stop whatever is being spoken. Safe to call when nothing is. */
export function cancelSpeech(): void {
  if (isTtsAvailable()) window.speechSynthesis.cancel();
}

/**
 * Speak `text` and resolve once it has finished — the primitive the narrator
 * needs to read a phrase and its translation back to back.
 *
 * Unlike `speak`, this does NOT cancel what is already queued: callers here are
 * sequencing deliberately, and cancelling would cut off the utterance before
 * this one. It resolves on `error` as well as `end`, and cancellation counts as
 * an error in some browsers, so a caller that stops playback still gets its
 * promise settled instead of hanging forever.
 */
export function speakAsync(text: string, locale: string, voiceURI?: string): Promise<void> {
  return new Promise((resolve) => {
    if (!isTtsAvailable() || !text.trim()) {
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(textForSpeech(text));
    utter.lang = locale;
    const voice = pickVoice(locale, voiceURI);
    if (voice) utter.voice = voice;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    utter.onend = finish;
    utter.onerror = finish;
    window.speechSynthesis.speak(utter);
  });
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
