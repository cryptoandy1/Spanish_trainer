import type { DataPack, GrammarTopic, Phrase, Verb, VocabWord } from "../types/data";

/**
 * One intake batch — everything that landed in the data in a single
 * seed/extract/ingest/curate pass. Records carry no per-item timestamp;
 * `source.ingestBatch` is the only record of when an item arrived, so the
 * "recently added" view groups by it.
 */
export interface RecentBatch {
  id: string; // full batch id, e.g. "ingest-2026-08-10"
  kind: string; // prefix before the date, e.g. "ingest"
  date: string; // "2026-08-10"; empty when the id carries no date suffix
  phrases: Phrase[];
  vocab: VocabWord[];
  verbs: Verb[];
  grammar: GrammarTopic[];
  total: number;
}

/** Same-date tie-break: hand-fed batches above bulk archive passes. */
const KIND_RANK: Record<string, number> = { ingest: 0, curate: 1, extract: 3, seed: 4 };
const rank = (b: RecentBatch) => KIND_RANK[b.kind] ?? 2;

const BATCH_ID = /^(.+)-(\d{4}-\d{2}-\d{2})$/;

function batchOf(byId: Map<string, RecentBatch>, id: string): RecentBatch {
  let batch = byId.get(id);
  if (!batch) {
    const m = BATCH_ID.exec(id);
    batch = {
      id,
      kind: m ? m[1] : id,
      date: m ? m[2] : "",
      phrases: [],
      vocab: [],
      verbs: [],
      grammar: [],
      total: 0,
    };
    byId.set(id, batch);
  }
  return batch;
}

/** Group every record by its intake batch, newest batch first. */
export function collectRecentBatches(
  pack: Pick<DataPack, "phrases" | "vocab" | "verbs" | "grammar">,
): RecentBatch[] {
  const byId = new Map<string, RecentBatch>();
  for (const p of pack.phrases) batchOf(byId, p.source.ingestBatch).phrases.push(p);
  for (const w of pack.vocab) batchOf(byId, w.source.ingestBatch).vocab.push(w);
  for (const v of pack.verbs) batchOf(byId, v.source.ingestBatch).verbs.push(v);
  for (const g of pack.grammar) batchOf(byId, g.source.ingestBatch).grammar.push(g);
  const batches = [...byId.values()];
  for (const b of batches) {
    b.total = b.phrases.length + b.vocab.length + b.verbs.length + b.grammar.length;
  }
  return batches.sort(
    (a, b) => b.date.localeCompare(a.date) || rank(a) - rank(b) || a.id.localeCompare(b.id),
  );
}
