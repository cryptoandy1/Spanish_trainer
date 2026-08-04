// Text normalization and fuzzy-matching primitives used by id generation
// (id parity with tools/spanish_extract/ids.py) and by the quiz grading ladder.

/**
 * Lowercase, strip punctuation, collapse whitespace — but KEEP diacritics.
 * Used to detect "only accents differ" separately from other case/punctuation
 * noise (see grade.ts's ladder: accent-only mismatch is graded more gently
 * than a genuine spelling difference).
 *
 * "¿Está listo?" -> "está listo"
 */
export function normalizeLoose(s: string): string {
  return s
    .toLowerCase()
    .replace(/[¿¡?!.,;:…"'«»–—()[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Full normalize for comparison / id hashing: normalizeLoose() plus stripping
 * combining diacritical marks (NFD decompose, drop \p{Mn}).
 *
 * "¿Está listo?" -> "esta listo"
 */
export function normalize(s: string): string {
  return normalizeLoose(s)
    .normalize("NFD")
    .replace(/\p{Mn}/gu, ""); // strip combining marks: á->a, ñ->n, ü->u
}

/** Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

/** Similarity ratio in [0, 1], 1 = identical. Used for distractor scoring. */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Simple deterministic string hash (djb2), used to seed per-question shuffles. */
export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) seeded from a string — stable shuffles per question id. */
export function seededRng(seed: string): () => number {
  let a = hashString(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using a supplied RNG (for determinism). */
export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** ASCII-safe slug for ids (e.g. verb infinitives): lowercase, latin, hyphens. */
export function slug(s: string): string {
  return normalize(s).replace(/\s+/g, "-");
}
