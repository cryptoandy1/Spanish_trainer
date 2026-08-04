import { describe, expect, it } from "vitest";
import { gradeAnswer, gradeSpeechAlternatives } from "./grade";

describe("gradeAnswer", () => {
  it("returns 'perfect' for an exact match", () => {
    expect(gradeAnswer("está", "está", [], { strictAccents: false })).toBe("perfect");
  });

  it("returns 'correct' when only case or punctuation differs", () => {
    expect(gradeAnswer("Está", "está", [], { strictAccents: false })).toBe("correct");
    expect(gradeAnswer("está.", "está", [], { strictAccents: false })).toBe("correct");
  });

  it("returns 'accent' when only diacritics differ and strictAccents is off", () => {
    expect(gradeAnswer("esta", "está", [], { strictAccents: false })).toBe("accent");
  });

  it("downgrades an accent-only mismatch to 'wrong' when strictAccents is on", () => {
    expect(gradeAnswer("esta", "está", [], { strictAccents: true })).toBe("wrong");
  });

  it("matches an alternative answer after normalization", () => {
    expect(gradeAnswer("Vale.", "de acuerdo", ["vale"], { strictAccents: false })).toBe("correct");
  });

  it("returns 'typo' for a small edit distance", () => {
    // "estas" vs "estás" is a 1-char diacritic diff (handled above); use a real typo:
    expect(gradeAnswer("gsto", "gato", [], { strictAccents: false })).toBe("typo");
  });

  it("returns 'wrong' for an unrelated answer", () => {
    expect(gradeAnswer("hola", "adiós", [], { strictAccents: false })).toBe("wrong");
  });

  it("returns 'wrong' for an empty answer", () => {
    expect(gradeAnswer("", "hola", [], { strictAccents: false })).toBe("wrong");
    expect(gradeAnswer("   ", "hola", [], { strictAccents: false })).toBe("wrong");
  });

  it("speech mode never penalizes accents, even with strictAccents on", () => {
    expect(gradeAnswer("esta", "está", [], { strictAccents: true, speechMode: true })).toBe("correct");
  });

  it("speech mode has a looser typo tolerance than typing mode", () => {
    // "camino" -> "cavano" is a 2-substitution edit distance on a 6-char word:
    // within speech tolerance (max(2, floor(6/6))=2), outside typing tolerance (max(1, floor(6/10))=1).
    expect(gradeAnswer("cavano", "camino", [], { strictAccents: false, speechMode: true })).toBe("typo");
    expect(gradeAnswer("cavano", "camino", [], { strictAccents: false, speechMode: false })).toBe("wrong");
  });
});

describe("gradeSpeechAlternatives", () => {
  it("picks the best verdict among several ASR alternatives", () => {
    const verdict = gradeSpeechAlternatives(["adios", "hola", "ola"], "hola");
    expect(verdict).toBe("perfect");
  });

  it("returns 'wrong' when no alternative is close", () => {
    const verdict = gradeSpeechAlternatives(["adios", "buenas"], "hola");
    expect(verdict).toBe("wrong");
  });
});
