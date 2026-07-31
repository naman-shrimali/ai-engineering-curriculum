---
id: tut-05
title: "RAG Chunking Strategy"
module: tutor
prerequisites: []
related_ids: [tut-06, rag-04]
keywords:
  - chunking
  - ingestion
  - h2 sections
  - contextual header
  - metadata
  - self-contained
  - rag pipeline
summary: >-
  The executable chunking recipe for ingesting this repo into a vector store —
  operationalizing METADATA_SCHEMA §Chunking: split on H2, enrich each chunk
  with a frontmatter-derived context header, attach filterable metadata, exclude
  noise sections and stub files, and handle tables, code, and pending chapters.
difficulty: 2
est_minutes: 20
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources: []
---

# RAG Chunking Strategy

This is the **implementation recipe** for the contract in [`METADATA_SCHEMA.md` §Chunking](../../METADATA_SCHEMA.md) — that document is the spec, this is the runbook. The repo was *authored* to be chunked structurally (self-contained H2 sections, complete ledes, captioned diagrams), so a correct chunker is simple and needs no ML boundary detection. The chapter [rag-04](../../modules/03-retrieval/rag-04-chunking.md) teaches chunking theory generally; this file is specifically how to chunk *this corpus*. Do not invent a different scheme — the whole repo's self-containment discipline assumes this one.

## The boundary rule

Split every content file at `## ` (H2) headings. Each H2 section is one chunk. The rules, verbatim from the spec, with the operational detail:

- **The lede is its own chunk:** frontmatter + H1 + everything before the first H2. It is written to be a complete statement of the chapter (~150–250 tokens) — embed it as the chapter's "summary chunk," ideal for high-level questions.
- **One H2 = one chunk**, target 300–800 tokens. Sections were authored under ~1,000 tokens for exactly this reason.
- **Oversize fallback:** if an H2 exceeds ~1,200 tokens, split at H3 (`### `) boundaries only — never mid-paragraph, never mid-code-block, never mid-table. This is rare in this corpus by design.
- **Exclude from embedding:** `## Check your understanding` and `## Sources` (chapters), and `## Related chapters` + `## Sources` (engineering/tutor docs) — match by exact heading. They add retrieval noise. Keep `## Sources` retrievable *as metadata* (for citation resolution) but out of the semantic index.

## The contextual header

Prepend to each chunk's **embedded text** (not its displayed text) a header built purely from frontmatter — no prose parsing needed:

```text
[{id} · {module} · {title} — section: {h2_heading}]
{summary}

{chunk_body}
```

This is why the corpus duplicates `title`/`id`/`summary` in frontmatter: a chunk from the middle of fnd-05 still carries "this is the transformer chapter, foundations module, and here's the one-line summary," which sharply improves retrieval of otherwise-ambiguous sections (e.g. a "failure modes" section is meaningless without its chapter). Store the *displayed* text separately so citations show clean content.

## Metadata to attach per chunk

Store these fields alongside each chunk for filtered retrieval (all from frontmatter except the last two):

| Field | Use |
|---|---|
| `id`, `title`, `module` | Attribution and the context header |
| `h2_heading` | Section-level citation ("fnd-05 § KV cache arithmetic") |
| `status` | Filter out `experimental` for conservative answers |
| `volatility` | Warn on `volatile` chunks; prioritize refresh |
| `difficulty` | Match answer depth to the asker |
| `keywords` | Hybrid-search lexical field ([rag-06](../../modules/03-retrieval/rag-06-advanced-retrieval.md) pattern) |
| `last_reviewed` | Surface staleness; exclude stale volatile chunks |
| `source_path` | Link back to the file for the reader |
| `chunk_type` | `lede` \| `body` \| `flashcards` \| `interview` — lets the tutor prefer, e.g., interview chunks for interview-sim |

## Ingestion filters (what to exclude)

- **Stub/empty files:** skip any file whose body is under ~200 bytes. This excludes the `agt-01` phantom stub (REVIEW.md P0-1) — otherwise it becomes a titled garbage chunk that retrieves for "agent fundamentals" and answers nothing.
- **Pending chapters:** the 42 not-yet-written chapters have no file to chunk. For a query on a pending topic, retrieve the **blueprint thesis** from `blueprints/` (chunk those separately, tagged `chunk_type: blueprint`, `status: pending`) and have the tutor answer "not yet written — here is the planned scope," never a fabricated answer. See the [tutor prompt](../prompts/tutor.md).
- **Non-content:** `manifest.yaml`, `CHANGELOG.md`, `REVIEW.md`, and `blueprints/AUTHORING_GUIDE.md` are operational, not teaching — index them only if the tutor needs to answer meta questions ("what's the status of X"), tagged `module: meta`.

## Tables, code, and diagrams

The corpus authors these to survive chunking, so the rule is simply **keep them whole within their H2 chunk**:

- **Never split a Markdown table or fenced code block.** If keeping it whole pushes a chunk over ~1,200 tokens, that H2 was under-split at authoring time (a bug to file, per rag-04), not a reason to break the table.
- **Mermaid diagrams:** embed the diagram source *plus its italic caption* — the caption is written to be the diagram's alt-text and carries the semantic content. The raw Mermaid also retrieves surprisingly well as structured text.
- **Flashcards / interview Q&A:** these H2 sections are high-value for the quiz and interview-sim prompts — tag them `chunk_type: flashcards` / `interview` so those tools can target them.

## Reference implementation sketch

A complete chunker for this corpus is ~60 lines. The shape:

```python
import re, pathlib, yaml, tiktoken

ENC = tiktoken.get_encoding("cl100k_base")   # count real tokens (fnd-04)
EXCLUDE_HEADINGS = {"Check your understanding", "Sources", "Related chapters"}

def chunk_file(path):
    text = pathlib.Path(path).read_text()
    if len(text) < 200:                       # skip stubs (agt-01)
        return []
    fm_raw, body = text.split("---\n", 2)[1:]
    fm = yaml.safe_load(fm_raw)
    header = f"[{fm['id']} · {fm['module']} · {fm['title']} — section: {{h2}}]\n{fm['summary']}\n\n"
    # split on H2, keeping the lede (text before first ##) as its own chunk
    parts = re.split(r'(?m)^## ', body)
    lede, sections = parts[0], parts[1:]
    chunks = [_mk(fm, header, "lede", lede.strip())]
    for sec in sections:
        h2 = sec.split("\n", 1)[0].strip()
        if h2 in EXCLUDE_HEADINGS:            # drop noise sections
            continue
        ctype = "flashcards" if h2 == "Flashcards" else \
                "interview" if h2 == "Interview questions" else "body"
        chunks.append(_mk(fm, header, ctype, "## " + sec.strip(), h2))
    return chunks   # _mk builds {embed_text: header+body, display_text: body, metadata: fm+extras}
```

Token counting uses a real tokenizer, never `chars/4` ([fnd-04](../../modules/01-foundations/fnd-04-tokenization.md)'s rule) — the embedding model's own tokenizer if it differs. Re-chunk on every content change; chunks are derived data (the [eng-01](../../engineering/eng-01-rag-pipeline-architecture.md) contract), so raw Markdown stays the source of truth.

## Why not semantic or fixed-size chunking

Fixed-size chunking would cut mid-argument and orphan the context header's value; semantic (embedding-boundary) chunking would spend compute rediscovering boundaries the H2 structure already encodes perfectly. Because the corpus was *written* to the self-containment rules (no cross-section anaphora, complete ledes, captioned visuals), structural H2 chunking is both simpler and higher-quality here than either alternative — a rare case where the ingestion is easy *because the authoring was disciplined*.

## Related chapters

| Chapter | What it explains |
|---|---|
| [METADATA_SCHEMA.md](../../METADATA_SCHEMA.md) | The chunking contract this recipe implements (the spec) |
| [rag-04](../../modules/03-retrieval/rag-04-chunking.md) | Chunking theory and strategy in general |
| [tut-06 embedding-strategy](embedding-strategy.md) | What to embed these chunks with and where to store them |
| [eng-01](../../engineering/eng-01-rag-pipeline-architecture.md) | The ingestion path this feeds |

## Sources

(Implementation recipe — derives from METADATA_SCHEMA.md §Chunking; no external sources.)
