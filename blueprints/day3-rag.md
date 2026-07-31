# Blueprints: Module 3 remainder (rag-02 … rag-08)

Read AUTHORING_GUIDE.md first. Canon already written and citable: rag-01 (context assembler, budgets, placement, compaction), eng-01 (RAG reference architecture — chapters teach the mechanisms it specifies; never contradict its contracts), fnd-03 (embeddings, versioning, similarity), evl-01 (eval doctrine).

---

## rag-02 — Vector Search Fundamentals

**Meta:** stable/evergreen · diff 3 · 240 min → 5,000–6,200 words · prereqs [fnd-03] · related [rag-03, rag-06, fnd-03]
**Thesis:** exact nearest-neighbor search doesn't scale; approximate algorithms (HNSW, IVF, PQ) buy speed with a recall dial — and every production retrieval decision (index choice, filtering, memory sizing) traces to how these structures work.
**Sections:** (1) Intuition: searching a library by walking toward warmer shelves — greedy navigation in similarity space; recall as the honesty metric of approximation. (2) Brute force and why it dies: O(N·d) per query; the memory napkin — N × d × 4 bytes float32 (10M × 1536 ≈ 61 GB); exact search is fine to ~1M vectors (say so — most readers' corpora fit!). (3) HNSW mechanics: navigable small-world graphs, layered skip-list intuition, greedy descent; parameters M/efConstruction/efSearch and what each trades; why deletes are awkward. (4) IVF + PQ: cluster-then-probe (nprobe dial); product quantization as lossy vector compression (sub-vectors → codebooks; 61 GB → ~2 GB at 8× compression), recall cost of compression. (5) The recall/latency/memory triangle: measuring recall@k against exact ground truth; ANN-benchmarks methodology caution. (6) Filtered search: why metadata filters break graph traversal (pre- vs post-filtering), the practical consequences for rag-03.
**Must land:** recall is measured against exact search on YOUR data (the eval decides); brute force is underrated at small N; parameters are dials not settings; filtering is the hidden hard problem.
**Math that earns its place:** memory formula; recall@k definition. No graph theory proofs.
**Diagrams:** (1) *graph TD* — HNSW layers as express-lanes-to-local-streets (≤12 nodes); (2) *graph LR* — IVF query flow: query → nearest centroids → probe cells → rerank. PQ codebook geometry: prose + tiny ```text``` illustration only (Mermaid can't).
**Mini-project:** hnswlib/faiss on your rag-01/fnd-03 corpus: brute-force ground truth → HNSW recall-vs-efSearch curve → PQ compression quality tradeoff. Success: a recall/latency plot you made. Capstone: index choice for rag-05 justified by these curves.
**Sources:** [T2] Malkov & Yashunin, HNSW, arXiv:1603.09320 · [T2] Jégou et al., Product Quantization, IEEE TPAMI 2011 · [T2] Johnson et al., FAISS billion-scale, arXiv:1702.08734 · [T1] FAISS wiki/docs · [T3] ann-benchmarks.com methodology (or cite as T5-flagged if classified conservatively).
**Volatile fences:** none needed — evergreen; index *products* belong to rag-03.

---

## rag-03 — Vector Databases in Practice

**Meta:** evolving/volatile · diff 2 · 180 min → 4,300–5,000 words · prereqs [rag-02] · related [rag-05, eng-01, prd-06]
**Thesis:** vector stores are databases first and vector indexes second — selection is about filtering, hybrid support, ops burden, and cost at your scale, not ANN benchmark deltas; and "your existing database with a vector extension" is the right answer more often than the category's marketing admits.
**Sections:** (1) Intuition: the index from rag-02 needs a database around it (CRUD, filters, replication, ACLs). (2) The category map (fence as volatile, teach as categories): dedicated engines; incumbent extensions (pgvector/OpenSearch/Redis-class); embedded/local (LanceDB/Chroma/FAISS-as-library-class). (3) Selection criteria in decision order: scale (rag-02 napkin), filtered-search quality, hybrid (BM25+vector — forward-link rag-06), freshness/upsert behavior, multi-tenancy/namespaces, ops model, cost shape. (4) Operational realities: reindexing (fnd-03's versioning → rebuild pipeline), backup = raw text + config (eng-01's derived-data contract), monitoring recall drift. (5) The pgvector default argument: at ≤ low-millions vectors with existing Postgres, extension beats new infra — with the honest escalation triggers.
**Must land:** benchmarks measure ANN, you operate a database; the bake-off procedure (api-06) applies to stores; derived-data contract; start boring.
**Diagrams:** (1) *graph TD* decision tree: corpus size / infra / filtering needs → category. One diagram suffices.
**Mini-project:** same corpus in pgvector AND one dedicated store: measure recall@10, filtered-query latency, upsert-to-visible lag; write the api-06-style decision log. Capstone: rag-05's store, chosen with evidence.
**Sources:** [T1] pgvector README/docs · [T1] Qdrant docs · [T1] Pinecone docs · [T1] OpenSearch k-NN docs · reuse arXiv:1603.09320 for parameter mapping.
**Volatile fences:** the entire category map + any named product's capabilities; lede acknowledges quarterly churn; stable layer = criteria + procedure.

---

## rag-04 — Chunking & Document Processing

**Meta:** evolving/mixed · diff 2 · 180 min → 4,300–5,000 words · prereqs [rag-01] · related [rag-05, api-04, fnd-04]
**Thesis:** chunking decides what *can* be retrieved — the retrieval unit is the quality ceiling; and the craft is aligning chunk boundaries with meaning while enriching each chunk to survive being read alone (the same self-containment doctrine as this repo's own METADATA_SCHEMA).
**Sections:** (1) Intuition: a chunk must answer for itself — the single-vector bottleneck (fnd-03) means one blurry summary per chunk; boundaries are editorial decisions. (2) The size trade-off: small = precise embedding, orphaned context; big = context-rich, blurry match; 300–800 tokens as the working band (token-exact via fnd-04, never chars/4 — cite the rag-01/fnd-04 chunker incident). (3) Strategy ladder: fixed-token (baseline) → recursive/structure-aware (headings, paragraphs — the default) → semantic (embedding-boundary detection; costs, marginal gains) → format-specific (tables must not split; code by function; slides/transcripts by turn). (4) Enrichment: prepend doc/section context before embedding (contextual retrieval — cite Anthropic T4, with measured retrieval-failure reduction), metadata (source, date, heading path — eng-01's provenance contract), chunk-vs-context decoupling: small-to-big / parent-document retrieval. (5) Parsing reality: PDFs/HTML/tables as the actual hard part; api-04's OCR-vs-VLM decision recap; loud-failure principle.
**Must land:** chunking failures masquerade as model failures downstream; overlap is a crutch for bad boundaries (small doses only); enrich-then-embed; keep raw text (derived-data contract).
**Diagrams:** (1) *graph LR* ingestion detail: parse → structure tree → boundary decisions → enrich → embed (matches eng-01's ingestion path); (2) small table of strategy ladder trade-offs.
**Mini-project:** chunk one real corpus 3 ways (fixed/structural/structural+enrichment); measure recall@10 on 20 labeled queries per variant (uses rag-02 project's harness). Success: measured strategy delta on your data. Capstone: rag-05's chunker, chosen with evidence.
**Sources:** [T4] Anthropic, "Introducing Contextual Retrieval" · [T2] Chen et al., Dense X Retrieval (proposition granularity), arXiv:2312.06648 · [T1] LangChain text-splitters docs (as category exemplar) · [T1] Unstructured docs (parsing).
**Volatile fences:** parsing-tool landscape; enrichment tooling. Strategy ladder + size trade-off are stable.

---

## rag-05 — The RAG Pipeline End-to-End

**Meta:** evolving/mixed · diff 3 · 300 min → 6,200–7,000 words · prereqs [rag-03, rag-04] · related [rag-06, rag-07, eng-01, sec-01]. **The capstone-core chapter — the module's centerpiece; give it the fnd-05 treatment.**
**Thesis:** assembling ingestion, retrieval, and generation into one system whose quality is the *product of stage qualities* — the chapter walks the full chain and its ten canonical failure points, teaching the reader to attribute any bad answer to its owning stage.
**Sections:** (1) Intuition: RAG converts recall to transformation (fnd-09's highest-leverage move) — but only when every link holds; multiplicative quality (0.9 retrieval × 0.9 assembly × 0.9 generation ≈ 0.73 end-to-end). (2) The two-system architecture at teaching depth (eng-01 specifies; this chapter *explains*): walk both Mermaid paths component by component with the why. (3) The query path in detail: query→embedding mismatch (asymmetric retrieval — fnd-03), top-k selection, assembly (rag-01 verbatim, applied), grounded generation with citations + abstention (the eng-06 grounded-answerer template as the worked example). (4) The ten failure points tour — the chapter's signature section: for each: symptom, stage, diagnostic (extends eng-07's tables into teaching): missing-from-corpus / parse loss / bad boundaries / embedding mismatch / recall miss / precision noise / ACL over-filter / assembly burial / ungrounded generation / stale index. (5) Freshness + deletion propagation (the update path everyone forgets; deletion as compliance requirement — sec-03 forward link). (6) Security posture: retrieved content is untrusted (sec-01 forward), ACL-at-retrieval contract, provenance end-to-end.
**Must land:** attribution-before-fixing (never tune prompts to fix retrieval); citations are architecture not decoration (auditability + groundedness eval hooks); the v0→v1→v2 scaling path with measured exit criteria; hybrid+rerank as v1 defaults.
**Diagrams:** (1) *graph LR* ingestion path; (2) *sequenceDiagram* query path (teach versions of eng-01's, expanded annotations); (3) *graph TD* failure-point map onto stages.
**Mini-project (capstone core):** the full pipeline over your corpus: rag-03 store + rag-04 chunker + rag-01 assembler + eng-06 grounded template; 30-query eval measuring per-stage (retrieval recall, groundedness sample) + end-to-end; deliberately break two stages and observe symptom propagation. Success: you can attribute a bad answer to its stage in minutes. Capstone: *is* the capstone core.
**Sources:** [T2] Lewis et al., RAG, arXiv:2005.11401 · [T2] Gao et al., RAG survey, arXiv:2312.10997 · [T4] Anthropic contextual retrieval · [T2] Liu lost-in-the-middle, arXiv:2307.03172 (assembly stage) · [T1] one provider RAG/retrieval guide.
**Volatile fences:** tooling mentions only; the pipeline shape is stable.

---

## rag-06 — Advanced Retrieval

**Meta:** evolving/mixed · diff 4 · 240 min → 5,000–6,200 words · prereqs [rag-05] · related [rag-07, rag-08, eng-01]
**Thesis:** naive dense retrieval plateaus on precision and vocabulary mismatch; the escalation ladder — hybrid, rerank, query transforms, structure — attacks specific measured failure classes, in that order, each paying rent on the rag-07 eval before the next is added.
**Sections:** (1) Intuition: retrieval as a funnel — cheap-and-wide then expensive-and-narrow; every stage exists because the previous one's errors are measurable. (2) Hybrid search: BM25 mechanics in two paragraphs (term rarity × saturation — enough to reason, no IR course), why lexical catches what vectors miss (IDs, jargon, negation-adjacent — fnd-03's blind spots), Reciprocal Rank Fusion as the merge default (formula: 1/(k+rank), why it needs no score calibration). (3) Rerankers: cross-encoders — full attention over query+passage jointly (fnd-05 mechanism: why that beats two separate embeddings), the cost asymmetry (apply to 20–50 candidates only), the funnel arithmetic. (4) Query transforms: rewriting for conversation (eng-06's template as worked example), decomposition for multi-hop, HyDE (embed a hypothetical answer — when it helps and its hallucination-adjacent risk). (5) Structured escalations: metadata routing/filtering as retrieval (often the biggest win — date/type/ACL narrowing before similarity), multi-vector late interaction (ColBERT-class) in one honest paragraph: what it buys, what it costs, why it's niche.
**Must land:** each rung fixes a *named* failure from rag-07's metrics — adopt by diagnosis, not fashion; the eng-01 example (top-20 dump → reranked top-5: cheaper AND better) is the canonical story; hybrid is v1 default, not "advanced" in practice.
**Diagrams:** (1) *graph LR* the funnel: N candidates → hybrid fusion → rerank → top-n → assembler, with typical counts and per-stage cost annotations.
**Mini-project:** add hybrid+RRF, then a reranker, to the rag-05 capstone; measure recall@k and precision (judge-scored relevance) per rung; find one query class each rung rescues. Success: measured ladder deltas on your corpus. Capstone: rag-05 upgraded to v1.
**Sources:** [T2] Robertson & Zaragoza, BM25 (Foundations & Trends IR 2009) · [T2] Cormack et al., RRF, SIGIR 2009 · [T2] Nogueira & Cho, passage reranking, arXiv:1901.04085 · [T2] Khattab & Zaharia, ColBERT, arXiv:2004.12832 · [T2] Gao et al., HyDE, arXiv:2212.10496 · [T1] Cohere rerank docs (category exemplar).
**Volatile fences:** reranker/embedder product landscape.

---

## rag-07 — Evaluating RAG Systems

**Meta:** evolving/mixed · diff 4 · 240 min → 5,000–6,200 words · prereqs [rag-05, evl-01] · related [rag-06, evl-03, eng-03]
**Thesis:** RAG quality is only debuggable when measured *per stage* — retrieval metrics against labeled relevance, generation metrics against retrieved context — because end-to-end scores can't tell you which stage to fix (the attribution problem rag-05 posed, now solved with instruments).
**Sections:** (1) Intuition: the triad — question ↔ retrieved context ↔ answer — with a distinct failure edge on each side; end-to-end evals collapse the triangle. (2) Retrieval metrics: recall@k (the workhorse), MRR, nDCG in one honest paragraph (when ranking position matters), and golden-set construction: real queries + labeled relevant chunks; synthetic query generation from chunks (with its inversion bias — synthetic queries are easier than real ones; say why: generated *from* the answer). (3) Generation metrics given context: faithfulness/groundedness (every claim supported by supplied context — judge-scored with quote-anchored rubric, eng-06's judge template applied), answer relevance, citation accuracy (resolvable + supporting). (4) Abstention metrics: out-of-corpus question set; missed-abstention (hallucinated answer) vs false-abstention ("not found" when it's there) — the fnd-09 doctrine instrumented. (5) The attribution workflow: symptom → which metric moved → which stage owns it (unifies with eng-07's playbook rows); component evals as the bisection tool. (6) Tooling honestly: RAGAS-class frameworks as scaffolding with judge-bias caveats (evl-03 forward) — validate their judges against your humans before trusting.
**Must land:** never eval end-to-end only; synthetic golden sets need human verification sampling; groundedness ≠ correctness (faithful to wrong context is a retrieval bug); the SLO floor numbers in eng-01 come from these metrics.
**Diagrams:** (1) *graph TD* the triad with labeled failure edges; (2) *graph TD* attribution decision tree: bad answer → check retrieval recall first → …
**Mini-project:** full eval suite for the rag-05 capstone: 40-query golden set (30 answerable + 10 out-of-corpus), retrieval recall + groundedness judge + citation checks; then re-run rag-06's ladder against it. Success: per-stage dashboards; one attribution exercise done blind. Capstone: the rag section of the eng-03 harness, permanent.
**Sources:** [T2] Es et al., RAGAS, arXiv:2309.15217 · [T2] Saad-Falcon et al., ARES, arXiv:2311.09476 · [T2] Zheng et al., LLM-as-judge, arXiv:2306.05685 (bias caveats) · [T2] Gao RAG survey arXiv:2312.10997 · [T1] provider eval guide (reuse evl-01's).
**Volatile fences:** tooling frameworks; metrics are stable.

---

## rag-08 — RAG Frontiers

**Meta:** experimental/volatile · diff 4 · 180 min → 4,000–4,600 words, hedged tone per experimental status · prereqs [rag-06] · related [rag-05, agt-04, fnd-05]
**Thesis:** three frontier bets — graph-structured retrieval, agentic retrieval, and long-context-instead-of-retrieval — each solve a *named* weakness of the rag-05/06 pipeline; the chapter is a decision framework for when each is warranted, not an endorsement.
**Sections:** (1) Intuition: classic RAG assumes answers live in a few passages; the frontiers attack the queries that don't (global synthesis, multi-hop, whole-corpus). (2) GraphRAG: entity/relation extraction → community summaries → global-question answering (cite Microsoft T2); what it buys (corpus-wide "themes" questions), what it costs (heavy indexing, staleness amplification, LLM-extraction errors compound into the graph). (3) Agentic retrieval: retrieval as a tool in a loop (agt-01 forward) — iterative query refinement, self-assessment (Self-RAG-class); buys multi-hop and recovery, costs latency×steps and the agent reliability tax (agt-09). (4) Long-context-instead: re-run rag-01's stuffing-vs-retrieval arithmetic with caching (api-05) at current window sizes; the honest frontier: small stable corpora genuinely fit now; freshness/ACL/selectivity still force retrieval; RULER-style usable-length caveats (rag-01's citation reused). (5) The decision framework: query-class taxonomy (needle / multi-hop / global-synthesis / fresh) × corpus properties → which architecture; default remains rag-05 v1 until a named query class fails its eval.
**Must land:** experimental status is honest — say "this section expects revision"; every frontier adoption needs the failing-query-class evidence first; hybrid architectures (frontier for one route, classic for the rest) beat wholesale migration.
**Diagrams:** (1) *graph TD* decision framework: query class × corpus properties → architecture.
**Mini-project:** identify your capstone's worst query class from rag-07's eval; prototype ONE frontier approach against it; measure vs the v1 baseline. Success: an adopt/reject decision with evidence. Capstone: optional v2 route.
**Sources:** [T2] Edge et al., GraphRAG, arXiv:2404.16130 · [T2] Asai et al., Self-RAG, arXiv:2310.11511 · [T2] Hsieh et al., RULER, arXiv:2404.06654 · [T4] Anthropic contextual retrieval (as the incremental alternative).
**Volatile fences:** the whole chapter is fenced by experimental status; the decision framework is the durable layer.
