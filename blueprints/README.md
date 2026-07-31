# Blueprints — generation specs for the 42 unwritten chapters

This directory is a **handoff artifact**: it lets any capable model generate the remaining chapters at the quality standard of the 19 already written, after the model that set that standard is gone. It exists because the authoring standard lives partly in judgment that a thin style guide can't capture — so these blueprints encode the *decisions* (thesis, section plan, must-land insights, exact sources, specified diagrams, volatile fences) that the standard-setting author would have made, chapter by chapter.

## How to use this directory

1. **Read [AUTHORING_GUIDE.md](AUTHORING_GUIDE.md) in full, once.** It is the mindset: the prime directives, the invariant chapter skeleton, size calibration, voice, the reusable motifs, volatility discipline, citation rules, the diagram policy, and the validation script. Everything in the blueprints assumes it.
2. **Pick the next chapter in manifest build order** (see the table below). Open its blueprint file.
3. **Generate the chapter** following the blueprint's plan and the guide's skeleton. Treat already-written chapters as canon to cross-reference, never to contradict or re-teach.
4. **Run the validation script** (in the guide) on the output. Fix every error before proceeding.
5. **Update `glossary.md`, `CHANGELOG.md`, and manifest statuses** as the guide's per-session process describes.
6. **Report** completed IDs + exact next IDs.

## The blueprint files

| File | Chapters | Module |
|---|---|---|
| [day3-rag.md](day3-rag.md) | rag-02 … rag-08 (7) | 3 · Retrieval |
| [day3-evl.md](day3-evl.md) | evl-02 … evl-06 (5) | 5 · Evaluation |
| [day3-agt.md](day3-agt.md) | agt-01 … agt-09 (9) | 4 · Agents |
| [day4-prd.md](day4-prd.md) | prd-01 … prd-06 (6) | 6 · Production |
| [day4-sec.md](day4-sec.md) | sec-01 … sec-05 (5) | 7 · Safety & Security |
| [day4-ftn.md](day4-ftn.md) | ftn-01 … ftn-06 (6) | 8 · Fine-Tuning |
| [day4-fro.md](day4-fro.md) | fro-01, fro-02, fro-03, fro-05 (4) | 9 · Frontier & Career |

**42 chapters total.** (fro-04 is already written.) Each blueprint entry gives: meta line (status/volatility/difficulty/minutes/word-target/prereqs/related), thesis, section plan, must-land insights, math-that-earns-its-place, specified diagrams (type + content), mini-project with capstone extension, source list (with arXiv IDs / T1 doc names), and volatile fences.

## Recommended generation order

Follow **manifest build order** — it is a topological sort of the prerequisite DAG, so every prerequisite chapter exists (as canon to cross-reference) before its dependents. The remaining order, with the two highest-leverage chapters flagged:

```
Day 3: rag-02, rag-03, rag-04, rag-05★, rag-06, rag-07, rag-08,
       evl-02, evl-03, evl-04, evl-05, evl-06,
       agt-01★, agt-02, agt-03, agt-04, agt-05, agt-06, agt-07, agt-08, agt-09
Day 4: prd-01, prd-02, prd-03, prd-04, prd-05, prd-06,
       sec-01, sec-02, sec-03, sec-04, sec-05,
       ftn-01, ftn-02, ftn-03, ftn-04, ftn-05, ftn-06,
       fro-01, fro-02, fro-03, fro-05
```

★ **rag-05** (RAG pipeline — capstone core) and **agt-01** (agent fundamentals — widest fan-out in module 4) are the load-bearing chapters; they carry the most downstream weight and deserve the fullest treatment (both are flagged for the deepest word budgets in their blueprints).

## What "same quality" means here

The 19 written chapters share measurable properties the blueprints are built to reproduce: mechanism-grounded claims (every assertion traces to a foundations chapter), eval-terminal epistemics (quality claims end in "measured on your eval"), the invariant 15-part skeleton, tiered real citations, fenced volatility, obsessive cross-linking, the running motif vocabulary, incident-shaped examples, and the accumulating capstone thread. A generated chapter that passes the validation script AND lands its blueprint's must-land insights AND reads in the established voice is at standard. When in doubt, open the nearest already-written chapter in the same module as a worked reference — they are the ground truth the blueprints point at.

## Provenance

Written 2026-07-10 as a deliberate handoff. The blueprints are opinionated on purpose: they encode specific theses and framings (not menus of options) so a generating model reproduces the curriculum's point of view, not just its format. Where a blueprint and an already-written chapter conflict, the written chapter wins — flag the conflict rather than diverging silently.
