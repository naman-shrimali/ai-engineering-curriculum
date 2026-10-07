---
id: similarity
title: Dot product, cosine and normalization
chapter: fnd-03
anchor: the-math-that-earns-its-place
functions: [dot, norm, cosine_similarity, normalize, euclidean_distance, rank]
difficulty: 1
minutes: 15
basis:
  - "is the dot product with magnitude divided out"
  - "and Euclidean distance becomes a monotonic function of it"
  - "all three metrics produce the same ranking"
  - "normalize on write, use dot product, move on"
---
## Goal

Write the small geometry kit every retrieval system runs on, then prove to yourself the chapter's claim: once vectors are normalized, dot product, cosine similarity and Euclidean distance all rank documents the same way.

Vectors are plain Python lists of numbers. Use only the standard library (`math` is fine).

## What to implement

- `dot(a, b)` — the sum of `a[i] * b[i]`. Raise `ValueError` if the lengths differ.
- `norm(a)` — the Euclidean length ‖a‖.
- `cosine_similarity(a, b)` — `dot(a, b) / (‖a‖ ‖b‖)`. Raise `ValueError` if either vector has length zero (direction is undefined).
- `normalize(a)` — `a` scaled to length 1. Raise `ValueError` for the zero vector.
- `euclidean_distance(a, b)` — ‖a − b‖.
- `rank(query, docs, metric)` — indices of `docs`, best match first, for `metric` in `"dot"`, `"cosine"`, `"euclidean"`. Higher is better for dot and cosine; *lower* is better for distance. Break ties by the lower index.

## Check yourself

The chapter's exercise 2 uses `a = (3, 4)` and `b = (6, 8)`: compute their distance and cosine by hand before running the tests.

<details><summary>Hint: rank</summary>

`sorted(range(len(docs)), key=...)` is stable, so ties keep index order for free. For the "higher is better" metrics, sort on the negated score.
</details>
