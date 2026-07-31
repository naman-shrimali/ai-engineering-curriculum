---
id: tut-03
title: "Acronyms & Abbreviations"
module: tutor
prerequisites: []
related_ids: [tut-02, tut-01]
keywords:
  - acronyms
  - abbreviations
  - expansions
  - reference
  - jargon
summary: >-
  Every acronym and abbreviation used across the corpus, expanded, with a
  one-line gloss and a pointer to where it is developed — so a retrieval hit
  resolves any short form the reader encounters.
difficulty: 1
est_minutes: 10
status: stable
volatility: mixed
last_reviewed: 2026-07-10
sources: []
---

# Acronyms & Abbreviations

Short forms the corpus uses, expanded. For concept definitions see [GLOSSARY.md](GLOSSARY.md); for model/product names (deliberately volatile, not listed here) see [api-06](../modules/02-llm-apis/api-06-model-selection.md). Grouped for scanning; alphabetical within groups.

## Models, training & architecture

| Acronym | Expansion | One-line gloss | See |
|---|---|---|---|
| LLM | Large Language Model | The generative transformer this whole repo is about | fnd-01 |
| ML | Machine Learning | Software written by optimization over data | fnd-02 |
| SGD | Stochastic Gradient Descent | Minibatch gradient descent, the training engine | fnd-02 |
| MLP | Multi-Layer Perceptron | The feed-forward block; ~⅔ of a transformer's parameters | fnd-05 |
| BPE | Byte-Pair Encoding | The subword tokenization algorithm | fnd-04 |
| RoPE | Rotary Position Embedding | Relative-position encoding via query/key rotation | fnd-05 |
| GQA | Grouped-Query Attention | Shared KV heads that shrink the KV cache 4–8× | fnd-05 |
| MQA | Multi-Query Attention | One KV head for all query heads (GQA's extreme) | fnd-05 |
| MoE | Mixture-of-Experts | Router activates a few expert MLPs per token | fnd-05 |
| KV | Key-Value | The cached attention state reused across decode steps | fnd-05 |
| SFT | Supervised Fine-Tuning | Demonstration training that teaches format/behavior | fnd-07 |
| RLHF | RL from Human Feedback | Reward-model + KL-anchored RL alignment | fnd-07 |
| RLAIF | RL from AI Feedback | RLHF with an AI judge generating preferences | fnd-07 |
| DPO | Direct Preference Optimization | Offline preference tuning without a reward model | fnd-07, ftn-05 |
| GRPO | Group Relative Policy Optimization | An RL method used for verifiable-reward reasoning training | fnd-07, ftn-05 |
| PPO | Proximal Policy Optimization | The classic RL algorithm in RLHF | fnd-07 |
| CoT | Chain-of-Thought | Intermediate reasoning tokens before an answer | api-02, agt-03 |
| ICL | In-Context Learning | Task-learning from prompt examples, no weight updates | fnd-06 |

## Retrieval & data

| Acronym | Expansion | One-line gloss | See |
|---|---|---|---|
| RAG | Retrieval-Augmented Generation | Grounding generation in retrieved context | rag-05, eng-01 |
| ANN | Approximate Nearest Neighbor | Sub-linear vector search (HNSW, IVF) | rag-02 |
| HNSW | Hierarchical Navigable Small World | The dominant graph-based ANN index | rag-02 |
| IVF | Inverted File (index) | Cluster-then-probe ANN index | rag-02 |
| PQ | Product Quantization | Lossy vector compression for ANN | rag-02 |
| BM25 | Best Match 25 | The standard lexical (keyword) ranking function | rag-06 |
| RRF | Reciprocal Rank Fusion | Score-free merge of hybrid search results | rag-06 |
| OCR | Optical Character Recognition | Text extraction from images/scans | api-04, rag-04 |
| VLM | Vision-Language Model | A model that reads images + text | api-04 |

## Serving, ops & cost

| Acronym | Expansion | One-line gloss | See |
|---|---|---|---|
| API | Application Programming Interface | The HTTPS interface to a hosted model | api-01 |
| TTFT | Time To First Token | Latency until streaming starts (prefill-bound) | fnd-05, api-05 |
| TPOT | Time Per Output Token | Inter-token latency (decode, bandwidth-bound) | prd-02 |
| TPM / RPM | Tokens / Requests Per Minute | The two rate-limit denominators | api-01 |
| SSE | Server-Sent Events | The streaming transport for token deltas | api-05 |
| SLO / SLI | Service Level Objective / Indicator | Reliability targets and their measured signals | prd-04 |
| LLMOps | LLM Operations | DevOps adapted to behavior-deploys and model drift | eng-04 |
| CI | Continuous Integration | Eval-gated pipelines for behavior deploys | evl-06 |
| OTel | OpenTelemetry | The tracing standard (GenAI semantic conventions) | evl-04 |
| TCO | Total Cost of Ownership | Honest self-hosting cost incl. ops and utilization | api-07 |
| GPU / NPU | Graphics / Neural Processing Unit | The inference accelerators | prd-06, fro-03 |
| VRAM | Video RAM | GPU memory; sizes what model fits | api-07, prd-06 |

## Methods, safety & eval

| Acronym | Expansion | One-line gloss | See |
|---|---|---|---|
| PEFT | Parameter-Efficient Fine-Tuning | The family LoRA/QLoRA belong to | ftn-02 |
| LoRA | Low-Rank Adaptation | Low-rank adapter fine-tuning | ftn-02 |
| QLoRA | Quantized LoRA | LoRA over a 4-bit-quantized frozen base | ftn-02 |
| SLM | Small Language Model | A compact model, often a distillation target | ftn-06, fro-03 |
| KD | Knowledge Distillation | Training a student to match a teacher | ftn-06 |
| MCP | Model Context Protocol | Cross-vendor tool/resource protocol | agt-05 |
| PII | Personally Identifiable Information | Data governance's core sensitive class | sec-03 |
| OWASP | Open Worldwide Application Security Project | Publisher of the LLM Top 10 threat list | sec-01, eng-09 |
| FP / FN | False Positive / False Negative | The guardrail and classifier trade-off axes | sec-02, evl-01 |
| pass@k | pass at k | Fraction of tasks solved by any of k samples | evl-01 |
| nDCG / MRR | normalized DCG / Mean Reciprocal Rank | Ranking-aware retrieval metrics | rag-07 |

## Related chapters

| Chapter | What it explains |
|---|---|
| [tut-02 GLOSSARY](GLOSSARY.md) | Full definitions of the concepts abbreviated here |
| [api-06](../modules/02-llm-apis/api-06-model-selection.md) | Model/product names (the volatile layer omitted here) |

## Sources

(Compiled reference — expansions standard in the cited chapters; no external sources.)
