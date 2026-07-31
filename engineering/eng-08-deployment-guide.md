---
id: eng-08
title: "Deployment & LLMOps Guide"
module: engineering
prerequisites: [api-01, api-05]
related_ids: [eng-04, prd-04, prd-06, evl-06]
keywords:
  - deployment
  - llmops procedures
  - capacity planning
  - incident runbooks
  - config deploy
  - canary
  - secrets
  - rate limits
  - self-hosted deployment
summary: >-
  The operational how-to companion to the LLMOps stack architecture:
  environment setup, secrets and key management, capacity and rate-limit
  planning arithmetic, the config-deploy and model-adoption procedures step by
  step, self-hosted deployment additions, and incident runbooks for the four
  recurring LLM production incidents.
difficulty: 3
est_minutes: 45
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources:
  - key: openai-ratelimits
    tier: 1
    title: "Rate limits guide"
    org: OpenAI
    url: https://platform.openai.com/docs/guides/rate-limits
    accessed: 2026-07-10
  - key: anthropic-errors
    tier: 1
    title: "Errors and rate limits"
    org: Anthropic
    url: https://docs.anthropic.com/en/api/errors
    accessed: 2026-07-10
  - key: vllm-docs
    tier: 1
    title: "vLLM documentation"
    org: vLLM
    url: https://docs.vllm.ai/
    accessed: 2026-07-10
  - key: anthropic-deprecations-note
    tier: 1
    title: "Model deprecations"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/about-claude/model-deprecations
    accessed: 2026-07-10
---

# Deployment & LLMOps Guide

[eng-04](eng-04-llmops-stack.md) specified the stack; this doc is the procedures — what to set up, in what order, with what arithmetic, and what to do at 3 a.m. Scope: API-first deployments with a self-hosted addendum; everything assumes the gateway/config-registry/trace-store trio exists at least at maturity rung 2 (eng-04's ladder).

## Environment and secrets setup

- **Keys:** one API key per (environment × workload class) — prod-interactive, prod-batch, staging, dev — so quota contention and blast radius are partitioned by construction ([api-01](../modules/02-llm-apis/api-01-llm-api-fundamentals.md)'s 429-storm lesson). Server-side only, in the secret manager, rotated on schedule, per-key spend caps and alerts at the provider dashboard.
- **Dev environment:** points at cheap/small models or a local endpoint ([api-07](../modules/02-llm-apis/api-07-local-inference.md)) through the *same gateway interface*; developers never hold prod keys. The OpenAI-compatible convergence makes this a base-URL swap.
- **Data governance defaults before first deploy:** provider data-use terms verified (training-on-inputs, retention) per [sec-03](../modules/07-safety-security/sec-03-privacy-compliance.md); trace-store redaction policy decided *before* traces accumulate — retrofitting redaction onto a year of stored prompts is a compliance incident in waiting.
- **Config registry bootstrapped:** every route's (prompt, examples, params, schema, model pin, budgets) as one versioned unit with a hash; the hash recorded on every trace. This single discipline is what makes every procedure below auditable.

## Capacity and rate-limit planning

The arithmetic to run *before* launch and at every scale doubling ([api-01](../modules/02-llm-apis/api-01-llm-api-fundamentals.md)):

1. **Demand:** requests/min at peak × (input + output tokens)/request, measured from staging traces — per route. Note input tokens include context, schemas, and history; use real assembled sizes ([rag-01](../modules/03-retrieval/rag-01-context-engineering.md) region logs), not template sizes.
2. **Supply:** provider TPM/RPM quotas per key/tier.[^openai-ratelimits] TPM binds first for context-heavy routes — check both.
3. **Headroom:** peak demand ≤ 60% of quota (retries, spikes, and growth eat the rest); if not, raise tiers, split workloads across keys, shed to batch ([api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md)), or shrink prompts (rag-01's curation pays capacity too).
4. **Client-side shaping:** token-budget throttles in the gateway *under* the quota — provider 429s are the backstop, not the mechanism. Retries: exponential + jitter, bounded budgets, respect `retry-after`.[^anthropic-errors]
5. **Batch relocation test:** anything with "nobody waiting" semantics goes to the batch tier — recheck this classification at every capacity review; workloads drift interactive-ward by default.

## Procedure: config deploy

The eng-04 lifecycle as steps (a prompt/params/schema change — behavior deploy, code unchanged):

1. Branch; edit the registry unit; PR with the semantic diff described in the description (what behavior should change).
2. Smoke suite runs as a required check — blocking, minutes ([evl-06](../modules/05-evaluation/evl-06-ci-for-llm-apps.md)).
3. Full suite pre-merge (batch tier) for anything touching a high-traffic route; reviewer reads the *sliced* diff, not the aggregate ([evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md)).
4. Merge → canary at 5–10% with online sampling ([evl-05](../modules/05-evaluation/evl-05-online-evaluation.md)) for one traffic cycle; watch the eng-04 alert set (cost/task, truncation, retry, refusal rates).
5. Promote; update the eval baseline to the new config hash. Rollback at any step = revert the registry commit.
6. **Cache note:** stable-prefix changes invalidate caches ([api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md)) — deploy large-prefix routes at low-traffic windows and expect a TTFT/cost blip while caches re-warm; that blip is normal, alarm on it *persisting*.

## Procedure: model adoption

The [api-06](../modules/02-llm-apis/api-06-model-selection.md) process as deployment steps: pin the candidate in a parallel registry entry → deep-tier bake-off ([eng-07](eng-07-eval-checklists-debugging.md)'s checklist) → prompt re-tune pass where diffs demand → shadow (log-only) or canary → decision-log entry → staged rollout with the old pin warm → fallback rehearsal scheduled. Calendar discipline: deprecation dates tracked with a two-month runway;[^anthropic-deprecations-note] the forced same-week upgrade is the most preventable incident in this guide.

## Self-hosted addendum

Everything above plus, for vLLM-class serving ([api-07](../modules/02-llm-apis/api-07-local-inference.md), [prd-02](../modules/06-production/prd-02-inference-and-serving.md)):[^vllm-docs]

- **The "model version" is five things:** weights + quantization + engine version + serving config + chat template — pinned together, eval-gated together (api-07). Engine upgrades go through the *model-adoption* procedure, not the code-deploy one.
- **Capacity is memory math:** weights + KV cache × concurrency × context ([fnd-05](../modules/01-foundations/fnd-05-transformer-architecture.md)'s formula) with paged-cache headroom; enforce context limits at the gateway so one long request can't evict a fleet's caches.
- **Benchmark on your traffic shape** (prefill-heavy vs. decode-heavy) before capacity commitments; synthetic tokens/sec numbers mislead across workload shapes.
- **You emit the failure surface now:** health checks, request draining on deploys, and the 429-equivalent (queue-depth shedding) are yours to implement; and the provider safety stack is gone — [eng-09](eng-09-security-guidelines.md)'s self-hosted section applies from day one.

## Incident runbooks

The four recurring LLM production incidents, each with: stabilize → diagnose → fix → feed the flywheel.

**1. Provider outage / sustained overload.** Stabilize: circuit-break to the fallback chain ([eng-05](eng-05-design-patterns.md) #3) — second provider, smaller model, or the graceful-unavailability message; shed batch traffic entirely. Diagnose: provider status + your 5xx/529 rates by key. Fix: none on your side — this is weather. Afterward: if the fallback wasn't exercised recently and misbehaved, *that's* the action item ([prd-04](../modules/06-production/prd-04-reliability.md)).

**2. Cost spike, flat traffic.** Stabilize: identify the route via cost-per-task decomposition (the [eng-04](eng-04-llmops-stack.md) dashboard); if runaway (agent loops), tighten budget caps immediately ([eng-02](eng-02-agent-loop-architecture.md)). Diagnose in order: cache hit-rate drop (prefix churn from a recent config deploy) → output-length drift (model version or prompt change) → retry-rate rise → routing/cascade regression ([prd-05](../modules/06-production/prd-05-cost-engineering.md) decomposition). Fix: usually a config revert. Flywheel: add the cost regression as a CI-checked metric on that route.

**3. Quality regression reports.** Run [eng-07](eng-07-eval-checklists-debugging.md)'s first-fifteen-minutes procedure — trace, read the context, boring three, classify, blast radius — then its playbook table. Stabilize only if severity demands: revert the last config/adoption on the affected route (the deploy log makes "last change" a lookup). Flywheel: every confirmed case into the suite before ticket close.

**4. Rate-limit storm.** Stabilize: pause batch/backfill workloads sharing the key (should be impossible if keys are partitioned — if not, that's the real finding); verify retry jitter and budgets are functioning, not amplifying. Diagnose: which workload grew, and whether TPM or RPM bound. Fix: key partitioning, client-side shaping under quota, batch relocation, tier raise — in that order of preference.[^openai-ratelimits] Flywheel: capacity-arithmetic review with the new numbers.

> **Volatile:** quota structures, batch-tier semantics, and deprecation policies are per-provider, per-quarter facts — the procedures are stable, the numbers in them are not. Re-verify at the [fro-04](../modules/09-frontier/fro-04-staying-current.md) quarterly review.

## Related chapters

| Chapter | What it explains |
|---|---|
| [eng-04](eng-04-llmops-stack.md) | The stack these procedures operate |
| [api-01](../modules/02-llm-apis/api-01-llm-api-fundamentals.md) / [api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md) | Failure surface, retries, caching/batch mechanics |
| [api-06](../modules/02-llm-apis/api-06-model-selection.md) / [api-07](../modules/02-llm-apis/api-07-local-inference.md) | Adoption process; self-hosted stack specifics |
| [evl-05](../modules/05-evaluation/evl-05-online-evaluation.md) / [evl-06](../modules/05-evaluation/evl-06-ci-for-llm-apps.md) | Canary sampling; CI gate wiring |
| [prd-04](../modules/06-production/prd-04-reliability.md) / [prd-05](../modules/06-production/prd-05-cost-engineering.md) / [prd-06](../modules/06-production/prd-06-deployment-infrastructure.md) | Reliability, cost, and infrastructure at depth |

## Sources

[^openai-ratelimits]: [T1] OpenAI. "Rate limits." https://platform.openai.com/docs/guides/rate-limits (accessed 2026-07-10)
[^anthropic-errors]: [T1] Anthropic. "Errors." https://docs.anthropic.com/en/api/errors (accessed 2026-07-10)
[^vllm-docs]: [T1] vLLM. "Documentation." https://docs.vllm.ai/ (accessed 2026-07-10)
[^anthropic-deprecations-note]: [T1] Anthropic. "Model deprecations." https://docs.anthropic.com/en/docs/about-claude/model-deprecations (accessed 2026-07-10)
