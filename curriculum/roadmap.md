# Curriculum Roadmap

The full path from foundations to advanced AI engineering: **9 modules, 61 chapters, ~204 hours**.

Column key — **Prereqs:** direct prerequisites only (transitive ones implied; see [dependency-graph.md](dependency-graph.md)). **Hrs:** estimated hours including exercises. **Diff:** difficulty 1 (orientation) to 5 (deep systems/ML). **Volatility:** `evergreen` = concepts that outlive tool cycles · `mixed` = stable core with volatile edges · `volatile` = expect material changes within ~6 months.

Chapter IDs are stable and never reused. Files live at `modules/<nn>-<module-slug>/<id>-<chapter-slug>.md` (exact paths in [manifest.yaml](../manifest.yaml)).

---

## Module 1 — Foundations of Modern AI (`01-foundations`)

How models actually work — the evergreen core that makes every later engineering decision legible. Depth target: strong intuition + correct vocabulary, not derivations.

| ID | Chapter | Objective | Prereqs | Hrs | Diff | Volatility |
|---|---|---|---|---|---|---|
| fnd-01 | The AI Engineering Landscape | Map the modern AI stack, the AI engineer role, and where value concentrates | — | 2 | 1 | mixed |
| fnd-02 | ML Refresher for Engineers | Rebuild working knowledge of training vs. inference, loss, gradient descent, generalization | — | 4 | 2 | evergreen |
| fnd-03 | Embeddings & Representation Learning | Explain how meaning becomes vectors and why similarity search works | fnd-02 | 3 | 2 | evergreen |
| fnd-04 | Tokenization | Understand BPE-style tokenizers and their practical consequences (cost, truncation, multilingual quirks) | fnd-02 | 2 | 2 | evergreen |
| fnd-05 | The Transformer, Layer by Layer | Trace a forward pass: attention, MLP blocks, KV pairs, positional encoding | fnd-03, fnd-04 | 6 | 4 | evergreen |
| fnd-06 | How LLMs Are Trained | Explain pretraining, data pipelines, and scaling laws well enough to reason about model behavior | fnd-05 | 4 | 3 | evergreen |
| fnd-07 | Post-Training: SFT, RLHF & Successors | Explain how base models become assistants (SFT, RLHF, DPO, RLAIF, reasoning RL) | fnd-06 | 4 | 4 | mixed |
| fnd-08 | Sampling & Decoding | Control generation via temperature, top-p, logprobs, and penalties — and know what each actually does | fnd-05 | 2 | 2 | evergreen |
| fnd-09 | Capabilities & Limits of LLMs | Build a calibrated mental model: hallucination, reasoning limits, benchmark literacy | fnd-06, fnd-08 | 3 | 2 | mixed |

**Module total: ~30h**

## Module 2 — Working with LLM APIs (`02-llm-apis`)

The daily toolkit: calling, prompting, and steering hosted and local models.

| ID | Chapter | Objective | Prereqs | Hrs | Diff | Volatility |
|---|---|---|---|---|---|---|
| api-01 | LLM API Fundamentals | Master the chat/messages paradigm: roles, system prompts, context, tokens, errors | fnd-01 | 3 | 1 | mixed |
| api-02 | Prompt Engineering | Apply durable prompting principles (specificity, examples, decomposition) and know which tricks are cargo cult | api-01, fnd-08 | 4 | 2 | mixed |
| api-03 | Structured Outputs & Tool Calling | Reliably extract typed data and invoke functions from model outputs | api-02 | 4 | 2 | mixed |
| api-04 | Multimodal Models | Work with image/audio/video inputs and outputs through APIs | api-01 | 3 | 2 | volatile |
| api-05 | Streaming, Prompt Caching & Batch APIs | Use the three big cost/latency levers every provider exposes | api-01 | 3 | 3 | volatile |
| api-06 | The Model Landscape & Selection | Choose models on capability, latency, cost, and license — with a repeatable evaluation habit | api-01, fnd-09 | 3 | 2 | volatile |
| api-07 | Local & Open-Weight Inference | Run open-weight models locally (Ollama, llama.cpp, vLLM) and know when that's the right call | api-01, fnd-05 | 4 | 3 | volatile |

**Module total: ~24h**

## Module 3 — Context Engineering & Retrieval (`03-retrieval`)

Getting the right information into the context window: the most common production LLM pattern.

| ID | Chapter | Objective | Prereqs | Hrs | Diff | Volatility |
|---|---|---|---|---|---|---|
| rag-01 | Context Windows & Context Engineering | Treat the context window as a managed resource: budgets, placement, rot, and compaction | api-02, fnd-04 | 3 | 2 | mixed |
| rag-02 | Vector Search Fundamentals | Understand embedding models, similarity metrics, and ANN indexes (HNSW, IVF) from first principles | fnd-03 | 4 | 3 | evergreen |
| rag-03 | Vector Databases in Practice | Select and operate a vector store: filtering, hybrid fields, scale and cost characteristics | rag-02 | 3 | 2 | volatile |
| rag-04 | Chunking & Document Processing | Turn messy real-world documents (PDF, HTML, tables) into retrievable chunks | rag-01 | 3 | 2 | mixed |
| rag-05 | The RAG Pipeline End-to-End | Build a complete RAG system and understand every failure point in the chain | rag-03, rag-04 | 5 | 3 | mixed |
| rag-06 | Advanced Retrieval | Improve recall and precision: hybrid search, reranking, query rewriting, HyDE, metadata routing | rag-05 | 4 | 4 | mixed |
| rag-07 | Evaluating RAG Systems | Measure retrieval and generation separately: recall, precision, faithfulness, groundedness | rag-05, evl-01 | 4 | 4 | mixed |
| rag-08 | RAG Frontiers | Judge when GraphRAG, agentic retrieval, or long-context-instead-of-RAG is actually warranted | rag-06 | 3 | 4 | volatile |

**Module total: ~29h**

## Module 4 — Agents (`04-agents`)

Systems where the model decides what to do next: the fastest-moving and highest-leverage area of AI engineering.

| ID | Chapter | Objective | Prereqs | Hrs | Diff | Volatility |
|---|---|---|---|---|---|---|
| agt-01 | Agent Fundamentals | Build the core agent loop (model → tool call → observation → repeat) from scratch, no framework | api-03 | 4 | 3 | mixed |
| agt-02 | Tool Design | Design tool interfaces that models use correctly: naming, schemas, errors, granularity | agt-01 | 3 | 3 | mixed |
| agt-03 | Reasoning & Planning | Use CoT, reasoning models, and test-time compute deliberately; know when reasoning helps vs. hurts | agt-01, fnd-07 | 4 | 4 | volatile |
| agt-04 | Agent Memory & State | Manage conversation state, long-term memory, and context compaction across sessions | agt-01, rag-01 | 3 | 3 | mixed |
| agt-05 | Model Context Protocol (MCP) | Expose and consume tools/resources via MCP; understand its architecture and security model | agt-02 | 3 | 3 | volatile |
| agt-06 | Multi-Agent Systems | Decide when multiple agents beat one, and orchestrate them (supervisor, swarm, pipeline patterns) | agt-04 | 4 | 4 | volatile |
| agt-07 | Agent Frameworks Landscape | Map LangGraph, Claude Agent SDK, OpenAI Agents SDK, et al. to use cases — and when to use none | agt-01 | 3 | 2 | volatile |
| agt-08 | Computer Use & Browser Agents | Build agents that operate GUIs and browsers; understand their reliability envelope | agt-02, api-04 | 3 | 4 | volatile |
| agt-09 | Agent Reliability & Evaluation | Make agents shippable: trajectory evals, failure taxonomies, human-in-the-loop gates | agt-01, evl-03 | 4 | 4 | mixed |

**Module total: ~31h**

## Module 5 — Evaluation & Observability (`05-evaluation`)

The discipline that separates demos from products. Deliberately placed before production: you cannot operate what you cannot measure.

| ID | Chapter | Objective | Prereqs | Hrs | Diff | Volatility |
|---|---|---|---|---|---|---|
| evl-01 | Evaluation Fundamentals | Understand why evals are the core asset of an LLM product and what "good" looks like | api-02 | 3 | 2 | evergreen |
| evl-02 | Building Eval Datasets | Construct golden sets from production data, synthetic generation, and expert labeling | evl-01 | 3 | 3 | mixed |
| evl-03 | LLM-as-Judge | Build judge prompts that correlate with human judgment; know judge biases and calibration | evl-01, api-03 | 3 | 3 | mixed |
| evl-04 | Tracing & Observability | Instrument LLM apps with traces/spans; use platforms (Langfuse, LangSmith, OTel GenAI) effectively | evl-01, api-01 | 3 | 2 | volatile |
| evl-05 | Online Evaluation & Feedback Loops | Run A/B tests, collect implicit/explicit feedback, and close the data flywheel | evl-02, evl-04 | 3 | 4 | mixed |
| evl-06 | CI for LLM Applications | Gate deploys on eval regressions; manage flakiness, cost, and prompt-change reviews | evl-02, evl-03 | 3 | 3 | mixed |

**Module total: ~18h**

## Module 6 — Production Engineering (`06-production`)

Serving, scaling, and operating LLM systems — where full-stack instincts pay off and get recalibrated.

| ID | Chapter | Objective | Prereqs | Hrs | Diff | Volatility |
|---|---|---|---|---|---|---|
| prd-01 | Architecture Patterns for LLM Apps | Design the standard shapes: gateway, router, queue-based, RAG service, agent runtime | api-05, rag-05 | 4 | 3 | mixed |
| prd-02 | Inference Internals & Serving | Understand KV cache, continuous batching, PagedAttention; operate vLLM/TGI-class servers | fnd-05, api-07 | 5 | 5 | mixed |
| prd-03 | Inference Optimization | Apply quantization, speculative decoding, and distillation to hit latency/cost targets | prd-02 | 4 | 5 | mixed |
| prd-04 | Reliability Engineering | Handle rate limits, timeouts, provider outages, and degraded modes with fallbacks and load shedding | api-05, evl-04 | 3 | 3 | mixed |
| prd-05 | Cost Engineering | Model, monitor, and reduce token spend: caching, routing, right-sizing, batch offload | api-06, prd-01 | 3 | 3 | volatile |
| prd-06 | Deployment & Infrastructure | Choose and run the compute layer: GPU classes, serverless inference, K8s, capacity planning | prd-02 | 4 | 4 | volatile |

**Module total: ~23h**

## Module 7 — Safety, Security & Responsible AI (`07-safety-security`)

Non-negotiable for production systems, and a differentiator in interviews.

| ID | Chapter | Objective | Prereqs | Hrs | Diff | Volatility |
|---|---|---|---|---|---|---|
| sec-01 | Prompt Injection & the LLM Threat Model | Internalize the OWASP LLM Top 10; reason about untrusted input in agentic systems | agt-01, rag-05 | 4 | 3 | mixed |
| sec-02 | Guardrails & Content Moderation | Layer input/output filters, policy models, and structural constraints — and know their limits | sec-01 | 3 | 3 | mixed |
| sec-03 | Privacy, Data Governance & Compliance | Handle PII, data retention, provider terms, and regulatory context (GDPR, EU AI Act) in LLM pipelines | api-01 | 3 | 2 | mixed |
| sec-04 | Red-Teaming LLM Applications | Systematically attack your own system before others do; build adversarial eval suites | sec-01, evl-02 | 3 | 4 | mixed |
| sec-05 | Alignment & Safety for Engineers | Understand alignment concepts (RLHF limits, specification gaming, misuse vs. misalignment) as they affect product decisions | fnd-07 | 3 | 3 | evergreen |

**Module total: ~16h**

## Module 8 — Fine-Tuning & Model Customization (`08-fine-tuning`)

The deepest ML content in the repo — when prompting and retrieval aren't enough.

| ID | Chapter | Objective | Prereqs | Hrs | Diff | Volatility |
|---|---|---|---|---|---|---|
| ftn-01 | The Customization Decision | Choose correctly among prompting, RAG, and fine-tuning with a cost/benefit framework | api-02, rag-05 | 2 | 3 | mixed |
| ftn-02 | Fine-Tuning Methods | Understand full fine-tuning, LoRA/QLoRA, and PEFT trade-offs at a practitioner level | fnd-05, ftn-01 | 5 | 4 | mixed |
| ftn-03 | Data for Fine-Tuning | Curate, format, and validate training data; understand why data quality dominates method choice | ftn-01, evl-02 | 3 | 4 | mixed |
| ftn-04 | Fine-Tuning in Practice | Execute fine-tunes via provider APIs and open-source stacks (Axolotl/TRL-class tooling); evaluate results | ftn-02, ftn-03 | 4 | 4 | volatile |
| ftn-05 | Preference Optimization & RL | Apply DPO/GRPO-style methods and reinforcement learning with verifiable rewards | fnd-07, ftn-02 | 4 | 5 | mixed |
| ftn-06 | Distillation & Small Language Models | Compress capability into smaller, cheaper models; run the distill-vs-buy calculation | ftn-02, api-06 | 3 | 4 | mixed |

**Module total: ~21h**

## Module 9 — Frontier & Career (`09-frontier`)

Emerging surfaces worth tracking, plus the meta-skills of the role.

| ID | Chapter | Objective | Prereqs | Hrs | Diff | Volatility |
|---|---|---|---|---|---|---|
| fro-01 | Voice & Realtime AI | Build speech-to-speech and realtime API applications; reason about latency budgets | api-04, api-05 | 3 | 3 | volatile |
| fro-02 | Generative Media for Engineers | Integrate image/video generation into products: prompting, cost, moderation, licensing | api-04 | 2 | 2 | volatile |
| fro-03 | On-Device & Edge AI | Deploy small models on-device (Core ML, ONNX, WebGPU); know the capability floor | api-07, ftn-06 | 2 | 3 | volatile |
| fro-04 | Staying Current | Build a personal system for tracking a field that changes monthly, without drowning | fnd-01 | 2 | 1 | mixed |
| fro-05 | The AI Engineer Interview & Portfolio | Prepare for AI engineering interviews: system design, evals questions, portfolio projects | agt-01, rag-05, evl-01 | 3 | 2 | mixed |

**Module total: ~12h**

---

## Sequencing notes

- **Modules 1–2 are the trunk.** Everything else branches from them.
- **evl-01 is deliberately early** in dependency terms (only needs api-02): evaluation thinking should arrive before you build your first RAG system, not after.
- **Modules 3, 4, 5 interleave well** — the dependency graph, not module order, is authoritative.
- **Module 6 (production) and Module 8 (fine-tuning) are the difficulty peaks** (several diff-5 chapters); schedule them when you can go deep.
- Volatile chapters teach *how to evaluate the category*, not just today's leader — so they stay useful after the specific tools churn.
