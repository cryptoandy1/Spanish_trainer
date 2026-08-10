// Shared data model. This file is the source of truth for the app's data
// shapes; tools/spanish_extract/schema.py mirrors it 1:1 as Pydantic models.
//
// Language-pair-agnosticism (see public/data/es/meta.json): every field here
// that is *not* itself a Tr map, and not sourced from a LanguageMeta list, is
// safe to reuse for any target/native language pair unchanged.

/** ISO language code, e.g. "ru", "en". */
export type LangCode = string;

/** A value that depends on the learner's native language. Always keyed by LangCode. */
export type Tr = Record<LangCode, string>;

export interface Example {
  /** Always in the TARGET language. */
  text: string;
  tr: Tr;
}

export type SourceOrigin = "chatgpt" | "claude" | "manual" | "youtube";
export type Extractor = "table" | "lexicon" | "pair" | "correction" | "model" | "seed";

export interface SourceRef {
  origin: SourceOrigin;
  conversationId?: string;
  conversationTitle?: string;
  createdAt?: string; // ISO
  ingestBatch: string; // e.g. "seed-2026-08-04" | "extract-2026-08-04" | "ingest-2026-08-11"
  extractor?: Extractor;
  alsoSeenIn?: string[]; // additional conversationIds, appended on merge
}

/** Envelope every data file is wrapped in. */
export interface Pack<T> {
  schemaVersion: 1;
  lang: string; // "es"
  generatedAt: string; // ISO
  items: T[]; // ALWAYS sorted by id for stable diffs
}

// ---------------------------------------------------------------------------
// Language metadata (public/data/{lang}/meta.json) — the ONLY place that
// carries structural knowledge about the target language.

export interface PersonMeta {
  id: string;
  label: string;
  labelTr: Tr;
}

export interface TenseMeta {
  id: string;
  mood: string;
  order: number;
  label: string;
  labelTr: Tr;
}

export interface LanguageMeta {
  schemaVersion: 1;
  lang: string;
  speechLocale: string; // BCP-47, e.g. "es-ES"
  persons: PersonMeta[];
  tenses: TenseMeta[];
  pos: string[];
  regularity: string[];
  errorTags: string[];
}

// ---------------------------------------------------------------------------
// languages.json registry

export interface LanguageTarget {
  code: string;
  name: Tr;
  flag?: string;
  speechLocale: string;
  natives: string[];
}

export interface LanguageRegistry {
  schemaVersion: 1;
  defaultTarget: string;
  defaultNative: string;
  targets: LanguageTarget[];
  /** `speechLocale` (BCP-47) is what the narrator reads translations with; a
   * native language without one simply isn't spoken aloud. */
  natives: { code: string; name: Tr; speechLocale?: string }[];
}

// ---------------------------------------------------------------------------
// Entities

export interface Phrase {
  id: string; // "ph_" + sha1(normalize(text))[:8]
  text: string; // canonical target-language phrase
  tr: Tr;
  literal?: Tr; // word-by-word gloss, when the source had one
  register?: "neutral" | "formal" | "informal" | "slang";
  topics: string[]; // Topic ids — the ONLY membership record
  tags?: string[];
  notes?: Tr;
  relatedGrammarIds?: string[];
  needsReview?: boolean;
  manual?: boolean; // true => immutable to extract.py / /ingest
  source: SourceRef;
}

export interface VocabWord {
  id: string; // "vc_" + sha1(normalize(lemma)+"|"+pos)[:8]
  lemma: string;
  pos: string; // from meta.pos
  gender?: "m" | "f" | "mf";
  plural?: string;
  tr: Tr;
  examples: Example[];
  topics: string[];
  verbId?: string; // link into verbs.json when pos === "verb"
  needsReview?: boolean;
  manual?: boolean;
  source: SourceRef;
}

export interface VerbForm {
  form: string;
  irregular?: boolean;
  example?: Example;
}

export interface VerbTense {
  /** Keyed by person id from meta.json. null = unattested in source ("—"). */
  forms: Record<string, VerbForm | null>;
}

export interface Verb {
  id: string; // "vb_" + slug(infinitive) — naturally unique
  infinitive: string;
  tr: Tr;
  regularity: string; // from meta.regularity
  regularityNote?: Tr;
  conjugationClass?: "-ar" | "-er" | "-ir";
  reflexive: boolean;
  nonFinite: {
    gerund?: string;
    participle?: string;
    participleIrregular?: boolean;
  };
  /** Keyed by tense id from meta.json. Sparse — only what the source had. */
  tenses: Record<string, VerbTense>;
  topics: string[];
  frequency?: 1 | 2 | 3; // 1 = most common
  needsReview?: boolean;
  manual?: boolean;
  source: SourceRef;
}

export interface Topic {
  id: string; // "tp_<latin-slug>"
  name: Tr;
  nameTarget?: string; // "En el restaurante"
  icon?: string; // emoji
  order: number;
  description?: Tr;
}

export interface GrammarTopic {
  id: string; // "gr_<latin-slug>"
  title: Tr;
  level?: "A1" | "A2" | "B1" | "B2" | "C1";
  order: number;
  summary: Tr;
  /** Path (under public/data/{lang}/), keyed by native lang code. */
  bodyPath: Record<LangCode, string>;
  examples: Example[];
  relatedVerbIds?: string[];
  relatedTopicIds?: string[];
  tags?: string[]; // may overlap meta.errorTags
  manual?: boolean;
  source: SourceRef;
}

export type ErrorVerdict = "wrong" | "partial" | "ok";

/**
 * Not part of DataPack — the "my mistakes" drill was removed from the UI, so
 * corrections.json is no longer fetched at runtime. The type stays because
 * tools/spanish_extract/schema.py mirrors this file 1:1 and the extraction /
 * ingest pipeline still writes corrections.json.
 */
export interface CorrectedError {
  id: string; // "er_" + sha1(normalize(attempt)+"|"+normalize(correct))[:8]
  prompt?: Tr; // the task the user was answering
  attempt: string; // what the user actually wrote
  correct: string; // the corrected target-language sentence
  verdict: ErrorVerdict;
  explanation: Tr; // the "why" — markdown ok
  errorTags: string[]; // from meta.errorTags
  relatedGrammarIds?: string[];
  relatedVerbIds?: string[];
  occurredAt?: string;
  manual?: boolean;
  source: SourceRef;
}

export interface WidgetItem {
  id: string;
  text: string;
  tr: Tr;
  icon?: string; // emoji
  swatch?: string; // hex, for colors
  value?: number; // for numbers
  imageUrl?: string; // escape hatch, unused by default
  note?: Tr;
  examples?: Example[];
}

export type WidgetKind = "swatch-grid" | "icon-grid" | "table" | "list";

export interface WidgetSet {
  id: string; // "wg_colors" | "wg_numbers" | "wg_days" | "wg_months" | "wg_countries"
  kind: WidgetKind;
  title: Tr;
  icon?: string;
  order: number;
  practiceable: boolean; // if true, also usable as a quiz deck
  items: WidgetItem[];
}

// ---------------------------------------------------------------------------
// Convenience aliases for the loaded, in-memory data pack

export interface DataPack {
  meta: LanguageMeta;
  /** `generatedAt` of the loaded packs — shown in the UI so it's visible which vintage of the data is on screen. */
  generatedAt: string;
  phrases: Phrase[];
  vocab: VocabWord[];
  verbs: Verb[];
  topics: Topic[];
  grammar: GrammarTopic[];
  widgets: WidgetSet[];
}
