---
id: api-06
title: "The Model Landscape & Selection"
module: llm-apis
prerequisites: [api-01, fnd-09]
related_ids: [api-07, prd-05, ftn-06, fro-04]
keywords:
  - model selection
  - model landscape
  - frontier models
  - open weights
  - model routing
  - price performance
  - model migration
  - deprecation
  - model evaluation
summary: >-
  How to choose models without believing marketing: the stable axes of the
  landscape (capability tier, openness, reasoning, modality, context), the
  selection criteria beyond benchmarks (latency, cost, license, governance,
  deprecation), and the repeatable process — shortlist publicly, decide on
  private evals, log the decision, and design for the migration you will
  eventually make.
difficulty: 2
est_minutes: 180
status: evolving
volatility: volatile
last_reviewed: 2026-07-09
sources:
  - key: openai-models
    tier: 1
    title: "Models overview"
    org: OpenAI
    url: https://platform.openai.com/docs/models
    accessed: 2026-07-09
  - key: anthropic-models
    tier: 1
    title: "Models overview"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/about-claude/models/overview
    accessed: 2026-07-09
  - key: gemini-models
    tier: 1
    title: "Gemini models"
    org: Google
    url: https://ai.google.dev/gemini-api/docs/models
    accessed: 2026-07-09
  - key: chiang-arena
    tier: 2
    title: "Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference"
    org: arXiv
    url: https://arxiv.org/abs/2403.04132
    accessed: 2026-07-09
  - key: anthropic-deprecations
    tier: 1
    title: "Model deprecations"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/about-claude/model-deprecations
    accessed: 2026-07-09
---

# The Model Landscape & Selection

"Which model should we use?" is the question every AI engineering team answers repeatedly — at project start, at every provider release, at every cost review — and it is systematically answered badly: by leaderboard rank, by brand familiarity, by whatever the last demo used. This chapter gives you the stable axes along which models differ, the selection criteria that actually predict production success (your eval, latency, cost, license, governance, and deprecation policy — roughly in that order), and the repeatable process that converts a marketing-saturated landscape into an engineering decision with a paper trail. The landscape itself is the most volatile subject in this repo — model names in this chapter would be stale by your first review cycle, so there are none; the axes, criteria, and process are the durable content, and they have survived every generation so far.

## Intuition: buying capability, not a brand

The commodity being purchased is **capability per dollar per millisecond, under your constraints** — nothing else. Two framings keep the decision honest:

First, **models are components, not platforms.** You are not "choosing a side"; you are populating a slot behind the gateway interface you built in api-01 — a slot you will re-populate several times over a product's life, because the price-performance frontier moves quarterly and deprecations are contractual reality.[^anthropic-deprecations] Teams that treat selection as a marriage over-invest in the choice and under-invest in the migration machinery; teams that treat it as procurement with a re-bid cycle get both right.

Second, **the frontier is jagged per-model too** (fnd-09, one level up): each model has its own capability fingerprint — a function of its training mixture and post-training choices (fnd-06/fnd-07) — so "best model" is meaningless without "at what?" A model that tops coding evals can trail at multilingual extraction; the mid-tier model can beat the frontier one *on your task* at a tenth the price. This is not an edge case; it is the common case, and it is why the private eval — not the leaderboard — makes the call.

## The axes of the landscape

Model names churn; these axes have been stable for years and organize any generation of the landscape:[^openai-models][^anthropic-models][^gemini-models]

- **Capability tier:** every provider ships a family ladder — frontier (maximum capability, price, latency), mid-tier (most production workloads), small/fast (classification, routing, high-QPS simple tasks). The overtraining economics of fnd-06 keep pushing yesterday's frontier capability into today's mid-tier — the single most exploitable trend in the landscape.
- **Openness:** proprietary API-only vs. **open-weight** (downloadable weights, self-hostable — api-07). Note the precision: open *weight* is not open *source* — most open models ship weights under custom licenses with use restrictions, without training data or recipes. License reading is part of selection (below).
- **Reasoning vs. standard:** reasoning-trained models (fnd-07) trade tokens and latency for accuracy on hard problems, often with effort controls. This is a *per-task* choice, not a per-product one — the routing section's subject.
- **Modality:** text-only vs. vision vs. audio-native vs. video (api-04) — a hard constraint filter, applied first.
- **Context length:** advertised maxima vary widely; usable quality at length varies more (fnd-05's lost-in-the-middle) — treat advertised context as a claim your eval verifies, not a spec.
- **Specialization:** code-tuned, embedding (fnd-03), moderation, and domain models — narrower and often better *and* cheaper inside their lane.

> **Volatile:** which providers lead on which axis, tier pricing, and family naming all churn quarterly. Consult provider model pages at decision time[^openai-models][^anthropic-models][^gemini-models] — and treat third-party aggregator dashboards as convenient but unaudited.

## Selection criteria beyond the benchmark

The criteria that predict production success, with the failure each guards against:

1. **Performance on *your* eval** — the non-negotiable centerpiece (fnd-09's argument: contamination, saturation, and distribution mismatch break public-benchmark inference; human-preference leaderboards like Chatbot Arena measure *chat preference*, which is real signal but not your workload[^chiang-arena]). Field-level, behavior-inclusive (refusals, format compliance), n-run (fnd-08).
2. **Latency profile** — TTFT and tokens/sec (fnd-05) at *your* prompt sizes, measured, not quoted; P99 matters more than mean for UX. Reasoning models add thinking-time variance that averages hide.
3. **Total cost** — input/output/cached pricing (api-05) × your measured token distribution, plus the reasoning-token multiplier where applicable. Compute cost-per-*task*, never per-token: a pricier model that needs no retries and shorter prompts can win the arithmetic.
4. **License and terms** — for open weights: commercial-use clauses, scale thresholds, redistribution rules. For APIs: data-use policies (training on your inputs?), retention, residency options — often the deciding criterion in regulated industries (sec-03).
5. **Operational posture** — rate-limit headroom for your growth, SLA reality, deprecation policy and history[^anthropic-deprecations] (a provider that sunsets models on short windows is levying a recurring migration tax), region availability, support.
6. **Ecosystem fit** — feature support your architecture needs: strict structured outputs (api-03), caching semantics (api-05), batch tiers, fine-tuning availability (module 8).

Weight these per product. A consumer chat app weights latency and cost; a healthcare extractor weights governance and abstention behavior; an agent platform weights tool-calling reliability above raw intelligence.

## The selection process

The repeatable four-step, one to two weeks at product start and days thereafter:

1. **Constraint filter:** modality, context, governance, license, feature requirements — hard requirements eliminate most of the field in an hour of documentation reading.
2. **Shortlist by public signal:** 2–4 candidates across tiers (always include one tier below your instinct — the mid-tier surprise is the common case). Public benchmarks and arenas are *shortlisting* instruments;[^chiang-arena] this is the only step they participate in.
3. **Private bake-off:** your eval suite (the api-02/api-03 evals you already built), plus measured latency at production prompt shapes, plus cost-per-task arithmetic from real token counts. Include behavioral checks: refusal rate on your traffic, format compliance, injection resilience (sec-01's basics).
4. **Decide and log:** the decision log from fnd-01 — candidates, eval scores, measured latency/cost, criteria weights, the choice, and the *re-evaluation trigger* (a provider release, a price change, a quarterly review). The log converts future re-decisions from politics into diffs.

The output is not just a model: it's a *pinned version* (api-01), a baseline eval record (the regression anchor for evl-06), and a documented second choice (your fallback candidate for prd-04).

## Portfolios and routing

Mature products don't run one model; they run a **portfolio**:

- **Task-tier routing:** classification and routing calls on a small model, main workloads mid-tier, hard reasoning steps on frontier/reasoning models (the fnd-07 example: route the flagged 15% to expensive thinking). The gateway (api-01) is where routing lives; the router itself can be a cheap classifier or rules.
- **Cascades:** try cheap first, escalate on low confidence (logprob gaps — fnd-08), validation failure (api-03's ladder), or judge rejection. Cascades convert the jagged frontier into economics: pay frontier prices only for frontier-hard inputs.
- **Fallbacks:** a second provider wired and *periodically exercised* for outage resilience (prd-04) — untested fallbacks are decorative.
- **The complexity tax is real:** every added model multiplies eval surfaces, prompt calibrations (api-02's migration lesson — prompts don't transfer intact), and behavioral quirks. Start with one model per task class; add portfolio structure when the cost or reliability arithmetic demands it, not preemptively (fnd-01's premature-depth warning).

## Production engineering perspective

- **Design for migration from day one** — because the frontier moves faster than your roadmap. Concretely: gateway abstraction (api-01), principle-based prompts over quirk exploitation (api-02), provider-agnostic schemas where possible (api-03), your eval suite as the portable definition of "works." Migration cost is a *design outcome*, not a fixed tax: well-factored teams re-platform in days, quirk-coupled teams in months.
- **Deprecation is a calendar item:** track announced sunsets for every pinned version;[^anthropic-deprecations] budget the eval-gated upgrade (evl-06) each cycle. The upgrade you're forced into at deadline is the one that ships regressions.
- **Re-run the bake-off on triggers, not vibes:** major releases in your tiers, price moves >20%, your own scale doubling (rate limits, batch economics shift), or a capability-map crossing (fnd-09's living map detecting that a previously-failed task now passes on a candidate).
- **Watch cost-per-task drift:** model behavior changes (fnd-07) shift output lengths and retry rates — the same pinned model can quietly cost more per task after a prompt or traffic change. The api-01 usage logs make this a dashboard, not an archaeology project (prd-05 formalizes).
- **Negotiate like infrastructure:** at volume, committed-use discounts, dedicated capacity, and enterprise terms (retention, residency) are all on the table — selection criteria 4 and 5 become procurement leverage.

## Historical evolution

**2020–2022:** one real choice — the API era began as a monopoly, and "selection" meant prompt design. **2023:** the field opens — credible second providers, the first strong open-weight families, and the tier ladder appears; selection becomes a real decision, mostly made badly (leaderboard-driven). **2024–2025:** commoditization pressure — capability gaps between top providers narrow on common tasks, price-performance becomes the battleground, mid-tier models absorb yesterday's frontier, reasoning models split the landscape along a new axis, and routing/cascade patterns mature from exotic to standard. **The through-line:** every year, the "which model" decision matters *less* per-choice (closer substitutes, better abstractions) and *more* in aggregate (more re-decisions, bigger portfolios) — which is exactly why the durable investment is the process and the eval, not the pick.

## Common misconceptions

- **"Pick the best model and move on."** Best-at-what, at-what-price, for-how-long? Selection is a recurring process with triggers, not an event with a winner.
- **"The leaderboard settles it."** Public benchmarks shortlist; contamination, saturation, and distribution mismatch (fnd-09) — plus arena scores measuring chat preference rather than your workload[^chiang-arena] — mean they cannot decide. The mid-tier-beats-frontier-on-your-task result is *routine*.
- **"Open weight = free."** Weights are free; serving them is not (api-07's TCO), and licenses carry restrictions that legal review, not vibes, must clear. "Open" is a governance property, not a price.
- **"Frontier models are always worth it."** For most production task classes, mid-tier models pass the same evals at a fraction of cost and latency. The frontier premium buys the hard tail — route it there (cascades), don't default to it.
- **"Switching providers is a rewrite."** Only if you built it that way. Gateway + portable prompts + your eval as the acceptance test = days. The rewrite risk is a design smell, not a landscape fact.
- **"Our provider would never deprecate the model we depend on."** Every provider publishes deprecation policies because every provider deprecates.[^anthropic-deprecations] Pin versions, track sunsets, rehearse upgrades.

## Failure modes and trade-offs

- **Leaderboard-driven selection** → production underperformance discovered post-launch. *Fix:* private bake-off as a gate, always.
- **Frontier-by-default** → 5–20× cost for margins your eval shows are zero on most traffic. *Fix:* include the lower tier in every bake-off; cascade the hard tail.
- **Quirk coupling** → prompts and parsers welded to one model's behaviors; migration becomes a quarter-long project at deprecation deadline. *Trade-off:* peak single-model tuning vs. portability — production favors portability (api-02's brittleness lesson at portfolio scale).
- **Portfolio sprawl** → five models, five eval surfaces, five sets of quirks, one team. *Fix:* portfolio complexity must pay measured rent (cost or reliability); consolidate otherwise.
- **Stale selection** → the pick was right in Q1, the frontier moved, nobody re-ran the bake-off; you're overpaying or underperforming by Q4. *Fix:* triggers on the calendar and on the capability map.
- **Terms drift** → data-use or pricing terms change under you. *Fix:* selection criteria 4–5 are monitored properties, not one-time checks (fro-04's changelog habit).

## Best practices

- **Maintain the eval suite as the selection instrument** — it is simultaneously your bake-off harness, regression gate (evl-06), and migration acceptance test. This triple duty is why evals are the moat (evl-01, next).
- **Always bake off one tier down** from your instinct; make the expensive model earn its premium on your data.
- **Compute cost-per-task from logged usage,** including retries and reasoning tokens — never compare per-token sticker prices.
- **Keep a decision log with re-evaluation triggers;** put deprecation dates on the team calendar.
- **Pin versions; adopt via eval gates; rehearse the fallback** quarterly (an unexercised fallback is a hope, not a plan).
- **Read the license and data-use terms before the bake-off,** not after the integration — governance criteria eliminate candidates cheapest at step one.
- **Route by task class when the arithmetic demands it;** resist portfolio sprawl before it does.

## Real-world examples

**The mid-tier upset.** A document-processing team assumes the frontier model for their extraction pipeline; the bake-off (30-doc field-level eval from api-03's mini-project) includes the same provider's mid-tier model as a control. Result: statistically indistinguishable field accuracy, 8× lower cost, 3× lower P99 latency — the task sits comfortably inside both models' capability (fnd-09's bands), so the premium bought nothing. Annualized saving: mid six figures. Time cost of including the control: one afternoon. This outcome is so common it should be your prior.

**The deprecation fire drill.** A team ignores a deprecation notice for eight months ("we'll get to it"); the sunset lands during their peak season; the forced same-week upgrade ships a refusal-behavior regression (fnd-07's drift) that the rushed eval missed, breaking a customer workflow. Post-mortem installs the machinery this chapter prescribes: sunset dates on the calendar with a two-month runway, upgrade-via-eval-gate as routine, and a standing fallback model *kept warm* with 1% of traffic. The next deprecation is a non-event — a diff in the decision log.

**The cascade that funded a feature.** An analytics assistant runs everything on a reasoning model ("quality matters"). Usage logs show 70% of queries are simple lookups the small model answers identically (verified by a two-week shadow eval — both models run, judge compares). A confidence-gated cascade (small model first; escalate on logprob gap or judge flag) cuts model spend 60% with no measured quality change — and the freed budget pays for the eval infrastructure the team had been deferring. Routing turned the jagged frontier from a risk into a margin.

## Interview questions

1. **"Walk me through choosing a model for a new production feature."** — Model answer: constraint filter first — modality, context, governance, license, required API features — which eliminates most candidates from documentation alone. Shortlist 2–4 across capability tiers using public signals, explicitly including one tier below instinct. Private bake-off: my task eval (field-level, behavior-inclusive, n-run), measured TTFT/throughput at production prompt shapes, cost-per-task from real token counts. Decide, pin the version, log the decision with re-evaluation triggers, and record the runner-up as the wired fallback. Public numbers shortlist; private evals decide — because contamination, saturation, and distribution mismatch make leaderboards weak evidence for any specific workload.

2. **"Why do mid-tier models so often win in production?"** — Model answer: capability is jagged and task-relative — most production task classes (extraction, classification, grounded Q&A, routine drafting) sit well inside mid-tier capability, so frontier premiums buy accuracy the eval can't detect, while overtraining economics keep pushing last year's frontier quality into this year's cheap tier. Frontier models earn their price on the hard tail — long-horizon reasoning, novel synthesis — which is better served by routing that tail to them than by defaulting everything to them. The bake-off with a lower-tier control makes this an observation, not an opinion.

3. **"What does 'open weight' actually buy you, and what does it cost?"** — Model answer: buys — weights you can self-host (data residency, no per-token vendor margin at scale, no deprecation risk, deep customization including fine-tuning), and insulation from provider terms changes. Costs — serving infrastructure and ops burden (api-07's real TCO), typically a capability gap to frontier APIs, license restrictions that need legal reading (open weight ≠ open source — commercial clauses and scale thresholds are common), and you inherit the full reliability stack. The decision is workload-shaped: sustained high volume, hard governance constraints, or customization needs flip it; convenience and frontier capability keep API-first the default.

4. **"How do you keep model selection from becoming a recurring fire drill?"** — Model answer: make it a process with machinery. Gateway abstraction so models are swappable slots; principle-based prompts that migrate; the eval suite as a portable acceptance test; pinned versions with deprecation dates calendared and a two-month upgrade runway; a decision log with explicit re-evaluation triggers (releases in my tiers, >20% price moves, scale doublings, capability-map crossings); and a fallback model exercised with trickle traffic. Then a forced migration is a bake-off re-run plus an eval-gated deploy — days, with a paper trail — instead of a quarter of archaeology.

5. **"Your CFO asks why the LLM bill doubled with no traffic growth. Selection-layer hypotheses?"** — Model answer: cost-per-task drifted rather than volume: a model-version adoption changed output verbosity or retry rates (post-training drift); a prompt change broke cache hit rates (api-05 — check the cached-token dashboard); traffic mix shifted toward the expensive route in a cascade (or a routing classifier regressed, over-escalating); reasoning-token consumption grew on a thinking model; or the provider repriced. The usage logs decompose it in an hour — cost per task per route per model version — which is precisely why those logs were day-one requirements (api-01). Fixes follow the diagnosis; the meta-fix is cost-per-task on a dashboard with alerts (prd-05).

6. **"When is running a model portfolio worth the complexity?"** — Model answer: when measured arithmetic demands it — a cost case (cascades routing 60–80% of traffic to a model 5–10× cheaper with eval-verified quality parity) or a reliability case (multi-provider fallback for outage resilience, kept warm). Not worth it: speculative "best model per micro-task" sprawl, which multiplies eval surfaces, prompt calibrations, and behavioral quirks faster than it returns value. The discipline: every model in the portfolio pays documented rent, the router itself is evaluated (escalation precision/recall), and consolidation is the default motion at review time.

## Exercises and mini-project

**Exercises**

1. Write the constraint filter for: (a) a HIPAA-adjacent clinical-notes summarizer; (b) a consumer chat toy; (c) an agent operating internal tools. Which criteria eliminate candidates before any benchmark is consulted?
2. Compute cost-per-task: Model A at $3/$15 per M input/output tokens, 2k in/300 out, 4% retry rate; Model B at $0.5/$2.5, same shape, 11% retry rate plus a 10% escalate-to-A cascade. Which wins, and by how much at 1M tasks/month?
3. Take one provider's current deprecation policy[^anthropic-deprecations] and draft the team process it implies: what's calendared, what's rehearsed, what's the minimum runway.
4. Design the escalation trigger for a two-model cascade on your api-03 extraction task: which signals (logprob gap, validation failure, judge flag), which thresholds, and how you'd evaluate the router itself.
5. Your decision log from six months ago chose Model X. List the four triggers that should force a re-run, and which artifacts make the re-run a one-day job.

**Mini-project: the bake-off.** Using your api-02/api-03 eval suites and api-05 instrumented gateway: (a) pick three models across two tiers (and, if accessible, two providers); (b) run the full private bake-off — field-level eval scores (n=5 runs), TTFT and total latency at your real prompt shapes, cost-per-task from logged usage including retries; (c) add two behavioral probes: refusal rate on borderline-but-benign inputs, format compliance under your schemas; (d) write the decision log entry: weighted criteria, scores, the pick, the runner-up-as-fallback, and three re-evaluation triggers; (e) bonus: wire the runner-up behind your gateway flag and measure the switch cost in hours. Target: 4 hours. Success criterion: a decision log a new teammate could audit — and at least one surprise vs. your leaderboard-informed prior.

**Capstone extension:** this bake-off process and decision log become the capstone's model-governance layer; prd-04 wires the fallback, prd-05 consumes the cost-per-task baseline, evl-06 turns the eval anchor into the upgrade gate.

## Revision summary

- You're buying capability-per-dollar-per-millisecond under constraints; models are swappable components behind your gateway, re-selected on triggers as the frontier moves. Every model has a jagged capability fingerprint — "best" is task-relative.
- Stable axes: capability tier (frontier/mid/small — with mid-tier absorbing frontier quality yearly), openness (open weight ≠ open source; licenses are selection criteria), reasoning vs. standard, modality, context (advertised ≠ usable), specialization.
- Criteria in rough order: your private eval, measured latency at your shapes, cost-per-task (never per-token), license/data terms, operational posture (deprecation policy!), ecosystem features.
- Process: constraint filter → public shortlist (benchmarks' only legitimate role) → private bake-off (include one tier down) → decision log with pinned version, fallback, and re-evaluation triggers.
- Portfolios pay rent or get consolidated: task-tier routing and confidence cascades convert jaggedness into economics; sprawl multiplies eval surfaces. Design for migration from day one — gateway, portable prompts, eval-as-acceptance-test make it days, not quarters.

## Flashcards

| Q | A |
|---|---|
| What are you actually buying when selecting a model? | Capability per dollar per millisecond, under your constraints — task-relative, re-decided on triggers. |
| The only legitimate role of public benchmarks? | Shortlisting — contamination, saturation, and distribution mismatch disqualify them from deciding. |
| Why include a lower tier in every bake-off? | Mid-tier-matches-frontier-on-your-task is the common case; overtraining economics refresh the mid tier yearly. |
| Open weight vs. open source? | Weights downloadable ≠ recipe/data/license freedom — custom licenses with commercial clauses are the norm; legal reads them. |
| Cost comparison rule? | Cost-per-task from logged usage (retries, reasoning tokens, cache rates included) — never sticker price per token. |
| The four re-evaluation triggers? | Major releases in your tiers, >20% price moves, your scale doubling, capability-map crossings. |
| What makes migration cheap? | Gateway abstraction, principle-based prompts, portable schemas, and the eval suite as acceptance test — a design outcome, not luck. |
| When does a cascade pay? | When most traffic passes eval-verified on the cheap model and confident escalation handles the hard tail — jaggedness converted to margin. |
| Why calendar deprecation dates? | Every provider deprecates; forced last-minute upgrades ship behavioral regressions the rushed eval misses. |
| The decision log's contents? | Candidates, weighted criteria, eval/latency/cost measurements, the pick + pinned version, fallback, re-evaluation triggers. |

## Further reading

- **Official docs:** the model overview pages of each provider you shortlist[^openai-models][^anthropic-models][^gemini-models] — plus, critically, their deprecation policies[^anthropic-deprecations] and data-use terms.
- **Papers:** Chiang et al., Chatbot Arena (2024)[^chiang-arena] — understand what preference leaderboards measure before consuming them; HELM (cited in fnd-09) for the multi-metric evaluation framing.
- **Books:** none — the landscape outdates print by publication day.
- **Talks:** skip; this chapter's volatile layer moves through changelogs, not talks (fro-04 builds the tracking habit).
- **Tutorials:** none needed — the mini-project's bake-off is the tutorial.

## Check your understanding

1. Reconstruct the four-step selection process and name what artifact each step produces.
2. Defend "cost-per-task, never per-token" with two concrete mechanisms that invert sticker-price comparisons.
3. Your teammate proposes adopting the newest frontier model everywhere "to be safe." Give the three-part rebuttal from this chapter.
4. Which sections of this chapter are volatile (name the review triggers) and which axes/criteria would you teach unchanged in three years?
5. Trace how the api-01 gateway, api-02 prompt discipline, and your eval suite jointly determine your migration cost — and what that implies about where selection risk actually lives.

## Sources

[^openai-models]: [T1] OpenAI. "Models." https://platform.openai.com/docs/models (accessed 2026-07-09)
[^anthropic-models]: [T1] Anthropic. "Models overview." https://docs.anthropic.com/en/docs/about-claude/models/overview (accessed 2026-07-09)
[^gemini-models]: [T1] Google. "Gemini models." https://ai.google.dev/gemini-api/docs/models (accessed 2026-07-09)
[^chiang-arena]: [T2] Chiang et al. (2024). "Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference." arXiv:2403.04132. https://arxiv.org/abs/2403.04132 (accessed 2026-07-09)
[^anthropic-deprecations]: [T1] Anthropic. "Model deprecations." https://docs.anthropic.com/en/docs/about-claude/model-deprecations (accessed 2026-07-09)
