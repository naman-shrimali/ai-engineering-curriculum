---
id: tut-02
title: "Expanded Glossary"
module: tutor
prerequisites: []
related_ids: [tut-01, tut-03, tut-04]
keywords:
  - glossary
  - definitions
  - terminology
  - concepts
  - reference
  - vocabulary
summary: >-
  A RAG-ingestible superset of the canonical glossary.md — every term used
  across three or more chapters, with a two-sentence definition and See
  pointers to the chapters that develop it. The canonical source of truth
  remains glossary.md; this file must not contradict it, only extend it.
difficulty: 1
est_minutes: 15
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources: []
---

# Expanded Glossary

The canonical glossary is [`glossary.md`](../glossary.md) (CONVENTIONS §5); this file is its **expanded, retrieval-optimized superset** — it repeats the 20 canonical terms verbatim in meaning and adds the wider vocabulary the corpus uses, so a single retrieval hit answers "what does X mean." One term per H3 (anchor = lowercase-kebab), definition ≤2 sentences, `See:` lists the developing chapters. If this file and `glossary.md` ever disagree, `glossary.md` wins — fix this one.

> **Note:** terms marked **(canonical)** are mirrored from `glossary.md`; the rest are tutor-layer extensions. Volatile terms (model/tool names) are deliberately excluded — see [ACRONYMS.md](ACRONYMS.md) for abbreviations and [api-06](../modules/02-llm-apis/api-06-model-selection.md) for the model landscape.

### activation
An intermediate value computed inside a network during the forward pass, cached during training so backpropagation can compute gradients. A dominant cost of training and of long-context inference. **(canonical)** *See: fnd-02, fnd-05, prd-02.*

### agent
An LLM system that runs a plan–act–observe loop — the model proposes actions (tool calls), a runtime executes them, results feed back as context — repeating until a task is done. The model plans; the runtime enforces every guarantee. *See: agt-01, eng-02.*

### attention
The transformer operation where each position computes a query, matches it against every position's key, and blends their values by relevance — a differentiable soft dictionary lookup that moves information between positions. *See: fnd-05.*

### backpropagation
The algorithm that computes the gradient of the loss with respect to every parameter in one reverse pass over the computation graph, via the chain rule. Makes gradient descent affordable at billions of parameters. **(canonical)** *See: fnd-02, fnd-05, ftn-02.*

### base model
The direct output of pretraining: a text-distribution engine that continues prompts as its corpus would, with no instruction-following or safety contract. Post-training turns it into an assistant. **(canonical)** *See: fnd-06, fnd-07, ftn-01.*

### chain-of-thought
Eliciting intermediate reasoning tokens before an answer, which raises accuracy on multi-step problems because each generated token is additional computation. Reasoning-trained models allocate this internally. *See: api-02, agt-03, fnd-07.*

### chunking
Splitting documents into retrieval units small enough to embed precisely yet self-contained enough to answer alone — the ingestion decision that sets a RAG system's quality ceiling. *See: rag-04, eng-01; tutor/rag/chunking.md.*

### context engineering
Managing the context window as a scarce resource — budgeting token allocations by region, placing content by attention behavior, curating for signal, and compacting growing state. *See: rag-01, agt-04.*

### context window
The bounded token span a model attends over in one forward pass — the model's entire working memory, read by uneven attention (edges strong, middle weak). *See: rag-01, fnd-05.*

### cross-entropy
A loss equal to the negative log-probability the model assigned to the correct token; minimizing it is maximum-likelihood training and is the exact pretraining objective of every LLM. **(canonical)** *See: fnd-02, fnd-06, fnd-08.*

### decode
The generation phase where tokens are produced one at a time against the KV cache; memory-bandwidth-bound, so it sets the steady tokens-per-second rate and the higher price of output tokens. *See: fnd-05, prd-02.*

### distillation
Training a smaller student model to reproduce a larger teacher's behavior — in practice, fine-tuning a student on teacher-generated (and verified) data. The top structural cost lever for stable high-volume tasks. *See: ftn-06, prd-03.*

### DPO
Direct Preference Optimization: tunes a model on preference pairs with a simple classification-style loss and a KL anchor to a reference model — capturing much of RLHF's benefit without a reward model or RL loop. *See: fnd-07, ftn-05.*

### embedding
A learned dense vector positioned so that geometric closeness approximates semantic relatedness — the foundation of vector search and of an LLM's own input layer. **(canonical)** *See: fnd-03, rag-02, rag-05.*

### eval
A curated set of inputs with expected behaviors plus a scoring method, used to measure an LLM system's quality statistically. The LLM-era test suite and the primary durable asset of an AI product. **(canonical)** *See: evl-01, evl-02, rag-07.*

### few-shot
Providing example input→output pairs in the prompt so the model generalizes the pattern to new instances — in-context learning used as a programming interface. *See: api-02, fnd-06.*

### fine-tuning
Continuing training on a pretrained model to change behavior/format/style — the last customization lever to reach for (after prompting and retrieval), and never the right tool for injecting knowledge. *See: ftn-01, ftn-02.*

### foundation model
A large model pretrained on broad data at scale and adaptable to many tasks via prompting or fine-tuning, rather than trained per task. **(canonical)** *See: fnd-01, fnd-06, api-06.*

### GQA
Grouped-query attention: query heads share key/value heads in groups, shrinking the KV cache 4–8× at negligible quality cost — an inference-economics optimization now near-universal. *See: fnd-05, prd-02.*

### gradient descent
The optimization that trains essentially all neural networks: repeatedly compute the loss's gradient on a minibatch and step every parameter a learning-rate-sized amount downhill. **(canonical)** *See: fnd-02, fnd-06, ftn-02.*

### groundedness
The property that every factual claim in a generated answer is supported by the supplied context — the core faithfulness metric for RAG, distinct from correctness. *See: rag-07, evl-03, eng-01.*

### guardrails
Input/output filtering layers (structural constraints, classifiers, policy models) that reduce rates of bad behavior — a complement to, never a substitute for, structural defenses like least privilege. *See: sec-02, eng-09.*

### hallucination
Fluent, confident, false output — a structural consequence of distribution-matching training, sparse-fact learnability limits, and guess-rewarding evaluation; mitigated by grounding and verification, not patched. **(canonical)** *See: fnd-06, fnd-09, rag-05.*

### hybrid search
Combining lexical (BM25-style) and vector retrieval, merged by rank fusion — lexical catches exact terms/IDs that embeddings miss; the practical v1 default for production retrieval. *See: rag-06.*

### in-context learning
A model's ability to perform a task from examples or instructions in the prompt alone, with no weight updates — the capability that made prompting a viable programming model. *See: fnd-06, api-02.*

### inference
Running a trained model's forward pass to produce outputs; latency-bound, parameter-memory-dominated, and the cost center of production LLM systems. **(canonical)** *See: fnd-02, api-07, prd-02.*

### jagged frontier
The observation that LLM capability tracks training-distribution density, not human difficulty — deep competence sits adjacent to surprising incompetence, and failure is unmarked. *See: fnd-09.*

### KV cache
Stored key and value vectors for every processed token, reused across generation steps because causal masking makes them immutable; the dominant memory consumer of long-context inference and the basis of prompt caching. **(canonical)** *See: fnd-05, api-05, prd-02.*

### logit
A raw, unnormalized score the model outputs per vocabulary token before softmax converts scores to probabilities; sampling controls operate on logits. **(canonical)** *See: fnd-02, fnd-08, api-03.*

### LoRA
Low-Rank Adaptation: fine-tunes a frozen model by learning small low-rank weight updates, collapsing the memory footprint enough to adapt large models on modest hardware — the practitioner default. *See: ftn-02.*

### loss function
A differentiable function scoring how wrong a model's outputs are against targets; the objective the optimizer minimizes and therefore the system's true specification. **(canonical)** *See: fnd-02, fnd-06, ftn-05.*

### MCP
Model Context Protocol: a standard for how agents discover and call tools/resources across vendors, turning bespoke N×M integrations into a reusable N+M ecosystem — and a supply-chain surface. *See: agt-05, eng-09.*

### MoE
Mixture-of-experts: a router activates a few expert MLP sub-networks per token, so parameter count grows without proportional per-token compute — which is why MoE parameter counts aren't comparable to dense ones. *See: fnd-05.*

### overfitting
Reducing training loss by memorizing training-set specifics rather than learning generalizable structure, visible as validation loss rising while training loss falls; its LLM-era forms include benchmark contamination and eval-set overfitting. **(canonical)** *See: fnd-02, fnd-09, evl-02.*

### parameter
One of the learned numeric weights defining a trained model's behavior; "7B model" counts them, and count drives memory, cost, and (loosely) capability. **(canonical)** *See: fnd-02, fnd-05, api-06.*

### prefill
The generation phase that processes the whole prompt in parallel to populate the KV cache; compute-bound and quadratic in prompt length, so it sets time-to-first-token. *See: fnd-05, prd-02, api-05.*

### pretraining
Self-supervised training on next-token prediction over a curated multi-trillion-token corpus — the stage where essentially all raw capability originates. **(canonical)** *See: fnd-02, fnd-06, fnd-07.*

### prompt caching
Reusing the KV state of a byte-identical prompt prefix to skip prefill, cutting input cost and time-to-first-token at zero quality risk — which is why stable-prefix prompt ordering pays. *See: api-05, fnd-05.*

### prompt injection
An attack where untrusted content (user input, retrieved docs, tool results) carries instructions the model follows — unsolvable at the prompt layer because instructions and data share one channel, so defended by privileges and isolation. *See: sec-01, eng-09.*

### quantization
Storing weights (and optionally the KV cache) at lower precision — 8-bit near-lossless, 4-bit gracefully degrading — to cut memory and bandwidth; the enabler of running serious models on modest hardware. *See: api-07, prd-03.*

### RAG
Retrieval-augmented generation: grounding a model's output in retrieved private/fresh context, converting an unreliable recall task into a reliable transformation task. *See: rag-05, eng-01.*

### reranking
A precision stage that re-scores retrieved candidates with a cross-encoder (full attention over query+passage jointly), applied to a shortlist because it is too costly for the whole corpus. *See: rag-06.*

### RLHF
Reinforcement learning from human feedback: train a reward model on human preference pairs, then optimize the assistant against it under a KL penalty that prevents drift from the reference model. **(canonical)** *See: fnd-02, fnd-07, ftn-05.*

### softmax
The function converting a vector of logits into a probability distribution by exponentiating and normalizing; every LLM's output layer ends in a softmax over the vocabulary. **(canonical)** *See: fnd-02, fnd-05, fnd-08.*

### speculative decoding
An inference speedup where a small draft model proposes several tokens that the target model verifies in one parallel pass, preserving exact output — attacking the one-token-per-step floor. *See: prd-03.*

### structured outputs
Constraining generation to a schema (via constrained decoding) so downstream code can assume valid syntax — guarantees shape, never semantics, so a validator still runs at the boundary. *See: api-03, eng-05.*

### temperature
A sampling parameter that divides logits before softmax, sharpening (<1) or flattening (>1) the next-token distribution without reordering it — a variance dial, not a creativity or truthfulness dial. **(canonical)** *See: fnd-08, api-01.*

### token
The subword unit a model actually reads and writes, produced by a tokenizer; the billing, context-length, and latency unit of the entire field (~1.3 tokens/English word). **(canonical)** *See: fnd-04, api-01, rag-01.*

### tool calling
The mechanism by which a model emits a typed request for your runtime to execute a function, returning the result as context — the single round trip that agents iterate. *See: api-03, agt-02, eng-02.*

## Related chapters

| Chapter | What it explains |
|---|---|
| [glossary.md](../glossary.md) | The canonical glossary this file supersets (source of truth) |
| [tut-03 ACRONYMS](ACRONYMS.md) | Abbreviation expansions (TTFT, PEFT, ANN, …) |
| [tut-04 knowledge-graph](knowledge-graph.md) | How these concepts relate |

## Sources

(Compiled reference — definitions synthesized from the cited chapters; no external sources.)
