---
id: rag-03
title: "Vector Databases in Practice"
module: retrieval
prerequisites: [rag-02]
related_ids: [rag-05, eng-01, prd-06, fnd-03]
keywords:
  - vector database
  - pgvector
  - vector store selection
  - metadata filtering
  - hybrid search
  - reindexing
  - multi-tenancy
  - operational cost
summary: >-
  Choosing and operating the store behind vector search: why these are
  databases first and indexes second, the category map from embedded libraries
  to dedicated engines to Postgres extensions, the selection criteria that
  actually decide (filtering, hybrid, freshness, ops), and the reindexing
  reality every embedding-model change forces.
difficulty: 2
est_minutes: 180
status: evolving
volatility: volatile
last_reviewed: 2026-07-10
sources:
  - key: pgvector
    tier: 1
    title: "pgvector — open-source vector similarity search for Postgres"
    org: pgvector
    url: https://github.com/pgvector/pgvector
    accessed: 2026-07-10
  - key: qdrant-docs
    tier: 1
    title: "Qdrant documentation — filtering and collections"
    org: Qdrant
    url: https://qdrant.tech/documentation/
    accessed: 2026-07-10
  - key: opensearch-knn
    tier: 1
    title: "OpenSearch k-NN plugin documentation"
    org: OpenSearch
    url: https://docs.opensearch.org/latest/vector-search/
    accessed: 2026-07-10
  - key: chroma-docs
    tier: 1
    title: "Chroma documentation"
    org: Chroma
    url: https://docs.trychroma.com/
    accessed: 2026-07-10
  - key: malkov-hnsw
    tier: 2
    title: "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs"
    org: arXiv
    url: https://arxiv.org/abs/1603.09320
    accessed: 2026-07-10
---

# Vector Databases in Practice

[rag-02](rag-02-vector-search.md) covered the algorithms; this chapter covers the *systems* that wrap them — and the reframe that decides most selections correctly: **a vector database is a database first and a vector index second.** The ANN algorithm inside is largely commoditized (nearly everyone runs HNSW[^malkov-hnsw]), so the differentiators are the boring database concerns: filtering quality, hybrid search, upsert and deletion semantics, multi-tenancy, backup, and how much operational surface you're signing up for. Teams that select on ANN benchmark numbers routinely pick wrong, because they optimized the one dimension where the options barely differ. This is a deliberately `volatile` chapter — the product landscape churns every quarter — so it teaches the category structure and the selection procedure, and fences the specific products. The most important conclusion is one the market's marketing won't tell you: for a large fraction of applications, the right vector database is **the database you already run**.

## Intuition: the index needs a database around it

You could build retrieval on a raw ANN library — Faiss in a process, vectors in memory. Many prototypes do, and for a read-only corpus it works. Then production arrives and asks the questions a library doesn't answer:

- A document changed. How do I update its vectors *and* make the change visible without rebuilding everything?
- This user may only see 40 of these 4 million chunks. How do I enforce that inside the search?
- The process restarted. Where did the index go?
- Two services need to query it. Who owns the memory?
- Legal says delete this customer's data. Everywhere. Prove it.

**Every one of those is a database question, not a search question.** A vector database is precisely an ANN index plus durability, CRUD, filtering, concurrency, replication, and access control. Which is why the selection criteria below are dominated by database properties, and why the sharpest question to ask about any candidate is not "how fast is your ANN?" but "what happens when I need to delete a tenant?"

## The category map

Four categories, distinguished by where they sit relative to infrastructure you already have. (Products named as *exemplars of a category*, not recommendations — see the volatility note.)

| Category | Examples | Fits when | Costs |
|---|---|---|---|
| **Embedded / in-process** | Chroma, LanceDB, Faiss-as-library, sqlite-vec | Prototypes, single-node apps, local tools, notebooks | No server to run; but no concurrency story, no replication, scaling means rewriting |
| **Extension to an incumbent DB** | pgvector (Postgres), OpenSearch/Elasticsearch k-NN, Redis vector, MongoDB Atlas Vector Search | You already run the parent database and are under ~few-million vectors | Zero new systems; transactional consistency with your relational data; ANN features may lag dedicated engines |
| **Dedicated engine (self-hosted)** | Qdrant, Weaviate, Milvus, Vespa | Large corpora, demanding filtering, you have platform capacity | Best-in-class vector features; a new stateful system to run, back up, and upgrade |
| **Managed / serverless** | Pinecone, and managed tiers of the above | You want none of the ops and can accept the bill and the vendor coupling | Fastest to production; per-vector pricing, data residency questions, another provider dependency |

The structural insight: moving down that table buys vector-specific capability and pays in operational surface. Moving up buys simplicity and pays in ceilings. Since [rag-02](rag-02-vector-search.md) established that most corpora sit far below where ANN sophistication matters, **most teams should start higher in the table than instinct suggests** and escalate on a measured constraint.

> **Volatile:** the products in each row, their feature sets, pricing, and relative standing all change quarterly. The *categories* and the criteria below are the durable content. Verify current capabilities against vendor documentation at decision time,[^pgvector][^qdrant-docs][^opensearch-knn][^chroma-docs] and decide with a bake-off on your own data ([api-06](../02-llm-apis/api-06-model-selection.md)'s procedure applies to stores exactly as it does to models).

## Selection criteria, in decision order

Run these in order; the early ones eliminate candidates cheaply.

1. **Scale (and therefore whether this matters at all).** Compute your vector count and memory from [rag-02](rag-02-vector-search.md)'s napkin math. Under ~1M vectors, nearly every option works and you should choose on operational simplicity alone. Past tens of millions, the field narrows sharply and sharding/replication become the deciding features.
2. **Filtering quality.** The hidden hard problem from rag-02, and the criterion most likely to bite you. Ask specifically: does the store pre-filter or filter during traversal (not post-filter)? Does it support the predicate shapes you need (ranges, sets, booleans, nested)? Does it offer partitions/namespaces for high-selectivity fields like tenant? **Test filtered recall on your own selective filters** — vendor benchmarks are unfiltered.
3. **Hybrid search support.** Whether the store can combine lexical (BM25-style) with vector scoring natively, or whether you must run two systems and fuse results yourself ([rag-06](rag-06-advanced-retrieval.md) shows why you'll want this — it's a v1 default, not an advanced extra). Search-engine lineages (OpenSearch/Vespa) are strong here almost by definition.
4. **Freshness and write semantics.** How long from upsert to queryable? Are updates atomic per document? How are deletes handled — immediate, tombstoned, or requiring compaction (rag-02's HNSW delete debt, now an operational property you're inheriting)? For corpora that change hourly this dominates.
5. **Multi-tenancy and access control.** Namespaces/collections per tenant, and whether filters are enforceable as security boundaries rather than application-level conventions ([eng-09](../../engineering/eng-09-security-guidelines.md) requires ACL enforcement *inside* the query).
6. **Operational model.** Backup and restore, replication, upgrade path, observability, and — the one teams forget — **who carries the pager**. A dedicated engine is a stateful distributed system; budget accordingly ([api-07](../02-llm-apis/api-07-local-inference.md)'s "ops product" argument, applied to storage).
7. **Cost shape.** Per-vector/per-namespace managed pricing versus instance cost versus "free, it's already in Postgres." Model it at your projected scale, not today's.

Ecosystem fit (client libraries, framework integrations) is a real tiebreaker but never a top-three criterion — integrations are days of work; a filtering model that can't express your access rules is a rewrite.

## The pgvector default

The argument worth making explicitly, because it contradicts the market's framing: **if you already run Postgres and are under a few million vectors, put the vectors in Postgres.**[^pgvector]

What you get for free: transactional consistency between chunks and their source records (no sync pipeline, no dual-write skew, no "the index says this document exists but the table says it was deleted"); arbitrary SQL predicates as filters, which sidesteps post-filter starvation entirely because the planner handles it; joins to your business data; your existing backup, replication, monitoring, and access-control story; and one fewer system in the architecture diagram.

What you give up: the newest ANN features and the highest scale ceilings, plus tuning that is genuinely coarser than dedicated engines offer. Both matter only past a scale most applications never reach.

The escalation triggers away from it are concrete — write them down when you choose: vector count into the tens of millions; ANN query latency exceeding budget after honest index tuning; a filtering or hybrid requirement Postgres can't express well; or write volume that makes index maintenance contend with your transactional workload. Until one of those *fires*, the added system is cost without benefit ([fnd-01](../01-foundations/fnd-01-ai-engineering-landscape.md)'s premature-depth warning, in its most expensive contemporary form).

## Operational realities

The parts of running a vector store that don't appear in any feature comparison:

- **Reindexing is a scheduled certainty, not an incident.** Every embedding-model change ([fnd-03](../01-foundations/fnd-03-embeddings.md)'s versioning tax) forces a full re-embed and rebuild. So does a dimension change, and often a major store upgrade. The requirement this places on your architecture: raw text and metadata are the system of record, the store is derived, and there exists a scripted, resumable, idempotent rebuild path you have *actually run* ([eng-01](../../engineering/eng-01-rag-pipeline-architecture.md)'s contract). Blue/green collections — build the new one alongside, flip an alias, delete the old — turn a migration into a deploy.
- **Version everything on the vector.** `embedding_model_version`, `chunker_version`, `source_doc_version`, `indexed_at`. Without them a mixed-model index is undetectable until quality mysteriously drops (rag-02's silent recall failure, but caused by you).
- **Backups: the vectors are not the valuable part.** Back up the source text and the pipeline config; the index can be regenerated. Backing up a 200 GB index while the 4 GB of source text is unbacked is a common and expensive inversion.
- **Monitor recall, not just uptime.** Recall drifts as the corpus grows past tuned parameters (rag-02). A periodic ground-truth job is the only thing that catches it.
- **Capacity planning is memory planning.** HNSW-family indexes are RAM-resident in most engines; the moment the working set exceeds memory, latency falls off a cliff rather than degrading gracefully. Size from rag-02's formula plus graph overhead, and alarm on headroom.

## Production engineering perspective

- **Decide with a bake-off, not a leaderboard.** Load *your* corpus into two candidates, run *your* queries (including your most selective filters), and measure recall@k, filtered recall, p99 latency, and upsert-to-visible lag. A day of work; regularly reverses the vendor-marketing ranking — the [api-06](../02-llm-apis/api-06-model-selection.md) procedure, verbatim.
- **Isolate the store behind an interface.** A thin repository layer (`upsert`, `search(query, filters, k)`, `delete`) keeps migration a days-not-quarters proposition, exactly as the gateway does for models ([api-01](../02-llm-apis/api-01-llm-api-fundamentals.md)). You *will* re-decide this at some scale boundary.
- **Enforce access control in the query.** Tenant/ACL as a filter the store applies, or as a namespace boundary — never as a post-hoc filter in application code, and never as a prompt instruction (eng-09).
- **Plan the freshness pipeline as a data pipeline**, with change detection, deletion propagation, and retry semantics ([eng-01](../../engineering/eng-01-rag-pipeline-architecture.md)'s ingestion path). Most "the bot gave stale information" incidents are pipeline failures, not model failures.
- **Right-size the deployment, then leave it alone.** Vector stores reward boring operation; the interesting engineering is upstream in chunking ([rag-04](rag-04-chunking.md)) and retrieval strategy ([rag-06](rag-06-advanced-retrieval.md)), which move quality far more than store choice does.

## Historical evolution

**Pre-2020:** vector search lives inside search engines (Elasticsearch/Solr add-ons) and recommender infrastructure at large companies; there is no general-purpose category. **2019–2021:** the first dedicated engines appear (Milvus, Weaviate, Vespa's vector support, Pinecone as managed), aimed mostly at recommendation and image search. **2022–2023:** the LLM boom makes RAG the dominant use case and vector databases briefly become the most-funded category in infrastructure; "you need a vector database" becomes conventional wisdom. **2023–2024:** the incumbents respond — pgvector matures rapidly, OpenSearch/Redis/Mongo ship vector support — and the "specialized store vs. existing database" debate resolves in practice toward *use what you have until it hurts*. **2024–present:** consolidation and feature convergence; filtering quality, hybrid search, and cost become the real differentiators while ANN performance flattens across the field. The through-line worth carrying: **a capability that starts as a specialized product usually ends as a feature of the databases you already run** — which is exactly the prior to hold when the next specialized-store category appears.

## Common misconceptions

- **"RAG requires a vector database."** RAG requires *retrieval*. Below ~1M vectors that can be a Postgres extension, an embedded library, or even exact search in memory (rag-02). The database is an implementation detail chosen on scale and ops, not a prerequisite.
- **"Pick the store with the best ANN benchmarks."** ANN performance is the most commoditized dimension — nearly everyone runs HNSW-family indexes with similar recall/latency frontiers. Filtering, hybrid, freshness, and ops differentiate; benchmarks measure the thing that doesn't.
- **"Managed means no operations."** It removes patching and replication; it leaves you reindexing, freshness pipelines, cost management, capacity, and data governance. The ops that dominate a RAG system are mostly *yours* either way.
- **"The vector store is the source of truth."** It's derived data. Raw text plus pipeline config regenerates it; treating it as authoritative is how teams end up unable to change embedding models.
- **"Metadata filtering is a checkbox feature."** It's the criterion most likely to break your product (post-filter starvation, rag-02), and implementations differ enormously in whether they filter during traversal or after it.
- **"We'll migrate stores later if needed."** True only if you isolated it behind an interface and kept source text. Otherwise "later" means re-embedding everything under deadline pressure.

## Failure modes and trade-offs

- **Dual-write skew** — the store and the source database disagree after a partial failure; deleted documents remain searchable. *Fix:* single-writer ingestion pipeline with idempotent upserts keyed on document ID, plus a periodic reconciliation job. *Trade-off:* pgvector avoids this class entirely via transactions — a real argument in its favor.
- **The unrunnable reindex** — an embedding upgrade is needed but nobody has ever rebuilt the index and the script doesn't exist. *Fix:* rehearse the rebuild quarterly; blue/green collections. *Trade-off:* double storage during migration.
- **Memory cliff** — working set exceeds RAM and p99 latency collapses. *Fix:* capacity alarms on headroom, quantization, or sharding. *Trade-off:* quantization costs recall (rag-02).
- **Filter-shaped rewrite** — a store chosen on speed can't express the tenant isolation the product now needs. *Fix:* criterion 2 before criterion 1. *Trade-off:* none — this is just ordering the evaluation correctly.
- **Store sprawl** — separate vector infrastructure for three features that could share one collection with a metadata field. *Fix:* namespaces over new deployments.
- **The complexity tax, generally:** every capability in the dedicated-engine column is also a component that fails, upgrades, and needs a pager. It should be paid for by a measured need, not by a category assumption.

## Best practices

- **Start with what you already run.** Postgres + pgvector, or your existing search cluster, unless a stated constraint rules it out. Write the escalation triggers down when you decide.
- **Bake off on your own corpus and your own filters** before committing — recall@k, *filtered* recall, p99 latency, upsert-to-visible lag — and record the decision with re-evaluation triggers (api-06).
- **Keep raw text as the system of record** and maintain a scripted, resumable, *rehearsed* reindex path; use blue/green collections for migrations.
- **Stamp every vector** with embedding-model version, chunker version, and source version.
- **Enforce ACLs as query-time filters or namespace boundaries**, never post-hoc; partition on high-selectivity fields.
- **Isolate the store behind a small repository interface** so migration stays cheap.
- **Alarm on memory headroom and periodically re-measure recall** against a ground-truth query set.
- **Re-verify the landscape at review cadence** — this chapter is volatile by design; the products will have moved (CONVENTIONS §6).

## Real-world examples

**The sync pipeline that wasn't needed.** A team runs Postgres for application data and adds a dedicated vector engine for search, with a CDC pipeline keeping them aligned. Six months in, the recurring incident is always the same shape: a document is deleted or edited, the pipeline hiccups, and search returns content that no longer exists — occasionally to the wrong customer. The rebuild moves vectors into `pgvector` in the same database: the chunk row and the source row now update in one transaction, deletion is a foreign-key cascade, and the entire class of skew incidents disappears along with the pipeline. Corpus size at the time: 900k vectors — comfortably inside pgvector's range, and never near the ceiling that justified the split.

**The bake-off that reversed the shortlist.** A team evaluating three stores ranks them by published ANN benchmarks and prepares to adopt the fastest. The day-long bake-off on their own data changes the answer: unfiltered recall and latency are within noise across all three (as rag-02 predicts — commoditized algorithms), but their dominant query pattern filters by `customer_id`, which matches ~0.02% of the corpus. Two candidates post-filter and return empty result sets for small customers; the third filters during traversal and returns correct results at slightly higher latency. They pick the "slower" one. The criterion that decided it was second on the list and absent from every benchmark.

**The migration nobody could run.** An embedding model is deprecated with 90 days' notice ([api-06](../02-llm-apis/api-06-model-selection.md)'s deprecation tax). The team discovers their index was built once, eighteen months ago, by an engineer who has left, from a notebook that no longer runs — and the store contains vectors whose source text was never retained in full. Re-embedding requires re-fetching from the original systems, some of which have since changed schema. The 90-day migration consumes a quarter. Every step of the pain traces to two skipped disciplines: raw text as the system of record, and a rehearsed rebuild path.

## Interview questions

1. **"How would you choose a vector store for a new product?"** — Model answer: constraint filter first — vector count and memory from the napkin math, filtering requirements (especially selective ones like tenant isolation), hybrid search need, freshness, and data-residency/compliance. That usually eliminates most of the field on documentation alone. Then default toward infrastructure we already run — pgvector if we have Postgres and are under a few million vectors — and only escalate to a dedicated engine on a specific measured trigger. Decide with a bake-off on our own corpus measuring recall, *filtered* recall, p99, and upsert lag; record it with re-evaluation triggers. Notably, I wouldn't weight ANN benchmarks heavily: that dimension is commoditized.

2. **"Make the case for and against putting vectors in Postgres."** — Model answer: For — transactional consistency with source data (no sync pipeline, no dual-write skew, cascade deletes), arbitrary SQL predicates as filters which avoids post-filter starvation, joins to business data, and reuse of existing backup/replication/monitoring/access control. One less stateful system. Against — ANN feature velocity and scale ceilings lag dedicated engines, tuning is coarser, and heavy index maintenance can contend with the transactional workload. The dividing line is scale and filtering sophistication: under a few million vectors it's usually the right call; into tens of millions or with demanding hybrid/filtering needs, a dedicated engine earns its operational cost.

3. **"What breaks when you change embedding models?"** — Model answer: everything in the index becomes incomparable — vectors from different models occupy unrelated coordinate systems, so a mixed index silently returns garbage rankings. The change forces a full re-embed and rebuild of every vector, which is why raw text must be the system of record and the rebuild must be a scripted, resumable, previously-rehearsed job. Operationally I'd run blue/green: build the new collection alongside, validate recall against a ground-truth set, flip an alias, then drop the old. And every vector carries an `embedding_model_version` so a partially-migrated index is detectable rather than silent.

4. **"Your search returns documents a user shouldn't see. Where's the bug?"** — Model answer: access control was applied in the wrong layer. It must be enforced *inside* the query — as a filter the store applies during retrieval, or by partitioning tenants into separate namespaces — not as a post-retrieval filter in application code and never as a prompt instruction to the model. Post-filtering also has a second failure in the same area: for selective filters it returns empty results even when matches exist. So the fix is both a security and a correctness fix: push the predicate into the store, and prefer namespace partitioning for tenant-scale selectivity.

5. **"When does a dedicated vector database actually earn its complexity?"** — Model answer: when a measured constraint fires. Vector counts into the tens of millions where an extension's ceilings bind; filtering or hybrid requirements the incumbent can't express well; latency budgets unmet after honest tuning; or write/query volume that would contend with a transactional database. Absent one of those, it's a new stateful distributed system — backup, upgrades, replication, a pager — bought on a category assumption rather than a need. I'd also weigh what it *doesn't* remove: reindexing, freshness pipelines, and governance stay yours regardless.

6. **"What do you monitor on a vector store?"** — Model answer: the usual database signals (latency percentiles, error rate, replication lag, disk) plus three vector-specific ones. Memory headroom, because HNSW-family indexes are RAM-resident and blow past a cliff rather than degrading. Recall against a periodically re-run ground-truth query set, because recall drifts as the corpus grows past tuned parameters and nothing else surfaces that. And upsert-to-queryable lag, because "the answer was stale" is usually a freshness-pipeline failure misattributed to the model. I'd also alarm on the distribution of `embedding_model_version` across the index to catch partial migrations.

## Exercises and mini-project

**Exercises**

1. For a corpus of 800k chunks at 768 dims with tenant-scoped queries (largest tenant 3% of corpus, smallest 0.01%): which category from the map would you choose, and which two criteria decided it?
2. Write the escalation triggers you'd record when choosing pgvector — four concrete, measurable conditions that would move you to a dedicated engine.
3. Design the blue/green reindex procedure for an embedding-model migration: steps, validation gate, rollback, and what makes it resumable.
4. Your store post-filters. List the two failures this creates (one correctness, one security-adjacent) and the architectural fix for each.
5. List the fields you'd stamp on every vector, and for each, name the failure it makes detectable.

**Mini-project: the store bake-off.** Load the corpus from your [rag-02](rag-02-vector-search.md) project into two stores — one incumbent-extension option (pgvector or your existing search cluster) and one embedded or dedicated option: (a) measure unfiltered recall@10 and p99 latency using your rag-02 ground truth; (b) add a metadata field with a deliberately selective value (~0.1% of rows) and measure *filtered* recall and result counts on both; (c) measure upsert-to-queryable lag and deletion behavior; (d) time a full rebuild of each; (e) write the api-06-style decision log: criteria weights, measurements, the pick, the runner-up, and the escalation triggers. Target: 4 hours. Success criterion: a decision you can defend with numbers — including, quite possibly, "the boring option won."

**Capstone extension:** the chosen store and its repository interface become your capstone's retrieval backend, which [rag-05](rag-05-rag-pipeline.md) assembles into the full pipeline and [eng-01](../../engineering/eng-01-rag-pipeline-architecture.md) specifies operationally.

## Revision summary

- A vector database is a database first, an ANN index second: durability, CRUD, filtering, concurrency, multi-tenancy, and backup are the differentiators, because the ANN layer is commoditized across the field.
- Four categories — embedded, incumbent-extension, dedicated engine, managed — trading operational surface against vector-specific capability. Most teams should start higher (simpler) than instinct and escalate on measured triggers.
- Selection order: scale → filtering quality → hybrid → freshness/write semantics → multi-tenancy/ACL → ops model → cost. Filtering is the criterion most likely to break the product and is absent from vendor benchmarks.
- The pgvector default: with Postgres already running and under a few million vectors, transactional consistency, SQL predicates, and zero new systems usually beat any dedicated engine's feature edge.
- Operations: reindexing is a certainty (raw text is the system of record; rehearse blue/green rebuilds), version-stamp every vector, back up sources not indexes, monitor memory headroom and recall drift, and isolate the store behind a repository interface so migration stays cheap.

## Flashcards

| Q | A |
|---|---|
| Why is "best ANN benchmark" a weak selection criterion? | ANN performance is commoditized (most engines run HNSW-family with similar frontiers); filtering, hybrid, freshness, and ops differentiate. |
| The four store categories? | Embedded/in-process, extension to an incumbent DB, dedicated engine, managed/serverless. |
| Selection criteria in order? | Scale → filtering → hybrid → freshness/writes → multi-tenancy/ACL → ops model → cost. |
| The pgvector argument in one line? | If you already run Postgres and are under a few million vectors, transactional consistency plus SQL filtering beats a new stateful system. |
| What forces a full reindex? | Any embedding-model or dimension change — hence raw text as system of record and a rehearsed, resumable rebuild. |
| Blue/green reindex? | Build the new collection alongside the old, validate recall, flip an alias, drop the old — migration as a deploy. |
| Where must ACL enforcement live? | Inside the query (store-applied filter or namespace boundary) — never post-hoc in app code, never as a prompt instruction. |
| What should be backed up? | Source text and pipeline config — the index is derived and rebuildable. |
| Three vector-specific monitors? | Memory headroom (RAM-resident index cliff), recall drift vs. ground truth, upsert-to-queryable lag. |
| Why version-stamp vectors? | Makes partial migrations and mixed-model indexes detectable instead of silently wrong. |

## Further reading

- **Official docs:** pgvector README[^pgvector] (read the indexing section before dismissing it); Qdrant filtering documentation[^qdrant-docs]; OpenSearch k-NN[^opensearch-knn]; Chroma[^chroma-docs] — read at least one incumbent-extension and one dedicated engine to feel the difference in framing.
- **Papers:** Malkov & Yashunin, HNSW (2016)[^malkov-hnsw] — the algorithm nearly all of these ship, worth knowing before comparing them.
- **Books:** none current enough for this layer.
- **Talks:** vendor talks age badly and are marketing-shaped; prefer docs plus your own bake-off.
- **Tutorials:** each store's quickstart, run against your own corpus — the bake-off *is* the tutorial.

## Check your understanding

1. Give the five database (not search) questions that distinguish a vector database from an ANN library.
2. Your team wants a dedicated vector engine. Name the four measured triggers that would justify it, and what you'd default to otherwise.
3. Explain why a store that post-filters can be both a correctness bug and an access-control bug.
4. Walk the blue/green reindex for an embedding-model deprecation, including the validation gate.
5. This chapter is `volatile` while [rag-02](rag-02-vector-search.md) is `evergreen`. What specifically in here would you expect to re-verify at the next review, and what would survive unchanged?

## Sources

[^pgvector]: [T1] pgvector. "Open-source vector similarity search for Postgres." https://github.com/pgvector/pgvector (accessed 2026-07-10)
[^qdrant-docs]: [T1] Qdrant. "Documentation — filtering and collections." https://qdrant.tech/documentation/ (accessed 2026-07-10)
[^opensearch-knn]: [T1] OpenSearch. "Vector search / k-NN plugin documentation." https://docs.opensearch.org/latest/vector-search/ (accessed 2026-07-10)
[^chroma-docs]: [T1] Chroma. "Documentation." https://docs.trychroma.com/ (accessed 2026-07-10)
[^malkov-hnsw]: [T2] Malkov & Yashunin (2016). "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs." arXiv:1603.09320. https://arxiv.org/abs/1603.09320 (accessed 2026-07-10)
