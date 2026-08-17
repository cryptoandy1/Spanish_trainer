import { describe, expect, it } from "vitest";
import { collectRecentBatches } from "./recent";
import type { GrammarTopic, Phrase, SourceRef, Verb, VocabWord } from "../types/data";

function src(ingestBatch: string): SourceRef {
  return { origin: "claude", ingestBatch };
}

function phrase(id: string, batch: string): Phrase {
  return { id, text: id, tr: { ru: id }, topics: [], source: src(batch) };
}

function word(id: string, batch: string): VocabWord {
  return { id, lemma: id, pos: "noun", tr: { ru: id }, examples: [], topics: [], source: src(batch) };
}

function verb(id: string, batch: string): Verb {
  return {
    id,
    infinitive: id,
    tr: { ru: id },
    regularity: "regular",
    reflexive: false,
    nonFinite: {},
    tenses: {},
    topics: [],
    source: src(batch),
  };
}

function grammar(id: string, batch: string): GrammarTopic {
  return {
    id,
    title: { ru: id },
    order: 1,
    summary: { ru: id },
    bodyPath: { ru: `grammar/${id}.md` },
    examples: [],
    source: src(batch),
  };
}

describe("collectRecentBatches", () => {
  it("groups records by ingestBatch and counts all four types", () => {
    const batches = collectRecentBatches({
      phrases: [phrase("ph_1", "ingest-2026-08-10"), phrase("ph_2", "ingest-2026-08-10")],
      vocab: [word("vc_1", "ingest-2026-08-10")],
      verbs: [verb("vb_1", "ingest-2026-08-10")],
      grammar: [grammar("gr_1", "ingest-2026-08-10")],
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].id).toBe("ingest-2026-08-10");
    expect(batches[0].kind).toBe("ingest");
    expect(batches[0].date).toBe("2026-08-10");
    expect(batches[0].phrases).toHaveLength(2);
    expect(batches[0].total).toBe(5);
  });

  it("sorts newest date first, hand-fed batches before bulk ones on a tie", () => {
    const batches = collectRecentBatches({
      phrases: [
        phrase("ph_1", "seed-2026-08-04"),
        phrase("ph_2", "extract-2026-08-04"),
        phrase("ph_3", "ingest-2026-08-04"),
        phrase("ph_4", "ingest-2026-08-10"),
      ],
      vocab: [],
      verbs: [],
      grammar: [],
    });
    expect(batches.map((b) => b.id)).toEqual([
      "ingest-2026-08-10",
      "ingest-2026-08-04",
      "extract-2026-08-04",
      "seed-2026-08-04",
    ]);
  });

  it("keeps a batch id without a date suffix intact and sorts it last", () => {
    const batches = collectRecentBatches({
      phrases: [phrase("ph_1", "legacy"), phrase("ph_2", "ingest-2026-08-10")],
      vocab: [],
      verbs: [],
      grammar: [],
    });
    expect(batches.map((b) => b.id)).toEqual(["ingest-2026-08-10", "legacy"]);
    expect(batches[1].kind).toBe("legacy");
    expect(batches[1].date).toBe("");
  });
});
