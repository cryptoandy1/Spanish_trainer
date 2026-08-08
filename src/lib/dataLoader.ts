import type {
  DataPack,
  GrammarTopic,
  LanguageMeta,
  LanguageRegistry,
  Pack,
  Phrase,
  Topic,
  Verb,
  VocabWord,
  WidgetSet,
} from "../types/data";

// import.meta.env.BASE_URL already carries the vite.config `base` setting
// (trailing slash included), so this resolves correctly both in dev and once
// built to a GitHub Pages subpath.
const DATA_BASE = `${import.meta.env.BASE_URL}data`;

// `no-store` on purpose: new material is published by pushing new JSON to the
// same URLs, so a cached copy is indistinguishable from "nothing new" — which
// is exactly what the Settings reload button exists to rule out. These files
// are a few hundred KB and fetched once per session.
async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function loadLanguageRegistry(): Promise<LanguageRegistry> {
  return fetchJson<LanguageRegistry>(`${DATA_BASE}/languages.json`);
}

export async function loadDataPack(targetLang: string): Promise<DataPack> {
  const base = `${DATA_BASE}/${targetLang}`;
  // corrections.json is deliberately NOT fetched: the "my mistakes" drill was
  // removed from the UI, and the file is ~58 KB that nothing renders. The data
  // and the tools/ pipeline that writes it are intentionally kept on disk.
  const [meta, phrases, vocab, verbs, topics, grammar, widgets] = await Promise.all([
    fetchJson<LanguageMeta>(`${base}/meta.json`),
    fetchJson<Pack<Phrase>>(`${base}/phrases.json`),
    fetchJson<Pack<VocabWord>>(`${base}/vocab.json`),
    fetchJson<Pack<Verb>>(`${base}/verbs.json`),
    fetchJson<Pack<Topic>>(`${base}/topics.json`),
    fetchJson<Pack<GrammarTopic>>(`${base}/grammar.json`),
    fetchJson<Pack<WidgetSet>>(`${base}/widgets.json`),
  ]);
  return {
    meta,
    // Taken from phrases.json as the pack's stamp: every writer bumps it only
    // when content actually changed (see tools/ingest/normalize.py), and
    // phrases is the file an ingest touches most.
    generatedAt: phrases.generatedAt,
    phrases: phrases.items,
    vocab: vocab.items,
    verbs: verbs.items,
    topics: topics.items,
    grammar: grammar.items,
    widgets: widgets.items,
  };
}

/** Fetch a grammar body (or any other relative data file) as plain text/markdown. */
export async function loadDataText(targetLang: string, relativePath: string): Promise<string> {
  const res = await fetch(`${DATA_BASE}/${targetLang}/${relativePath}`);
  if (!res.ok) throw new Error(`Failed to load ${relativePath}: ${res.status}`);
  return res.text();
}
