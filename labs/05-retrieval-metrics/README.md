---
id: retrieval-metrics
title: Retrieval metrics from scratch
chapter: rag-07
anchor: retrieval-metrics
functions: [hit_at_k, recall_at_k, precision_at_k, reciprocal_rank, mean_reciprocal_rank, hit_rate, ndcg_at_k]
difficulty: 2
minutes: 30
basis:
  - "the fraction of queries for which at least one relevant passage appears in the top k"
  - "the fraction of all relevant passages retrieved"
  - "the fraction of retrieved passages that are relevant"
  - "MRR (mean reciprocal rank) averages"
  - "nDCG additionally weights graded relevance by position"
  - "tell you immediately whether a reranker is helping or reordering noise"
---
## Goal

Implement the chapter's retrieval metrics against labelled data, then use them the way the chapter does: to tell whether reordering a candidate set (a reranker) actually helped.

`retrieved` is a ranked list of passage ids, best first. `relevant` is a set of the ids labelled relevant for the query. Ranks are 1-based.

## What to implement

Per query:

- `hit_at_k(retrieved, relevant, k)` — `1.0` if any relevant passage is in the top `k`, else `0.0`.
- `recall_at_k(retrieved, relevant, k)` — the share of all relevant passages that appear in the top `k`. Raise `ValueError` if `relevant` is empty (recall is undefined).
- `precision_at_k(retrieved, relevant, k)` — the share of the top `k` that is relevant (divide by `k`).
- `reciprocal_rank(retrieved, relevant)` — `1 / rank` of the first relevant passage, or `0.0` if none was retrieved.

Across queries — `runs` is a list of `(retrieved, relevant)` pairs:

- `mean_reciprocal_rank(runs)` — the mean of the per-query reciprocal ranks.
- `hit_rate(runs, k)` — the chapter's first formulation of recall@k: the fraction of queries with at least one relevant passage in the top `k`.

Graded relevance — `grades` maps passage id → grade (missing ids are grade 0):

- `ndcg_at_k(retrieved, grades, k)` — DCG@k divided by the ideal DCG@k. The chapter does not fix a formula, so this lab uses one common form: **DCG@k = Σ grade_i / log₂(i + 1)** over ranks i = 1…k, and the ideal DCG sorts *all* graded passages (retrieved or not) best first. Return `0.0` when the ideal DCG is 0.

<details><summary>Hint: the reranker test</summary>

A reranker reorders the same candidates. Which of these numbers can that change at k = 10 when only 10 were retrieved — and which can it change at k = 3?
</details>
