---
id: temperature
title: Softmax with temperature
chapter: fnd-08
anchor: temperature-the-math-that-earns-its-place
functions: [softmax, apply_temperature]
difficulty: 1
minutes: 15
basis:
  - "Temperature is a single-line modification to the softmax you know from fnd-02"
  - "divide all logits by"
  - "greedy decoding as a limit"
  - "the ordering never changes, only the gaps"
---
## Goal

Turn a model's raw logits into a next-token distribution, then add the one-line change that is temperature — and confirm what the chapter says it does and does not do.

## What to implement

- `softmax(logits)` — `exp(x_i) / Σ exp(x_j)` as a list of probabilities. It must be **numerically stable**: subtract the largest logit before exponentiating, or `exp(1000)` overflows.
- `apply_temperature(logits, T)` — `softmax` of every logit divided by `T`. `T` must be positive: raise `ValueError` for `T <= 0` (in this lab, greedy decoding is the *limit* as T approaches 0, not a value you pass).

## Check yourself

The chapter's exercise 1 gives logits `(2.0, 1.0, 0.5, -1.0)`. Work out the distribution at T = 1, 0.5 and 2, and check that the ordering never changes. The tests use the same numbers.

<details><summary>Hint: stability</summary>

Subtracting a constant from every logit leaves softmax unchanged, because it multiplies the numerator and the denominator by the same factor.
</details>
