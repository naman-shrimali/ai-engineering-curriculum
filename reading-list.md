# Reading List

A curated queue of primary sources — mostly papers — organized by the curriculum module each one reinforces. This is the *shared, version-controlled* list; your personal, ad-hoc queue lives in [Read Later](#@readlater), which is stored in your browser and can be added to from anywhere.

Every link below has a **+** button next to it in the reader — click it to push that paper into your Read Later queue.

> **Source:** the bulk of this list is adapted from [InterviewReady's AI engineering resources](https://github.com/InterviewReady/ai-engineering-resources), an excellent topic-organized collection. What's added here is the mapping: each paper sits under the chapter whose ideas it underpins, so you can read a chapter and then go straight to its primary sources.

---

## 1 · Foundations

**Tokenization** — pairs with [fnd-04](modules/01-foundations/fnd-04-tokenization.md)

- [Byte-pair Encoding](https://arxiv.org/pdf/1508.07909) — the algorithm behind most production tokenizers
- [Byte Latent Transformer: Patches Scale Better Than Tokens](https://arxiv.org/pdf/2412.09871) — the case against tokenization entirely

**Embeddings and representation** — pairs with [fnd-03](modules/01-foundations/fnd-03-embeddings.md)

- [BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/pdf/1810.04805)
- [IMAGEBIND: One Embedding Space To Bind Them All](https://arxiv.org/pdf/2305.05665)
- [SONAR: Sentence-Level Multimodal and Language-Agnostic Representations](https://arxiv.org/pdf/2308.11466)
- [Facebook Large Concept Models](https://arxiv.org/pdf/2412.08821v2)

**Core architecture** — pairs with [fnd-05](modules/01-foundations/fnd-05-transformer-architecture.md)

- [Attention is All You Need](https://papers.neurips.cc/paper/7181-attention-is-all-you-need.pdf) — the foundational one; read it at least once
- [FlashAttention](https://arxiv.org/pdf/2205.14135) — why attention is memory-bound, and the fix
- [Multi Query Attention](https://arxiv.org/pdf/1911.02150)
- [Grouped Query Attention](https://arxiv.org/pdf/2305.13245) — the KV-cache reduction behind most modern serving stacks
- [VideoRoPE: Rotary Position Embedding](https://arxiv.org/pdf/2502.05173)
- [Google Titans outperform Transformers](https://arxiv.org/pdf/2501.00663)

**Mixture of Experts** — pairs with [fnd-06](modules/01-foundations/fnd-06-llm-pretraining.md)

- [Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/pdf/1701.06538)
- [GShard](https://arxiv.org/abs/2006.16668)
- [Switch Transformers](https://arxiv.org/abs/2101.03961)

**Post-training and RLHF** — pairs with [fnd-07](modules/01-foundations/fnd-07-post-training.md), [ftn-05](modules/08-fine-tuning/ftn-05-preference-optimization.md), [sec-05](modules/07-safety-security/sec-05-alignment-for-engineers.md)

- [Deep Reinforcement Learning with Human Feedback](https://arxiv.org/pdf/1706.03741)
- [Fine-Tuning Language Models from Human Preferences](https://arxiv.org/pdf/1909.08593)
- [Training language models to follow instructions (InstructGPT)](https://arxiv.org/pdf/2203.02155)

**Capabilities and limits** — pairs with [fnd-09](modules/01-foundations/fnd-09-capabilities-and-limits.md)

The two sides of the argument, worth reading back to back:

- [Can AI be made to think critically](https://arxiv.org/pdf/2501.04682)
- [Evolving Deeper LLM Thinking](https://arxiv.org/pdf/2501.09891)
- [LLMs Can Easily Learn to Reason from Demonstrations](https://arxiv.org/pdf/2502.07374)
- [Separating communication from intelligence](https://arxiv.org/pdf/2301.06627) — the skeptical case
- [Language is not intelligence](https://gwern.net/doc/psychology/linguistics/2024-fedorenko.pdf)

---

## 2 · LLM APIs

**Multimodal** — pairs with [api-04](modules/02-llm-apis/api-04-multimodal.md)

- [An Image is Worth 16x16 Words (ViT)](https://arxiv.org/pdf/2010.11929)
- [CLIP](https://arxiv.org/pdf/2103.00020)
- [ViViT: A Video Vision Transformer](https://arxiv.org/pdf/2103.15691)
- [Joint Embedding abstractions with self-supervised video masks](https://arxiv.org/pdf/2404.08471)

---

## 3 · Retrieval

**Vector search and databases** — pairs with [rag-02](modules/03-retrieval/rag-02-vector-search.md), [rag-03](modules/03-retrieval/rag-03-vector-databases.md)

- [Billion-Scale Similarity Search (FAISS)](https://arxiv.org/pdf/1702.08734)
- [The FAISS library](https://arxiv.org/pdf/2401.08281)
- [Milvus DB](https://www.cs.purdue.edu/homes/csjgwang/pubs/SIGMOD21_Milvus.pdf)

**Context engineering and advanced RAG** — pairs with [rag-01](modules/03-retrieval/rag-01-context-engineering.md), [rag-06](modules/03-retrieval/rag-06-advanced-retrieval.md), [rag-08](modules/03-retrieval/rag-08-rag-frontiers.md)

- [DSPy](https://arxiv.org/pdf/2310.03714)
- [RAG with Knowledge Graphs for Customer Service QA](https://arxiv.org/pdf/2404.17723v1)
- [Chain-of-Retrieval Augmented Generation](https://arxiv.org/pdf/2501.14342)

Reference code:

- [A minimal RAG implementation](https://github.com/InterviewReady/ai-engineering-resources/blob/main/code/rag) — ~70 lines: embed, cosine-similarity retrieve, stuff into a prompt. Worth reading once as the honest skeleton underneath [rag-05](modules/03-retrieval/rag-05-rag-pipeline.md), then compare against everything that chapter says a production pipeline adds on top.

---

## 4 · Agents

**Reasoning and planning** — pairs with [agt-03](modules/04-agents/agt-03-reasoning-and-planning.md)

- [Chain-of-Thought Prompting Elicits Reasoning in LLMs](https://arxiv.org/pdf/2201.11903) — start here
- [Demystifying Long Chain-of-Thought Reasoning in LLMs](https://arxiv.org/pdf/2502.03373)
- [Chain of thought](https://arxiv.org/pdf/2411.14405v1)
- [Transformer Reasoning Capabilities](https://arxiv.org/pdf/2405.18512)
- [Large Language Monkeys: Scaling Inference Compute with Repeated Sampling](https://arxiv.org/pdf/2407.21787)
- [Scaling test-time compute beats scaling parameters](https://arxiv.org/pdf/2408.03314)
- [Training LLMs to Reason in a Continuous Latent Space](https://arxiv.org/pdf/2412.06769)
- [DeepSeek R1](https://arxiv.org/pdf/2501.12948v1)
- [Latent Reasoning: A Recurrent Depth Approach](https://arxiv.org/pdf/2502.05171)
- [A Probabilistic Inference Approach to Inference-Time Scaling](https://arxiv.org/pdf/2502.01618)
- [Syntactic and Semantic Control via Sequential Monte Carlo](https://arxiv.org/pdf/2504.13139)

**Tooling and protocol** — pairs with [agt-05](modules/04-agents/agt-05-mcp.md)

- [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)
- [Swarm by OpenAI](https://github.com/openai/swarm)

---

## 6 · Production

**Serving infrastructure** — pairs with [prd-02](modules/06-production/prd-02-inference-and-serving.md)

- [Ray](https://arxiv.org/abs/1712.05889)
- [TensorFlow](https://arxiv.org/pdf/1605.08695)
- [DeepSeek 3FS filesystem](https://github.com/deepseek-ai/3FS/blob/main/docs/design_notes.md)

**Inference optimization** — pairs with [prd-03](modules/06-production/prd-03-inference-optimization.md)

- [Speculative Decoding](https://arxiv.org/pdf/2211.17192) — the exactness-preserving trick from the chapter
- [The Era of 1-bit LLMs: All LLMs are in 1.58 Bits](https://arxiv.org/pdf/2402.17764)
- [ByteDance 1.58](https://arxiv.org/pdf/2412.18653v1)
- [FlashAttention-3](https://arxiv.org/pdf/2407.08608)
- [Transformer Square](https://arxiv.org/pdf/2501.06252)
- [1b outperforms 405b](https://arxiv.org/pdf/2502.06703)

---

## 8 · Fine-tuning

**Distillation** — pairs with [ftn-06](modules/08-fine-tuning/ftn-06-distillation-and-slms.md)

- [Distilling the Knowledge in a Neural Network](https://arxiv.org/pdf/1503.02531) — the original
- [BYOL — Distilled Architecture](https://arxiv.org/pdf/2006.07733)
- [DINO](https://arxiv.org/pdf/2104.14294)

---

## 9 · Frontier

**Alternative architectures (SSMs)** — pairs with [fro-04](modules/09-frontier/fro-04-staying-current.md)

The most credible current challenge to the transformer's dominance:

- [Mamba](https://arxiv.org/pdf/2312.00752)
- [RWKV: Reinventing RNNs for the Transformer Era](https://arxiv.org/pdf/2305.13048)
- [Transformers are SSMs: Structured State Space Duality](https://arxiv.org/pdf/2405.21060)
- [Distilling Transformers to SSMs](https://arxiv.org/pdf/2408.10189)
- [LoLCATs: On Low-Rank Linearizing of LLMs](https://arxiv.org/pdf/2410.10254)
- [Think Slow, Fast](https://arxiv.org/pdf/2502.20339)

**Generative media** — pairs with [fro-02](modules/09-frontier/fro-02-generative-media.md)

- [DeepSeek image generation](https://arxiv.org/pdf/2501.17811)
- [Facebook VideoJAM](https://arxiv.org/pdf/2502.02492)
- [Inference-Time Scaling for Diffusion Models](https://arxiv.org/pdf/2501.09732)

**Competition-level reasoning**

- [Competitive Programming with Large Reasoning Models](https://arxiv.org/pdf/2502.06807)
- [Google Math Olympiad (Nature)](https://www.nature.com/articles/s41586-023-06747-5)
- [Google Math Olympiad 2](https://arxiv.org/pdf/2502.03544)

---

## Case studies

Production write-ups — the closest thing to seeing someone else's [prd-01](modules/06-production/prd-01-architecture-patterns.md) decisions:

- [Automated Unit Test Improvement using LLMs at Meta](https://arxiv.org/pdf/2402.09171)
- [OpenAI o1 System Card](https://arxiv.org/pdf/2412.16720)
- [LLM-powered bug catchers](https://arxiv.org/pdf/2501.12862)
- [Swiggy: search relevance with small language models](https://bytes.swiggy.com/improving-search-relevance-in-hyperlocal-food-delivery-using-small-language-models-ecda2acc24e6)
- [Netflix: foundation model for personalized recommendation](https://netflixtechblog.com/foundation-model-for-personalized-recommendation-1a0bd8e02d39)
- [Uber QueryGPT](https://www.uber.com/en-IN/blog/query-gpt/)

---

## Blogs worth following

Papers tell you what was discovered; blogs tell you what it's like to build with it. This section is **not** from the source repo above — its `blogs/` folder turned out to hold a single course announcement — so these are added here on their own merit. Every link was checked before it went in.

[fro-04](modules/09-frontier/fro-04-staying-current.md) argues you should subscribe to *few* things and read them properly. Treat this as a menu, not a checklist: pick two or three.

**Deep explainers** — when you want a concept properly unpacked

- [Lil'Log (Lilian Weng)](https://lilianweng.github.io/) — long, careful surveys of a topic at a time; among the best free technical writing in the field
- [Jay Alammar](https://jalammar.github.io/illustrated-transformer/) — the illustrated explanations; the Transformer post is the standard visual introduction, and pairs directly with [fnd-05](modules/01-foundations/fnd-05-transformer-architecture.md)
- [Andrej Karpathy](https://karpathy.github.io/) — first-principles posts on how neural nets actually behave
- [Distill](https://distill.pub/) — interactive visual explanations; no longer publishing, but the back catalogue is still worth working through

**Applied practice** — the closest thing to this curriculum's Modules 5–8 in blog form

- [Eugene Yan](https://eugeneyan.com/writing/) — applied LLM systems, evals, and patterns; already cited in [fro-05](modules/09-frontier/fro-05-interviews-portfolio.md)
- [Hamel Husain](https://hamel.dev/) — evals and fine-tuning in practice, with unusual specificity about what actually goes wrong
- [Chip Huyen](https://huyenchip.com/blog/) — ML systems design; the reference behind much of [prd-01](modules/06-production/prd-01-architecture-patterns.md)'s framing
- [What We Learned from a Year of Building with LLMs](https://applied-llms.org/) — a multi-author retrospective that reads like a compressed version of Modules 5–7

**Staying current** — see [fro-04](modules/09-frontier/fro-04-staying-current.md) before subscribing to all of these

- [Simon Willison](https://simonwillison.net/) — near-daily notes on what shipped and why it matters; the single best signal-to-noise feed in the field
- [Ahead of AI (Sebastian Raschka)](https://magazine.sebastianraschka.com/) — research digests with implementation detail
- [The Gradient](https://thegradient.pub/) — longer-form essays and commentary

**From the teams shipping it**

- [Anthropic Engineering](https://www.anthropic.com/engineering)
- [OpenAI research](https://openai.com/news/research/)
- [Netflix TechBlog](https://netflixtechblog.com/) — the recommendation and foundation-model posts especially
- [Uber Engineering](https://www.uber.com/blog/engineering/)
- [Pinecone Learn](https://www.pinecone.io/learn/) — solid vector-search and RAG explainers; vendor-published, so read it alongside [rag-02](modules/03-retrieval/rag-02-vector-search.md) rather than instead of it
- [Vicki Boykis](https://vickiboykis.com/) — essays on embeddings and the practical shape of ML work

---

## How to work through this

Don't read top to bottom. [fro-04](modules/09-frontier/fro-04-staying-current.md) makes the argument in full, but briefly: pick the chapter you just finished, read its two or three primary sources here, and let the rest sit until a chapter sends you to them. A reading list you actually finish is worth more than one you feel guilty about.
