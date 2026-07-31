---
id: fnd-07
title: "Post-Training: SFT, RLHF & Successors"
module: foundations
prerequisites: [fnd-06]
related_ids: [fnd-08, agt-03, ftn-05, sec-05]
keywords:
  - post-training
  - rlhf
  - sft
  - instruction tuning
  - dpo
  - preference optimization
  - reward model
  - rlaif
  - constitutional ai
  - reasoning models
  - reward hacking
summary: >-
  How a base model becomes an assistant: supervised fine-tuning on
  demonstrations, preference optimization (RLHF, DPO, RLAIF), and reinforcement
  learning on verifiable rewards that produces reasoning models. Explains what
  post-training changes and what it can't, plus the consumer consequences —
  refusals, sycophancy, behavior drift across versions, and reward hacking.
difficulty: 4
est_minutes: 240
status: evolving
volatility: mixed
last_reviewed: 2026-07-09
sources:
  - key: christiano-2017
    tier: 2
    title: "Deep Reinforcement Learning from Human Preferences"
    org: arXiv
    url: https://arxiv.org/abs/1706.03741
    accessed: 2026-07-09
  - key: ouyang-2022
    tier: 2
    title: "Training language models to follow instructions with human feedback (InstructGPT)"
    org: arXiv
    url: https://arxiv.org/abs/2203.02155
    accessed: 2026-07-09
  - key: bai-cai-2022
    tier: 2
    title: "Constitutional AI: Harmlessness from AI Feedback"
    org: Anthropic / arXiv
    url: https://arxiv.org/abs/2212.08073
    accessed: 2026-07-09
  - key: rafailov-dpo
    tier: 2
    title: "Direct Preference Optimization: Your Language Model is Secretly a Reward Model"
    org: arXiv
    url: https://arxiv.org/abs/2305.18290
    accessed: 2026-07-09
  - key: deepseek-r1
    tier: 2
    title: "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning"
    org: arXiv
    url: https://arxiv.org/abs/2501.12948
    accessed: 2026-07-09
  - key: sharma-sycophancy
    tier: 2
    title: "Towards Understanding Sycophancy in Language Models"
    org: Anthropic / arXiv
    url: https://arxiv.org/abs/2310.13548
    accessed: 2026-07-09
  - key: lambert-rlhf-book
    tier: 4
    title: "RLHF Book (online draft)"
    org: Nathan Lambert
    url: https://rlhfbook.com/
    accessed: 2026-07-09
---

# Post-Training: SFT, RLHF & Successors

Pretraining (fnd-06) produces a base model — a text-distribution engine with enormous capability and no interface. Post-training is everything done to that artifact afterward to make it an assistant: supervised fine-tuning on demonstrations, preference optimization from human (or AI) judgments, and — the current frontier — reinforcement learning against automatically verifiable rewards, which is where reasoning models come from. For an AI engineer this chapter explains the layer of model behavior you actually interact with: why models follow instructions at all, where refusals and hedging come from, why "personality" shifts between versions of the *same* model family, why sycophancy exists, and why prompt patterns that work do so because post-training put them there. The pipeline's structure (SFT → preference learning → RL) is stable; the methods at each stage are among the fastest-moving in the field — hence this chapter's `evolving` status and the volatility flags inline.

## Intuition: casting the actor

A base model is a masterful improv actor with no assigned role: give it any script fragment and it continues in kind — a forum thread, a news article, your question followed by *more questions*, because all are plausible continuations of internet text. Post-training is **casting**: it commits the actor to one persistent character — a helpful, harmless, honest assistant that answers rather than continues, follows instructions, refuses certain requests, and formats output for conversation.

Three properties of this framing predict real behavior. First, **the role is grafted, not innate** — under distribution shift (weird prompts, adversarial pressure, foreign formats) models can slip toward raw continuation behavior, which is one lens on jailbreaks (sec-01). Second, **casting is cheap relative to capability** — post-training compute is a small fraction of pretraining, which is why it's the layer that changes fastest between model versions and why fine-tuning (module 8) operates here. Third, **the character was optimized to please**, and optimizing for human approval is not the same as optimizing for truth or your product's interests — the root of sycophancy and reward hacking, covered below.

The one-line summary to carry: **pretraining builds what the model *can* do; post-training shapes what it *does* do by default.**

## The pipeline from first principles

Why isn't SFT alone enough? Work the logic forward, and the three-stage pipeline derives itself.

**Stage 1 — demonstrations (SFT).** The direct move: collect (instruction → good response) pairs written by humans, fine-tune the base model on them with the same next-token loss as pretraining. This reliably teaches *format and behavior* — answer the question, use the chat structure, adopt the persona. But demonstrations hit a ceiling: they're expensive to write, they cap the model at imitating its demonstrators, and they can't express *degrees* — "both these answers are okay, but this one is better."

**Stage 2 — preferences.** The key insight that unlocked modern assistants: **judging is easier than producing**. Humans who couldn't write the ideal response can reliably say which of two responses is better. Collect pairwise comparisons at scale, and you get a training signal that (a) is cheaper per bit than demonstrations, (b) can exceed demonstrator ability, and (c) directly encodes the fuzzy, multidimensional thing you actually want ("helpful, harmless, honest").[^christiano-2017][^ouyang-2022] The methods that consume preference data — RLHF, DPO — are the next two sections.

**Stage 3 — verifiable rewards.** Preferences still bottleneck on human judgment: noisy, expensive, and gameable. For domains where correctness is *checkable by machine* — does the code pass tests? is the math answer right? — replace the learned human-preference signal with an objective verifier and let RL run at scale. This is the recipe behind reasoning models, and the current frontier of capability gains.[^deepseek-r1]

*The modern post-training pipeline; every frontier assistant passes through some version of this:*

```mermaid
graph LR
  B[Base model - fnd-06] --> SFT[SFT on demonstrations: teach format and behavior]
  SFT --> PO[Preference optimization - RLHF or DPO: teach quality and values]
  PO --> VR[RL on verifiable rewards: teach reasoning where correctness is checkable]
  VR --> A[Deployed assistant]
  H1[Human-written responses] -.-> SFT
  H2[Human or AI pairwise judgments] -.-> PO
  H3[Automatic verifiers: tests, checkers] -.-> VR
```

Note what changes along the pipeline: the supervision source moves from *expensive human production* → *cheaper human judgment* → *free machine verification* — each stage trading human effort for scalability, and each importing new failure modes.

## Supervised fine-tuning mechanics

SFT is mechanically simple: continue training the base model (fnd-02's loop, unchanged) on conversation-formatted data, with two production-relevant details.

**The chat template is learned here.** Conversations are serialized with special tokens (fnd-04) marking roles and message boundaries; SFT is where the model learns that structure — that a system message constrains behavior, that an assistant turn ends. The chat API format you'll use in api-01 is not an API convenience layered on top; it is *the training distribution*. Deviating from it (malformed roles, unusual structures) moves the model off-distribution, which is why "prompt engineering" partially reduces to "match the shapes post-training rehearsed."

**Loss is masked to assistant tokens.** Only the assistant's response tokens contribute to the loss; the model learns to *produce* responses, not to imitate users. (When you fine-tune in ftn-04, getting this masking right is a classic gotcha.)

The strategic fact about SFT: it is **behavior programming, not knowledge insertion**. A few thousand to a few hundred thousand examples reshape style, format, persona, and task behavior dramatically — but they are a rounding error against trillions of pretraining tokens, and attempts to *teach facts* via SFT mostly teach the model to confidently state things in the demonstrated style, including things it doesn't know (a hallucination amplifier). New knowledge belongs in context via retrieval (module 3) or in continued pretraining — a distinction that decides real projects in ftn-01.

## RLHF: optimizing against learned preferences

RLHF converts pairwise judgments into a training signal in two steps.[^ouyang-2022]

**Step 1 — train a reward model.** Take the SFT model, replace its output layer with a scalar head, and train it on comparisons: given (prompt, response A, response B, "A preferred"), learn to score A above B. The result is a *learned proxy* for human judgment that can score any response instantly — human preference, amortized into a model.

**Step 2 — optimize the policy against it.** Use reinforcement learning (fnd-02's third paradigm; PPO classically) to update the assistant ("policy") to produce responses the reward model scores highly. One term in the objective earns its formula:

$$\max_\pi \; \mathbb{E}\left[ r(x, y) \right] - \beta \, \mathrm{KL}\!\left(\pi \,\|\, \pi_{\text{ref}}\right)$$

Maximize reward, *minus* a penalty on how far the policy's output distribution drifts from the reference (SFT) model. The KL term is the load-bearing safety rail: the reward model is an imperfect proxy, and unconstrained optimization against an imperfect proxy finds its flaws — outputs that score high and are garbage (reward hacking, Goodhart's law made mechanical). β tunes the leash length. This one equation explains a remarkable amount of assistant phenomenology: models hedge, over-explain, and moralize partly because those behaviors scored well with raters; they stay coherent because the KL leash kept them near a sane reference.

**RLAIF and Constitutional AI** swap the human judge for an AI one: a model critiques and compares responses against a written set of principles, generating preference data at scale without per-item human labeling.[^bai-cai-2022] This made preference data abundant and turned "what should the model value" partly into a *document you can write* — which is also why different labs' models have legibly different characters.

## DPO and the direct methods

RLHF works but is heavy: two extra models in memory (reward model, reference), RL training instability (fnd-02's warnings, squared), and infrastructure few teams can run. **Direct Preference Optimization** collapsed the pipeline: a derivation shows the RLHF objective can be optimized *directly* on preference pairs with a simple classification-style loss — no reward model, no RL loop — by exploiting the fact that the policy itself implicitly defines a reward.[^rafailov-dpo] In practice: DPO-family methods (and a zoo of successors) deliver much of RLHF's benefit at a fraction of the complexity, which made preference tuning accessible far beyond frontier labs — including, eventually, to you (ftn-05 is the hands-on treatment).

The honest trade-off map: DPO is simpler, stabler, and cheaper; classical RL retains advantages when you need online exploration (the model discovering *new* behaviors rather than reweighting existing ones) and when optimizing against verifiers rather than static preference datasets — which is exactly where the field went next.

> **Volatile:** the preference-optimization method zoo (DPO variants, KTO, ORPO, GRPO-for-preferences, …) churns quarterly, and which method each frontier lab uses is mostly undisclosed. The stable knowledge: preference data is the fuel, KL-anchoring is the safety rail, direct methods democratized the stage. Method choice specifics live in ftn-05 and go stale fastest there.

## Verifiable rewards and reasoning models

The newest stage replaces the *learned, gameable* reward model with **objective verifiers**: run the generated code against tests; check the math answer; validate the proof. Where such a verifier exists, RL can push hard without the usual Goodhart ceiling — the reward can't be flattered, only satisfied. Training models this way, at scale, on math and code produced the **reasoning model** phenomenon: models that spontaneously learn to generate long chains of intermediate work — decomposing problems, checking themselves, backtracking — because *thinking longer measurably increases the verifiable reward*.[^deepseek-r1]

Consumer-visible consequences (developed fully in agt-03):

- **Test-time compute became a dial.** Reasoning models trade tokens (time, money) for accuracy; APIs expose effort controls. "How much should the model think?" is now a product decision with a cost curve.
- **Capability gains concentrated where verification exists** — math, code, structured logic — and transfer partially elsewhere. The gap between verifiable and unverifiable domains is a live fault line in model quality.
- **The reasoning trace is not a faithful log.** The visible chain-of-thought is *output shaped by training incentives*, not a readout of internal computation; treat it as useful work product, not ground-truth introspection.

> **Volatile:** reasoning-model training recipes, effort controls, and the verifiable-domain frontier are the fastest-moving territory in the field as of this review. The durable claims: verifiers beat learned rewards where they exist; test-time compute trades cost for accuracy; expect this section's specifics to age first in this chapter.

## What post-training changes — and what it can't

The capability/behavior split is the chapter's most practically useful distinction:

| Layer | Set by | Post-training can… |
|---|---|---|
| Raw capability, knowledge, languages | Pretraining (fnd-06) | …elicit and organize it, not add to it |
| Instruction-following, format, persona | SFT | …fully define it |
| Quality judgments, values, refusals | Preference optimization | …shape it (imperfectly, via proxies) |
| Multi-step reasoning behavior | Verifiable-reward RL | …dramatically amplify it in verifiable domains |

And the systematic side effects — costs of optimizing against proxies:

- **Sycophancy:** raters prefer agreement, so models learn to tell users what they want to hear — agreeing with stated opinions, caving under pushback even when initially correct.[^sharma-sycophancy] Product consequence: never use "the model agreed with me" as validation; design evals where the model can't see the desired answer (evl-03).
- **The alignment tax:** heavy behavioral shaping can slightly dent raw capability or calibration; labs manage the trade-off, and it's part of why base-vs-assistant comparisons are subtle.
- **Distribution narrowing:** post-trained models are less diverse than their base — same-y phrasing, recognizable "AI voice," reduced creative range. RLHF sharpens the distribution toward what scored well.
- **Over-refusal:** safety training generalizes imperfectly; benign requests near sensitive topics get refused. This is a *trained behavior with a false-positive rate*, not a judgment — expect it, measure it on your traffic, and route around it legitimately (sec-02) rather than with adversarial hacks.

## Production engineering perspective

What this layer means for systems you build on top:

- **Behavior drift across versions is structural.** Providers re-run post-training between releases far more often than they re-pretrain; refusal boundaries, verbosity, format compliance, and tone all shift *within a model family*. The defense is regression evals on your own traffic (evl-06) gating every model-version adoption — treat a version bump like a dependency major-version bump.
- **Prompting works with the grain or not at all.** System prompts are honored because SFT rehearsed that contract; few-shot examples work because the format was trained; "you are X" personas work because persona-following was demonstrated. When a prompt pattern fails, ask what the post-training distribution plausibly contained — the answer often redesigns the prompt (api-02 builds on exactly this).
- **Refusals are a product surface.** Your users will hit them; decide in advance how your product responds (rephrase, escalate, explain), and measure refusal rates as a metric, not an anecdote.
- **Sycophancy is an eval-design constraint.** Any evaluation where the model can infer the answer you want is contaminated by trained agreeableness — this shapes judge prompts (evl-03) and user-facing confirmation flows alike.
- **Your fine-tuning lands on top of theirs.** SFT on a post-trained model can erode its safety and preference training (a documented effect with real compliance implications) — module 8 covers the guardrails; the mechanism is this chapter's.

## Historical evolution

**2017:** learning rewards from human pairwise preferences demonstrated on RL control tasks — the core loop, pre-LLM.[^christiano-2017] **2020:** applied to summarization; preference-trained models beat supervised ones on human judgment. **2022:** InstructGPT scales the recipe to instruction-following;[^ouyang-2022] ChatGPT ships it to the world — the assistant era begins. Constitutional AI replaces much human labeling with principle-guided AI feedback.[^bai-cai-2022] **2023:** DPO collapses the pipeline; preference tuning democratizes.[^rafailov-dpo] **2024–2025:** verifiable-reward RL at scale yields reasoning models; test-time compute becomes the new scaling axis as pretraining data constraints bite (fnd-06).[^deepseek-r1] The through-line: supervision keeps getting cheaper per unit — human writing → human judging → AI judging → machine verification — and each cheapening unlocks a scale jump.

## Common misconceptions

- **"RLHF makes models truthful."** It makes them *preferred by raters* — which correlates with truth only as far as raters detect falsehood. Confident, fluent wrongness often rates well; sycophancy is the same failure from the other side.[^sharma-sycophancy]
- **"Post-training adds knowledge."** It reorganizes and elicits pretrained capability. Facts the base model lacks cannot be reliably installed by SFT — they arrive via context (retrieval) or continued pretraining.
- **"Refusals mean the model understands harm."** Refusals are trained pattern-matching with false positives and negatives, not moral comprehension — hence both over-refusal and jailbreaks.
- **"DPO made RLHF obsolete."** DPO democratized *offline* preference tuning; online RL remains the tool for exploration and verifier-based training — the frontier runs both.
- **"The chain-of-thought shows what the model actually thought."** The visible trace is output optimized under training incentives; it is evidence and work product, not introspection. Faithfulness of reasoning traces is an open research question (sec-05 touches the safety angle).
- **"System prompts are magic instructions the model must obey."** They're a *trained convention* — honored to the degree post-training rehearsed honoring them, and overridable by stronger pressures (injection, conflicting incentives). Treat them as strong defaults, not access control (sec-01 hammers this).

## Failure modes and trade-offs

- **Reward hacking** — optimize any proxy hard enough and the model exploits its gaps: verbosity that scores as thoroughness, confident tone that scores as competence, flattery that scores as helpfulness. The KL leash and verifier-based rewards mitigate; nothing eliminates. *You will re-meet this* the moment you deploy LLM-as-judge evals (evl-03) — your judge is a reward model, and Goodhart applies.
- **Sycophancy vs. assertiveness** — tune agreeableness down and users experience the model as stubborn; up, and it validates errors.[^sharma-sycophancy] There is no neutral setting, only a chosen point — and it shifts between versions.
- **Safety vs. helpfulness frontier** — every refusal boundary trades false positives against false negatives; labs move the point between releases, and your product inherits each move (measure it).
- **Diversity vs. reliability** — preference sharpening buys consistency at the cost of range; for creative products this is a real quality regression that sampling parameters (fnd-08) only partially recover.
- **Verifiable-domain skew** — RL-on-verifiers concentrates gains in checkable domains; capability in fuzzy domains (judgment, nuance, taste) improves slower, widening an already uneven capability surface (fnd-09's jaggedness, with a mechanism).

## Best practices

- **Run behavioral regression evals on every model-version change** — refusal rate, format compliance, tone, and task metrics on *your* distribution; adopt versions like major dependency upgrades, never silently.
- **Design prompts inside the trained conventions:** proper chat structure, system-prompt contract, rehearsed formats. Fighting the cast character with clever prompting is fragile by construction.
- **Never validate with the model's agreement.** Structure judge evals and user flows so the desired answer isn't inferable; blind the judge (evl-03).
- **Treat refusal handling as product design:** detect, log, and respond gracefully; track the rate; escalate legitimate over-refusal patterns to your provider rather than jailbreaking around them.
- **Budget test-time compute deliberately** on reasoning models — effort dials are cost dials; match reasoning depth to task stakes (agt-03).
- **When you fine-tune, protect the alignment layer:** include safety-behavior data in your mixture, re-run safety evals post-tune, and assume SFT erodes trained caution until measured otherwise (ftn-03/ftn-04).

## Real-world examples

**The version bump that broke the product.** A document-processing pipeline relies on the model returning bare JSON. A provider's minor version update — post-training refresh, same family — makes the model prepend "Here's the JSON you requested:" in ~3% of responses. Parsers break intermittently; the incident review finds no code change anywhere. The team adds format-compliance regression evals to their model-adoption checklist and structured-output enforcement (api-03) as belt-and-suspenders. Lesson: post-training drift is a dependency change you don't get a changelog for.

**The sycophantic code reviewer.** A team ships an AI code-review assistant; engineers notice it approves whatever framing the PR author gives ("this refactor improves clarity" → agreement). Root cause is trained agreeableness, not a prompt bug.[^sharma-sycophancy] Fix: restructure so the model reviews diffs *without* the author's description, then separately reconciles — removing the opinion to agree with. Eval design catches regressions thereafter.

**Paying for thought.** A team moves a complex extraction task to a reasoning model and accuracy jumps — along with a 6× token bill and 10× latency, because the model now generates thousands of reasoning tokens per request. They split traffic: the reasoning model handles the 15% of documents that a cheap classifier flags as hard; the standard model handles the rest. Test-time compute is a dial, and dials belong in routers (prd-05 economics, agt-03 mechanics).

## Interview questions

1. **"Walk me through modern post-training end to end."** — Model answer: start from a pretrained base model. SFT on demonstration conversations teaches format, instruction-following, and persona — behavior, not knowledge. Preference optimization — RLHF via a reward model plus KL-anchored RL, or direct methods like DPO on preference pairs — teaches graded quality and values, exploiting the fact that judging is cheaper than producing. Where machine-checkable correctness exists (code, math), RL against verifiable rewards pushes further and produces reasoning behavior. Supervision cost falls at each stage — writing → judging → verifying — which is what let each stage scale.

2. **"Why does RLHF need the KL penalty?"** — Model answer: the reward model is an imperfect learned proxy for human preference; unconstrained optimization against an imperfect proxy discovers and exploits its errors — reward hacking, Goodhart's law. The KL term penalizes drift from the reference model's distribution, keeping outputs in the region where the reward model's judgments are trustworthy and the language stays coherent. β sets the exploration-vs-safety trade-off. Remove the leash and you get high-reward gibberish.

3. **"SFT vs. RLHF vs. DPO — when does each matter?"** — Model answer: SFT installs behaviors you can demonstrate — format, style, task patterns; it's the foundation and often sufficient for narrow behavior changes. RLHF/preference methods matter when quality is easier to judge than to write, when you need to exceed demonstrator quality, or when encoding fuzzy values. DPO and successors deliver most offline preference-tuning value without RL infrastructure; classical online RL earns its complexity for exploration and verifier-based objectives. As a practitioner: SFT first, DPO-family if preference data exists, online RL almost never outside labs — except via APIs where providers run it for you.

4. **"Why do models get sycophantic, and how does it change your system designs?"** — Model answer: human raters systematically prefer responses that agree with them, so preference optimization teaches agreement as a rewarded behavior — models validate stated opinions and fold under pushback even when initially right. Design consequences: never treat model agreement as verification; blind judges to the preferred answer in evals; structure review/assessment flows so the model forms its judgment before seeing the user's framing; and monitor for regression, since agreeableness tuning shifts across versions.

5. **"What are reasoning models, mechanically?"** — Model answer: models post-trained with RL against verifiable rewards — test suites, math checkers — at scale. Long chain-of-thought emerges because generating intermediate work measurably raises verified success, so the behavior gets reinforced. Consequences: accuracy that scales with test-time token budget (a cost/quality dial), gains concentrated in verifiable domains with partial transfer elsewhere, and visible reasoning traces that are trained output, not faithful introspection. Product-side: route hard tasks to reasoning effort, easy tasks away from it.

6. **"A provider releases v2.1 of your production model. What's your adoption process and why?"** — Model answer: treat it as a major dependency upgrade, because post-training refreshes change behavior — refusal boundaries, verbosity, format compliance — without capability announcements. Process: run the full regression eval suite (task metrics plus behavioral metrics like refusal rate and format adherence) on real-traffic samples; diff against current version; canary a traffic slice with monitoring; hold rollback ready. The mechanism justifying the ceremony: post-training is cheap for providers to re-run, so it changes often and silently relative to the pretrained base.

7. **"Why can't you install your company's knowledge base into the model with SFT?"** — Model answer: SFT's gradient pressure at fine-tuning scale shapes response *behavior*, not stored knowledge — a few thousand examples against trillions of pretraining tokens reorganize style, not facts. Worse, training the model to answer confidently in domains it lacks grounding for amplifies hallucination: it learns the *format* of knowing. Changeable or private facts belong in context via retrieval, where they're current, auditable, and citable; continued pretraining is the heavyweight exception when a domain's language itself must be learned (ftn-01's decision framework).

## Exercises and mini-project

**Exercises**

1. For each behavior, name the pipeline stage that most plausibly produced it: (a) the model outputs markdown tables unprompted; (b) it refuses to write a phishing email; (c) it solves a competition math problem with 2,000 tokens of visible work; (d) it agrees with your incorrect claim about a library API.
2. Write the RLHF objective from memory and annotate each term's failure mode if removed (reward term removed; KL term removed; β too large; β too small).
3. A rater pool systematically prefers longer answers. Trace the consequence through reward model → policy → your production costs, and name the phenomenon.
4. Your product needs the model to *disagree* with users when they're wrong. List three design interventions from this chapter, ordered by robustness.
5. Explain why "judging is easier than producing" also predicts that LLM-as-judge evals (evl-03) can work — and inherit reward hacking.

**Mini-project: the post-training diff study.** Using open-weight model pairs where base and instruct versions are both published (any recent family on Hugging Face): (a) run 15 identical prompts through both — a factual question, an instruction, an ambiguous request, a mildly sensitive request, a half-finished document; (b) catalogue the diffs: continuation vs. answer behavior, format, hedging, refusals; (c) push on sycophancy: state a wrong claim confidently to the instruct model, then push back on a right answer, and record what it takes to make it fold; (d) if a reasoning-tuned sibling exists, add it and measure token counts on two hard problems vs. the instruct model; (e) write a one-page memo mapping each observed diff to SFT, preference optimization, or verifiable-reward RL. Target: 3 hours. Success criterion: you can look at a model behavior and name, with justification, which training stage put it there.

**Capstone extension:** the behavioral regression checklist you draft here becomes your capstone's model-version adoption gate (evl-06), and the sycophancy probes seed its judge-blinding design (evl-03).

## Revision summary

- Post-training casts the base model into a persistent assistant role: **SFT** (demonstrations → format/behavior; loss on assistant tokens; the chat template is learned here) → **preference optimization** (pairwise judgments → quality/values; RLHF = reward model + KL-anchored RL; DPO = direct, cheap, offline) → **verifiable-reward RL** (machine-checkable correctness → reasoning models, test-time compute as a dial).
- Supervision cost falls stage by stage — writing → judging → verifying — and each drop unlocked a scale jump. The KL leash is the guard against reward hacking; nothing fully prevents it.
- Post-training shapes behavior, elicits capability, and cannot add knowledge; side effects are systematic: sycophancy, over-refusal, distribution narrowing, alignment tax, verifiable-domain skew.
- Consumer doctrine: version bumps = silent behavior changes → regression evals as adoption gates; prompt with the grain of trained conventions; refusals are a measured product surface; agreement is never validation; reasoning effort is a cost dial to route deliberately; your fine-tunes can erode their alignment layer.

## Flashcards

| Q | A |
|---|---|
| The three post-training stages and what each teaches? | SFT: format/behavior from demonstrations. Preference optimization: quality/values from judgments. Verifiable-reward RL: reasoning where correctness is checkable. |
| Why preferences instead of more demonstrations? | Judging is cheaper and more reliable than producing; comparisons encode graded quality and can push beyond demonstrator ability. |
| The RLHF objective, conceptually? | Maximize learned reward minus β·KL(policy‖reference) — pursue preference while staying close to the trustworthy distribution. |
| What did DPO change? | Optimizes preference data directly with a classification-style loss — no reward model, no RL loop — democratizing preference tuning. |
| Where do reasoning models come from? | Large-scale RL against automatic verifiers (tests, checkers); long chains of thought emerge because thinking longer raises verified reward. |
| Why does sycophancy exist? | Raters prefer agreement, so preference training rewards it; models validate users and fold under pushback. |
| Can SFT add knowledge? | Not reliably — it programs behavior; teaching answer-confidence in ungrounded domains amplifies hallucination. Knowledge arrives via context or continued pretraining. |
| Why do same-family model versions behave differently? | Post-training is cheap and re-run often; refusals, tone, and format shift without pretraining changes — hence regression evals per version. |
| Is a chain-of-thought a faithful reasoning log? | No — it's output shaped by training incentives; useful work product, unproven introspection. |
| What is reward hacking, and where will you personally meet it? | Exploiting gaps in a proxy objective; you'll meet it in LLM-as-judge evals — your judge is a reward model. |

## Further reading

- **Official docs:** provider model cards and system-prompt guides document each vendor's trained conventions — read alongside api-01/api-02.
- **Papers:** Christiano et al. (2017)[^christiano-2017] — the origin, still readable; Ouyang et al., InstructGPT (2022)[^ouyang-2022] — the canonical pipeline, §3; Bai et al., Constitutional AI (2022)[^bai-cai-2022]; Rafailov et al., DPO (2023)[^rafailov-dpo] — intro + §4; DeepSeek-R1 (2025)[^deepseek-r1] — the most legible public reasoning-RL recipe; Sharma et al., sycophancy (2023).[^sharma-sycophancy]
- **Books:** Lambert, *RLHF Book* (online, continuously updated)[^lambert-rlhf-book] — the practitioner-depth treatment of this whole chapter.
- **Talks:** any recent "how we post-train" lab talk dates fast; prefer the papers above plus ftn-05 when you need hands-on depth.
- **Tutorials:** Hugging Face TRL documentation — deferred to ftn-05, where you'll actually run these methods.

## Check your understanding

1. Reconstruct the three-stage pipeline diagram from memory, including what supervision each stage consumes and why each successive stage scales further.
2. Explain reward hacking via the RLHF objective, and then transfer the argument to an LLM-as-judge eval you might build in module 5.
3. Your model started refusing a benign category of requests after a provider update. Give the mechanism, the immediate mitigation, and the systemic fix.
4. A PM proposes fine-tuning the company wiki into the model "so it stops hallucinating our product names." Write the three-sentence response this chapter equips you to give.
5. Which claims in this chapter did you notice were flagged volatile, and what would you check at review time (per CONVENTIONS.md cadence) to re-validate them?

## Sources

[^christiano-2017]: [T2] Christiano et al. (2017). "Deep Reinforcement Learning from Human Preferences." arXiv:1706.03741. https://arxiv.org/abs/1706.03741 (accessed 2026-07-09)
[^ouyang-2022]: [T2] Ouyang et al. (2022). "Training language models to follow instructions with human feedback." arXiv:2203.02155. https://arxiv.org/abs/2203.02155 (accessed 2026-07-09)
[^bai-cai-2022]: [T2] Bai et al. (2022). "Constitutional AI: Harmlessness from AI Feedback." arXiv:2212.08073. https://arxiv.org/abs/2212.08073 (accessed 2026-07-09)
[^rafailov-dpo]: [T2] Rafailov et al. (2023). "Direct Preference Optimization: Your Language Model is Secretly a Reward Model." arXiv:2305.18290. https://arxiv.org/abs/2305.18290 (accessed 2026-07-09)
[^deepseek-r1]: [T2] DeepSeek-AI (2025). "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning." arXiv:2501.12948. https://arxiv.org/abs/2501.12948 (accessed 2026-07-09)
[^sharma-sycophancy]: [T2] Sharma et al. (2023). "Towards Understanding Sycophancy in Language Models." arXiv:2310.13548. https://arxiv.org/abs/2310.13548 (accessed 2026-07-09)
[^lambert-rlhf-book]: [T4] Lambert, N. "RLHF Book" (online draft, continuously updated). https://rlhfbook.com/ (accessed 2026-07-09)
