/** Helpers for rendering the grammar article bodies stored under
 * `public/data/{lang}/grammar/*.md`. */

/**
 * Drop a leading level-1 heading from an article body.
 *
 * Article pages render the title from `grammar.json` themselves, but 17 of the
 * 49 body files also open with an `# …` repeating it, so the title showed up
 * twice. Stripping it here rather than editing the files fixes every existing
 * article at once and keeps a future ingest from reintroducing the duplicate:
 * a body is a fragment under the page's own `<h1>` and should never carry a
 * top-level heading of its own.
 *
 * Only a heading at the very start is removed, and only `#` — a `##` further
 * down is real structure.
 */
export function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^﻿?\s*#[ \t]+[^\n]*(?:\r?\n)*/, "");
}
