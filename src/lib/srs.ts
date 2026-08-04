// Leitner-box spaced repetition. Deliberately simpler than SM-2 — this is a
// single-user, no-backend app; a hand-editable exported JSON file matters
// more here than ease-factor tuning. Progress is keyed by content-derived
// item ids (see tools/spanish_extract/ids.py), so re-running extraction or
// /ingest never resets progress on an item that already existed.
import { getItem, setItem } from "./storage";

export const BOX_COUNT = 6;
export const INTERVALS_DAYS = [0, 1, 3, 7, 21, 60] as const;

export type Verdict = "perfect" | "correct" | "accent" | "typo" | "wrong";

export interface ProgressEntry {
  box: number;
  due: string; // ISO date (yyyy-mm-dd)
  seen: number;
  correct: number;
  streak: number;
  lastResult: Verdict;
  lastSeen: string; // ISO datetime
}

export type Progress = Record<string, ProgressEntry>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function progressKey(targetLang: string): string {
  return `st.progress.v1.${targetLang}`;
}

export function loadProgress(targetLang: string): Progress {
  return getItem<Progress>(progressKey(targetLang), {});
}

export function saveProgress(targetLang: string, progress: Progress): void {
  setItem(progressKey(targetLang), progress);
}

/** True verdicts that "count as correct" for the grading UI, even if they hold the box. */
export function isCorrectVerdict(v: Verdict): boolean {
  return v === "perfect" || v === "correct" || v === "accent" || v === "typo";
}

/**
 * Apply one answer to an item's progress entry, returning the updated entry.
 * Does not persist — caller should merge into the Progress map and saveProgress().
 */
export function applyResult(entry: ProgressEntry | undefined, verdict: Verdict): ProgressEntry {
  const prev: ProgressEntry = entry ?? {
    box: 0,
    due: todayIso(),
    seen: 0,
    correct: 0,
    streak: 0,
    lastResult: verdict,
    lastSeen: new Date().toISOString(),
  };

  const seen = prev.seen + 1;
  const correctSoFar = prev.correct + (isCorrectVerdict(verdict) ? 1 : 0);

  if (verdict === "perfect" || verdict === "correct") {
    const box = Math.min(prev.box + 1, BOX_COUNT - 1);
    return {
      box,
      due: addDaysIso(INTERVALS_DAYS[box]),
      seen,
      correct: correctSoFar,
      streak: prev.streak + 1,
      lastResult: verdict,
      lastSeen: new Date().toISOString(),
    };
  }

  if (verdict === "accent" || verdict === "typo") {
    // "hold": counts as correct, but doesn't advance the box — reinforces the near-miss.
    return {
      box: prev.box,
      due: addDaysIso(INTERVALS_DAYS[prev.box]),
      seen,
      correct: correctSoFar,
      streak: prev.streak + 1,
      lastResult: verdict,
      lastSeen: new Date().toISOString(),
    };
  }

  // wrong: reset to box 0, due immediately (requeued in-session by the caller)
  return {
    box: 0,
    due: todayIso(),
    seen,
    correct: correctSoFar,
    streak: 0,
    lastResult: verdict,
    lastSeen: new Date().toISOString(),
  };
}

/** Item ids due today or overdue, sorted by due date ascending. */
export function dueItemIds(progress: Progress, itemIds: string[]): string[] {
  const today = todayIso();
  return itemIds
    .filter((id) => progress[id] && progress[id].due <= today)
    .sort((a, b) => progress[a].due.localeCompare(progress[b].due));
}

/** Item ids never seen before (no progress entry). */
export function newItemIds(progress: Progress, itemIds: string[]): string[] {
  return itemIds.filter((id) => !progress[id]);
}

/** Count of due items — used for dashboard badges. */
export function dueCount(progress: Progress, itemIds: string[]): number {
  return dueItemIds(progress, itemIds).length;
}
