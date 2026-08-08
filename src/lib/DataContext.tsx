import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  DataPack,
  GrammarTopic,
  LanguageRegistry,
  Phrase,
  Topic,
  Verb,
  VocabWord,
  WidgetSet,
} from "../types/data";
import { loadDataPack, loadLanguageRegistry } from "./dataLoader";
import { getItem, setItem } from "./storage";

export interface Settings {
  targetLang: string;
  nativeLang: string;
  strictAccents: boolean;
  sessionSize: number;
}

const SETTINGS_KEY = "st.settings.v1";
const DEFAULT_SETTINGS: Settings = {
  targetLang: "es",
  nativeLang: "ru",
  strictAccents: false,
  sessionSize: 20,
};

export interface DataIndex {
  phrases: Map<string, Phrase>;
  vocab: Map<string, VocabWord>;
  verbs: Map<string, Verb>;
  topics: Map<string, Topic>;
  grammar: Map<string, GrammarTopic>;
  widgets: Map<string, WidgetSet>;
}

interface DataContextValue {
  registry: LanguageRegistry | null;
  pack: DataPack | null;
  index: DataIndex | null;
  settings: Settings;
  setSettings: (next: Settings | ((prev: Settings) => Settings)) => void;
  loading: boolean;
  error: string | null;
  /**
   * Re-fetch the data packs. New material is published to the same URLs, so
   * this is how the app picks up an ingest without a full page reload.
   *
   * Resolves with the freshly loaded pack (null on failure) rather than
   * relying on the caller re-reading `pack`: a React state update isn't
   * visible in the closure that awaited this, so returning the value is what
   * lets a caller diff before/after counts.
   */
  reload: () => Promise<DataPack | null>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(() => getItem(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [registry, setRegistry] = useState<LanguageRegistry | null>(null);
  const [pack, setPack] = useState<DataPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setSettings = (next: Settings | ((prev: Settings) => Settings)) => {
    setSettingsState((prev) => {
      const resolved = typeof next === "function" ? (next as (p: Settings) => Settings)(prev) : next;
      setItem(SETTINGS_KEY, resolved);
      return resolved;
    });
  };

  const load = useCallback(async (lang: string, isCancelled: () => boolean): Promise<DataPack | null> => {
    setLoading(true);
    setError(null);
    try {
      const [reg, dp] = await Promise.all([loadLanguageRegistry(), loadDataPack(lang)]);
      if (isCancelled()) return null;
      setRegistry(reg);
      setPack(dp);
      return dp;
    } catch (e: unknown) {
      if (!isCancelled()) setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load(settings.targetLang, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [settings.targetLang, load]);

  // No cancellation guard: a manual reload is never superseded by an unmount
  // the way the effect above is, and its caller is awaiting the result.
  const reload = useCallback(() => load(settings.targetLang, () => false), [load, settings.targetLang]);

  const index = useMemo<DataIndex | null>(() => {
    if (!pack) return null;
    return {
      phrases: new Map(pack.phrases.map((p) => [p.id, p])),
      vocab: new Map(pack.vocab.map((v) => [v.id, v])),
      verbs: new Map(pack.verbs.map((v) => [v.id, v])),
      topics: new Map(pack.topics.map((t) => [t.id, t])),
      grammar: new Map(pack.grammar.map((g) => [g.id, g])),
      widgets: new Map(pack.widgets.map((w) => [w.id, w])),
    };
  }, [pack]);

  const value: DataContextValue = { registry, pack, index, settings, setSettings, loading, error, reload };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData() must be used within <DataProvider>");
  return ctx;
}
