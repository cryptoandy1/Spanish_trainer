// Versioned localStorage wrapper. Every key is prefixed "st.<name>.v<N>" so a
// future schema change can migrate (bump N, read the old key once, drop it)
// instead of silently misreading stale data.

function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false; // SSR / non-DOM test environment
  try {
    const k = "__st_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export const storageAvailable = isStorageAvailable();

export function getItem<T>(key: string, fallback: T): T {
  if (!storageAvailable) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or blocked — silently ignore, this is best-effort persistence
  }
}

export function removeItem(key: string): void {
  if (!storageAvailable) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Serialize every st.*.v* key for the export-progress button in Settings. */
export function exportAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!storageAvailable) return out;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith("st.")) continue;
    out[key] = getItem(key, null);
  }
  return out;
}

/** Restore keys previously produced by exportAll(). Only touches "st.*" keys. */
export function importAll(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith("st.")) continue;
    setItem(key, value);
  }
}
