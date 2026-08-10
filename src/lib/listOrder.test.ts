import { describe, expect, it } from "vitest";
import { orderWithSeed } from "./listOrder";

const items = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("orderWithSeed", () => {
  it("returns the list untouched when there is no seed", () => {
    expect(orderWithSeed(items, null)).toEqual(items);
  });

  it("keeps every element, just reordered", () => {
    const shuffled = orderWithSeed(items, "seed-1");
    expect([...shuffled].sort()).toEqual([...items].sort());
    expect(shuffled).toHaveLength(items.length);
  });

  it("is stable for the same seed — the list must not jump between renders", () => {
    expect(orderWithSeed(items, "seed-1")).toEqual(orderWithSeed(items, "seed-1"));
  });

  it("gives a different order for a different seed", () => {
    const a = orderWithSeed(items, "seed-1");
    const b = orderWithSeed(items, "seed-2");
    expect(a).not.toEqual(b);
  });

  it("does not mutate the input", () => {
    const original = [...items];
    orderWithSeed(items, "seed-1");
    expect(items).toEqual(original);
  });

  it("copes with empty and single-element lists", () => {
    expect(orderWithSeed([], "seed-1")).toEqual([]);
    expect(orderWithSeed(["only"], "seed-1")).toEqual(["only"]);
  });
});
