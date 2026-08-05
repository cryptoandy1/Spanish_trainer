# inbox/ — conversations waiting to be ingested

Drop a Spanish-learning conversation here as a `.md` (or `.txt`) file, then run
`/ingest` with no arguments in Claude Code. Every file in this folder is
extracted into `public/data/es/*.json` and then moved to `inbox/processed/`.

Nothing in this folder is committed. **This repository is public**, and git
history cannot be rewritten away in practice — so raw conversation text, which
contains whatever personal context you happened to mention while asking about
Spanish, stays out of it. Only the extracted records (phrases, words, verbs,
grammar) reach `public/data/`, and those you review as a `git diff` before
pushing. `.gitignore` enforces this: `inbox/*` is ignored, this README is the
single tracked exception.

## Getting conversations in here

- **From this computer:** save or paste the text into a file. Any filename.
- **From your phone:** share the conversation to the private inbox repository
  (see `tools/inbox_pull.py`), then run `python -m tools.inbox_pull` here to
  download the new files into this folder.
- **File sync** (iCloud / Dropbox / Obsidian) pointed at this folder works too.

## Format

No required structure — plain conversation text is fine, and the more of it the
better. Two things genuinely help the extraction:

- **Keep your own messages, not just Claude's replies.** Corrections are built
  from what you attempted and what came back fixed; with only the answers,
  that material is lost.
- **Keep the Spanish exactly as written**, accents included. Ids are content
  hashes, so `esta` and `está` are different records.

Optionally start the file with a title line — it lands in the record's
`source.conversationTitle` and makes provenance readable later:

```markdown
# Разница между por и para
```
