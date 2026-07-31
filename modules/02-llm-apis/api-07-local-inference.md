---
id: api-07
title: "Local & Open-Weight Inference"
module: llm-apis
prerequisites: [api-01, fnd-05]
related_ids: [prd-02, prd-03, fro-03, api-06]
keywords:
  - open weights
  - local inference
  - self-hosting
  - ollama
  - llama.cpp
  - vllm
  - quantization
  - gguf
  - vram
  - model serving
summary: >-
  Running open-weight models yourself: the ecosystem (hubs, families,
  licenses), the two stack tiers (desktop llama.cpp/Ollama vs. server
  vLLM-class), quantization as the practical enabler, VRAM napkin math from
  first principles, and the honest total-cost-of-ownership analysis that
  decides when self-hosting beats the API — and when it decidedly doesn't.
difficulty: 3
est_minutes: 240
status: evolving
volatility: volatile
last_reviewed: 2026-07-09
sources:
  - key: ollama-docs
    tier: 1
    title: "Ollama documentation"
    org: Ollama
    url: https://docs.ollama.com/
    accessed: 2026-07-09
  - key: llamacpp-repo
    tier: 1
    title: "llama.cpp"
    org: ggml-org
    url: https://github.com/ggml-org/llama.cpp
    accessed: 2026-07-09
  - key: vllm-docs
    tier: 1
    title: "vLLM documentation"
    org: vLLM
    url: https://docs.vllm.ai/
    accessed: 2026-07-09
  - key: hf-hub
    tier: 1
    title: "Hugging Face Hub documentation"
    org: Hugging Face
    url: https://huggingface.co/docs/hub/index
    accessed: 2026-07-09
  - key: dettmers-int8
    tier: 2
    title: "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale"
    org: arXiv
    url: https://arxiv.org/abs/2208.07339
    accessed: 2026-07-09
  - key: kwon-paged
    tier: 2
    title: "Efficient Memory Management for Large Language Model Serving with PagedAttention"
    org: arXiv
    url: https://arxiv.org/abs/2309.06180
    accessed: 2026-07-09
---

# Local & Open-Weight Inference

Everything so far assumed a provider on the other end of the HTTPS call. This chapter removes them: open-weight models — weights you download and run on hardware you control — are the parallel ecosystem that gives you data sovereignty, zero marginal token cost, deep customization, and immunity from deprecation, in exchange for owning the entire serving problem yourself. For an AI engineer the material has two payoffs: the practical one (a local model on your laptop is the best learning and prototyping instrument in the field — several earlier mini-projects already assumed it), and the strategic one (the self-host-vs-API decision recurs throughout a career, and it's decided by arithmetic this chapter teaches, not by ideology). The stack specifics are volatile; the memory math (straight from fnd-05), the two-tier stack structure, and the TCO framework are the durable content.

## Intuition: the API, unbundled

A provider API bundles: model weights + serving software + GPUs + ops + reliability engineering + a billing meter. Self-hosting unbundles it — you source each layer yourself:

- **Weights** from a hub (Hugging Face being the center of gravity[^hf-hub]), under a license you actually read (api-06: open weight ≠ open source).
- **Serving software** — an inference engine that loads weights and exposes an API; the good news is the ecosystem converged on **OpenAI-compatible endpoints**, so your api-01 gateway talks to a local engine by changing a base URL.
- **Hardware** — where fnd-05's memory arithmetic stops being napkin trivia and becomes your shopping list.
- **Everything else** — monitoring, scaling, failover, upgrades: the invisible 60% of what your API bill was paying for.

The framing that keeps decisions honest: **self-hosting is infrastructure ownership, and infrastructure ownership is a product you build for yourself.** The question is never "is it cheaper per token?" (at high utilization, usually yes) but "is building and running this product a better use of the team than the work it displaces?" — the same build-vs-rent logic as any infrastructure (fnd-01), with unusually sharp numbers on both sides.

## The open-weight ecosystem

The stable structure of a fast-churning world:

- **Hubs:** Hugging Face is the distribution layer — weights, model cards, licenses, community quantizations, and the `transformers`/`tokenizers` libraries that define de-facto formats.[^hf-hub] Model cards are your first diligence read: license, training cutoff, context length, benchmark claims (with fnd-09 skepticism), and the chat template (fnd-07 — using the *wrong* chat template is the classic silent quality-killer of local inference; the template ships with the tokenizer and your engine must apply it).
- **Families and tiers:** open weights ship in the same family-ladder pattern as APIs (api-06) — small (1–8B class: laptop-friendly, remarkably capable post-overtraining economics, fnd-06), mid (a few tens of B: single-server), large (70B+ and MoE giants: multi-GPU commitments). Base vs. instruct variants matter: you almost always want the instruct/post-trained variant (fnd-06's base-model warning applies with full force locally).
- **Licenses:** a spectrum from permissive (Apache-2.0-class) through custom "community licenses" with scale/use clauses to research-only. This is a legal-review input, not an engineer's judgment call — and license terms have changed *between versions* of the same family, so the review recurs.
- **Formats and quantization variants:** the same model appears as full-precision safetensors (server stacks) and pre-quantized bundles (GGUF for the llama.cpp world) at multiple bit-widths — the practical enabler covered below.

> **Volatile:** which families lead, license specifics, and format fashions churn quarterly — verify at the hub at build time.[^hf-hub] The hub-families-licenses-formats *structure*, and the diligence checklist, are stable.

## Quantization: the practical enabler

Fnd-05 gave you the rule: ~2 bytes/parameter at 16-bit. Quantization stores weights at lower precision — 8-bit (~1 byte/param), 4-bit (~0.5 bytes/param) — cutting memory (and memory-bandwidth pressure, hence often *increasing* decode speed, fnd-05's bandwidth-bound insight) at some quality cost. The foundational result: 8-bit inference can be essentially lossless with outlier-aware techniques,[^dettmers-int8] and modern 4-bit methods degrade surprisingly gracefully — which is *why* consumer hardware runs serious models at all.

The engineering picture:

- **The quality cost is real but task-relative:** small on fluent generation, larger on precise reasoning and long-tail knowledge, and it *compounds* with model size pressure (a 4-bit large model usually beats a 16-bit small one at equal memory — but verify on *your* eval, the api-06 discipline unchanged).
- **The napkin math, updated:** memory ≈ params × bytes-per-param × ~1.2 overhead, *plus* KV cache (fnd-05's formula — quantizable too, at its own quality trade-off). An 8B model: ~16 GB at 16-bit, ~8–9 GB at 8-bit, ~5 GB at 4-bit — the difference between "needs a server GPU" and "runs on a gaming laptop."
- **Pre-quantized vs. quantize-yourself:** the community ships pre-quantized variants of everything within days of release; for standard methods, use them and spend your time on evals, not conversion.

Deep treatment — methods, calibration, activation quantization, when quality falls off a cliff — belongs to prd-03; this chapter's requirement is that you can size hardware and read a quantization label on the hub.

## The two-tier stack

The serving ecosystem has settled into two tiers with different physics and different jobs:

**Desktop/edge tier — llama.cpp and Ollama.** llama.cpp is the portable C++ engine (CPU + consumer-GPU inference, GGUF format, aggressive quantization support);[^llamacpp-repo] Ollama wraps it in a model-manager UX — `ollama run <model>` pulls weights and serves an OpenAI-compatible endpoint locally.[^ollama-docs] Optimized for: one user, modest concurrency, minimal setup, heterogeneous hardware. This tier is your **laboratory**: free experimentation (the fnd-07 base-vs-instruct diffs, fnd-08 sampler zoo, api-02 prompt iteration — all run here without a meter), offline/air-gapped work, and privacy-absolute prototyping.

**Server tier — vLLM and peers.** vLLM-class engines (TGI, SGLang) are throughput machines: continuous batching (interleaving many requests' decode steps to keep the GPU saturated), PagedAttention (virtual-memory-style KV cache management — the fnd-05 paper made real[^kwon-paged]), prefix caching (api-05's mechanism, now yours to operate), tensor parallelism for multi-GPU models, and OpenAI-compatible serving.[^vllm-docs] Optimized for: many concurrent users, GPU utilization, production SLOs. This tier is what "we self-host in production" actually means, and operating it is prd-02's subject — this chapter's job is that you can stand one up and know what knobs exist.

The strategic convenience of the converged API shape: your gateway (api-01), prompts (api-02), schemas (api-03 — engines increasingly support constrained decoding natively), and eval harness all work unchanged across both tiers and against providers. The stack is swappable *because* you built to the interface.

## When self-hosting wins — the honest TCO

The decision framework, criteria in the order they usually decide:

1. **Hard governance constraints win outright:** data that legally cannot leave your infrastructure (regulated industries, air-gapped environments, sovereignty requirements) makes the decision for you — the only question left is which model and stack (sec-03).
2. **Sustained high utilization flips the economics:** GPU costs are fixed; API costs are linear in tokens. The crossover needs *sustained* volume — a GPU at 15% utilization is an expensive way to feel sovereign, and utilization is the number teams most overestimate. Batch-heavy, steady workloads cross earliest; spiky interactive traffic crosses latest (peak-provisioning waste).
3. **Customization needs:** fine-tuned weights you own (module 8), constrained decoding beyond provider support, logit-level access, exotic sampling — things APIs structurally can't sell you.
4. **Latency/locality:** colocation with your systems, no internet hop, edge deployment (fro-03).
5. **Deprecation immunity and terms stability:** the model you validated runs forever; no forced migrations (api-06's tax, escaped).

And the costs the enthusiasm forgets: **the capability gap** (frontier API models generally outperform what you can self-host — if your task needs frontier capability, TCO is moot); **the ops product** (monitoring, failover, upgrades, capacity planning, security patching — a part-time job at minimum, a team at scale); **the reliability inheritance** (api-01's failure surface becomes yours to *emit*, not just handle); and **opportunity cost** (the honest denominator: what the team doesn't build while running inference).

The pattern that resolves most real cases: **hybrid** — API for frontier-capability and spiky interactive paths, self-hosted for high-volume routine tasks (classification, extraction, embeddings), governance-constrained flows, and everything module 8 fine-tunes. Your gateway routes; your evals arbitrate (api-06's portfolio logic, extended across the ownership boundary).

## Production engineering perspective

- **Match the tier to the job:** Ollama-class for development and prototyping (its convenience is the point); vLLM-class for anything multi-user (its throughput is the point). Serving production traffic on a desktop-tier stack is the classic first mistake — single-request engines collapse under concurrency they were never designed for.
- **Do the capacity math before the hardware order:** weights (quantized) + KV cache × expected concurrency × context (fnd-05's formula) + overhead, against GPU VRAM tiers. The fnd-05 worked example — where cache exceeded weights — is the trap; long-context concurrent serving is a *memory* problem first.
- **Benchmark on your workload shape,** not synthetic tokens/sec: prefill-heavy (RAG, long prompts) and decode-heavy (generation) workloads stress different resources (fnd-05's two phases); engine defaults tune differently for each.[^vllm-docs]
- **Own your eval more, not less:** no provider is silently improving the model under you — but also no provider is catching regressions from *your* quantization choice, template mismatch, or engine upgrade. The api-06 bake-off discipline applies to every stack change: engine versions, quantization levels, and serving configs are all "model versions" for eval purposes.
- **Chat-template hygiene:** verify the engine applies the model's own template (inspect actual token sequences on first setup — fnd-04's debugging habit). Template mismatch is the most common "this model is worse than the benchmarks said" root cause in local deployments.
- **Security inverts:** no provider safety stack — moderation, special-token sanitization (fnd-04), abuse handling are now yours (sec-02); but also no data leaves — the threat model trades external exposure for internal responsibility.

## Historical evolution

**2023:** the LLaMA weights release (and its leak-then-license arc) ignites the ecosystem; llama.cpp demonstrates laptops running LLMs via aggressive quantization;[^llamacpp-repo] vLLM's PagedAttention paper professionalizes open serving.[^kwon-paged] **2023–2024:** the gap narrows — open families reach within striking distance of frontier APIs; Ollama makes local inference a consumer experience; OpenAI-compatibility becomes the ecosystem's lingua franca. **2024–2025:** open-weight reasoning models (fnd-07's DeepSeek-R1 moment) prove frontier *techniques* replicate in the open; enterprise self-hosting matures from ideology to line-item arithmetic; small-model quality (overtraining economics, fnd-06) makes the laptop tier genuinely useful rather than merely impressive. The through-line: open weights lag the frontier by a shrinking margin while the serving stack commoditizes — every year the TCO crossover moves toward self-hosting for more workload classes, without ever reaching "always."

## Common misconceptions

- **"Self-hosting is free — the weights cost nothing."** The weights are the cheapest component. GPUs, engineering time, and the ops product are the bill; at low utilization, the API is dramatically cheaper. Run the arithmetic with honest utilization numbers.
- **"Open models are far behind — toys."** The gap is real at the frontier and irrelevant for many production task classes (fnd-09's bands): extraction, classification, routine drafting, and embedding-adjacent work run eval-verified-equivalent on open mid-tiers. Task-relative, always.
- **"Quantization ruins models."** 8-bit is near-lossless; 4-bit degrades gracefully and task-dependently.[^dettmers-int8] The eval decides, not the bit-count — and memory saved often buys a *bigger* model, which nets positive.
- **"It benchmarked worse locally, so the model is worse."** Check the chat template first, quantization level second, sampling defaults third (fnd-08 — engine defaults differ from provider defaults). Most local "quality gaps" are configuration artifacts.
- **"We'll self-host to save money" (from a team with spiky, modest traffic).** The crossover needs sustained utilization; peak-provisioned GPUs idling at 3 a.m. are the most expensive tokens in the industry. Batch the spiky workload to a provider instead (api-05).
- **"Local means safe."** Local means *private*. The provider's safety stack — moderation, sanitization, abuse detection — is gone; you inherit its responsibilities (sec-02) along with the sovereignty.

## Failure modes and trade-offs

- **Template mismatch** — wrong or missing chat template silently degrades everything. *Fix:* token-level verification at setup; template pinned with the model version.
- **Desktop stack under production load** — single-user engines collapsing at concurrency. *Fix:* tier match; vLLM-class for multi-user, always.
- **KV-cache OOM under long-context concurrency** — the fnd-05 capacity example, now on your pager. *Fix:* the napkin math at planning time; paged-cache engines; context limits enforced at the gateway.[^kwon-paged]
- **Quantization regression discovered in production** — a bit-width chosen for memory, evaled never. *Fix:* every quantization level is a model version; bake-off before deploy.
- **Utilization fantasy** — TCO computed at 80% utilization, realized at 12%. *Fix:* measure current API traffic patterns *first*; provision for measured reality; keep the API path for peaks (hybrid).
- **Ops debt** — no monitoring, no upgrade path, one engineer who knows the stack. *Trade-off made visible:* self-hosting converts an API bill into headcount; if that headcount isn't budgeted, the system is one departure from unowned.

## Best practices

- **Run a local model this week** if you never have — Ollama, one command, your api-01 client pointed at localhost.[^ollama-docs] The mini-projects of fnd-07/fnd-08 assumed it; the intuition it builds (models as artifacts you hold) changes how you read the whole field.
- **Read the model card and license before the download finishes;**[^hf-hub] verify the chat template at the token level before trusting any quality impression.
- **Treat engine version + quantization + serving config as the model version** — pin it, eval it, log it (api-01/api-06 disciplines, extended).
- **Size hardware from the fnd-05 formula with honest concurrency and context numbers;** benchmark on your workload shape before committing to capacity.
- **Default to hybrid:** API for frontier and spiky, self-host for sustained/governed/customized — gateway-routed, eval-arbitrated.
- **Budget the ops product explicitly** — monitoring, upgrades, on-call — or don't self-host production traffic.
- **Inherit the safety responsibilities knowingly:** input sanitization (fnd-04's special tokens), moderation where user-facing, and the sec-02 stack on your roadmap the day you go live.

## Real-world examples

**The classification workload that paid for its GPUs in a quarter.** A team runs 40M classification calls/month on a provider's small model. Traffic is steady (ingestion pipeline, not user-facing), the task is well inside open mid-tier capability (bake-off verified: eval parity), and governance prefers on-prem anyway. Two GPUs behind vLLM at ~70% sustained utilization replace an API line-item at roughly one-quarter the monthly cost, including amortized hardware and a realistic ops allocation. Every factor aligned: sustained volume, modest capability needs, batch-shaped traffic, existing infra team. The same arithmetic run for their *chat* feature (spiky, frontier-needy) said: stay on the API. They did both — the hybrid default, derived rather than assumed.

**The "worse model" that was a template bug.** An engineer benchmarks a well-regarded open model locally and finds it dramatically underperforming its reputation — rambling, ignoring instructions. Diagnosis (in this chapter's prescribed order): the serving setup was feeding raw text without the model's chat template — the model was completing documents, not answering (fnd-06's base-model behavior, induced by configuration). One template fix later, quality matches the model card. Hours saved by knowing the checklist: template → quantization → sampling defaults, before "the model is bad."

**The sovereignty project that forgot the ops bill.** A regulated-industry team self-hosts for compliance — correctly, criterion 1 decides it. But the plan budgets hardware and zero ops: no monitoring, no upgrade cadence, one heroic engineer. Eighteen months later: engine three major versions behind (missing the prefix-caching feature that would halve their latency), no eval coverage on the quantization they chose under memory pressure, and the heroic engineer resigning. The remediation costs more than doing it right initially. Moral: criterion 1 decides *whether*; the ops product decides *whether it works*.

## Interview questions

1. **"Walk me through the self-host vs. API decision for a real workload."** — Model answer: constraint check first — if data can't leave our infrastructure, self-hosting is decided and we move to sizing. Otherwise, arithmetic: measure current/projected token volume and traffic shape; sustained high-utilization batch-like workloads cross the TCO line earliest, spiky interactive traffic latest (peak provisioning waste). Then capability: bake off the best self-hostable candidate against the API incumbent on our eval — if the task needs frontier capability, TCO is moot. Then the honest costs: ops headcount, reliability inheritance, opportunity cost. Most real answers are hybrid — self-host the sustained/governed/fine-tuned paths, API the frontier/spiky paths, gateway-routed.

2. **"Size the hardware for serving an 8B model to 50 concurrent users at 16k context."** — Model answer: weights — 8B at 8-bit ≈ 9 GB with overhead. KV cache — using the fnd-05 formula for a typical 8B GQA config, ≈128 KB/token × 16k × 50 ≈ 100 GB if all sessions are simultaneously full — which says one GPU won't hold naive worst-case. Refinements: paged cache management (vLLM) means real usage is average-not-peak context; cache quantization halves it; and measured concurrency is rarely all-full-context. Realistic plan: one 80 GB-class GPU handles it with paging and context limits enforced at the gateway, but I'd benchmark with production-shaped traffic before committing — prefill-heavy vs. decode-heavy mixes stress different resources.

3. **"What's quantization buying and costing, and how do you choose a level?"** — Model answer: buying — 2–4× memory reduction (weights and optionally KV cache) and often faster decode (memory-bandwidth-bound, fnd-05); costing — task-dependent quality: near-zero at 8-bit with outlier handling, graceful-but-real at 4-bit, worst on precise reasoning and long-tail recall. Choice process: treat each level as a model version and run the private eval (api-06's bake-off) — including the counterintuitive comparison, since a 4-bit larger model frequently beats a 16-bit smaller one at equal memory. Never choose by bit-count and vibes; the eval decides.

4. **"Your locally-served model underperforms its benchmarks. Debug it."** — Model answer: in order of base rates. Chat template — verify at the token level that the engine applies the model's own template; mismatch produces document-completion behavior that looks like stupidity. Quantization — check what variant was pulled and eval against a higher precision. Sampling defaults — engines ship different temperature/truncation defaults than providers (fnd-08); set explicitly. Context handling — silent truncation or misconfigured window. Then, and only then, entertain "the model card oversold it" (fnd-09's contamination skepticism). Ninety percent of local quality gaps are the first three.

5. **"What do you inherit when you leave the provider API?"** — Model answer: the whole unbundled stack. Reliability: you now emit the 429s and 5xxs — capacity planning, failover, monitoring are yours. Safety: no provider moderation, no special-token sanitization (a real injection surface on self-hosted stacks, fnd-04), abuse handling — the sec-02 stack becomes your roadmap. Quality assurance: no one silently improves the model, but no one guards against your own config regressions either — engine upgrades and quantization changes need eval gates. And the ops product: upgrades, security patching, on-call. In exchange: sovereignty, zero marginal cost, customization, and deprecation immunity. It's a fair trade exactly when the arithmetic says so.

6. **"Why did OpenAI-compatible endpoints become the ecosystem standard, and what does it enable architecturally?"** — Model answer: convergence economics — every tool, SDK, and gateway already spoke that dialect, so engines adopting it inherited the entire client ecosystem for free; network effects did the rest. Architecturally it makes the serving layer a swappable slot: the same gateway, prompts, schemas, and eval harness run against a provider, a vLLM cluster, or a laptop Ollama by changing a base URL — which is what makes hybrid routing, provider fallbacks, and incremental self-hosting migrations cheap. It's the api-01 gateway abstraction, validated by an entire ecosystem converging on the same seam.

## Exercises and mini-project

**Exercises**

1. Compute VRAM for: 8B at 4-bit, 32B at 8-bit, 70B at 4-bit (weights + 20% overhead, no cache). Which consumer (24 GB), prosumer (48 GB), and datacenter (80 GB) tiers does each fit?
2. Extend exercise 1: add KV cache for 10 concurrent 8k-context sessions on the 8B config (fnd-05 formula). What fraction of a 24 GB card is now cache?
3. A team does 5M tokens/day, spiky 10:1 peak-to-trough, needing frontier-adjacent quality. Another does 500M tokens/day, flat, simple classification. Write the two-line TCO verdict for each with the deciding factor.
4. Find one current open-weight model on the hub;[^hf-hub] from its card alone extract: license class, context length, chat template location, available quantizations, and one claim you'd verify per fnd-09.
5. List the five configuration items that constitute a "model version" for eval purposes on a self-hosted stack.

**Mini-project: your local lab, benchmarked.** (a) Install Ollama, pull one small instruct model (≤8B), point your api-01 client at the local endpoint — verify your entire gateway (retries, logging, usage accounting) works unchanged;[^ollama-docs] (b) verify the chat template at token level (compare engine-applied vs. model-card template); (c) run your api-02 prompt-lab eval and api-03 extraction eval against the local model — record the capability gap vs. your API baseline, field by field; (d) pull the same model at two quantization levels and measure the eval delta and tokens/sec; (e) benchmark honestly: tokens/sec at 1 vs. 4 concurrent requests (feel the desktop tier's ceiling); (f) memo: what this model could replace in your capstone at what quality cost, and the traffic shape that would justify a vLLM tier. Target: 3–4 hours. Success criterion: your full toolchain running against hardware you own, with a measured — not vibed — capability and throughput map.

**Capstone extension:** the local endpoint becomes a routing target in your capstone's gateway (cheap/private path), the quantization bake-off seeds prd-03, and the concurrency ceiling you measured motivates prd-02's serving stack.

## Revision summary

- Self-hosting unbundles the API: weights (hub + license diligence + chat-template hygiene), engine, hardware, and the invisible ops product. OpenAI-compatible endpoints make the whole stack a swappable slot behind your gateway.
- Quantization is the enabler: 8-bit near-lossless, 4-bit gracefully degrading and task-relative — memory ≈ params × bytes × 1.2 + KV cache; every level is a model version for eval purposes.
- Two tiers, two jobs: llama.cpp/Ollama as the frictionless laboratory (dev, prototyping, privacy-absolute work); vLLM-class (continuous batching, PagedAttention, prefix caching, tensor parallel) for production concurrency.
- TCO honestly: governance constraints decide outright; sustained utilization flips economics (spiky traffic doesn't); customization and deprecation immunity are real assets; the capability gap, ops product, and opportunity cost are real liabilities. Hybrid — self-host the sustained/governed/fine-tuned, API the frontier/spiky — resolves most cases.
- Local quality gaps are usually configuration: template → quantization → sampling defaults, before blaming the model. Safety responsibilities transfer with sovereignty.

## Flashcards

| Q | A |
|---|---|
| What does self-hosting unbundle? | Weights + serving engine + hardware + ops/reliability/safety — everything the API bill covered. |
| The two stack tiers and their jobs? | llama.cpp/Ollama: single-user lab and prototyping. vLLM-class: production concurrency via continuous batching + PagedAttention. |
| Memory napkin math with quantization? | Params × bytes-per-param (2/1/0.5 for 16/8/4-bit) × ~1.2 overhead, plus KV cache × concurrency × context. |
| Quality cost of quantization? | 8-bit ≈ lossless (outlier-aware); 4-bit graceful, worst on precise reasoning/long-tail recall — the eval decides per task. |
| The #1 local quality-gap root cause? | Chat template mismatch — the model completes documents instead of chatting; verify token-level at setup. |
| What flips TCO toward self-hosting? | Hard governance constraints (decides outright), sustained high utilization, customization needs, deprecation immunity. |
| What flips it back? | Spiky traffic (peak-provisioning waste), frontier capability needs, unbudgeted ops product, opportunity cost. |
| Why is OpenAI-compatibility strategic? | Same gateway/prompts/schemas/evals run against any tier or provider — swappable serving, cheap hybrid routing. |
| What counts as a "model version" locally? | Weights + quantization + engine version + serving config + chat template — pin and eval-gate all five. |
| What safety changes when you go local? | Provider moderation and sanitization disappear — sovereignty arrives with the full sec-02 responsibility stack. |

## Further reading

- **Official docs:** Ollama docs[^ollama-docs]; vLLM docs[^vllm-docs] (serving args and PagedAttention overview); Hugging Face Hub docs[^hf-hub] (model cards, GGUF, licenses); llama.cpp README for the quantization-variant landscape.[^llamacpp-repo]
- **Papers:** Dettmers et al., LLM.int8() (2022)[^dettmers-int8] — why 8-bit works; Kwon et al., PagedAttention (2023)[^kwon-paged] — re-read now that you'll operate it (first assigned in fnd-05).
- **Books:** none — the papers and engine docs are the canon.
- **Talks:** none essential; engine release notes are the real literature (fro-04's changelog habit).
- **Tutorials:** the vLLM quickstart, run once before prd-02 — the mini-project's Ollama path plus this covers both tiers.

## Check your understanding

1. Reconstruct the TCO framework from memory: which criterion decides outright, which is most overestimated, and which cost is most forgotten?
2. Size a deployment: 32B model, 8-bit, 20 concurrent 32k-context users — walk the arithmetic and name the binding constraint.
3. Your teammate benchmarked a local model as "way worse than the card claims." Recite the diagnostic order and the mechanism behind each suspect.
4. Explain why your api-01 gateway makes hybrid API/local routing nearly free — and what five things still need pinning per local target.
5. Which claims in this chapter are volatile (families, formats, engine features) vs. stable (memory math, tier structure, TCO logic, template hygiene)?

## Sources

[^ollama-docs]: [T1] Ollama. "Documentation." https://docs.ollama.com/ (accessed 2026-07-09)
[^llamacpp-repo]: [T1] ggml-org. "llama.cpp." https://github.com/ggml-org/llama.cpp (accessed 2026-07-09)
[^vllm-docs]: [T1] vLLM. "Documentation." https://docs.vllm.ai/ (accessed 2026-07-09)
[^hf-hub]: [T1] Hugging Face. "Hub documentation." https://huggingface.co/docs/hub/index (accessed 2026-07-09)
[^dettmers-int8]: [T2] Dettmers et al. (2022). "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale." arXiv:2208.07339. https://arxiv.org/abs/2208.07339 (accessed 2026-07-09)
[^kwon-paged]: [T2] Kwon et al. (2023). "Efficient Memory Management for Large Language Model Serving with PagedAttention." arXiv:2309.06180. https://arxiv.org/abs/2309.06180 (accessed 2026-07-09)
