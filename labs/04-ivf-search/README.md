---
id: ivf-search
title: IVF search and the recall you give up
chapter: rag-02
anchor: ivf-and-product-quantization-partition-then-compress
functions: [squared_distance, assign, cells_to_probe, exact_search, ivf_search, recall_at_k]
difficulty: 3
minutes: 30
basis:
  - "assign every vector to its nearest centroid's cell"
  - "If you have 1,000 cells and probe 10, you've searched 1% of the corpus."
  - "a true nearest neighbor sitting just across the border of a cell you didn't probe"
  - "the fraction of true nearest neighbors your search actually returned"
---
## Goal

Build the query side of an IVF index on top of centroids you are given, then measure — against exact search — the recall it trades away, including the chapter's signature failure: the **cell-boundary miss**.

Vectors are lists of numbers; ids are list positions. Distances are squared Euclidean distances (the square root does not change any ordering). Wherever two candidates tie, prefer the **lower index**.

## What to implement

- `squared_distance(a, b)` — Σ (a_i − b_i)².
- `assign(vectors, centroids)` — for every vector, the index of its nearest centroid: its cell.
- `cells_to_probe(query, centroids, nprobe)` — the `nprobe` cells whose centroids are nearest the query, nearest first.
- `exact_search(query, vectors, k)` — ids of the `k` nearest vectors by brute force, nearest first. This is the answer key.
- `ivf_search(query, vectors, centroids, assignments, nprobe, k)` — compare the query against the centroids only, pick `nprobe` cells, then brute-force **only the vectors in those cells**; return the `k` nearest ids, nearest first.
- `recall_at_k(approx_ids, exact_ids, k)` — |A_k ∩ T_k| / k, where A_k and T_k are the first `k` ids of each list.

<details><summary>Hint: what can a miss look like?</summary>

Put a query just inside one cell, next to a point that sits just across the border in the neighbouring cell. With `nprobe = 1` the neighbouring cell is never searched, so that point can never be returned however close it is.
</details>
