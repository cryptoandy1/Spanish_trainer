import { describe, expect, it } from "vitest";
import { hasConjugationCells, verbFormsToDeck } from "./deck";
import type { LanguageMeta, Verb } from "../../types/data";

// Deliberately non-Spanish tense/person ids, and tenses listed out of `order`,
// to prove verbFormsToDeck() is language-agnostic and sorts by meta.order
// rather than by object-key insertion order.
const meta: LanguageMeta = {
  schemaVersion: 1,
  lang: "xx",
  speechLocale: "xx-XX",
  persons: [
    { id: "p1", label: "PersonOne", labelTr: { ru: "Лицо один" } },
    { id: "p2", label: "PersonTwo", labelTr: { ru: "Лицо два" } },
  ],
  tenses: [
    { id: "t2", mood: "m", order: 20, label: "TenseTwo", labelTr: { ru: "Время два" } },
    { id: "t1", mood: "m", order: 10, label: "TenseOne", labelTr: { ru: "Время один" } },
  ],
  pos: ["verb"],
  regularity: ["regular"],
  errorTags: [],
};

function makeVerb(id: string, infinitive: string, tenses: Verb["tenses"] = {}): Verb {
  return {
    id,
    infinitive,
    tr: { ru: `${infinitive}(ru)` },
    regularity: "regular",
    reflexive: false,
    nonFinite: {},
    tenses,
    topics: ["some-theme"],
    source: { origin: "manual", ingestBatch: "test" },
  };
}

describe("verbFormsToDeck", () => {
  it("emits one item per present form and skips absent person keys", () => {
    const verb = makeVerb("vb_x", "xer", {
      t1: { forms: { p1: { form: "xo" } } }, // p2 key entirely absent
    });
    const deck = verbFormsToDeck([verb], meta, "ru");
    expect(deck).toHaveLength(1);
    expect(deck[0].target).toBe("xo");
  });

  it("skips an explicit null form", () => {
    const verb = makeVerb("vb_x", "xer", {
      t1: { forms: { p1: { form: "xo" }, p2: null } },
    });
    const deck = verbFormsToDeck([verb], meta, "ru");
    expect(deck).toHaveLength(1);
    expect(deck.map((d) => d.itemId)).toEqual(["cj_vb_x_t1_p1"]);
  });

  it("a verb with tenses: {} yields zero items, no crash", () => {
    const verb = makeVerb("vb_empty", "vacio", {});
    expect(verbFormsToDeck([verb], meta, "ru")).toHaveLength(0);
  });

  it("a tense present on the verb but absent from meta.tenses yields zero cells", () => {
    const verb = makeVerb("vb_x", "xer", {
      unknown_tense: { forms: { p1: { form: "xo" } } },
    });
    expect(verbFormsToDeck([verb], meta, "ru")).toHaveLength(0);
  });

  it("mints ids as cj_<verbId>_<tenseId>_<personId>, unique across a multi-verb deck", () => {
    const v1 = makeVerb("vb_a", "aer", { t1: { forms: { p1: { form: "a1" }, p2: { form: "a2" } } } });
    const v2 = makeVerb("vb_b", "ber", { t1: { forms: { p1: { form: "b1" } } } });
    const deck = verbFormsToDeck([v1, v2], meta, "ru");
    const ids = deck.map((d) => d.itemId);
    expect(ids).toEqual(["cj_vb_a_t1_p1", "cj_vb_a_t1_p2", "cj_vb_b_t1_p1"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names the tense in the target language and the person in the native one", () => {
    const verb = makeVerb("vb_x", "xer", { t1: { forms: { p1: { form: "xo" } } } });
    const deck = verbFormsToDeck([verb], meta, "ru");
    expect(deck[0].native).toBe("xer — TenseOne, Лицо один");

    // Each half still has the other as a fallback: an empty target-language
    // `label` falls back to the gloss, an empty `labelTr` falls back to
    // `label` (tr() itself already falls back to the first language present,
    // so that branch only fires on a wholly empty map).
    const bareMeta: LanguageMeta = {
      ...meta,
      tenses: [{ id: "t1", mood: "m", order: 10, label: "", labelTr: { ru: "Время один" } }],
      persons: [{ id: "p1", label: "PersonOne", labelTr: {} }],
    };
    const deckBare = verbFormsToDeck([verb], bareMeta, "ru");
    expect(deckBare[0].native).toBe("xer — Время один, PersonOne");
  });

  it("maps fields: target/pos/topics, and leaves altTargets/context unset", () => {
    const verb = makeVerb("vb_x", "xer", { t1: { forms: { p1: { form: "xo" } } } });
    const [d] = verbFormsToDeck([verb], meta, "ru");
    expect(d.target).toBe("xo");
    expect(d.pos).toBe("t1");
    expect(d.topics).toEqual(["vb_x"]); // NOT verb.topics ("some-theme") -- see deck.ts comment
    expect(d.altTargets).toBeUndefined();
    expect(d.context).toBeUndefined();
  });

  it("orders output by meta.tenses[].order, not by Object.keys insertion order", () => {
    // verb.tenses is written t2-before-t1 (insertion order), but meta says t1 (order 10) before t2 (order 20)
    const verb = makeVerb("vb_x", "xer", {
      t2: { forms: { p1: { form: "form-t2" } } },
      t1: { forms: { p1: { form: "form-t1" } } },
    });
    const deck = verbFormsToDeck([verb], meta, "ru");
    expect(deck.map((d) => d.target)).toEqual(["form-t1", "form-t2"]);
  });

  it("gives two distinct ids for two cells of the same verb sharing an identical form string", () => {
    const verb = makeVerb("vb_x", "xer", {
      t1: { forms: { p1: { form: "same" } } },
      t2: { forms: { p1: { form: "same" } } },
    });
    const deck = verbFormsToDeck([verb], meta, "ru");
    expect(deck.map((d) => d.target)).toEqual(["same", "same"]);
    expect(new Set(deck.map((d) => d.itemId)).size).toBe(2);
  });

  it("explanation includes the verb translation, and an irregular marker/example when present", () => {
    const verb = makeVerb("vb_x", "xer", {
      t1: {
        forms: {
          p1: { form: "xo", irregular: true, example: { text: "xo mucho", tr: { ru: "я много xo" } } },
        },
      },
    });
    const [d] = verbFormsToDeck([verb], meta, "ru");
    expect(d.explanation).toContain("xer(ru)");
    expect(d.explanation).toContain("xo mucho");
    expect(d.explanation).toContain("я много xo");
  });
});

describe("hasConjugationCells", () => {
  it("is false for a verb with tenses: {}", () => {
    expect(hasConjugationCells(makeVerb("vb_x", "xer", {}))).toBe(false);
  });

  it("is false when every form is null or blank", () => {
    const verb = makeVerb("vb_x", "xer", {
      t1: { forms: { p1: null, p2: { form: "   " } } },
    });
    expect(hasConjugationCells(verb)).toBe(false);
  });

  it("is true when at least one form has content", () => {
    const verb = makeVerb("vb_x", "xer", { t1: { forms: { p1: { form: "xo" } } } });
    expect(hasConjugationCells(verb)).toBe(true);
  });
});
