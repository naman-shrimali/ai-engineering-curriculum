---
id: tut-06
title: "Embedding & Vector Store Strategy"
module: tutor
prerequisites: []
related_ids: [tut-05, rag-02, rag-03]
keywords:
  - embeddings
  - vector store
  - chroma
  - local embedding model
  - hosted embedding
  - mps
  - hybrid search
  - retrieval config
summary: >-
  The recommended embedding and vector-store setup for this corpus in two
  tiers — a lightweight fully-local option (small MPS-friendly embedder +
  Chroma) for an 8GB M1, and a hosted option for quality/scale — plus the
  shared retrieval config: hybrid search, metadata filters, and reranking.
difficulty: 2
est_minutes: 20
status: evolving
volatility: volatile
last_reviewed: 2026-07-10
sources:
  - key: chroma-docs
    tier: 1
    title: "Chroma documentation"
    org: Chroma
    url: https://docs.trychroma.com/
    accessed: 2026-07-10
  - key: sbert-docs
    tier: 1
    title: "Sentence Transformers documentation"
    org: SBERT / Hugging Face
    url: https://www.sbert.net/
    accessed: 2026-07-10
  - key: mteb
    tier: 2
    title: "MTEB: Massive Text Embedding Benchmark"
    org: arXiv
    url: https://arxiv.org/abs/2210.07316
    accessed: 2026-07-10
---

# Embedding & Vector Store Strategy

The retrieval setup for a tutor over this corpus, in two tiers: a **fully-local option** that runs on an 8GB M1 Air (small embedder on MPS + Chroma, no API keys, no Docker) and a **hosted option** for higher retrieval quality or larger scale. Both share the same chunking ([tut-05](chunking.md)) and the same retrieval config. This is a `volatile` doc — specific models and their rankings churn ([api-06](../../modules/02-llm-apis/api-06-model-selection.md)'s bake-off discipline applies to embedders too); the *decision procedure and architecture* are the durable part. Chapters [rag-02](../../modules/03-retrieval/rag-02-vector-search.md)/[rag-03](../../modules/03-retrieval/rag-03-vector-databases.md) teach the mechanics; this file is the concrete recommendation.

## Corpus profile (why this is easy)

Sizing first — the numbers make the local tier obviously sufficient. The written corpus is ~31 files averaging ~15 H2 sections → **roughly 500 chunks now, ~1,500 when all 61 chapters land**. At 384–768 dimensions in float32 that is single-digit megabytes of vectors. This is *far* below the scale where ANN indexes or dedicated vector databases matter (rag-02's "brute force is fine to ~1M vectors") — so exact search in Chroma is not just adequate, it's optimal. Do not reach for Pinecone/Qdrant/pgvector here; that would be the premature-infrastructure anti-pattern this repo keeps warning about.

## Tier 1 — fully local (recommended default, 8GB M1)

Runs offline, no keys, no cost, private. The stack:

- **Embedder:** a small sentence-transformer that fits comfortably in memory and runs on Apple Silicon via MPS — e.g. a **`bge-small`- or `gte-small`-class model (~384 dim, ~130MB)** through `sentence-transformers`.[^sbert-docs] These sit near the top of retrieval benchmarks per parameter[^mteb] and embed the whole corpus in seconds on an M1. Enable MPS: `SentenceTransformer(model, device="mps")`.
- **Store:** **Chroma** in persistent local mode[^chroma-docs] — an embedded vector store (SQLite-backed, `pip install chromadb`, no server, no Docker). Exact cosine search over ~1,500 vectors is instant.
- **Normalization:** L2-normalize embeddings at write time and use cosine/dot (fnd-03's rule — normalize once, the metric debate disappears).

```python
from sentence_transformers import SentenceTransformer
import chromadb

embedder = SentenceTransformer("BAAI/bge-small-en-v1.5", device="mps")  # ~130MB, MPS
client = chromadb.PersistentClient(path=".chroma")
col = client.get_or_create_collection("ai-eng", metadata={"hnsw:space": "cosine"})

# ingest (chunks from tut-05): embed the header+body, store display text + metadata
col.add(ids=[c.id for c in chunks],
        embeddings=embedder.encode([c.embed_text for c in chunks], normalize_embeddings=True).tolist(),
        documents=[c.display_text for c in chunks],
        metadatas=[c.metadata for c in chunks])
```

Memory budget on 8GB: embedder (~130MB) + Chroma (tens of MB) + Python leaves ample headroom alongside a browser. If you also run a **local generation model** for a fully-offline tutor, a 4-bit ~3–4B model via Ollama (~3GB, api-07) coexists — but the honest recommendation is local *retrieval* + a hosted *generation* model for answer quality, since the generator is where the capability gap bites (fnd-09).

## Tier 2 — hosted (higher retrieval quality / scale)

When retrieval quality on hard queries matters more than locality, or the corpus grows well beyond this repo:

- **Embedder:** a hosted embedding endpoint (an OpenAI / Voyage / Cohere-class `text-embedding` model — pick by a retrieval eval on *your* queries, not the leaderboard, per api-06 and rag-03). Higher dimensions and stronger asymmetric query/passage training buy recall on paraphrased questions.
- **Store:** Chroma still suffices at this corpus size; graduate to pgvector (if you already run Postgres) or a dedicated store only past low-millions of vectors or when you need multi-tenancy — the rag-03 decision, not a default.
- **Trade-off:** cost per embed + a network hop + the fnd-03 versioning tax (a hosted model can be deprecated → full reindex). Keep raw Markdown as the source of truth so reindexing is a batch job.

> **Volatile:** the specific embedders named above (`bge-small`, `gte-small`, hosted families) shift in ranking every few months. Re-verify against a small retrieval eval on ~30 real tutor questions with labeled relevant chunks (the rag-03/api-06 bake-off) at setup and at each refresh. The two-tier architecture and the "exact search is enough here" conclusion are stable.

## Shared retrieval config (both tiers)

The query-time setup, matching the corpus's structure:

1. **Hybrid search.** Combine vector similarity with a lexical match over the `keywords` + `h2_heading` metadata (rag-06). This corpus is dense with exact terms — chapter IDs (`fnd-05`), acronyms (`GQA`, `TTFT`), API names — that lexical catches and embeddings blur. Chroma supports metadata filtering; run a parallel keyword pass and merge by Reciprocal Rank Fusion.
2. **Metadata filters.** Expose `status` and `volatility` filters: default-exclude `experimental`, and flag `volatile` chunks past their review cadence (`last_reviewed` older than 3 months) so the tutor can caveat them. Filter by `module` when the asker scopes a question.
3. **Retrieve wide, rerank narrow.** Pull top ~20 by hybrid score, then (optional, tier-2-worth-it) rerank to top 5–6 with a cross-encoder before assembly (rag-06). At this corpus size even the local tier can afford a small local reranker if quality demands.
4. **Assemble with placement discipline.** Feed the reranked chunks into the context with best matches at the edges, the question last, and the "answer only from provided sections, cite the chapter ID" instruction (rag-01 + the [tutor prompt](../prompts/tutor.md)). The context header from tut-05 travels with each chunk, so citations resolve to `id § h2_heading`.
5. **Handle the pending 42.** If the best matches are `chunk_type: blueprint` (a pending chapter), the tutor answers from the blueprint thesis with an explicit "not yet written" flag — never dressing a blueprint up as finished content.

## Evaluation of the retrieval itself

Even for a personal tutor, sanity-check retrieval (rag-07's discipline, scaled down): keep ~30 questions you know the answers to, each labeled with the chapter/section that answers it, and measure recall@5. Rerun when you change embedder, chunker, or add chapters. This is the difference between a tutor that cites the right section and one that confidently retrieves the wrong one — and it takes an afternoon.

## Related chapters

| Chapter | What it explains |
|---|---|
| [rag-02](../../modules/03-retrieval/rag-02-vector-search.md) | Vector search mechanics (why exact search suffices here) |
| [rag-03](../../modules/03-retrieval/rag-03-vector-databases.md) | Store selection and the "start boring" argument |
| [rag-06](../../modules/03-retrieval/rag-06-advanced-retrieval.md) | Hybrid search and reranking used in the config |
| [fnd-03](../../modules/01-foundations/fnd-03-embeddings.md) | Embedding mechanics, normalization, versioning |
| [tut-05 chunking](chunking.md) | What produces the chunks this embeds |

## Sources

[^chroma-docs]: [T1] Chroma. "Documentation." https://docs.trychroma.com/ (accessed 2026-07-10)
[^sbert-docs]: [T1] Sentence Transformers. "Documentation." https://www.sbert.net/ (accessed 2026-07-10)
[^mteb]: [T2] Muennighoff et al. (2022). "MTEB: Massive Text Embedding Benchmark." arXiv:2210.07316. https://arxiv.org/abs/2210.07316 (accessed 2026-07-10)
