---
id: fnd-08
title: "Sampling & Decoding"
module: foundations
prerequisites: [fnd-05]
related_ids: [fnd-09, api-01, api-02]
keywords:
  - sampling
  - decoding
  - temperature
  - top-p
  - nucleus sampling
  - top-k
  - greedy decoding
  - logprobs
  - determinism
  - self-consistency
summary: >-
  How a probability distribution becomes text: greedy decoding and its
  degeneration failures, temperature as a logit rescaler, truncation strategies
  (top-k, top-p, min-p), logprobs, and multi-sample techniques. Covers why
  temperature zero is not determinism, how parameters map to task types, and
  the production discipline of tuning by eval rather than folklore.
difficulty: 2
est_minutes: 120
status: stable
volatility: evergreen
last_reviewed: 2026-07-09
sources:
  - key: holtzman-2019
    tier: 2
    title: "The Curious Case of Neural Text Degeneration"
    org: arXiv
    url: https://arxiv.org/abs/1904.09751
    accessed: 2026-07-09
  - key: fan-2018
    tier: 2
    title: "Hierarchical Neural Story Generation"
    org: arXiv
    url: https://arxiv.org/abs/1805.04833
    accessed: 2026-07-09
  - key: nguyen-minp
    tier: 2
    title: "Turning Up the Heat: Min-p Sampling for Creative and Coherent LLM Outputs"
    org: arXiv
    url: https://arxiv.org/abs/2407.01082
    accessed: 2026-07-09
  - key: wang-sc
    tier: 2
    title: "Self-Consistency Improves Chain of Thought Reasoning in Language Models"
    org: arXiv
    url: https://arxiv.org/abs/2203.11171
    accessed: 2026-07-09
  - key: openai-params
    tier: 1
    title: "API Reference — chat completions (temperature, top_p, logprobs)"
    org: OpenAI
    url: https://platform.openai.com/docs/api-reference/chat/create
    accessed: 2026-07-09
  - key: anthropic-params
    tier: 1
    title: "Messages API reference (temperature, top_p, top_k)"
    org: Anthropic
    url: https://docs.anthropic.com/en/api/messages
    accessed: 2026-07-09
---

# Sampling & Decoding

A transformer's forward pass ends with a probability distribution over the vocabulary (fnd-05) — and then something has to *pick a token*. That something is the decoding loop, and it is the only part of the generation stack you fully control from the API side: `temperature`, `top_p`, and their siblings are parameters of this loop, not of the model. This short chapter builds decoding from first principles: why always picking the most likely token produces degenerate text, how temperature reshapes the distribution mathematically, what the truncation strategies actually cut, what logprobs offer, and why "temperature 0" still isn't determinism. The payoff is practical: these are the cheapest quality knobs you own, they're routinely mis-set by folklore, and every later chapter that says "sample the model" (structured outputs, agents, evals) assumes the mechanics here. Evergreen material — the samplers predate modern LLMs and the math doesn't churn.

## Intuition: the model proposes, the sampler disposes

Keep the division of labor sharp: **the model computes beliefs; the sampler makes choices.** After each forward pass the model hands over its full opinion — "given everything so far: 31% ` the`, 12% ` a`, 7% ` this`, …" — and takes no part in what happens next. A separate, dumb, fast procedure converts that distribution into one token, appends it, and the loop repeats (fnd-05's decode phase).

The sampler's design question is a trade-off you already know from other domains: **exploit or explore.** Always take the argmax and you get the safest word at every step — which compounds into text that is repetitive, generic, and weirdly *less* human than the model can produce, because human text constantly takes locally-improbable turns. Sample proportionally from the full distribution and you honor the model's uncertainty — but the distribution's long tail contains thousands of tokens that are individually near-impossible yet collectively likely to be hit eventually, and one bad tail-sample can derail everything after it (the loop feeds on its own output; errors compound autoregressively).

Every decoding strategy in production is a point on the line between those failure modes: reshape the distribution (temperature), amputate the tail (top-k/top-p/min-p), or spend more compute on multiple attempts (best-of-n, self-consistency). That's the whole design space; the rest is mechanics.

## Greedy decoding and why it degenerates

Greedy decoding — always emit the argmax token — is the natural first idea and fails informatively. The classic result: on open-ended text, maximization-based decoding produces *degeneration* — bland, looping output ("I'm not sure. I'm not sure. I'm not sure…") — while the same model, sampled, writes fluently.[^holtzman-2019] Two mechanisms drive it:

- **Self-reinforcing repetition.** Once a phrase appears twice, its next occurrence gets *more* probable (the context now contains a strong repetition pattern — recall induction-style copying from fnd-05), so maximization locks into loops it can never leave: a positive-feedback failure.
- **Likelihood ≠ quality.** The single most probable continuation of a whole passage is systematically more boring than what humans write; human text has per-token surprise that maximization refuses by construction.[^holtzman-2019]

The lesson generalizes: for **open-ended generation**, some randomness is a quality ingredient, not a concession. For **closed tasks** (extraction, classification, formatting) where there really is one right answer, greedy or near-greedy is usually right — the distinction that drives all parameter-setting practice below.

## Temperature: the math that earns its place

Temperature is a single-line modification to the softmax you know from fnd-02: divide all logits by $T$ before normalizing.

$$p_i = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}$$

What division by $T$ does to the *shape*:

- **$T \to 0$:** differences between logits are amplified toward infinity; the softmax saturates to the argmax — greedy decoding as a limit.
- **$T = 1$:** the model's raw trained distribution, untouched.
- **$T > 1$:** differences are flattened; probability flows from the head into the tail — more diverse, riskier.
- **$0 < T < 1$:** the useful middle — sharpens toward likely tokens while keeping some variation.

Three precisions worth having that folklore misses. First, temperature **rescales relative differences, it doesn't add noise** — a token the model ranks 40th doesn't jump to 1st at high temperature; the ordering never changes, only the gaps. Second, its effect is **per-step and compounding**: small per-token flattening accumulates over hundreds of tokens into large trajectory divergence. Third, **the "right" T is task- and model-relative** — post-training (fnd-07) already sharpened the distribution, so the same T means different effective randomness on different models; numbers don't transfer across providers any better than tokenizer counts do (fnd-04).

## Truncation: top-k, top-p, and min-p

Temperature reshapes; truncation amputates. The motivation is the **unreliable tail**: the model assigns tiny probabilities to thousands of tokens each step, and those estimates are noise — the model has little training signal about the difference between rank-500 and rank-5000 continuations. Pure sampling will eventually pick one, and one absurd token can poison the rest of the generation. Truncation cuts the tail before sampling:

| Strategy | Rule | Character |
|---|---|---|
| **Top-k** | Keep only the k highest-probability tokens, renormalize[^fan-2018] | Fixed-size cut: too wide when the model is confident, too narrow when it's genuinely uncertain |
| **Top-p (nucleus)** | Keep the smallest set whose cumulative probability ≥ p, renormalize[^holtzman-2019] | Adaptive: confident steps keep few tokens, uncertain steps keep many — the sensible default |
| **Min-p** | Keep tokens with probability ≥ (min_p × top token's probability)[^nguyen-minp] | Adaptive relative to peak confidence; degrades more gracefully at high temperature |

The practical guidance: top-p ≈ 0.9–1.0 with task-appropriate temperature covers most production needs; min-p is worth knowing because open-source inference stacks favor it for high-temperature creative work.[^nguyen-minp] The interaction warning: temperature and truncation **compose** (typically temperature first, then truncation), so tuning both simultaneously produces confounded experiments — move one knob at a time, exactly per fnd-02's experiment discipline.

> **Note:** parameter *semantics* differ across providers — ranges, defaults, whether temperature and top_p may be combined, which knobs exist at all.[^openai-params][^anthropic-params] The concepts are universal; the API contracts are per-vendor reading.

## Spending compute on multiple samples

When one sample isn't reliable enough, buy accuracy with parallelism — a family of techniques that previews the test-time-compute theme of fnd-07/agt-03:

- **Best-of-n:** generate n candidates, pick the best by a scorer (a verifier, a reward model, or an LLM judge — evl-03). Simple, parallel, effective wherever "pick the best" is easier than "generate the best" — the judging-vs-producing asymmetry from fnd-07, recycled.
- **Self-consistency:** for reasoning tasks, sample n chains of thought at moderate temperature and **majority-vote the final answers**; disagreement between chains also serves as a free uncertainty signal.[^wang-sc] Reliable accuracy gains at n× the cost.
- **Beam search** — maintaining several highest-likelihood partial sequences in parallel — dominates in machine translation but is rare for open-ended LLM work: it inherits maximization's degeneration and costs memory; know it as vocabulary, reach for it almost never.
- **Constrained decoding** — masking tokens that would violate a grammar or JSON schema *before* sampling — is how structured outputs are actually enforced; the sampler is where that enforcement physically lives (api-03 owns the topic).

## Logprobs: reading the model's confidence

Most APIs can return the log-probabilities of chosen (and top alternative) tokens.[^openai-params] Three legitimate uses and one big caveat:

- **Cheap classification:** for a constrained-answer prompt ("Yes/No", category labels), the logprob gap between candidate answers is a *graded* signal, richer than the sampled token alone — useful for thresholding ("auto-approve above 90%, human review below").
- **Anomaly and drift detection:** a falling average logprob on production traffic flags inputs the model finds unusual — early warning for distribution shift (evl-05).
- **Scoring without generating:** perplexity of a candidate text under the model (fnd-02's loss, applied at inference) supports ranking and filtering pipelines.

The caveat: **logprobs are the model's fluency estimate, not calibrated truth-probability.** A model can assign 95% to a hallucinated "fact" — confidence tracks how *natural the text is as text*, and post-training distorts calibration further (fnd-09 takes this up properly). Use logprobs comparatively (between candidate answers on one input) rather than as absolute confidence, and validate any threshold against labeled outcomes.

## Determinism and reproducibility

The engineering fine print that catches teams: **temperature 0 does not guarantee identical outputs.** Two separate gaps:

- **Floating-point non-associativity:** GPU reductions sum in orders that vary with batch composition and kernel choice; when two top logits are within numerical noise, the argmax itself can flip run-to-run on shared serving infrastructure (fnd-02 flagged this; here is where it bites).
- **Fleet heterogeneity:** providers serve models across differing hardware/software stacks, and quantization or kernel differences perturb logits slightly. Some APIs offer a `seed` parameter with *best-effort* reproducibility — read the fine print; it is not a contract.[^openai-params]

Design consequences: never build correctness on bit-identical outputs (idempotency via request IDs, not via "same prompt ⇒ same text"); make evals statistical — run flaky-looking cases n times and score pass rates (evl-01's doctrine, mechanically justified here); and for local models, pin the full stack (weights, engine version, kernels) when you need reproducibility for debugging.

## Production engineering perspective

The working parameter doctrine, then the discipline that matters more than any preset:

| Task type | Temperature | Notes |
|---|---|---|
| Extraction, classification, structured output | 0 – 0.3 | Consistency is the product; pair with constrained decoding (api-03) |
| Code generation | 0 – 0.4 | Correctness dominates; diversity mostly adds bug variety |
| General assistant / Q&A | 0.5 – 0.8 | Balance fluency and reliability |
| Creative writing, brainstorming, synthetic data | 0.9 – 1.2 (+ min-p or top-p) | Diversity is the product; degeneration risk managed by truncation |
| Self-consistency reasoning runs | 0.6 – 0.9 | Chains must differ for voting to help[^wang-sc] |

The discipline: **these are priors, not answers — tune against your eval, one knob at a time.** Sampling parameters are part of your model configuration and belong under version control with prompts (evl-06); a temperature change is a deployment, capable of regressing quality exactly like a prompt change. And remember the two knobs that aren't "sampling" but govern the same loop: `max_tokens` (a latency and cost budget — fnd-05's decode economics) and stop sequences (cheap structural control). Repetition penalties exist on open-model stacks for looping pathologies; treat them as symptom management — persistent loops at sane settings usually indicate prompt or model problems.

## Historical evolution

Beam search ruled the machine-translation era — closed tasks, where likelihood maximization matches the goal. **2018–2019:** open-ended generation exposed maximization's degeneration; top-k arrived with story-generation work,[^fan-2018] and nucleus (top-p) sampling named the problem and became the standard fix.[^holtzman-2019] **2020s:** chat APIs standardized temperature + top-p as the universal knobs; self-consistency showed sampling could *buy accuracy*, not just diversity;[^wang-sc] open-source inference engines proliferated samplers (min-p among the survivors[^nguyen-minp]); and constrained decoding matured from research into the mechanism behind every structured-output API. The direction of travel: the sampler stopped being a text-quality dial and became a *system component* — enforcing schemas, spending test-time compute, emitting confidence signals.

## Common misconceptions

- **"Temperature 0 makes outputs deterministic."** It makes the *sampler* deterministic; floating-point and fleet effects still vary the logits. Build for statistical, not bit-level, stability.
- **"Temperature is a creativity knob."** It's a distribution-sharpness knob. It cannot add ideas the model doesn't have — it only redistributes probability among continuations the model already ranks. Genuine novelty comes from the prompt and the model, not the sampler.
- **"High temperature causes hallucination; low temperature prevents it."** Hallucination is a model-knowledge phenomenon (fnd-09): a model confidently wrong at T=0 stays wrong — greedy decoding just picks the *most probable* falsehood consistently. Temperature affects *variance* of outputs, only weakly their factual grounding.
- **"Top-p and temperature are interchangeable."** They compose differently: temperature reshapes the whole distribution; top-p cuts its tail. High-T-plus-tight-top-p behaves very differently from moderate-T alone. Tune them as distinct instruments.
- **"Logprobs tell you the probability the answer is correct."** They report fluency under the model's distribution, not calibrated accuracy; use comparatively and validate thresholds empirically.
- **"There's an objectively correct temperature per task."** Only relative to a model (post-training sharpness differs) and an eval. Presets are starting points; numbers cargo-culted across models are folklore.

## Failure modes and trade-offs

- **Repetition loops** (low T, no penalties, long outputs) — the self-reinforcing argmax pathology; mitigate with slight temperature, top-p, or penalties, and investigate the prompt if persistent.
- **Degeneration at high T with no truncation** — tail tokens poison generations; the fix is exactly what top-p/min-p exist for.[^holtzman-2019][^nguyen-minp]
- **Mode collapse in synthetic-data pipelines** — generating datasets at low temperature yields homogeneous data that transfers poorly (a fine-tuning trap for module 8: diversity of training data is a feature you must *sample for*).
- **Confounded tuning** — changing prompt, model, temperature, and top-p together; nothing is learned. One knob, one eval, one change — fnd-02's experiment log, again.
- **Silent cross-provider drift** — migrating models while keeping parameter values; semantics and effective sharpness differ, so behavior shifts without any code change. Re-tune as part of any migration checklist (api-06).
- **The cost of multi-sample accuracy** — best-of-n and self-consistency multiply spend linearly for sublinear gains; they're precision tools for high-stakes steps, not defaults (route by task value — prd-05 thinking).

## Best practices

- **Set temperature by task class first** (table above), then tune against your eval — never by vibes, never one knob mid-flight without measurement.
- **Version-control sampling parameters with prompts;** treat changes as deployments with regression evals (evl-06).
- **Default top-p to 0.9–1.0 and touch it only with cause;** prefer min-p for deliberately high-temperature creative regimes on open stacks.[^nguyen-minp]
- **Design evals and idempotency for statistical stability** — n-run pass rates, request-ID dedup — never for identical text.
- **Use logprobs comparatively** (candidate-answer gaps, drift monitoring), and validate any confidence threshold against labeled outcomes before it gates anything.
- **Reserve multi-sample techniques for verified-high-value steps,** with a scorer you trust; log disagreement as an uncertainty signal.
- **On migration or model upgrade, re-tune sampling** — parameters are model-relative calibrations, like every other number in this module.

## Real-world examples

**The flaky extraction pipeline.** An invoice-parsing service runs at the API default temperature (typically ~1.0). Success rate: 94% — with the 6% failing *differently on retry*, maddening to debug. Setting T=0.2 with schema-constrained decoding lifts it to 99%+ and makes failures *reproducible enough to fix*. Total change: two parameters. The diagnosis skill was knowing that variance itself was the bug — a closed task running on open-task settings.

**The creative tool that bored everyone.** A marketing-copy generator ships at T=0.3 ("we tested it and outputs looked reliable"). Users complain every variation reads the same — reliability was the wrong objective for the product. T=1.0 with min-p, plus best-of-3 with a quick LLM-judge ranking, makes variants genuinely diverse while filtering the duds. Same model; opposite knob direction; the task-class table in one incident.

**Buying accuracy for the hard 5%.** A reasoning-heavy analytics step scores 82% single-sample. Self-consistency with 7 samples at T=0.7 lifts it to 91% — at 7× the cost, viable only because a router sends just the classifier-flagged hard cases through it.[^wang-sc] Chain disagreement gets logged and later becomes the trigger for human review: the uncertainty signal was free.

## Interview questions

1. **"What actually happens between the model's forward pass and the next token appearing?"** — Model answer: the forward pass ends in logits over the vocabulary; softmax (optionally with temperature dividing the logits first) turns them into a distribution; a truncation rule (top-k/top-p/min-p) may cut the unreliable tail and renormalize; then a token is drawn — argmax if effectively greedy — appended, and the loop repeats with the KV cache carrying state. Every sampling parameter is a knob on this loop, not on the model's beliefs.

2. **"Why does greedy decoding produce worse text than sampling, if it picks the most likely token every time?"** — Model answer: two mechanisms. Locally, repetition self-reinforces — once a phrase recurs, its continuation becomes even more probable, so argmax locks into loops. Globally, likelihood and quality diverge: human text takes locally improbable turns constantly, so the maximum-likelihood trajectory is systematically blander than typical human text. Hence the task split: near-greedy for closed tasks with one right answer, calibrated randomness for open-ended generation.

3. **"Explain temperature mathematically and name two things it cannot do."** — Model answer: logits are divided by T before softmax — T<1 sharpens the distribution toward the head, T>1 flattens it toward the tail; T→0 recovers argmax. It cannot reorder tokens (relative ranking is preserved — it rescales gaps), and it cannot make a model deterministic or truthful — at T=0 a confidently-wrong model just emits its most probable wrong answer, reproducibly-ish.

4. **"Top-k vs. top-p — why did top-p win as the default?"** — Model answer: both amputate the unreliable tail before sampling, but top-k's cutoff is fixed-size while the model's genuine uncertainty varies per step — k=40 is too generous when the model is 95% sure and too stingy when twenty continuations are legitimately plausible. Top-p adapts: it keeps the smallest set covering probability mass p, so the cut tracks the distribution's actual shape. Min-p is a newer adaptive variant that holds up better at high temperature.

5. **"How would you use logprobs in a production system, and what's the trap?"** — Model answer: comparatively — the gap between candidate-answer logprobs for classification thresholds ("auto-act above X, human-review below"), average-logprob monitoring for input drift, and perplexity scoring for ranking pipelines. The trap: treating them as calibrated correctness probabilities. They measure fluency under the model's distribution; hallucinations can carry high logprobs, and post-training distorts calibration. Validate any threshold against labeled outcomes.

6. **"Your teammate says 'we set temperature to 0, so our tests can assert exact output strings.' Correct them."** — Model answer: T=0 removes sampler randomness but not system randomness — GPU floating-point reduction order varies with batch composition, and provider fleets mix hardware and kernels, so near-tied logits flip run to run; seeds are best-effort where offered. Tests should assert semantic properties (schema validity, key facts, judge scores) and use n-run pass rates for flaky cases; correctness should never depend on bit-identical generations.

## Exercises and mini-project

**Exercises**

1. Given logits $(2.0, 1.0, 0.5, -1.0)$, compute the softmax distribution at T = 1, T = 0.5, and T = 2. Verify the ordering never changes and describe what does.
2. For the distribution $(0.55, 0.20, 0.10, 0.06, 0.05, 0.04)$: which tokens survive top-k with k=3? Top-p with p=0.8? Min-p with min_p=0.1? Note where they disagree and why.
3. A generation loops: "…as mentioned above, as mentioned above, as…". Explain the mechanism, then order three interventions by how directly they address the cause.
4. Design the sampling configuration (all knobs, with one-line justifications) for: (a) a JSON invoice extractor, (b) a brainstorming assistant, (c) a math-reasoning step you'll wrap in self-consistency.
5. Your eval shows a prompt passing 87% of 100 runs at your production settings. A colleague reports "it failed for me" once. What do you conclude, and what would change your mind?

**Mini-project: build the sampler zoo.** Using a small open-weight model locally (any few-hundred-MB causal LM via Hugging Face `transformers`): (a) get raw logits for a prompt's next token and implement, from scratch in numpy: greedy, temperature sampling, top-k, top-p, and min-p; verify each against the library's built-ins; (b) generate 20 continuations of one open-ended prompt at T ∈ {0.2, 0.7, 1.0, 1.5} × {no truncation, top-p 0.9} and measure distinct-n-gram diversity per cell; find the degeneration corner and the blandness corner in your grid; (c) run a 10-question arithmetic-reasoning set single-sample vs. self-consistency (n=5, T=0.7) and report accuracy and cost; (d) write a half-page memo: your grid's sweet spots, mapped to the task-class table. Target: 3 hours. Success criterion: you have personally produced degeneration, blandness, and a self-consistency accuracy gain — and can predict the corner of the grid each lives in.

**Capstone extension:** the sampling configurations you derive here become versioned config in your capstone's model layer (api-01), and the n-run statistical eval pattern becomes its test harness (evl-06).

## Revision summary

- The model proposes a distribution; the sampler disposes — every generation-time knob is a sampler parameter. Greedy decoding degenerates on open-ended text (self-reinforcing loops; likelihood ≠ quality); closed tasks want near-greedy, open tasks want calibrated randomness.
- Temperature divides logits pre-softmax: sharpens (<1) or flattens (>1) without reordering; effects compound per-step; values are model-relative and don't migrate. Truncation amputates the unreliable tail: top-k (fixed), top-p (adaptive, default), min-p (adaptive, high-T-friendly); temperature and truncation compose — tune one at a time.
- Multi-sample techniques buy accuracy with compute: best-of-n + scorer, self-consistency majority voting (with disagreement as free uncertainty); beam search is MT vocabulary; constrained decoding is where structured outputs physically happen.
- Logprobs: comparative confidence, drift monitoring, scoring — never calibrated truth. T=0 ≠ determinism (floating point, fleet heterogeneity); build statistical evals and idempotency, not exact-string assertions.
- Doctrine: parameters by task class, tuned by eval, version-controlled with prompts, re-tuned on every model migration.

## Flashcards

| Q | A |
|---|---|
| What does temperature do, mechanically? | Divides logits by T before softmax — rescaling probability gaps (sharpening or flattening) without changing token order. |
| Why does greedy decoding loop? | Repetition self-reinforces: each recurrence makes the pattern more probable, and argmax can never escape a lock-in. |
| Top-p in one line? | Sample only from the smallest token set whose cumulative probability ≥ p — an adaptive tail amputation. |
| Why truncate the tail at all? | Tail probabilities are noise; sampled tail tokens derail generation, and errors compound autoregressively. |
| Self-consistency? | Sample n reasoning chains at moderate T, majority-vote the answers; disagreement doubles as an uncertainty signal. |
| Two reasons T=0 outputs still vary? | Floating-point reduction order varies with batching; provider fleets mix hardware/kernels — near-tied logits flip. |
| The logprob trap? | Logprobs measure fluency, not calibrated correctness — hallucinations can score high; use comparatively, validate thresholds. |
| Default sampling for extraction vs. creative work? | Extraction: T 0–0.3 + constrained decoding. Creative: T ~1.0 with top-p/min-p truncation, optionally best-of-n. |
| Where does structured-output enforcement physically live? | In the decoding loop — invalid tokens are masked before sampling (constrained decoding). |
| What must be re-tuned on model migration? | All sampling parameters — effective sharpness and parameter semantics are model- and provider-relative. |

## Further reading

- **Official docs:** OpenAI API reference (temperature, top_p, logprobs, seed)[^openai-params]; Anthropic Messages API (temperature, top_p, top_k)[^anthropic-params] — read both to see semantics diverge.
- **Papers:** Holtzman et al., neural text degeneration (2019)[^holtzman-2019] — the essential one; Fan et al. (2018)[^fan-2018]; Wang et al., self-consistency (2022)[^wang-sc]; Nguyen et al., min-p (2024)[^nguyen-minp].
- **Books:** none needed; this topic lives in papers and API docs.
- **Talks:** none essential.
- **Tutorials:** Hugging Face `transformers` generation-strategies guide — pairs with the mini-project; the sampler implementations in any open inference engine (e.g. vLLM's sampling params) as readable reference code.

## Check your understanding

1. Reconstruct the full decoding loop from logits to emitted token, naming where temperature, truncation, and constrained decoding each intervene.
2. Explain to a PM why their "make it deterministic" requirement needs rewording, and what the achievable contract is.
3. Your extraction accuracy is 94% and failures differ on retry. Diagnose, fix, and state what the fix costs.
4. When would you spend 7× on self-consistency, and what routing machinery makes that affordable?
5. Why are sampling parameters "model-relative calibrations"? Connect to post-training (fnd-07) in one sentence.

## Sources

[^holtzman-2019]: [T2] Holtzman et al. (2019). "The Curious Case of Neural Text Degeneration." arXiv:1904.09751. https://arxiv.org/abs/1904.09751 (accessed 2026-07-09)
[^fan-2018]: [T2] Fan, Lewis & Dauphin (2018). "Hierarchical Neural Story Generation." arXiv:1805.04833. https://arxiv.org/abs/1805.04833 (accessed 2026-07-09)
[^nguyen-minp]: [T2] Nguyen et al. (2024). "Turning Up the Heat: Min-p Sampling for Creative and Coherent LLM Outputs." arXiv:2407.01082. https://arxiv.org/abs/2407.01082 (accessed 2026-07-09)
[^wang-sc]: [T2] Wang et al. (2022). "Self-Consistency Improves Chain of Thought Reasoning in Language Models." arXiv:2203.11171. https://arxiv.org/abs/2203.11171 (accessed 2026-07-09)
[^openai-params]: [T1] OpenAI. "API Reference — Chat completions." https://platform.openai.com/docs/api-reference/chat/create (accessed 2026-07-09)
[^anthropic-params]: [T1] Anthropic. "Messages API reference." https://docs.anthropic.com/en/api/messages (accessed 2026-07-09)
