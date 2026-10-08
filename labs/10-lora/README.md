---
id: lora
title: LoRA forward pass and parameter count
chapter: ftn-02
anchor: lora-low-rank-adaptation
functions: [matvec, lora_forward, trainable_params, full_params]
difficulty: 2
minutes: 20
basis:
  - "adds a parallel, trainable low-rank decomposition"
  - "A (r×d, trainable)"
  - "B (d×r, trainable)"
  - "Output = Wx + (α/r)·BAx"
  - "so the number of trainable parameters scales with"
---
## Goal

Implement a LoRA-adapted layer exactly as the chapter's diagram draws it — a frozen `W` plus a trainable low-rank path `BA`, scaled by α/r — and count what full fine-tuning and LoRA each train.

Matrices are lists of rows (a d × d matrix is `d` lists of `d` numbers); vectors are lists. Pure Python, no numpy.

## What to implement

- `matvec(M, x)` — the matrix–vector product `Mx`. Raise `ValueError` if the shapes do not match.
- `lora_forward(W, A, B, x, scale=1.0)` — `Wx + scale · B(Ax)` for `W` (d × d), `A` (r × d), `B` (d × r), where `scale` is the chapter's α/r. Raise `ValueError` if any shape is wrong. **Do not modify `W`** — it is frozen.
- `trainable_params(d, r, n_matrices=1)` — parameters LoRA trains for `n_matrices` adapted d × d matrices: A and B for each.
- `full_params(d, n_matrices=1)` — parameters full fine-tuning trains for the same matrices.

<details><summary>Hint: why B(Ax) and not (BA)x?</summary>

Both give the same vector, but `Ax` is only r numbers. Computing `B(Ax)` never builds the d × d product.
</details>
