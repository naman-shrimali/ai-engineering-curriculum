---
id: truncation
title: Top-k, top-p and min-p samplers
chapter: fnd-08
anchor: truncation-top-k-top-p-and-min-p
functions: [top_k, top_p, min_p, greedy, sample]
difficulty: 2
minutes: 25
basis:
  - "Truncation cuts the tail before sampling"
  - "Keep only the k highest-probability tokens, renormalize"
  - "Keep the smallest set whose cumulative probability ≥ p, renormalize"
  - "Keep tokens with probability ≥ (min_p × top token's probability)"
  - "confident steps keep few tokens, uncertain steps keep many"
---
## Goal

Implement the three truncation rules from the chapter's table, exactly as the table states them, plus greedy decoding and the draw itself.

Each truncation function takes a probability distribution (a list that sums to 1) and returns a list of the **same length**: cut tokens get exactly `0.0`, kept tokens are **renormalized** to sum to 1. Keeping positions stable is what lets you compare the rules side by side.

## What to implement

- `top_k(probs, k)` — keep the `k` highest-probability tokens. Break ties by the lower index.
- `top_p(probs, p)` — sort by probability, highest first, and keep the smallest prefix whose cumulative probability is ≥ `p`. Allow `1e-9` of floating-point slack in that comparison.
- `min_p(probs, min_p)` — keep tokens whose probability is ≥ `min_p × max(probs)`.
- `greedy(probs)` — the index of the most probable token (lowest index on ties).
- `sample(probs, u)` — draw a token with a uniform number `u` in [0, 1): walk the tokens in index order adding up probability and return the first index where the running total exceeds `u`. Tokens with probability 0 can never be drawn.

## Check yourself

The chapter's exercise 2 gives `(0.55, 0.20, 0.10, 0.06, 0.05, 0.04)`. Which tokens survive top-k with k = 3, top-p with p = 0.8, and min-p with min_p = 0.1? Where do they disagree?

<details><summary>Hint: one helper for all three</summary>

Write `_keep(probs, indices)` that zeroes everything outside `indices` and renormalizes the rest. Each rule then only has to choose the indices.
</details>
