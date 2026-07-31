---
id: tut-01
title: "Master Index"
module: tutor
prerequisites: []
related_ids: [tut-02, tut-04]
keywords:
  - index
  - table of contents
  - navigation
  - status
  - written
  - pending
  - corpus map
summary: >-
  The master map of the repository: every chapter and engineering doc with its
  id, status, volatility, prerequisites, and written/pending state — the
  authoritative "what exists" index for readers and for the RAG tutor's
  retrieval scope.
difficulty: 1
est_minutes: 10
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources: []
---

# Master Index

The authoritative map of what the repository contains and what is still pending. **Written** = the file exists with full content and can be ingested/cited. **Pending** = a manifest-fixed ID with a generation blueprint in `blueprints/` but no content yet; links to it resolve by path but return no chunk. Regenerate this index from `manifest.yaml` + on-disk state after any batch (see `tutor/rag/chunking.md` for the ingestion contract).

**State as of 2026-07-10:** 19 chapters written · 42 chapters pending · 12 engineering docs written · 6 tutor docs. The RAG tutor should scope retrieval to **written** files only; a query about a pending topic should return the *blueprint* thesis (from `blueprints/`) with an explicit "not yet written" flag, never a hallucinated answer.

## How to read this index

Each row: **ID** · status (stable/evolving/experimental) · volatility (evergreen/mixed/volatile) — the review cadence driver · prerequisites · state. Follow prerequisites when studying; follow the [knowledge graph](knowledge-graph.md) when exploring by concept.

## Module 1 — Foundations (`fnd-*`) · all written

| ID | Title | Status | Prereqs | State |
|---|---|---|---|---|
| fnd-01 | The AI Engineering Landscape | evolving | — | written |
| fnd-02 | ML Refresher for Engineers | stable | — | written |
| fnd-03 | Embeddings & Representation Learning | stable | fnd-02 | written |
| fnd-04 | Tokenization | stable | fnd-02 | written |
| fnd-05 | The Transformer, Layer by Layer | stable | fnd-03, fnd-04 | written |
| fnd-06 | How LLMs Are Trained | stable | fnd-05 | written |
| fnd-07 | Post-Training: SFT, RLHF & Successors | evolving | fnd-06 | written |
| fnd-08 | Sampling & Decoding | stable | fnd-05 | written |
| fnd-09 | Capabilities & Limits of LLMs | evolving | fnd-06, fnd-08 | written |

## Module 2 — Working with LLM APIs (`api-*`) · all written

| ID | Title | Status | Prereqs | State |
|---|---|---|---|---|
| api-01 | LLM API Fundamentals | evolving | fnd-01 | written |
| api-02 | Prompt Engineering | evolving | api-01, fnd-08 | written |
| api-03 | Structured Outputs & Tool Calling | evolving | api-02 | written |
| api-04 | Multimodal Models | evolving | api-01 | written |
| api-05 | Streaming, Prompt Caching & Batch APIs | evolving | api-01 | written |
| api-06 | The Model Landscape & Selection | evolving | api-01, fnd-09 | written |
| api-07 | Local & Open-Weight Inference | evolving | api-01, fnd-05 | written |

## Module 3 — Context Engineering & Retrieval (`rag-*`)

| ID | Title | Status | Prereqs | State |
|---|---|---|---|---|
| rag-01 | Context Windows & Context Engineering | evolving | api-02, fnd-04 | written |
| rag-02 | Vector Search Fundamentals | stable | fnd-03 | pending |
| rag-03 | Vector Databases in Practice | evolving | rag-02 | pending |
| rag-04 | Chunking & Document Processing | evolving | rag-01 | pending |
| rag-05 | The RAG Pipeline End-to-End | evolving | rag-03, rag-04 | pending |
| rag-06 | Advanced Retrieval | evolving | rag-05 | pending |
| rag-07 | Evaluating RAG Systems | evolving | rag-05, evl-01 | pending |
| rag-08 | RAG Frontiers | experimental | rag-06 | pending |

## Module 4 — Agents (`agt-*`) · all pending

| ID | Title | Status | Prereqs | State |
|---|---|---|---|---|
| agt-01 | Agent Fundamentals | evolving | api-03 | pending (stub — see below) |
| agt-02 | Tool Design | evolving | agt-01 | pending |
| agt-03 | Reasoning & Planning | evolving | agt-01, fnd-07 | pending |
| agt-04 | Agent Memory & State | evolving | agt-01, rag-01 | pending |
| agt-05 | Model Context Protocol (MCP) | evolving | agt-02 | pending |
| agt-06 | Multi-Agent Systems | evolving | agt-04 | pending |
| agt-07 | Agent Frameworks Landscape | evolving | agt-01 | pending |
| agt-08 | Computer Use & Browser Agents | experimental | agt-02, api-04 | pending |
| agt-09 | Agent Reliability & Evaluation | evolving | agt-01, evl-03 | pending |

> **Warning:** `agt-01` has a phantom 2-line stub file on disk (see REVIEW.md P0-1). It is **not** written. Ingestion must exclude files under 200 bytes.

## Module 5 — Evaluation & Observability (`evl-*`)

| ID | Title | Status | Prereqs | State |
|---|---|---|---|---|
| evl-01 | Evaluation Fundamentals | stable | api-02 | written |
| evl-02 | Building Eval Datasets | evolving | evl-01 | pending |
| evl-03 | LLM-as-Judge | evolving | evl-01, api-03 | pending |
| evl-04 | Tracing & Observability | evolving | evl-01, api-01 | pending |
| evl-05 | Online Evaluation & Feedback Loops | evolving | evl-02, evl-04 | pending |
| evl-06 | CI for LLM Applications | evolving | evl-02, evl-03 | pending |

## Module 6 — Production Engineering (`prd-*`) · all pending

| ID | Title | Status | Prereqs | State |
|---|---|---|---|---|
| prd-01 | Architecture Patterns for LLM Apps | evolving | api-05, rag-05 | pending |
| prd-02 | Inference Internals & Serving | evolving | fnd-05, api-07 | pending |
| prd-03 | Inference Optimization | evolving | prd-02 | pending |
| prd-04 | Reliability Engineering | evolving | api-05, evl-04 | pending |
| prd-05 | Cost Engineering | evolving | api-06, prd-01 | pending |
| prd-06 | Deployment & Infrastructure | evolving | prd-02 | pending |

## Module 7 — Safety, Security & Responsible AI (`sec-*`) · all pending

| ID | Title | Status | Prereqs | State |
|---|---|---|---|---|
| sec-01 | Prompt Injection & the LLM Threat Model | evolving | agt-01, rag-05 | pending |
| sec-02 | Guardrails & Content Moderation | evolving | sec-01 | pending |
| sec-03 | Privacy, Data Governance & Compliance | evolving | api-01 | pending |
| sec-04 | Red-Teaming LLM Applications | evolving | sec-01, evl-02 | pending |
| sec-05 | Alignment & Safety for Engineers | stable | fnd-07 | pending |

## Module 8 — Fine-Tuning & Customization (`ftn-*`) · all pending

| ID | Title | Status | Prereqs | State |
|---|---|---|---|---|
| ftn-01 | The Customization Decision | evolving | api-02, rag-05 | pending |
| ftn-02 | Fine-Tuning Methods | evolving | fnd-05, ftn-01 | pending |
| ftn-03 | Data for Fine-Tuning | evolving | ftn-01, evl-02 | pending |
| ftn-04 | Fine-Tuning in Practice | evolving | ftn-02, ftn-03 | pending |
| ftn-05 | Preference Optimization & RL | evolving | fnd-07, ftn-02 | pending |
| ftn-06 | Distillation & Small Language Models | evolving | ftn-02, api-06 | pending |

## Module 9 — Frontier & Career (`fro-*`)

| ID | Title | Status | Prereqs | State |
|---|---|---|---|---|
| fro-01 | Voice & Realtime AI | experimental | api-04, api-05 | pending |
| fro-02 | Generative Media for Engineers | experimental | api-04 | pending |
| fro-03 | On-Device & Edge AI | experimental | api-07, ftn-06 | pending |
| fro-04 | Staying Current | evolving | fnd-01 | written |
| fro-05 | The AI Engineer Interview & Portfolio | evolving | agt-01, rag-05, evl-01 | pending |

## Engineering reference docs (`eng-*`) · all written

| ID | Title | Prereqs |
|---|---|---|
| eng-01 | Reference Architecture: RAG Pipeline | rag-01, api-05 |
| eng-02 | Reference Architecture: Agent & Tool-Use Loop | api-03 |
| eng-03 | Reference Architecture: Evaluation Harness | evl-01 |
| eng-04 | Reference Architecture: The LLMOps Stack | api-01, evl-01 |
| eng-05 | Production Design Patterns for LLM Applications | api-03, rag-01 |
| eng-06 | Prompt Library | api-02 |
| eng-07 | Evaluation Checklists & Debugging Playbook | evl-01 |
| eng-08 | Deployment & LLMOps Guide | api-01, api-05 |
| eng-09 | Security Guidelines for LLM Systems | api-03 |
| eng-10 | Cost-Optimization Guide | api-05, api-06 |
| eng-11 | Benchmark Comparison Templates | api-06, evl-01 |
| eng-12 | Interview-Prep Pack | fnd-01 |

## Meta & tooling

| File | Purpose |
|---|---|
| `README.md` · `CONVENTIONS.md` · `METADATA_SCHEMA.md` | Repo overview, authoring rules, frontmatter/chunking contract |
| `manifest.yaml` | Machine-readable build spec (source of truth for IDs/paths/status) |
| `curriculum/roadmap.md` · `dependency-graph.md` | Learning path and prerequisite DAG |
| `glossary.md` | Canonical glossary (§5); [tutor/GLOSSARY.md](GLOSSARY.md) is the expanded superset |
| `REVIEW.md` | Current punch list of fixes |
| `blueprints/` | Generation specs for the 42 pending chapters |
| `tutor/` | This query layer: index, glossary, acronyms, [knowledge graph](knowledge-graph.md), [RAG config](rag/chunking.md), [prompts](prompts/), [tool scaffold](tool/README.md) |

## Suggested entry points

- **New reader:** `README.md` → fnd-01 → fnd-02 → follow prerequisites.
- **Fast track to productive:** fnd-01 → api-01…03 → rag-01 → evl-01 → (eng-01, eng-05).
- **Interview prep:** eng-12 (drill index) + fnd-05/07/08 + evl-01 + eng-01/02.
- **Build the tutor:** [tutor/tool/README.md](tool/README.md).

## Related chapters

| Chapter | What it explains |
|---|---|
| [tut-02 GLOSSARY](GLOSSARY.md) | Term definitions this index's topics reference |
| [tut-04 knowledge-graph](knowledge-graph.md) | The concept-relationship view complementing this file-list view |

## Sources

(Compiled index — no external sources; derived from `manifest.yaml` and on-disk state.)
