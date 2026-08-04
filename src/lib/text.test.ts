import { describe, expect, it } from "vitest";
import { hashString, levenshtein, normalize, normalizeLoose, seededRng, seededShuffle, similarity, slug } from "./text";

describe("normalizeLoose", () => {
  it("lowercases, strips punctuation, collapses whitespace, keeps diacritics", () => {
    expect(normalizeLoose("¿Está listo?")).toBe("está listo");
    expect(normalizeLoose("  Hola,   mundo!  ")).toBe("hola mundo");
  });
});

describe("normalize", () => {
  it("also strips diacritics", () => {
    expect(normalize("¿Está listo?")).toBe("esta listo");
    expect(normalize("Ñoño")).toBe("nono");
  });

  it("treats accented and unaccented forms as equal", () => {
    expect(normalize("está")).toBe(normalize("esta"));
  });

  it("is idempotent-ish for plain ascii lowercase text", () => {
    expect(normalize("hola")).toBe("hola");
  });
});

describe("levenshtein", () => {
  it("is 0 for identical strings", () => {
    expect(levenshtein("hola", "hola")).toBe(0);
  });

  it("counts a single substitution", () => {
    expect(levenshtein("gato", "goto")).toBe(1);
  });

  it("counts a single insertion/deletion", () => {
    expect(levenshtein("hola", "holaa")).toBe(1);
    expect(levenshtein("holaa", "hola")).toBe(1);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "")).toBe(0);
  });
});

describe("similarity", () => {
  it("is 1 for identical strings", () => {
    expect(similarity("hola", "hola")).toBe(1);
  });

  it("is 0 for completely different strings of equal length", () => {
    expect(similarity("abcd", "wxyz")).toBe(0);
  });

  it("is between 0 and 1 for partially similar strings", () => {
    const s = similarity("estoy", "estas");
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});

describe("seededRng / seededShuffle", () => {
  it("produces a deterministic sequence for the same seed", () => {
    const a = seededRng("question-1");
    const b = seededRng("question-1");
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces a different sequence for a different seed (overwhelmingly likely)", () => {
    const a = seededRng("question-1")();
    const b = seededRng("question-2")();
    expect(a).not.toBe(b);
  });

  it("shuffles deterministically given the same seed", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffledA = seededShuffle(arr, seededRng("q"));
    const shuffledB = seededShuffle(arr, seededRng("q"));
    expect(shuffledA).toEqual(shuffledB);
  });

  it("shuffle is a permutation (same elements, same length)", () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = seededShuffle(arr, seededRng("perm-check"));
    expect(shuffled).toHaveLength(arr.length);
    expect([...shuffled].sort()).toEqual([...arr].sort());
  });
});

describe("hashString", () => {
  it("is deterministic", () => {
    expect(hashString("hola")).toBe(hashString("hola"));
  });

  it("differs for different inputs (overwhelmingly likely)", () => {
    expect(hashString("hola")).not.toBe(hashString("adios"));
  });
});

describe("slug", () => {
  it("produces a latin, hyphenated, accent-free slug", () => {
    expect(slug("Está bien")).toBe("esta-bien");
  });
});
