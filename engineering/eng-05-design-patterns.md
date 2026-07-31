---
id: eng-05
title: "Production Design Patterns for LLM Applications"
module: engineering
prerequisites: [api-03, rag-01]
related_ids: [eng-01, eng-02, eng-03, eng-04, prd-01]
keywords:
  - design patterns
  - llm patterns
  - gateway pattern
  - cascade
  - validator
  - retry ladder
  - human gate
  - workflow vs agent
  - fallback chain
  - semantic cache
summary: >-
  The pattern catalog for production LLM systems: fourteen named, reusable
  solutions — gateway, cascade, typed boundary, retry ladder, stable-prefix
  layout, context assembler, retrieve-then-read, judge, human gate, fallback
  chain, workflow-over-agent, idempotent tool, compaction contract, shadow
  eval — each with problem, solution, when-not, and chapter cross-links.
difficulty: 3
est_minutes: 60
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources:
  - key: anthropic-agents
    tier: 4
    title: "Building effective agents"
    org: Anthropic
    url: https://www.anthropic.com/engineering/building-effective-agents
    accessed: 2026-07-10
  - key: anthropic-caching
    tier: 1
    title: "Prompt caching"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
    accessed: 2026-07-10
  - key: wang-sc
    tier: 2
    title: "Self-Consistency Improves Chain of Thought Reasoning in Language Models"
    org: arXiv
    url: https://arxiv.org/abs/2203.11171
    accessed: 2026-07-10
---

# Production Design Patterns for LLM Applications

Named solutions to recurring problems, in the classic pattern-catalog format: **problem → solution → use when → avoid when → chapters**. Every pattern here was derived in a chapter; the catalog exists so design reviews can say "cascade with a judge-gated escalation" instead of re-deriving it. Patterns compose — the reference architectures ([eng-01](eng-01-rag-pipeline-architecture.md), [eng-02](eng-02-agent-loop-architecture.md)) are compositions of exactly these.

## Access and routing patterns

**1. Gateway.** *Problem:* LLM calls scattered across a codebase make pinning, retries, logging, and migration shotgun surgery. *Solution:* one internal module owning model pins, retries+jitter, timeouts, usage/stop-reason logging, and (as they arrive) caching flags, routing, fallbacks. *Use when:* always — it is the day-one pattern everything else attaches to. *Avoid when:* never; right-size instead (a prototype's gateway is 100 lines). *Chapters:* [api-01](../modules/02-llm-apis/api-01-llm-api-fundamentals.md), [eng-04](eng-04-llmops-stack.md).

**2. Model cascade.** *Problem:* frontier pricing on traffic that is mostly easy. *Solution:* cheap model first; escalate on confidence signals (logprob gap — [fnd-08](../modules/01-foundations/fnd-08-sampling-and-decoding.md)), validation failure, or judge flag. Router itself is evaluated (escalation precision/recall). *Use when:* measured traffic shows a large easy majority; task value varies. *Avoid when:* uniform hard tasks; latency budgets that can't afford the escalation round-trip. *Chapters:* [api-06](../modules/02-llm-apis/api-06-model-selection.md).

**3. Fallback chain.** *Problem:* provider outages and rate limits are weather, not bugs. *Solution:* ordered alternatives (second provider / smaller model / cached response / graceful degradation message), each *eval-baselined and periodically exercised with trickle traffic* — an untested fallback is decorative. *Use when:* any user-facing SLO. *Avoid when:* the fallback's quality would be worse than honest unavailability (e.g. compliance-sensitive answers). *Chapters:* [prd-04](../modules/06-production/prd-04-reliability.md), api-06.

## Correctness patterns

**4. Typed boundary.** *Problem:* code consuming free text inherits parse failures and schema drift. *Solution:* constrained/structured output + one validator at the boundary (schema + business rules) — the type system extended across the model. Required-with-null fields make abstention visible. *Use when:* any machine-consumed output. *Avoid when:* genuinely open prose is the product (then validate properties, not shape). *Chapters:* [api-03](../modules/02-llm-apis/api-03-structured-outputs-tool-calling.md).

**5. Retry ladder with error feedback.** *Problem:* transient quality failures (invalid output, failed validation) are often self-correctable. *Solution:* on failure, re-ask once with the error appended; then fall back (decompose, human queue, default). Capped, logged, rate-alarmed — retry rate is a leading drift indicator. *Use when:* validation exists to define "failure." *Avoid when:* failures are systematic (fix the prompt/schema, don't pay retry tax forever). *Chapters:* api-03, [eng-04](eng-04-llmops-stack.md).

**6. Verifier sandwich.** *Problem:* model output feeding consequential actions with no independent check. *Solution:* wrap generation between cheap verifications — pre (input sanity) and post (execution for code, cross-field checks for extraction, resolve-and-verify for IDs, citation-resolution for claims). Route verification failures to the retry ladder or a human. *Use when:* verification is cheaper than the failure (fnd-09's verify-where-cheap doctrine). *Avoid when:* no oracle exists — then use pattern 8. *Chapters:* [fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md), api-03.

**7. Best-of-n / self-consistency.** *Problem:* single-sample reliability below requirement on a high-value step. *Solution:* n parallel samples; select by verifier/judge (best-of-n) or majority vote on final answers (self-consistency);[^wang-sc] log disagreement as an uncertainty signal. *Use when:* accuracy is worth n× cost on a *routed subset* (compose with pattern 2). *Avoid when:* as a default — linear cost for sublinear gain. *Chapters:* fnd-08.

**8. LLM judge.** *Problem:* quality dimensions (groundedness, tone, helpfulness) with no programmatic oracle. *Solution:* a pinned judge config scoring against a behavioral-checklist rubric, blinded to authorship/preference, calibrated against human labels on a standing cadence. *Use when:* subjective-quality gating or selection at scale. *Avoid when:* uncalibrated, or when a programmatic check exists (always prefer it). *Chapters:* [evl-03](../modules/05-evaluation/evl-03-llm-as-judge.md), [eng-03](eng-03-eval-harness-architecture.md).

## Context patterns

**9. Stable-prefix layout.** *Problem:* prompt assembly that defeats caching and buries instructions. *Solution:* frozen region order — system contract, tool schemas, exemplars, reference content, state, task — stable→volatile, no dynamic content in stable regions, instructions restated after long content.[^anthropic-caching] One ordering, three payoffs: cache hits, attention placement, diffability. *Use when:* always. *Avoid when:* never. *Chapters:* [api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md), [rag-01](../modules/03-retrieval/rag-01-context-engineering.md).

**10. Context assembler.** *Problem:* f-string prompt assembly hides budget overflows, dedup misses, and provenance loss. *Solution:* a component: (task, sources, budget config) → (messages, per-region metrics), enforcing token-exact budgets, dedup, placement, and provenance labels. *Use when:* more than one dynamic content source (i.e., almost immediately). *Avoid when:* single static prompt. *Chapters:* rag-01, [eng-01](eng-01-rag-pipeline-architecture.md).

**11. Compaction with survival contract.** *Problem:* growing histories/trajectories that overflow budgets or rot. *Solution:* capped growing region + explicit must-survive list — instructions re-pinned in stable regions, decisions extracted to structured state (data, not prose), the rest windowed/summarized at natural boundaries (cache-aware). *Use when:* any multi-turn or multi-step system. *Avoid when:* sessions are short enough to never compact (then just cap). *Chapters:* rag-01, [agt-04](../modules/04-agents/agt-04-memory-and-state.md), [eng-02](eng-02-agent-loop-architecture.md).

## Grounding and action patterns

**12. Retrieve-then-read.** *Problem:* the model's weights can't hold your private, fresh, or per-user facts (and hallucinate the gap). *Solution:* convert recall to transformation — retrieve relevant passages with provenance, assemble with placement discipline, generate answer-from-context-only with required citations and an abstention path. The field's highest-leverage reliability move. *Use when:* factual products over any owned corpus. *Avoid when:* tiny stable corpus + caching beats the pipeline (do the rag-01 arithmetic). *Chapters:* [rag-05](../modules/03-retrieval/rag-05-rag-pipeline.md), eng-01, fnd-09.

**13. Workflow over agent.** *Problem:* reaching for autonomous agency when the task's path is actually known. *Solution:* fixed pipelines of focused LLM steps (route → extract → transform → act) where *code owns the sequence* and each step is narrow, testable, and independently cacheable; reserve the open loop (eng-02) for genuinely dynamic paths.[^anthropic-agents] *Use when:* the decomposition is stable and known. *Avoid when:* the path genuinely depends on intermediate findings — then a real agent loop, budgeted. *Chapters:* [agt-01](../modules/04-agents/agt-01-agent-fundamentals.md), [api-02](../modules/02-llm-apis/api-02-prompt-engineering.md) (decomposition).

**14. Human gate + idempotent tool.** *Problem:* model-initiated actions with real-world consequences. *Solution:* the pair that makes action safe — privilege tiers routing consequential calls (money, deletion, external comms) to human confirmation with the trajectory attached; and every side-effecting tool idempotent (natural-key dedup) with least-privilege credentials, so retries and duplicates are harmless. *Use when:* any agent that mutates state. *Avoid when:* nothing — read-only agents are the only exemption, and only from the gate half. *Chapters:* [agt-09](../modules/04-agents/agt-09-agent-reliability.md), api-03, eng-02.

## Deployment patterns

**15. Shadow eval / canary.** *Problem:* offline evals can't fully predict behavior on live traffic distribution. *Solution:* run the candidate config against real traffic without serving it (shadow) or on a small served slice (canary), scored by online sampling + judges, gated before rollout; rollback = config revert. *Use when:* every config deploy and model adoption above smoke-level risk. *Avoid when:* traffic too low for signal — then lean harder on the offline suite. *Chapters:* [evl-05](../modules/05-evaluation/evl-05-online-evaluation.md), [evl-06](../modules/05-evaluation/evl-06-ci-for-llm-apps.md), eng-04.

> **Note:** the missing "pattern" people expect — *semantic caching* (serving cached responses to similar-enough requests) — is deliberately listed as a caution, not a recommendation: unlike KV prefix caching (correctness-free by construction — api-05), semantic caching trades correctness for cost via a similarity threshold, inheriting fnd-03's blind spots (negation, entity swaps). Adopt only with a staleness contract, per-route thresholds validated on your eval, and an invalidation story ([prd-05](../modules/06-production/prd-05-cost-engineering.md)).

## Composition: the standard assemblies

The architectures you'll actually build are stacks of the above — reading them as pattern compositions is the fastest design-review vocabulary:

| System | Composition |
|---|---|
| Knowledge assistant (eng-01) | Gateway + retrieve-then-read + assembler + stable-prefix + typed boundary (citations) + judge (groundedness sample) + shadow eval |
| Extraction pipeline | Gateway + typed boundary + retry ladder + verifier sandwich + cascade + batch tier |
| Agent (eng-02) | Gateway + assembler + compaction contract + typed boundary (tool calls) + human gate + idempotent tools + budget termination + fallback chain |
| Eval harness (eng-03) | Gateway + typed boundary (judge outputs) + judge + best-of-n (n-runs) + batch tier |

## Related chapters

| Chapter | What it explains |
|---|---|
| [api-01](../modules/02-llm-apis/api-01-llm-api-fundamentals.md) / [api-03](../modules/02-llm-apis/api-03-structured-outputs-tool-calling.md) / [api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md) | Gateway, typed boundary + retry ladder, stable-prefix mechanics |
| [rag-01](../modules/03-retrieval/rag-01-context-engineering.md) / [rag-05](../modules/03-retrieval/rag-05-rag-pipeline.md) | Assembler, compaction, retrieve-then-read |
| [fnd-08](../modules/01-foundations/fnd-08-sampling-and-decoding.md) / [fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md) | Confidence signals, best-of-n, verify-where-cheap doctrine |
| [agt-01](../modules/04-agents/agt-01-agent-fundamentals.md) / [agt-09](../modules/04-agents/agt-09-agent-reliability.md) | Workflow-vs-agent boundary, human gates |
| [evl-03](../modules/05-evaluation/evl-03-llm-as-judge.md) / [evl-05](../modules/05-evaluation/evl-05-online-evaluation.md) / [evl-06](../modules/05-evaluation/evl-06-ci-for-llm-apps.md) | Judge, shadow/canary, gate policies |
| [prd-04](../modules/06-production/prd-04-reliability.md) / [prd-05](../modules/06-production/prd-05-cost-engineering.md) | Fallback chains, semantic-cache economics |

## Sources

[^anthropic-agents]: [T4] Anthropic (2024). "Building effective agents." Anthropic Engineering. https://www.anthropic.com/engineering/building-effective-agents (accessed 2026-07-10)
[^anthropic-caching]: [T1] Anthropic. "Prompt caching." https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching (accessed 2026-07-10)
[^wang-sc]: [T2] Wang et al. (2022). "Self-Consistency Improves Chain of Thought Reasoning in Language Models." arXiv:2203.11171. https://arxiv.org/abs/2203.11171 (accessed 2026-07-10)
