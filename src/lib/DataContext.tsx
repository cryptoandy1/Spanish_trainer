import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  CorrectedError,
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
  corrections: Map<string, CorrectedError>;
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadLanguageRegistry(), loadDataPack(settings.targetLang)])
      .then(([reg, dp]) => {
        if (cancelled) return;
        setRegistry(reg);
        setPack(dp);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.targetLang]);

  const index = useMemo<DataIndex | null>(() => {
    if (!pack) return null;
    return {
      phrases: new Map(pack.phrases.map((p) => [p.id, p])),
      vocab: new Map(pack.vocab.map((v) => [v.id, v])),
      verbs: new Map(pack.verbs.map((v) => [v.id, v])),
      topics: new Map(pack.topics.map((t) => [t.id, t])),
      grammar: new Map(pack.grammar.map((g) => [g.id, g])),
      corrections: new Map(pack.corrections.map((c) => [c.id, c])),
      widgets: new Map(pack.widgets.map((w) => [w.id, w])),
    };
  }, [pack]);

  const value: DataContextValue = { registry, pack, index, settings, setSettings, loading, error };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData() must be used within <DataProvider>");
  return ctx;
}
