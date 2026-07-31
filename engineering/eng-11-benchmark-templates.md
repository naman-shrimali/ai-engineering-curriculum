---
id: eng-11
title: "Benchmark Comparison Templates"
module: engineering
prerequisites: [api-06, evl-01]
related_ids: [eng-03, eng-10, fnd-09, api-07]
keywords:
  - benchmark template
  - bake-off
  - model comparison
  - decision log
  - capability map
  - latency measurement
  - cost per task
  - behavioral probes
summary: >-
  Fill-in templates for the model bake-off: constraint filter, candidate
  matrix, quality/latency/cost measurement tables, behavioral probes,
  capability-map re-run, and the decision-log entry — the api-06 selection
  process as paperwork, so comparisons are auditable and repeatable instead
  of re-invented per decision.
difficulty: 2
est_minutes: 30
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources:
  - key: anthropic-models
    tier: 1
    title: "Models overview"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/about-claude/models/overview
    accessed: 2026-07-10
  - key: chiang-arena
    tier: 2
    title: "Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference"
    org: arXiv
    url: https://arxiv.org/abs/2403.04132
    accessed: 2026-07-10
---

# Benchmark Comparison Templates

The [api-06](../modules/02-llm-apis/api-06-model-selection.md) selection process as copy-paste paperwork. Rules of engagement, restated once: public benchmarks and arenas *shortlist only*[^chiang-arena] ([fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md)'s contamination/saturation argument); your suite decides; every number below is measured at your prompt shapes via the harness ([eng-03](eng-03-eval-harness-architecture.md)), n-run, against a recorded baseline. Copy the whole file per bake-off into your decision-log directory; a comparison without this paperwork is a vibe with a date on it.

## 1. Bake-off header

```text
Bake-off ID:        BO-YYYY-MM-DD-<route>
Trigger:            release | price change | deprecation | capability candidate | scale doubling
Route(s) affected:  <route ids>            Owner: <name>       Date: <date>
Incumbent config:   <registry hash>        Baseline suite run: <run id>
Decision deadline:  <date>                 (deprecation runway if applicable)
```

## 2. Constraint filter (eliminates before any benchmark)

| Requirement | Threshold | Candidate A | Candidate B | Candidate C |
|---|---|---|---|---|
| Modality (text/vision/audio) | required set | pass/fail | | |
| Context (usable at our P95 prompt size) | ≥ ___ tokens | | | |
| Structured outputs / tool calling / caching / batch | required features | | | |
| Data-use & residency terms | legal sign-off | | | |
| License (open-weight candidates) | commercial clearance | | | |
| Deprecation policy | ≥ ___ months notice | | | |

*Include at least one candidate a tier below instinct — the mid-tier upset is the base case (api-06).*

## 3. Quality: the suite, sliced

Run the deep tier (eng-03): full task suite + behavioral probes, n=5, batch API.

| Metric (per category) | Incumbent | Cand. A | Cand. B | Δ best vs. incumbent | Flip-count sanity* |
|---|---|---|---|---|---|
| <category 1> pass rate ± spread | | | | | |
| <category 2> … | | | | | |
| Abstention precision / recall | | | | | |
| Aggregate (distrust it) | | | | | |

*\*Case-flip arithmetic per [evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md): a delta smaller than ~2× the n-run spread, or a handful of case flips, is noise — mark it "indistinguishable," which is a finding, not a failure.*

**Behavioral probes** (the [fnd-07](../modules/01-foundations/fnd-07-post-training.md) drift set): refusal rate on borderline-benign inputs ___ / format compliance under our schemas ___ / verbosity (output tokens on fixed tasks) ___ / injection-basics resilience ([eng-09](eng-09-security-guidelines.md) red-team subset) ___.

**Capability-map re-run** ([fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md)): failed-task list against each candidate — crossings: ___ (each crossing is a roadmap event, log it regardless of the selection outcome).

## 4. Latency and cost, measured

At production prompt shapes (real assembled contexts from the trace store, not toy prompts):

| Measure | Incumbent | Cand. A | Cand. B | Notes |
|---|---|---|---|---|
| TTFT P50 / P99 (cache-cold) | | | | prefill behavior |
| TTFT P50 / P99 (cache-warm) | | | | caching semantics differ per provider |
| Tokens/sec decode | | | | |
| Output tokens on fixed tasks | | | | verbosity → cost |
| **Cost per task** (the eng-10 formula: retries + cache mix in) | | | | never sticker per-token price |
| Reasoning-token consumption (if applicable) | | | | effort-dial setting recorded |

## 5. Decision-log entry

```text
Decision:      adopt <candidate> on <routes> | keep incumbent | split (cascade: <cheap> → <escalation>)
Pinned as:     <exact model version + registry hash>
Rationale:     <3 sentences: which criteria decided, which were indistinguishable>
Runner-up:     <candidate> — wired as fallback: yes/no; exercised via: <trickle % or schedule>
Prompt re-tune: needed on <routes> — eval-verified diffs attached: <links>
Rollout:       canary <X>% for <period> → staged; rollback = registry revert to <hash>
Re-evaluation triggers: <releases in tier / price ±20% / deprecation notice / capability crossings / date>
Capability crossings logged: <ids> → roadmap tickets: <links>
```

## 6. Variant: quantization / engine bake-off (self-hosted)

Same paperwork, different candidate axis ([api-07](../modules/02-llm-apis/api-07-local-inference.md) — every row is a "model version"): candidates = (weights × quantization × engine version × serving config), constraint filter gains VRAM/hardware rows, cost-per-task becomes cost-per-task-at-measured-utilization, and section 4 adds concurrency: tokens/sec at 1 / 8 / 32 parallel requests at your P95 context. Template-mismatch check ([api-07](../modules/02-llm-apis/api-07-local-inference.md)'s first suspect) runs *before* any quality numbers are recorded.

> **Volatile:** the template's rows are stable; everything filled into them — prices, models, quotas, feature support — is quarterly-perishable, which is precisely why the header carries dates and the decision log carries re-evaluation triggers ([fro-04](../modules/09-frontier/fro-04-staying-current.md)).

## Related chapters

| Chapter | What it explains |
|---|---|
| [api-06](../modules/02-llm-apis/api-06-model-selection.md) | The selection process this paperwork implements |
| [evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md) | Statistical honesty rules (n-runs, flip counts, slicing) |
| [eng-03](eng-03-eval-harness-architecture.md) | The harness and deep-tier suite that produce section 3 |
| [eng-10](eng-10-cost-optimization.md) | The cost-per-task formula behind section 4 |
| [fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md) | Benchmark literacy and the capability map |
| [api-07](../modules/02-llm-apis/api-07-local-inference.md) | The self-hosted variant's candidate axis |

## Sources

[^anthropic-models]: [T1] Anthropic. "Models overview." https://docs.anthropic.com/en/docs/about-claude/models/overview (accessed 2026-07-10)
[^chiang-arena]: [T2] Chiang et al. (2024). "Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference." arXiv:2403.04132. https://arxiv.org/abs/2403.04132 (accessed 2026-07-10)
