import { describe, expect, it } from "vitest";
import { pickDistractors } from "./distractors";
import type { DeckItem } from "./deck";
import { seededRng } from "../text";

function item(id: string, target: string, native: string, extra: Partial<DeckItem> = {}): DeckItem {
  return { itemId: id, target, native, ...extra };
}

describe("pickDistractors", () => {
  it("never includes the correct item itself", () => {
    const correct = item("a", "hola", "привет", { topics: ["greet"] });
    const pool = [
      correct,
      item("b", "adiós", "пока", { topics: ["greet"] }),
      item("c", "gracias", "спасибо", { topics: ["greet"] }),
      item("d", "por favor", "пожалуйста", { topics: ["greet"] }),
    ];
    const picks = pickDistractors(correct, pool, "native-target", 3, seededRng("q"));
    expect(picks.some((p) => p.itemId === correct.itemId)).toBe(false);
  });

  it("never includes an item whose answer normalizes to the same text as the correct answer", () => {
    const correct = item("a", "vale", "окей", { topics: ["x"] });
    const duplicate = item("dupe", "Vale.", "тоже окей", { topics: ["x"] }); // same normalized target
    const pool = [
      correct,
      duplicate,
      item("b", "adiós", "пока", { topics: ["x"] }),
      item("c", "gracias", "спасибо", { topics: ["x"] }),
      item("d", "por favor", "пожалуйста", { topics: ["x"] }),
    ];
    const picks = pickDistractors(correct, pool, "native-target", 3, seededRng("q"));
    expect(picks.some((p) => p.itemId === "dupe")).toBe(false);
  });

  it("returns up to n items when enough distinct candidates exist", () => {
    const correct = item("a", "hola", "привет", { topics: ["greet"] });
    const pool = [
      correct,
      item("b", "adiós", "пока"),
      item("c", "gracias", "спасибо"),
      item("d", "por favor", "пожалуйста"),
      item("e", "buenas noches", "спокойной ночи"),
    ];
    const picks = pickDistractors(correct, pool, "native-target", 3, seededRng("q"));
    expect(picks).toHaveLength(3);
  });

  it("is deterministic for the same seed", () => {
    const correct = item("a", "hola", "привет", { topics: ["greet"] });
    const pool = [
      correct,
      item("b", "adiós", "пока", { topics: ["greet"] }),
      item("c", "gracias", "спасибо", { topics: ["greet"] }),
      item("d", "por favor", "пожалуйста", { topics: ["greet"] }),
      item("e", "buenas noches", "спокойной ночи", { topics: ["other"] }),
      item("f", "hasta luego", "до скорого", { topics: ["other"] }),
    ];
    const picksA = pickDistractors(correct, pool, "native-target", 3, seededRng("stable-seed"));
    const picksB = pickDistractors(correct, pool, "native-target", 3, seededRng("stable-seed"));
    expect(picksA.map((p) => p.itemId)).toEqual(picksB.map((p) => p.itemId));
  });

  it("falls back to any distinct item when the pool is smaller than n after filtering", () => {
    const correct = item("a", "hola", "привет");
    const pool = [correct, item("b", "adiós", "пока")];
    const picks = pickDistractors(correct, pool, "native-target", 3, seededRng("q"));
    expect(picks.length).toBeLessThanOrEqual(1); // only one other distinct candidate available
    expect(picks.every((p) => p.itemId !== correct.itemId)).toBe(true);
  });
});
