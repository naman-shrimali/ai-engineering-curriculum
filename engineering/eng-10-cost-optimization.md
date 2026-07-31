---
id: eng-10
title: "Cost-Optimization Guide"
module: engineering
prerequisites: [api-05, api-06]
related_ids: [prd-05, eng-04, eng-05, ftn-06]
keywords:
  - cost optimization
  - token economics
  - cost per task
  - caching
  - cascades
  - batch processing
  - output discipline
  - cost audit
  - unit economics
summary: >-
  The cost model and the lever catalog, ordered by typical ROI: the cost-per-
  task decomposition, seven levers from prompt caching (usually first and
  largest) through routing, output discipline, batch relocation, prompt
  slimming, model right-sizing, and self-hosting — each with its quality
  risk — plus the quarterly audit procedure and the guardrail metrics.
difficulty: 3
est_minutes: 45
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources:
  - key: anthropic-caching
    tier: 1
    title: "Prompt caching"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
    accessed: 2026-07-10
  - key: openai-batch
    tier: 1
    title: "Batch API"
    org: OpenAI
    url: https://platform.openai.com/docs/guides/batch
    accessed: 2026-07-10
  - key: openai-pricing
    tier: 1
    title: "API pricing"
    org: OpenAI
    url: https://platform.openai.com/docs/pricing
    accessed: 2026-07-10
---

# Cost-Optimization Guide

LLM cost work has one honest unit — **cost per task** — and one honest constraint: every lever below has a quality risk, so every lever is applied *through the eval harness* ([eng-03](eng-03-eval-harness-architecture.md)), never by config edit and hope. This doc gives the decomposition, the lever catalog in typical-ROI order, and the audit procedure. Deep treatment: [prd-05](../modules/06-production/prd-05-cost-engineering.md); serving-side economics: [prd-02](../modules/06-production/prd-02-inference-and-serving.md)/[prd-03](../modules/06-production/prd-03-inference-optimization.md).

## The cost model

Per route, from your trace store ([eng-04](eng-04-llmops-stack.md) — if you can't compute this, fix logging first):

```text
cost_per_task = [ input_tokens × input_price × (1 − cache_hit_share × cache_discount)
                + output_tokens × output_price ]
                × (1 + retry_rate)
                × cascade_mix_factor          # weighted across models on the route
                + tool/retrieval overheads    # embeddings, rerankers, search
```

Reading the formula tells you where money hides: **input tokens** dominate context-heavy routes (RAG, agents) and are the caching lever's territory; **output tokens** cost several times more per token ([fnd-05](../modules/01-foundations/fnd-05-transformer-architecture.md)'s decode economics) and are the discipline lever's territory; **retry rate** is a quality tax visible only if logged; **cascade mix** is where routing pays. Track the formula's terms per route on the eng-04 dashboard; alert on >20% week-over-week drift in any term.

## The lever catalog

In typical-ROI order — start at the top; each lever names its quality risk and its chapter.

**1. Prompt caching (usually first, often largest).** Stable→volatile prompt reordering + byte-stable prefixes + append-only history = 50–90% off the input-token line on repeated-prefix routes, plus a TTFT collapse.[^anthropic-caching] *Quality risk: zero* — KV-prefix caching is correctness-free by construction ([api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md)) — which is exactly why it's lever #1. Cost: a prompt-layout refactor. Check: cache hit rate per route, alarmed.

**2. Batch relocation.** Every nobody-waiting workload (evals, ingestion, enrichment, backfills) onto the batch tier: ~50% off *and* quota isolation.[^openai-batch] *Quality risk: zero.* Cost: per-item idempotency and pickup automation ([api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md)'s engineering). Check: what share of tokens runs interactive that shouldn't — re-audit quarterly; workloads drift interactive-ward.

**3. Output discipline.** Concise-output instructions, structured outputs instead of prose ([api-03](../modules/02-llm-apis/api-03-structured-outputs-tool-calling.md) — schemas are shorter than essays), honest `max_tokens` budgets, and — on reasoning models — effort dials matched to task stakes ([agt-03](../modules/04-agents/agt-03-reasoning-and-planning.md)). Output tokens are the expensive ones and the latency ones; this lever pays twice. *Quality risk: real* — over-tightening truncates or starves reasoning; eval per change.

**4. Model right-sizing + cascades.** The [api-06](../modules/02-llm-apis/api-06-model-selection.md) bake-off with one tier down (the mid-tier upset is the common case), then confidence-gated cascades for mixed traffic ([eng-05](eng-05-design-patterns.md) #2) — pay frontier prices only for frontier-hard inputs. *Quality risk: real but measurable* — the eval decides, and the router itself gets evaluated (escalation precision/recall). Typical yield: 3–10× on the routed share.

**5. Context slimming.** The [rag-01](../modules/03-retrieval/rag-01-context-engineering.md) curation program as a cost program: retrieval precision over recall-dumping (the eng-01 example: top-20 → reranked top-5 cut cost 70% *and improved quality*), dedup, density reformatting, route-scoped tool catalogs, few-shot examples audited for marginal eval value ([api-02](../modules/02-llm-apis/api-02-prompt-engineering.md)'s token audit). *Quality risk: cuts too deep lose recall* — slim against the eval, watching abstention rates.

**6. Semantic caching.** Serving cached responses to similar-enough requests — listed sixth deliberately: unlike lever 1 it trades *correctness* for cost (similarity thresholds inherit [fnd-03](../modules/01-foundations/fnd-03-embeddings.md)'s blind spots; staleness is real). Only for high-repetition routes with tolerant semantics, with per-route validated thresholds, TTLs, and an invalidation story ([eng-05](eng-05-design-patterns.md)'s caution note).

**7. Self-hosting / distillation (the structural levers).** Sustained high-volume routine workloads → the [api-07](../modules/02-llm-apis/api-07-local-inference.md) TCO analysis (honest utilization, ops product budgeted); stable narrow tasks at huge volume → distill into a small model you own ([ftn-06](../modules/08-fine-tuning/ftn-06-distillation-and-slms.md)). Highest ceilings, highest engineering cost, slowest payback — the levers you earn after 1–6, not instead of them.

## The quarterly cost audit

1. **Decompose:** cost per task per route, split by the formula's terms, trend over the quarter (trace-store queries — one hour if eng-04 is in place).
2. **Rank routes by spend** and audit the top three against the lever catalog in order: hit rate ok? batch-eligible tokens on interactive? output length drifting? tier justified by the eval? context regions bloating?
3. **Check the taxes:** retry rate (a quality bug wearing a cost costume), budget-exhausted agent runs, semantic-cache hit *quality* (sampled).
4. **Re-verify the prices:** provider pricing moves; cached/batch discounts move[^openai-pricing] — recompute the crossovers (cascade thresholds, self-host TCO) that were calibrated to old numbers ([fro-04](../modules/09-frontier/fro-04-staying-current.md)'s trigger discipline).
5. **File the findings as eval-gated changes**, not config hotfixes — every lever ships through the smoke/full suite like any behavior deploy ([eng-08](eng-08-deployment-guide.md)'s procedure).

## Guardrails: what cost work must not break

- **Quality floors are explicit:** each route's eval thresholds are written down *before* optimization starts; a lever that breaches them reverts, whatever it saves.
- **Latency budgets ride along:** several levers (caching, output discipline) improve latency; cascades and semantic caches can add round-trips — the SLO dashboard arbitrates ([eng-01](eng-01-rag-pipeline-architecture.md)'s per-stage decomposition).
- **Abstention isn't savings:** a context-slimmed route that answers "not found" more often shows lower tokens and *looks* cheaper — watch abstention and escalation rates next to cost ([fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md)).
- **The forgotten denominators:** engineering time (a week of caching refactor beats a quarter of micro-optimizations) and the flywheel (never optimize away the trace logging and eval sampling that make everything else possible — they are single-digit percent overhead and the whole control system).

> **Volatile:** every price, discount ratio, and crossover in this doc's arithmetic is a per-provider, per-quarter fact.[^openai-pricing][^anthropic-caching] The decomposition, the lever ordering logic (correctness-free levers first), and the audit procedure are the stable content.

## Related chapters

| Chapter | What it explains |
|---|---|
| [api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md) | Caching and batch mechanics (levers 1–2) |
| [api-06](../modules/02-llm-apis/api-06-model-selection.md) | Right-sizing bake-offs and cascade economics (lever 4) |
| [rag-01](../modules/03-retrieval/rag-01-context-engineering.md) | Context curation (lever 5) |
| [api-07](../modules/02-llm-apis/api-07-local-inference.md) / [ftn-06](../modules/08-fine-tuning/ftn-06-distillation-and-slms.md) | The structural levers (7) |
| [prd-05](../modules/06-production/prd-05-cost-engineering.md) | Cost engineering at full depth |
| [eng-04](eng-04-llmops-stack.md) | The dashboards and trace store the audit assumes |

## Sources

[^anthropic-caching]: [T1] Anthropic. "Prompt caching." https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching (accessed 2026-07-10)
[^openai-batch]: [T1] OpenAI. "Batch API." https://platform.openai.com/docs/guides/batch (accessed 2026-07-10)
[^openai-pricing]: [T1] OpenAI. "API pricing." https://platform.openai.com/docs/pricing (accessed 2026-07-10)
