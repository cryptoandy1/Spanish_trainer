import { describe, expect, it } from "vitest";
import { assembleSession } from "./session";
import type { DeckItem } from "./deck";
import type { Progress, ProgressEntry } from "../srs";
import { seededRng } from "../text";

function item(id: string): DeckItem {
  return { itemId: id, target: `t-${id}`, native: `n-${id}` };
}

function entry(due: string): ProgressEntry {
  return { box: 1, due, seen: 1, correct: 1, streak: 1, lastResult: "correct", lastSeen: `${due}T00:00:00Z` };
}

/** A deterministic rng so tests can assert exact order. */
const fixedRng = () => seededRng("fixed-test-seed");

describe("assembleSession", () => {
  it("takes due items before never-seen ones", () => {
    const pool = [item("a"), item("b"), item("c"), item("d")];
    const progress: Progress = { c: entry("2000-01-01") }; // long overdue
    const session = assembleSession(pool, progress, 2, fixedRng());
    expect(session.map((s) => s.itemId)).toContain("c");
    expect(session).toHaveLength(2);
  });

  it("prioritises the most overdue item when the size cap bites", () => {
    const pool = [item("a"), item("b"), item("c")];
    const progress: Progress = {
      a: entry("2020-06-01"),
      b: entry("2000-01-01"), // oldest due date -> highest priority
      c: entry("2020-07-01"),
    };
    const session = assembleSession(pool, progress, 1, fixedRng());
    expect(session.map((s) => s.itemId)).toEqual(["b"]);
  });

  it("excludes items that are seen but not yet due", () => {
    const pool = [item("a"), item("b")];
    const progress: Progress = { a: entry("2999-01-01") }; // far future
    const session = assembleSession(pool, progress, 10, fixedRng());
    expect(session.map((s) => s.itemId)).toEqual(["b"]); // only the never-seen one
  });

  it("shuffles the selected items rather than returning raw pool order", () => {
    const pool = Array.from({ length: 30 }, (_, i) => item(`i${String(i).padStart(2, "0")}`));
    const session = assembleSession(pool, {}, 30, fixedRng());
    const ids = session.map((s) => s.itemId);
    const poolIds = pool.map((p) => p.itemId);
    expect(ids).toHaveLength(30);
    expect([...ids].sort()).toEqual([...poolIds].sort()); // same set…
    expect(ids).not.toEqual(poolIds); // …different order
  });

  it("samples the whole deck when the size cap bites, not just its first N", () => {
    // Regression: the shuffle used to run only AFTER the cap, so a 20-question
    // session on a 500-item deck was always items 0..19 of the file. On the
    // conjugation deck that meant the same verb every single time.
    const pool = Array.from({ length: 500 }, (_, i) => item(`i${String(i).padStart(3, "0")}`));
    const picked = assembleSession(pool, {}, 20, fixedRng()).map((s) => s.itemId);
    expect(picked).toHaveLength(20);
    expect(picked.some((id) => Number(id.slice(1)) >= 100)).toBe(true);
  });

  it("picks a different subset each session when rng is not pinned", () => {
    const pool = Array.from({ length: 500 }, (_, i) => item(`i${i}`));
    const a = new Set(assembleSession(pool, {}, 20).map((s) => s.itemId));
    const b = assembleSession(pool, {}, 20).map((s) => s.itemId);
    expect(b.some((id) => !a.has(id))).toBe(true); // 20 of 500 twice — overlap is near-nil
  });

  it("still prefers the most overdue item over the random fresh sample", () => {
    const pool = Array.from({ length: 200 }, (_, i) => item(`i${i}`));
    const progress: Progress = { i150: entry("2000-01-01") };
    const session = assembleSession(pool, progress, 5, fixedRng());
    expect(session.map((s) => s.itemId)).toContain("i150");
  });

  it("is deterministic for a given rng", () => {
    const pool = Array.from({ length: 20 }, (_, i) => item(`i${i}`));
    const a = assembleSession(pool, {}, 20, fixedRng()).map((s) => s.itemId);
    const b = assembleSession(pool, {}, 20, fixedRng()).map((s) => s.itemId);
    expect(a).toEqual(b);
  });

  it("varies between sessions when rng is not pinned", () => {
    const pool = Array.from({ length: 50 }, (_, i) => item(`i${i}`));
    const a = assembleSession(pool, {}, 50).map((s) => s.itemId);
    const b = assembleSession(pool, {}, 50).map((s) => s.itemId);
    expect(a).not.toEqual(b); // 50! orderings — a collision is not a realistic flake
  });

  it("takes the whole deck when sessionSize is Infinity", () => {
    const pool = Array.from({ length: 250 }, (_, i) => item(`i${i}`));
    const session = assembleSession(pool, {}, Number.POSITIVE_INFINITY, fixedRng());
    expect(session).toHaveLength(250);
    expect(new Set(session.map((s) => s.itemId)).size).toBe(250); // no duplicates
  });

  it("never returns an item twice", () => {
    const pool = Array.from({ length: 40 }, (_, i) => item(`i${i}`));
    const progress: Progress = { i0: entry("2000-01-01"), i5: entry("2000-01-02") };
    const session = assembleSession(pool, progress, 40, fixedRng());
    expect(new Set(session.map((s) => s.itemId)).size).toBe(session.length);
  });

  it("returns an empty session for an empty pool", () => {
    expect(assembleSession([], {}, 20, fixedRng())).toEqual([]);
  });
});
