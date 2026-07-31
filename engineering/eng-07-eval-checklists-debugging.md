---
id: eng-07
title: "Evaluation Checklists & Debugging Playbook"
module: engineering
prerequisites: [evl-01]
related_ids: [eng-03, evl-02, evl-03, evl-06, fnd-09]
keywords:
  - eval checklist
  - debugging playbook
  - triage
  - launch checklist
  - model adoption checklist
  - failure taxonomy
  - llm debugging
  - quality regression
summary: >-
  The operational checklists — eval design, feature launch, model adoption —
  and the master debugging playbook: a symptom-indexed triage tree that unifies
  the failure maps from across the curriculum, plus the first-fifteen-minutes
  procedure for any LLM quality incident.
difficulty: 2
est_minutes: 45
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources:
  - key: anthropic-evals
    tier: 1
    title: "Create strong empirical evaluations"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/build-with-claude/develop-tests
    accessed: 2026-07-10
  - key: husain-evals
    tier: 5
    title: "Your AI Product Needs Evals"
    org: Hamel Husain
    url: https://hamel.dev/blog/posts/evals/
    accessed: 2026-07-10
---

# Evaluation Checklists & Debugging Playbook

The curriculum's quality doctrine ([evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md)) compressed into artifacts you use at the moment of need: three checklists (print them into your PR templates) and one master triage playbook (pin it in the on-call runbook). Every line links back to the chapter that explains *why* it's on the list.

## Checklist: designing an eval

- [ ] Cases written **before** the feature was built, from the spec ([evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md))
- [ ] Composition: representative of real traffic + hard tail + abstention cases ([fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md))
- [ ] Every case has `category` (for slicing), `source` (provenance), `difficulty` ([eng-03](eng-03-eval-harness-architecture.md) data model)
- [ ] Scoring: cheapest method that captures "good" — programmatic first; judge only with a human-validated checklist rubric ([evl-03](../modules/05-evaluation/evl-03-llm-as-judge.md))
- [ ] Output designed to be checkable (schema, required citations) so scoring *can* be programmatic ([api-03](../modules/02-llm-apis/api-03-structured-outputs-tool-calling.md))
- [ ] n-runs configured for anything flaky-adjacent; deltas judged by case-flip arithmetic, never single runs ([fnd-08](../modules/01-foundations/fnd-08-sampling-and-decoding.md))
- [ ] A held-out partition exists and is excluded from all prompt iteration ([evl-02](../modules/05-evaluation/evl-02-eval-datasets.md))
- [ ] No eval case appears in any prompt as a few-shot example (self-contamination — evl-01)
- [ ] Baseline recorded with the system-config hash before any iteration begins
- [ ] The suite still has failing cases — a saturated suite is a broken instrument (evl-01)

## Checklist: launching an LLM feature

- [ ] Eval suite green at agreed thresholds, sliced — no category regressions hiding under the aggregate ([evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md))
- [ ] `stop_reason` checked and `usage` logged on every call path ([api-01](../modules/02-llm-apis/api-01-llm-api-fundamentals.md))
- [ ] Model version pinned; sampling params explicit per task class ([fnd-08](../modules/01-foundations/fnd-08-sampling-and-decoding.md))
- [ ] Typed boundary + retry ladder on machine-consumed outputs ([api-03](../modules/02-llm-apis/api-03-structured-outputs-tool-calling.md); [eng-05](eng-05-design-patterns.md) #4–5)
- [ ] Abstention path designed, tested, and *measured* (missed- and false-abstention — fnd-09)
- [ ] Context assembly budgeted with per-region logging; prompts in stable-prefix order ([rag-01](../modules/03-retrieval/rag-01-context-engineering.md), [api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md))
- [ ] Injected content delimited; injection basics reviewed per [eng-09](eng-09-security-guidelines.md)
- [ ] Cost per task computed from measured tokens; dashboards + alerts from the [eng-04](eng-04-llmops-stack.md) starter table wired
- [ ] Failure UX decided: refusals, timeouts, mid-stream errors, "couldn't find it" all have product behavior, not just error logs
- [ ] Fallback behavior defined (even if it's a graceful unavailability message — [prd-04](../modules/06-production/prd-04-reliability.md))
- [ ] For agents additionally: privilege-tier table written, budgets set, idempotency on side-effecting tools, human gates on consequential actions ([eng-02](eng-02-agent-loop-architecture.md))

## Checklist: adopting a model version

- [ ] Trigger logged (release / price / deprecation / capability-map candidate — [api-06](../modules/02-llm-apis/api-06-model-selection.md))
- [ ] Deep-tier suite run: task evals + behavioral probes (refusal rate, format compliance, verbosity) + capability map ([eng-03](eng-03-eval-harness-architecture.md) tiers; [fnd-07](../modules/01-foundations/fnd-07-post-training.md) drift)
- [ ] Latency (TTFT + total, P50/P99) and cost-per-task measured at production prompt shapes — not quoted numbers
- [ ] Prompts re-tuned where the diff demanded it, changes eval-verified ([api-02](../modules/02-llm-apis/api-02-prompt-engineering.md) migration pass)
- [ ] Token-denominated calibrations re-checked: counts, budgets, chunk sizes, truncation limits ([fnd-04](../modules/01-foundations/fnd-04-tokenization.md))
- [ ] Judges: if the judge model changes, baselines re-anchored (a judge change is a suite migration — eng-03)
- [ ] Canary slice with online sampling before full rollout ([evl-05](../modules/05-evaluation/evl-05-online-evaluation.md))
- [ ] Old pin kept warm as fallback; decision-log entry written with re-evaluation triggers (api-06)

## The debugging playbook

The master triage tree — unifying the failure maps of eng-01/02/03/04 and the chapters. Start from the symptom; each row names the mechanism chapter and the *first* diagnostic (cheapest decisive check).

**Quality symptoms**

| Symptom | Ordered suspects | First diagnostic |
|---|---|---|
| Confident wrong answers | Missing grounding ([fnd-06](../modules/01-foundations/fnd-06-llm-pretraining.md)) → retrieval precision (eng-01) → sycophancy ([fnd-07](../modules/01-foundations/fnd-07-post-training.md)) | Read 5 failing transcripts: is the right information in the context at all? |
| Right info in context, ignored | Mid-context burial ([rag-01](../modules/03-retrieval/rag-01-context-engineering.md)) → budget overflow → instruction conflict | Passage position audit; per-region token logs |
| Inconsistent outputs run-to-run | Sampling params ([fnd-08](../modules/01-foundations/fnd-08-sampling-and-decoding.md)) → ambiguous prompt ([api-02](../modules/02-llm-apis/api-02-prompt-engineering.md)) | Check temperature vs. task class; then 5-run spread on one input |
| Sudden behavior change, no deploy | Unpinned model alias ([api-01](../modules/02-llm-apis/api-01-llm-api-fundamentals.md)) → provider-side change → input-mix shift | Pin audit; diff logged outputs on identical historical inputs |
| Counting/spelling/number errors | Tokenization ([fnd-04](../modules/01-foundations/fnd-04-tokenization.md)) — delegate to tools, don't prompt harder | Tokenize the failing input and look |
| Quality degrades over long sessions | Context rot / history contamination (rag-01) | Per-turn quality sampling; check compaction policy and survival contract |
| Agent loops or repeats failing calls | Error not informative in-band → stall detection missing ([eng-02](eng-02-agent-loop-architecture.md)) | Read the trajectory: can the model see why the step failed? |
| Local model "worse than benchmarks" | Chat template → quantization → sampling defaults ([api-07](../modules/02-llm-apis/api-07-local-inference.md)) | Token-level template verification |

**Pipeline symptoms**

| Symptom | Ordered suspects | First diagnostic |
|---|---|---|
| Silent data loss / truncated outputs | `max_tokens` + unchecked stop reason (api-01) | Truncation-rate query over trace store |
| Parse failures rising | Model drift → schema too complex → naive JSON without constraints ([api-03](../modules/02-llm-apis/api-03-structured-outputs-tool-calling.md)) | Retry-rate trend; sample the failing raw outputs |
| Retrieval finds nothing it should | Chunk boundaries ([rag-04](../modules/03-retrieval/rag-04-chunking.md)) → embedding mismatch ([fnd-03](../modules/01-foundations/fnd-03-embeddings.md)) → ACL over-filter | Query the index directly for a known-good passage |
| Quality cliff after infra work | Mixed embedding versions (fnd-03) → template/config drift | `embedding_model_version` distribution; config-hash diff |
| Cost spike, flat traffic | Cache hit-rate drop → verbosity drift → routing regression ([api-05](../modules/02-llm-apis/api-05-streaming-caching-batch.md), [prd-05](../modules/06-production/prd-05-cost-engineering.md)) | Cached-token dashboard; cost-per-task decomposition by route |
| 429 storms | Retry amplification → workload/quota mismatch (api-01) | Retry-budget audit; move bulk work to batch tier |
| Eval green, users unhappy | Easy-case suite → harness/prod config drift → missing slice ([eng-03](eng-03-eval-harness-architecture.md)) | Case `source:` distribution; config-hash comparison |

## The first fifteen minutes

For any "the AI is broken" report, in order — the procedure exists because steps 1–3 resolve most incidents and everyone skips them under pressure:

1. **Reproduce with the trace, not the anecdote:** pull the exact request from the trace store ([evl-04](../modules/05-evaluation/evl-04-tracing-observability.md)) — full context, config hash, usage, stop reason. Most reports transform on contact with the actual transcript.
2. **Read what the model actually saw.** Not the template — the assembled context. Missing/buried/drowned information explains the plurality of quality incidents (rag-01).
3. **Check the boring three:** stop reason (truncation?), config hash vs. expected (silent deploy? alias drift?), and the incident's start time against the deploy/adoption log (eng-04's lifecycles make this a lookup).
4. **Classify the failure** by the fnd-09 taxonomy — knowledge / precision / capability / spec — which names the owning layer and prevents the classic waste (prompt-tuning a retrieval bug).
5. **Check blast radius statistically:** is this one input, a category, or everything? One trace-store query by category; determines severity and rules out half the suspects.
6. **Then** open the playbook table above with a symptom, a scope, and a transcript in hand.

And the closing discipline: **every confirmed incident becomes an eval case** (`source: production`) before the ticket closes — the flywheel ([eng-03](eng-03-eval-harness-architecture.md)) is fed by exactly this moment.

## Related chapters

| Chapter | What it explains |
|---|---|
| [evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md) | The doctrine behind every checklist line |
| [evl-02](../modules/05-evaluation/evl-02-eval-datasets.md) / [evl-03](../modules/05-evaluation/evl-03-llm-as-judge.md) | Dataset hygiene; judge calibration referenced in the adoption checklist |
| [evl-06](../modules/05-evaluation/evl-06-ci-for-llm-apps.md) | Wiring these checklists into CI gates |
| [fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md) | The failure taxonomy step 4 applies |
| [eng-03](eng-03-eval-harness-architecture.md) / [eng-04](eng-04-llmops-stack.md) | The harness and trace infrastructure the playbook assumes |

## Sources

[^anthropic-evals]: [T1] Anthropic. "Create strong empirical evaluations." https://docs.anthropic.com/en/docs/build-with-claude/develop-tests (accessed 2026-07-10)
[^husain-evals]: [T5 — practitioner canon; no higher-tier source covers the workflow this concretely] Husain, H. (2024). "Your AI Product Needs Evals." https://hamel.dev/blog/posts/evals/ (accessed 2026-07-10)
