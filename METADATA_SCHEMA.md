# METADATA_SCHEMA

The YAML frontmatter contract for every chapter file, plus chunking rules. Designed so the repo can be ingested into a RAG system without preprocessing heuristics: everything a retriever or reranker needs is explicit.

`spec_version: 2` — changes bump the version here and in `manifest.yaml`. (v2, 2026-07-10: added the `eng-` id prefix and `engineering` module for `engineering/` reference docs; they carry identical frontmatter, are listed in the manifest's `engineering_docs` section, and end with `## Related chapters` + `## Sources` instead of the chapter ending sections — see CONVENTIONS §1.)

## Frontmatter schema

Every file in `modules/` MUST begin with this frontmatter. All fields required unless marked optional.

```yaml
---
id: rag-05                        # string — stable chapter ID, matches filename prefix and manifest. Immutable.
title: "The RAG Pipeline End-to-End"  # string — exact match with the file's single H1.
module: retrieval                 # enum — foundations | llm-apis | retrieval | agents | evaluation |
                                  #        production | safety-security | fine-tuning | frontier
prerequisites: [rag-03, rag-04]   # list of chapter IDs — DIRECT prerequisites only. [] if none.
related_ids: [prd-01, sec-01]     # list of chapter IDs — relevant but not prerequisite. [] if none.
                                  # Used at retrieval time to pull sibling context.
keywords:                         # 5–12 lowercase strings. Include synonyms and abbreviations a
  - rag                           # searcher would use (e.g. both "retrieval augmented generation"
  - retrieval augmented generation #  and "rag") — these feed lexical/hybrid search.
  - reranking
  - grounding
summary: >-                       # 1–3 sentences, ≤60 words, self-contained (no "this chapter").
  How to assemble ingestion, retrieval, and generation into a production RAG
  pipeline, and where each stage fails. Covers index freshness, retrieval
  quality, prompt assembly, and grounded generation.
difficulty: 3                     # int 1–5, matches roadmap.
est_minutes: 300                  # int — estimated study time incl. exercises (roadmap hours × 60).
status: evolving                  # enum — stable | evolving | experimental (deprecated allowed post-launch only).
volatility: mixed                 # enum — evergreen | mixed | volatile. Drives review cadence (CONVENTIONS §6).
last_reviewed: 2026-07-08         # ISO date — last time a human verified accuracy. Set on creation.
sources:                          # Mirrors the chapter's ## Sources footnotes, machine-readable.
  - key: anthropic-caching        #   key: footnote slug used inline
    tier: 1                       #   tier: 1–5 per CONVENTIONS §5
    title: "Prompt caching"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
    accessed: 2026-07-08
---
```

### Validation rules (enforceable by a ~50-line script; run in CI)

1. `id` matches `^(fnd|api|rag|agt|evl|prd|sec|ftn|fro|eng)-\d{2}$`, equals the filename prefix, and exists in `manifest.yaml` (chapters in `chapters`, engineering docs in `engineering_docs`) with the same `path` and `status`.
2. Every ID in `prerequisites` and `related_ids` exists in the manifest; the prerequisite graph is acyclic; a chapter never lists itself.
3. `title` equals the H1 text; exactly one H1 in the body.
4. `summary` ≤ 60 words; `keywords` 5–12 entries, lowercase.
5. Every inline footnote key in the body has a matching `sources[].key` and vice versa.
6. `volatility: evergreen` files contain no `> **Volatile:**` callouts pointing at model names/prices without a link to a volatile chapter (lintable as: no bare model-version strings outside Volatile callouts).
7. `last_reviewed` not in the future; files overdue per the volatility cadence are reported (warning, not failure).

## Chunking guidance for RAG ingestion

The repo is written to be chunked **structurally, not by token count**. Ingestion pipelines should follow these rules; authors must write so that they hold.

### Chunk boundaries

- **The chunk unit is the H2 section** — split every file at `## ` headings. Never split inside an H2 unless it exceeds ~1,200 tokens; then split at H3 boundaries only.
- Target 300–800 tokens per chunk. Authors: if an H2 section exceeds ~1,000 tokens of prose, split it into two H2 sections rather than relying on the H3 fallback.
- The frontmatter + H1 + everything before the first H2 (the chapter lede) is its own chunk — authors must make the lede a complete statement of what the chapter covers and why it matters (~150–250 tokens).
- `## Check your understanding` and `## Sources` sections are **excluded from embedding** (flag them by exact heading match); they add noise to retrieval.

### Self-containment rules (why H2 discipline exists)

Each chunk must survive being read with zero surrounding context:

- **No anaphora across H2 boundaries.** Never begin a section with "This approach…", "As shown above…", "It also…". Name the subject: "Reranking improves precision by…".
- **Code blocks never open a section** — every fenced block is preceded in the same section by at least one sentence saying what it demonstrates.
- **Tables and Mermaid diagrams carry their own one-sentence caption** in the same section (CONVENTIONS §4), so a chunk containing them is interpretable.
- Abbreviations are expanded on first use *per H2 section* when the term is central to that section, not just once per file.

### Contextual enrichment at ingestion time

Prepend to every chunk's embedded text (not its displayed text) a context header assembled from frontmatter:

```text
[{id} · {module} · {title} — section: {h2_heading}]
{summary}
```

This is why `summary` must be self-contained and why `title`/`id` are duplicated in metadata: the ingestion pipeline never needs to parse prose to build the header. Store `id`, `module`, `status`, `volatility`, `difficulty`, `keywords`, and `last_reviewed` as chunk metadata for filtered retrieval (e.g. "exclude experimental", "only evergreen", "refresh candidates older than 6 months").
