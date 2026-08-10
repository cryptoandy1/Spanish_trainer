import { useCallback, useMemo, useState } from "react";
import { seededRng, seededShuffle } from "./text";

/**
 * Order a list either as given or shuffled by `seed`.
 *
 * The shuffle is seeded rather than a one-off `Math.random()` pass so it stays
 * put across re-renders. Every list this backs sits under a search box, so the
 * array is rebuilt on each keystroke — an unseeded shuffle would deal a new
 * order after every typed character and the list would jump under the cursor.
 */
export function orderWithSeed<T>(items: T[], seed: string | null): T[] {
  if (seed == null) return items;
  return seededShuffle(items, seededRng(seed));
}

export interface ListOrder<T> {
  ordered: T[];
  shuffled: boolean;
  shuffle: () => void;
  restore: () => void;
}

/** Shuffle/restore state for a list view. `restore` returns the original order. */
export function useListOrder<T>(items: T[]): ListOrder<T> {
  const [seed, setSeed] = useState<string | null>(null);
  const ordered = useMemo(() => orderWithSeed(items, seed), [items, seed]);
  const shuffle = useCallback(() => setSeed(String(Math.random())), []);
  const restore = useCallback(() => setSeed(null), []);
  return { ordered, shuffled: seed != null, shuffle, restore };
}
