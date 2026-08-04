import { beforeEach, describe, expect, it } from "vitest";
import {
  applyResult,
  BOX_COUNT,
  dueCount,
  dueItemIds,
  INTERVALS_DAYS,
  loadProgress,
  newItemIds,
  saveProgress,
} from "./srs";

beforeEach(() => {
  window.localStorage.clear();
});

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("applyResult", () => {
  it("creates a fresh entry at box 0 for a first-time item", () => {
    const entry = applyResult(undefined, "correct");
    expect(entry.seen).toBe(1);
    expect(entry.correct).toBe(1);
    expect(entry.box).toBe(1); // "correct" advances from the implicit box 0 start
  });

  it("advances the box on 'correct' and 'perfect', up to the max box", () => {
    let entry = applyResult(undefined, "perfect");
    for (let i = 0; i < BOX_COUNT + 3; i++) {
      entry = applyResult(entry, "perfect");
    }
    expect(entry.box).toBe(BOX_COUNT - 1);
  });

  it("sets the due date according to INTERVALS_DAYS for the new box", () => {
    const first = applyResult(undefined, "correct"); // box 0 -> 1
    expect(first.due).toBe(isoDaysFromNow(INTERVALS_DAYS[1]));
  });

  it("holds the box (does not advance) on 'accent' and 'typo', but still counts as correct", () => {
    const base = applyResult(undefined, "correct"); // box 1
    const held = applyResult(base, "accent");
    expect(held.box).toBe(base.box);
    expect(held.correct).toBe(2);
  });

  it("resets to box 0 and due today on 'wrong'", () => {
    const advanced = applyResult(applyResult(applyResult(undefined, "correct"), "correct"), "correct");
    expect(advanced.box).toBeGreaterThan(0);
    const failed = applyResult(advanced, "wrong");
    expect(failed.box).toBe(0);
    expect(failed.due).toBe(isoDaysFromNow(0));
    expect(failed.streak).toBe(0);
  });

  it("tracks streak across consecutive correct answers and resets it on a wrong one", () => {
    let entry = applyResult(undefined, "correct");
    entry = applyResult(entry, "correct");
    entry = applyResult(entry, "correct");
    expect(entry.streak).toBe(3);
    entry = applyResult(entry, "wrong");
    expect(entry.streak).toBe(0);
  });
});

describe("dueItemIds / newItemIds / dueCount", () => {
  it("treats an item with no progress entry as new, not due", () => {
    const progress = {};
    expect(newItemIds(progress, ["a", "b"])).toEqual(["a", "b"]);
    expect(dueItemIds(progress, ["a", "b"])).toEqual([]);
  });

  it("returns due items sorted by due date ascending", () => {
    const progress = {
      a: applyResult(undefined, "wrong"), // due today
      b: { ...applyResult(undefined, "wrong"), due: isoDaysFromNow(-5) }, // overdue
      c: { ...applyResult(undefined, "correct"), due: isoDaysFromNow(30) }, // far future, not due
    };
    const due = dueItemIds(progress, ["a", "b", "c"]);
    expect(due).toEqual(["b", "a"]);
  });

  it("dueCount matches dueItemIds().length", () => {
    const progress = {
      a: applyResult(undefined, "wrong"),
      b: { ...applyResult(undefined, "correct"), due: isoDaysFromNow(10) },
    };
    expect(dueCount(progress, ["a", "b"])).toBe(dueItemIds(progress, ["a", "b"]).length);
    expect(dueCount(progress, ["a", "b"])).toBe(1);
  });
});

describe("loadProgress / saveProgress round-trip", () => {
  it("persists and reloads a progress map for a given target language", () => {
    const progress = { ph_abc: applyResult(undefined, "correct") };
    saveProgress("es", progress);
    const reloaded = loadProgress("es");
    expect(reloaded).toEqual(progress);
  });

  it("returns an empty object for a language with no saved progress", () => {
    expect(loadProgress("fr")).toEqual({});
  });

  it("keeps progress for different target languages independent", () => {
    saveProgress("es", { a: applyResult(undefined, "correct") });
    saveProgress("fr", { b: applyResult(undefined, "wrong") });
    expect(Object.keys(loadProgress("es"))).toEqual(["a"]);
    expect(Object.keys(loadProgress("fr"))).toEqual(["b"]);
  });
});
