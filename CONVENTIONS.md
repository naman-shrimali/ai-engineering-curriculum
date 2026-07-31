# CONVENTIONS

Authoring and maintenance rules for this repository. Frozen 2026-07-08; amended 2026-07-10 (spec_version 2: `engineering/` added; spec_version 3: `tutor/` query layer added — see CHANGELOG.md). Changes require a CHANGELOG entry and a version bump (see [Versioning](#versioning--update-strategy)).

## 1. Folder hierarchy

```
/                       repo root: README, CONVENTIONS, METADATA_SCHEMA, manifest.yaml, glossary.md, CHANGELOG.md
curriculum/             roadmap.md, dependency-graph.md — curriculum-level docs only
modules/<nn>-<slug>/    one directory per module, zero-padded order prefix
  <id>-<slug>.md        one file per chapter
  assets/               module-local images/diagrams that Mermaid can't express
engineering/            practitioner reference docs: architectures, patterns, playbooks, templates
  <id>-<slug>.md        one doc per file, ids prefixed eng-
tutor/                  query layer: compiled indices, RAG config, prompts, local tool scaffold
  INDEX.md GLOSSARY.md ACRONYMS.md knowledge-graph.md   ids prefixed tut-
  rag/ prompts/ tool/   RAG strategy, reusable system prompts, local app scaffold
```

**`tutor/` is a derived layer:** its indices (INDEX, GLOSSARY, ACRONYMS, knowledge-graph) are *compiled from* `modules/` + `engineering/` and are regenerated, not hand-maintained as source of truth — the canonical glossary remains `glossary.md` (§5); `tutor/GLOSSARY.md` is an expanded, RAG-ingestible superset that must not contradict it. Tutor docs carry frontmatter and volatility marks like all content.

Rules:

- **One chapter = one file.** No multi-file chapters; if a chapter needs splitting, it becomes two chapters with two IDs (via the deprecation process, §6).
- **Teaching content lives in `modules/`; reference content lives in `engineering/`.** Chapters teach (intuition → mechanics → practice); engineering docs specify (architectures, checklists, templates a working engineer copies from). An engineering doc never re-teaches a mechanism — it cross-links the chapter that does.
- **Engineering docs follow chapter conventions** (frontmatter per METADATA_SCHEMA, §3 Markdown rules, §4 diagrams, §5 citations, volatility marking) with two deviations: they end with `## Related chapters` (a table mapping each linked chapter ID to what it explains) followed by `## Sources` — no "Check your understanding" — and they may use tables more liberally, since reference material is enumerable by nature.
- Runnable code examples live inline in chapters as fenced blocks. If a chapter ever needs a full runnable project, it goes in `labs/<id>-<slug>/` (directory reserved; not part of the initial build).

## 2. File naming

- Chapter files: `<id>-<slug>.md`, e.g. `rag-05-rag-pipeline.md`. Lowercase kebab-case throughout; ASCII only; no dates in filenames.
- **IDs are immutable and never reused**, even after deprecation. The slug may be corrected only together with a manifest update and a redirect note in the CHANGELOG.
- Module directories: `<nn>-<slug>` with a two-digit prefix (`03-retrieval`). The prefix orders modules; it appears nowhere in chapter IDs, so modules can be reordered without breaking IDs.
- Assets: `assets/<chapter-id>-<short-name>.<ext>`, e.g. `assets/fnd-05-attention-heads.svg`.

## 3. Markdown standards

- **Exactly one H1** per file, identical to the frontmatter `title`. The H1 is the only heading level 1.
- **H2 is the chunking unit** (see METADATA_SCHEMA.md §Chunking). Every H2 section must be self-contained: readable without the preceding section, no "as shown above", no unexplained pronouns referring to earlier sections. Repeat the key term instead.
- Heading case: sentence case (`## Why the KV cache matters`), no trailing punctuation, no numbering in headings (IDs and order live in metadata, not prose).
- Maximum depth H3. If you need H4, the H2 section is too big — split it.
- Code fences always declare a language (` ```python `, ` ```bash `, ` ```json `). Pseudo-code uses ` ```text `.
- Callouts use blockquote prefixes, exactly these four: `> **Note:**`, `> **Warning:**`, `> **Volatile:**` (marks a passage expected to date faster than the rest of the file), `> **Deep dive:**` (optional advanced material).
- No hard line-wrapping; one paragraph per line. Tables only for enumerable facts, never for explanations.
- Every chapter ends with two fixed H2 sections, in order: `## Check your understanding` (3–5 self-test questions) and `## Sources` (the citation list, §5).
- Cross-references between chapters use relative links with the chapter ID visible: `[agt-02](../04-agents/agt-02-tool-design.md)`. Never link by title alone — titles can change, IDs can't.

## 4. Diagram standards

- **Mermaid is the default** for every diagram: flowcharts, sequence diagrams, state machines, ER-style schemas. It's diffable, renders on GitHub, and survives RAG ingestion as text.
- Direction: `graph TD` for hierarchies/dependencies, `graph LR` for pipelines/dataflow, `sequenceDiagram` for request flows (client ↔ gateway ↔ model), `stateDiagram-v2` for agent loops and lifecycle.
- Every Mermaid block is immediately preceded by one italic sentence stating what the diagram shows (this becomes the diagram's "alt text" in chunks): `*Data flow from raw document to indexed chunk:*`
- Keep diagrams under ~20 nodes; split larger ones.
- **Justified alternatives** (use `assets/` + SVG with source committed):
  - Precise geometric/numeric layouts Mermaid can't express — e.g. attention-matrix heatmaps, tensor-shape walkthroughs, GPU memory maps.
  - Plots of real data (latency curves, scaling laws) — generate with matplotlib, commit both the `.svg` and the generating script.
  - ASCII art is acceptable only for tiny token-level illustrations inside ` ```text ` blocks (e.g. showing BPE merges).
- Never screenshot third-party UIs or diagrams (licensing + rot). Redraw.

## 5. Glossary & citations

### Glossary

- Single shared file: `glossary.md`, alphabetized, one term per entry: `**KV cache** — definition (≤2 sentences). *See: fnd-05, prd-02.*`
- First use of a glossary term in a chapter links to it: `[KV cache](../../glossary.md#kv-cache)`. Anchors are the lowercase kebab-case term.
- A term earns a glossary entry when it's used in ≥3 chapters or is commonly misused in industry. Chapter-local jargon is defined inline instead.

### Citation format

Source hierarchy, encoded as tiers — always cite the highest tier available:

| Tier | Source class | Examples |
|---|---|---|
| T1 | Official documentation | OpenAI, Anthropic, Google, Hugging Face, PyTorch, vLLM docs |
| T2 | Peer-reviewed papers / reputable preprints | NeurIPS/ICML/ACL papers, arXiv from known labs |
| T3 | University course material | Stanford CS336/CS224n, CMU, MIT OCW |
| T4 | Engineering blogs from major AI labs & serious practitioners | Anthropic/OpenAI/DeepMind engineering blogs, chip-level vendor blogs |
| T5 | Community resources | High-quality blog posts, GitHub discussions — **only for practical detail found nowhere else** |

Format — inline footnote reference, definition in the `## Sources` section:

```markdown
Prompt caching can cut input-token cost by up to 90% for repeated prefixes.[^anthropic-caching]

## Sources
[^anthropic-caching]: [T1] Anthropic. "Prompt caching." Anthropic API Docs. https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching (accessed 2026-07-08)
[^vaswani-2017]: [T2] Vaswani et al. (2017). "Attention Is All You Need." arXiv:1706.03762. https://arxiv.org/abs/1706.03762 (accessed 2026-07-08)
[^cs336-l3]: [T3] Stanford CS336 (2025). Lecture 3: Architectures. https://stanford-cs336.github.io/ (accessed 2026-07-08)
```

Rules:

- Every element: `[T<n>] Author/Org (year, if not obvious from URL). "Title." Venue/Site. URL (accessed YYYY-MM-DD)`.
- Footnote keys are stable slugs (`anthropic-caching`), not numbers — numbered keys break when sections are edited or chunked.
- **Claims about API behavior, pricing, or limits must cite T1.** Claims about model internals or training should cite T2/T3. A T5 citation must be flagged in the footnote: `[T5 — no higher-tier source exists]`.
- The `sources` list in frontmatter (METADATA_SCHEMA.md) mirrors the footnotes so the citation set is machine-readable without parsing prose.

## 6. Versioning & update strategy

The core design problem: models and tooling churn monthly, but most knowledge here doesn't. The system separates them so refresh work is targeted, not repo-wide.

### Volatility drives review cadence

Every chapter's frontmatter carries `volatility` and `last_reviewed`. A chapter is **due for review** when:

| volatility | Review due after |
|---|---|
| evergreen | 12 months |
| mixed | 6 months |
| volatile | 3 months |

A trivial script (or CI job) can list overdue chapters from frontmatter alone. Reviews update `last_reviewed` even when nothing changed — "checked, still accurate" is information.

### Containing volatility inside chapters

- Volatile facts inside otherwise-stable chapters are wrapped in `> **Volatile:**` callouts, so a refresh pass can grep for them.
- Model names, prices, and context-window sizes appear **only** in volatile chapters or Volatile callouts — never as load-bearing facts in evergreen prose. Evergreen chapters say "frontier models" and link to `api-06` for specifics.

### Model/tooling release playbook

When a major model or framework release lands:

1. `grep` manifest.yaml for `volatility: volatile` chapters in the affected modules; review those first.
2. `grep -rn "Volatile:" modules/` for embedded callouts mentioning the affected vendor/tool.
3. Update content, bump `last_reviewed`, adjust `status` if maturity changed (e.g. experimental → evolving when a practice consolidates).
4. Add a CHANGELOG entry: date, chapters touched, trigger (e.g. "GPT-6 release").

### Repo versioning

- The repo uses **CalVer releases**: `2026.07`, tagged when a coherent batch of content lands or a refresh pass completes. Content evolves continuously on `main`; tags exist so downstream consumers (including RAG indexes) can pin.
- `manifest.yaml` carries a `spec_version`; structural changes to the manifest or metadata schema bump it and require updating METADATA_SCHEMA.md in the same commit.
- **Deprecation, not deletion:** a superseded chapter gets `status: deprecated` in the manifest (the only place that status value is allowed), a one-line pointer to its successor at the top of the file, and removal from the roadmap. The file and ID remain forever.
