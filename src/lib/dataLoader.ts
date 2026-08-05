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

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
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
