---
id: fnd-06
title: "How LLMs Are Trained"
module: foundations
prerequisites: [fnd-05]
related_ids: [fnd-07, fnd-09, ftn-02]
keywords:
  - pretraining
  - next-token prediction
  - scaling laws
  - chinchilla
  - training data
  - data curation
  - base model
  - emergent abilities
  - knowledge cutoff
  - distributed training
summary: >-
  What pretraining is and why it works: next-token prediction over trillions of
  tokens, the data pipelines that matter more than architecture, scaling laws
  and the compute-optimal trade-off, and what a base model actually is. Ends
  with the consumer consequences — knowledge cutoffs, memorization, benchmark
  contamination, and why capability arrives in steps.
difficulty: 3
est_minutes: 240
status: stable
volatility: evergreen
last_reviewed: 2026-07-09
sources:
  - key: kaplan-2020
    tier: 2
    title: "Scaling Laws for Neural Language Models"
    org: arXiv
    url: https://arxiv.org/abs/2001.08361
    accessed: 2026-07-09
  - key: hoffmann-2022
    tier: 2
    title: "Training Compute-Optimal Large Language Models (Chinchilla)"
    org: arXiv
    url: https://arxiv.org/abs/2203.15556
    accessed: 2026-07-09
  - key: brown-2020
    tier: 2
    title: "Language Models are Few-Shot Learners"
    org: arXiv
    url: https://arxiv.org/abs/2005.14165
    accessed: 2026-07-09
  - key: touvron-llama
    tier: 2
    title: "LLaMA: Open and Efficient Foundation Language Models"
    org: arXiv
    url: https://arxiv.org/abs/2302.13971
    accessed: 2026-07-09
  - key: penedo-fineweb
    tier: 4
    title: "FineWeb: decanting the web for the finest text data at scale"
    org: Hugging Face
    url: https://huggingface.co/spaces/HuggingFaceFW/blogpost-fineweb-v1
    accessed: 2026-07-09
  - key: wei-emergent
    tier: 2
    title: "Emergent Abilities of Large Language Models"
    org: arXiv
    url: https://arxiv.org/abs/2206.07682
    accessed: 2026-07-09
  - key: schaeffer-mirage
    tier: 2
    title: "Are Emergent Abilities of Large Language Models a Mirage?"
    org: arXiv
    url: https://arxiv.org/abs/2304.15004
    accessed: 2026-07-09
  - key: carlini-2021
    tier: 2
    title: "Extracting Training Data from Large Language Models"
    org: arXiv
    url: https://arxiv.org/abs/2012.07805
    accessed: 2026-07-09
---

# How LLMs Are Trained

Pretraining is where a language model's capability comes from — everything else in the lifecycle (instruction tuning, RLHF, your prompts) steers capability that was built here. The recipe sounds absurdly simple: take a transformer (fnd-05), feed it trillions of tokens of text, and train it with gradient descent (fnd-02) to predict each next token. This chapter explains why that objective produces general capability, why *data curation* is the real craft, what scaling laws say about spending a compute budget, roughly how a multi-week distributed training run works, and what the resulting *base model* is and is not. The payoff for an AI engineer is a set of consumer consequences you'll use weekly: why knowledge cutoffs exist, why models don't know your data (and what to do about it), why memorization creates privacy and benchmark-contamination problems, and why capability arrives in generational steps rather than continuously. The principles here are evergreen; the specific corpus sizes and cost figures scale up yearly.

## Intuition: prediction pressure builds a world model

Why would predicting the next token produce anything intelligent? Because *predicting well is hard in exactly the right way*. To predict the next token of "The verdict in the Smith trial was announced today: the jury found him ___", a model needs grammar (an adjective or noun phrase fits), domain knowledge (juries return verdicts like "guilty"), discourse tracking (who "him" is), and world modeling (what trials are). Every regularity in text — syntax, facts, logic, style, sentiment, code semantics — is *predictive signal*, and cross-entropy loss (fnd-02) pays the model to absorb any of it that lowers prediction error. Compressing the internet well *requires* modeling the processes that generated it, at least functionally.

The best analogy: pretraining is **lossy compression of the training corpus into the weights**. A model with a few billion parameters trained on tens of trillions of tokens cannot memorize everything; it is forced to find generalizations — reusable structure that predicts many documents at once. Where the corpus contains something extremely repeated (famous quotes, licenses, common code idioms), memorization does happen, with consequences covered below. But the bulk of what training extracts is pattern, not archive — which is why a model can complete text it has never seen, and why it can also confidently generate text that was never true (fnd-09 takes up hallucination).

One more framing that pays rent: the objective is *imitation of the corpus's token distribution*. A base model is not trained to be correct, helpful, or safe — it is trained to continue text the way the internet would. Everything you think of as assistant behavior is added later (fnd-07). Keep "what was the training pressure?" as your first question whenever model behavior surprises you.

## The objective, precisely

Pretraining minimizes next-token cross-entropy over the corpus: for each position in each document, the model outputs a distribution over the vocabulary (fnd-05's forward pass), and the loss is $-\log p(\text{actual next token})$, averaged over everything (fnd-02's formula, at scale). Because a transformer computes all positions in parallel with causal masking, *every token in a training document is simultaneously a training example* — a 4,000-token document contributes 4,000 prediction problems in one forward/backward pass. This density is a large part of why the recipe is economical.

Three engineering-relevant facts about the objective:

- **It is self-supervised** (fnd-02's taxonomy): labels are manufactured from raw text, so the entire accessible written record is training data with zero labeling cost. This is the economic unlock that makes foundation models possible.
- **Loss is interpretable.** A per-token loss of 2.0 nats means the model is, on average, as uncertain as choosing among $e^{2.0} \approx 7.4$ equally likely tokens (perplexity). Frontier-model pretraining losses on held-out web text sit in the low single digits, and *small differences matter*: scaling-law work shows smooth, predictable loss improvements translate into large capability differences.[^kaplan-2020]
- **The objective is indifferent to truth.** Fiction, misinformation, and satire are all valid prediction targets. The model learns "what text follows what text," including humanity's errors — a fact that post-training only partially repairs (fnd-07, sec-05).

## Data: the actual product

The architecture is public and stable; the optimizer is standard; compute is purchasable. What differentiates model quality most, and what labs guard most closely, is **the data pipeline**. Modern pretraining corpora are measured in tens of trillions of tokens, assembled roughly as follows:

- **Acquisition:** web crawls (the raw web is the bulk), code repositories, books, academic text, reference works, licensed corpora, and increasingly curated synthetic data (model-generated text filtered for quality — powerful and double-edged; see failure modes).
- **Filtering:** the raw web is mostly garbage — boilerplate, spam, machine-generated SEO sludge, adult content, gibberish. Quality filtering (heuristics + learned classifiers) typically discards the large majority of crawled text. Public reconstructions like FineWeb document the pipeline in detail: language ID, quality heuristics, classifier-based selection, and the striking result that *filtering choices move downstream benchmark performance more than most architecture choices*.[^penedo-fineweb]
- **Deduplication:** near-duplicate text wastes compute, amplifies memorization, and distorts the distribution; large-scale fuzzy dedup is standard.[^touvron-llama]
- **Mixture weighting:** how much code vs. web vs. books vs. multilingual text — set by *ablation experiments* (train small models on candidate mixtures, extrapolate), not by intuition. Mixture choices are why models have personalities of capability: heavy code mixture buys reasoning and coding strength; multilingual weight buys language coverage at some English cost.
- **Ordering/curriculum:** most tokens are shuffled, but end-of-training data (highest quality, often more recent) disproportionately shapes final behavior — one reason knowledge near the cutoff can feel sharper.

The evergreen lesson generalizes fnd-02's "the spec is the dataset" to civilization scale: **an LLM is a rendering of its corpus**. Odd capability gaps, dialect biases, training-data-era slang, code-style preferences — trace them to the mixture. And the same lesson lands on your desk in module 8: when you fine-tune, data curation will dominate your results too.

## Scaling laws: how to spend a compute budget

The empirical discovery that industrialized the field: **pretraining loss falls as a smooth power law in model size, dataset size, and training compute**, over many orders of magnitude.[^kaplan-2020] Two consequences reshaped everything. First, *predictability*: labs can train small models, fit the curve, and forecast a frontier run's loss before spending on it — capability planning became engineering. Second, *the scaling bet*: if loss (and downstream capability with it) improves smoothly with scale, the rational move is to scale — which is exactly the 2020–present trajectory.

The refinement every engineer should know by name: **Chinchilla (2022)** corrected the field's allocation. For a fixed compute budget, loss is minimized by scaling parameters and training tokens *together* — roughly 20 tokens per parameter — whereas the field had been training models too large on too little data.[^hoffmann-2022] A compute-optimal 70B-parameter model wants ~1.4T tokens.

The second-order correction matters even more to you as a *consumer*: **compute-optimal is not cost-optimal once inference exists.** Chinchilla optimizes training loss per training dollar, but a deployed model's lifetime cost is dominated by inference, and inference cost scales with model size. So the industry now deliberately *overtrains* — far more than 20 tokens per parameter on small and mid-size models — accepting extra training cost to get more capability into fewer parameters, because those parameters will be served billions of times.[^touvron-llama] This is why capable small models keep appearing, why model families ship in size tiers, and why the price/capability frontier you'll navigate in api-06 keeps improving faster than raw scale alone would predict.

> **Note:** know the shape, not the coefficients. The power-law form and the train-vs-inference allocation logic are the durable content; fitted constants shift with data quality, architecture era, and objective details.

## Anatomy of a training run

What actually happens during the weeks of a frontier pretraining run — consumer-level depth, because you will never operate one but will constantly reason about their outputs:

- **Scale of hardware:** thousands to tens of thousands of accelerators, running for weeks to months, at costs from tens to hundreds of millions of dollars for frontier runs. This capital wall is *why* the model layer is concentrated in a few labs and why the API economy exists (fnd-01's great divide).
- **Parallelism, in three sentences:** *data parallelism* replicates the model and splits the batch; *tensor parallelism* splits individual matrices across devices (needed once the model exceeds one device's memory — recall fnd-02's ~16 bytes/param training footprint); *pipeline parallelism* assigns different layers to different devices. Frontier runs compose all three; interconnect bandwidth becomes the binding constraint, which is why training clusters are exotic networking as much as raw FLOPs.
- **Failure is routine:** at this device count, hardware dies mid-run as a matter of statistics. Runs checkpoint frequently and restart from checkpoints; loss curves get watched like patient monitors for spikes and divergences (fnd-02's instability, at industrial stakes).
- **One epoch, more or less:** the corpus is so large that most data is seen roughly once — memorization pressure comes from *duplication within* the corpus more than from repetition of the corpus.
- **Evaluation during training:** held-out loss plus benchmark suites at checkpoints, both to steer the run and to forecast final capability via scaling curves.

## What pretraining produces: the base model

The artifact at the end of the run is a **base model**: a text-distribution engine, not an assistant. Given a prompt, it continues it the way internet text plausibly continues — ask it a question and it may answer, list more questions, or write a forum thread that *contains* your question, because all are plausible continuations. Base models are maximally capable and minimally steered: everything the assistant will know is in there, but the interface is raw distribution-matching. The conversion to something you can build products on — instruction following, refusals, chat format — is post-training, the subject of fnd-07.

The capability question that generated the most debate: do abilities **emerge** discontinuously with scale? Influential work catalogued tasks where performance jumps from near-chance to strong across a scale threshold;[^wei-emergent] a sharp rebuttal showed many such jumps are artifacts of discontinuous *metrics* (exact-match scoring makes smooth improvement look like a cliff), with underlying competence improving smoothly.[^schaeffer-mirage] The pragmatic synthesis for an engineer: *underlying capability scales smoothly; task-level performance — which is what your product experiences — can still flip from unusable to usable across one model generation.* Hence the working rule: **re-evaluate your hardest failed use cases on every major model release** — tasks impossible last year become products this year, and teams that notice first win (fnd-09 builds the evaluation literacy).

## Production engineering perspective

The consumer consequences — what pretraining mechanics mean for systems you build:

- **Knowledge cutoffs are structural.** A model knows the world as its corpus described it, up to its data cutoff, with recency softness near the edge. No prompt fixes this; grounding with retrieval (module 3) or tools (module 4) is the fix. Design so that *facts that change* come from your systems, not from weights.
- **Your data isn't in there** — private corpora, your product's docs, yesterday's tickets. The entire retrieval module exists because of this one fact. Corollary: anything the model *does* seem to know about your domain came from public text, with public text's accuracy.
- **Memorization is real at the tails.** Heavily duplicated training text can be extracted from models near-verbatim,[^carlini-2021] which creates provider-side privacy/copyright exposure and consumer-side lessons: don't assume generation is original (license scanners exist for generated code), and don't send secrets into *anyone's* training pipeline (check API data-use terms — sec-03).
- **Benchmark contamination is the default, not the exception.** Public benchmarks leak into web-scale corpora; treat vendor benchmark claims as advertising until reproduced on *your* held-out data (fnd-09, evl-02). This is fnd-02's data-leakage lesson at ecosystem scale.
- **Capability arrives in steps; costs fall in curves.** Pretraining runs are discrete events, so model quality improves generationally, while price per token declines steadily as inference efficiency (prd-02/03) and overtrained-small-model economics improve. Architecture roadmaps should anticipate both: what's marginal today may be routine next generation — the "assume the model gets better" heuristic from fnd-01, now with its mechanism.

## Historical evolution

**2018–2019:** GPT-1/GPT-2 establish generative pretraining and show zero-shot glimmers; "train on the web, predict the next token" stops sounding naive.[^brown-2020] **2020:** GPT-3 scales the recipe ~100× and in-context learning appears — few-shot prompting replaces fine-tuning for many tasks; scaling laws give the field its investment thesis.[^kaplan-2020][^brown-2020] **2022:** Chinchilla rebalances the recipe toward data;[^hoffmann-2022] the hunt for tokens begins in earnest. **2023–2024:** open-weight models (LLaMA line) demonstrate that disciplined data work at modest scale yields near-frontier quality, democratizing the recipe;[^touvron-llama] overtraining-for-inference becomes standard economics. **2024–present:** the data-constrained era — high-quality natural text is finite, so curation sophistication, synthetic data, and (the fnd-07 story) post-training and test-time compute carry increasing shares of capability gains. The through-line: every era's edge moved *down the stack of glamour* — architecture → scale → data → post-training.

## Common misconceptions

- **"The model looks things up in its training data."** There is no database and no lookup; there are weights shaped by prediction pressure. Recall is reconstruction — which is why it's fluent, approximate, and confidently wrong at the tails (fnd-09).
- **"It was trained on everything, including my company's data."** It was trained on a *filtered subset of public* text (plus licensed/synthetic corpora), ending at a cutoff. Private, paywalled, and recent content is absent — structurally, not accidentally.
- **"More parameters = better model."** Only with commensurate data and training compute (Chinchilla), and only per generation — a well-trained small model routinely beats a poorly trained large one, and overtrained small models beat naive scaling expectations.[^hoffmann-2022][^touvron-llama]
- **"Base models are just worse assistants."** They're a different artifact: distribution-matchers with no instruction-following contract. If you ever touch one directly (some open-weight workflows do), prompt it as *text to continue*, not as an agent to instruct.
- **"Emergence means capabilities are unpredictable, so planning is futile."** Loss improves predictably; task-level thresholds are partly metric artifacts;[^schaeffer-mirage] and the practical discipline — re-test hard tasks each generation — converts the step function into a roadmap input.
- **"Training loss numbers are comparable across models."** Loss depends on tokenizer (fnd-04), corpus, and context length; cross-model loss comparisons are meaningless without matched conditions. Compare on downstream evals — *yours*.

## Failure modes and trade-offs

- **Contaminated evaluation** — public test sets inside training corpora inflate benchmarks and misinform model selection. *Consumer defense:* private held-out evals (evl-02); treat any benchmark released before a model's cutoff as suspect for that model.
- **Memorization vs. generalization** — duplication drives verbatim recall of copyrighted/PII text;[^carlini-2021] dedup mitigates but can't eliminate. *Consumer exposure:* generated-content provenance and license risk in code products.
- **The data ceiling** — high-quality natural text is finite; the escalating response is synthetic data, which risks feedback loops (models training on model output degrading diversity — "model collapse" in the limit) and homogenization across labs training on similar distributions. *Watch, don't panic:* curation quality has so far outrun the ceiling.
- **Mixture trade-offs** — every capability weight (code, multilingual, math) trades against others at fixed budget; no model is best at everything, which is why model *selection* (api-06) is a real discipline rather than a leaderboard lookup.
- **Stale world model** — weights encode the corpus era's facts, APIs, library versions, and social context; drift is silent and pervasive. *Defense:* grounding as architecture (retrieval/tools), never trusting weights for anything that changes.

## Best practices

For the consumer of pretrained models — this chapter's doctrine:

- **Partition every product fact into "from weights" vs. "from my systems."** Stable world knowledge may live in weights; anything changing, private, or high-stakes must arrive via retrieval or tools, with the model as reasoner rather than source.
- **Know each production model's cutoff and treat it as an SLA input** — surface it in design reviews the way you'd surface a dependency's version.
- **Maintain a private eval set that has never touched the public internet**, and score every candidate model on it; assume public benchmarks are contaminated in the model's favor.
- **Re-run your "failed capability" list on every major model generation** — budget a recurring spike for it; capability steps are roadmap events.
- **Check data-use terms before sending sensitive tokens to any API** (training-on-inputs policies differ), and scan generated code in shipped products for license-significant verbatim output.[^carlini-2021]
- **When you reach fine-tuning (module 8), import this chapter's lessons wholesale:** curation beats volume, dedup beats size, mixture is strategy, contamination invalidates evals.

## Real-world examples

**The napkin economics of a frontier run.** A compute-optimal ~70B model wants ~1.4T tokens;[^hoffmann-2022] at realistic cluster throughput and cloud pricing, the training bill lands in the tens of millions of dollars before staffing, ablations, and failed runs. One arithmetic exercise explains the industry's structure: why a handful of labs train frontier models, why APIs are the distribution mechanism, and why "we'll pretrain our own" is almost never the right answer for a product team — while fine-tuning (module 8), at ~10,000× smaller budgets, often is.

**The benchmark that lied.** A team selects a model because it tops a public reasoning benchmark, then watches it underperform a "weaker" rival on their actual workload. Post-mortem: the benchmark predates the winner's data cutoff — contamination in the winner's favor — while the private eval (built per evl-02) had no such bias. The rival wins on the private eval and ships. The team's new rule, straight from this chapter: public benchmarks shortlist, private evals decide.

**The API that didn't exist.** A coding assistant confidently generates calls against a library version released after its cutoff — plausible-looking methods, wrong signatures. Diagnosis by this chapter: the weights render the library as the corpus knew it; recency is structurally absent. Fix: retrieval over current docs injected into context (rag-05 pattern), turning a weights problem into a grounding problem. The bug class disappears.

## Interview questions

1. **"Why does next-token prediction produce general capability?"** — Model answer: every regularity in text — grammar, facts, logic, code semantics, discourse structure — reduces prediction error, so cross-entropy pressure pays the model to internalize all of it. Predicting well at scale functionally requires modeling the processes that generate text. Framed as compression: trillions of tokens can't be memorized into billions of parameters, so training is forced to extract reusable structure. The objective's blind spot is truth — it learns "what follows what," not "what is so" — which is why grounding and post-training exist.

2. **"Explain Chinchilla to a CTO in three sentences."** — Model answer: for a fixed training budget, loss is minimized by growing model size and training data together — roughly 20 tokens per parameter — and the field had been under-training oversized models. But compute-optimal ignores inference: deployed models pay per-token serving costs scaling with size, so the industry deliberately overtrains smaller models beyond Chinchilla ratios, spending extra training once to save inference forever. Consequence for us: capable small models keep arriving, and model choice is a total-cost decision, not a size decision.

3. **"What is a base model, and when would anyone want one?"** — Model answer: the direct product of pretraining — a text-distribution engine that continues prompts the way its corpus would, with no instruction-following or safety contract. Post-training converts it into an assistant. You'd touch a base model for: research, building custom post-training on top (module 8 territory), or tasks that are genuinely distribution-matching (e.g. creative continuation, perplexity-based scoring). For products, you consume post-trained models — but understanding the base layer explains behaviors that leak through, like completion-mode responses to unusual prompts.

4. **"How does training-data contamination affect how you evaluate models, and what do you do about it?"** — Model answer: web-scale corpora ingest public benchmarks, so models partially memorize test sets and public scores overstate capability — differentially, favoring newer models with later cutoffs. Defenses: maintain private eval data that never touched the internet; prefer benchmarks released after a model's cutoff; weight your own task-distribution evals over any public number; and treat vendor benchmark marketing as a shortlisting signal only. It's the classic train/test leakage discipline from ML fundamentals, operating at ecosystem scale.

5. **"Why can't a prompt fix a knowledge cutoff?"** — Model answer: the cutoff isn't a setting — it's the absence of post-cutoff structure in the weights. Prompting can only steer what pretraining built. The architectural fix is grounding: retrieve current information into context (RAG) or fetch it with tools, letting the model reason over supplied facts rather than recall absent ones. Design rule: changeable facts come from systems; weights supply language, reasoning, and stable world knowledge.

6. **"Your team wants to pretrain a domain-specific model from scratch. Argue both sides."** — Model answer: For — total data control (compliance, no contamination), domain-optimal mixture, no provider dependency, possible unit-economics win at massive inference scale. Against — frontier-quality pretraining costs tens of millions and a rare team; general-corpus capability (reasoning, language) transfers into domains and is hard to match from domain data alone; fine-tuning or continued-pretraining on an open-weight base captures most domain gains at ~1/10,000 the cost; and the frontier moves — your from-scratch model competes with next year's APIs. Verdict for almost everyone: adapt, don't pretrain; revisit only with extreme scale, extreme constraints, or both.

7. **"Emergent abilities — real or mirage, and what do you do about it either way?"** — Model answer: the underlying loss and competence improve smoothly with scale; some reported discontinuities are artifacts of all-or-nothing metrics that hide partial progress. But product experience is often threshold-like regardless — a task is unusable until accuracy crosses a viability line, then it's a feature. Operationally the debate changes nothing: keep a suite of currently-failing tasks, re-run it each model generation, and treat crossings as roadmap events. Smooth curves plus hard thresholds still produce step-function products.

## Exercises and mini-project

**Exercises**

1. Compute the Chinchilla-optimal token count for 8B, 70B, and 400B parameter models. Then explain, in inference-economics terms, why a lab might train the 8B model on 15T tokens instead of its "optimal" count.
2. A model reports held-out loss of 1.9 nats/token; another reports 2.1 on a *different* tokenizer and corpus. What can you conclude? What single change would make the comparison meaningful?
3. List five categories of text that are systematically *absent or underweighted* in web-scale corpora, and for each, name a product capability that suffers.
4. Your compliance team asks: "Can the model leak someone's personal data from training?" Write the three-sentence honest answer, citing the mechanism.[^carlini-2021]
5. Design the contamination policy for your team's model evals: three rules that ensure a benchmark score means what it claims.

**Mini-project: train a tiny language model.** Using nanoGPT or equivalent (~small config, single GPU or CPU-hours): (a) train a character-level model on a distinctive corpus you assemble (~1–10 MB: your emails, a favorite author, your codebase); (b) sample from checkpoints at 10%, 50%, 100% of training and keep the outputs — watch structure emerge: characters → words → syntax → style; (c) deliberately duplicate one paragraph 500× in the corpus, retrain, and demonstrate memorization by prompting its prefix; (d) halve the model size and double it, same data, and compare losses — you have reproduced a scaling-law point and a contamination incident on a laptop; (e) write a one-page memo mapping each observation to this chapter's sections. Target: 4 hours plus training time. Success criterion: you have *watched* capability emerge from prediction pressure, and induced memorization on purpose.

**Capstone extension:** the "from weights vs. from my systems" partition you practice here becomes the grounding architecture of your capstone RAG system (rag-05), and the private-eval discipline seeds its model-selection round (api-06).

## Revision summary

- Pretraining = next-token cross-entropy over trillions of curated tokens; self-supervision makes the written record free training data; prediction pressure forces compression into generalizable structure — a lossy render of the corpus, indifferent to truth.
- Data pipelines (filter → dedup → mixture → curriculum) are the differentiating craft; filtering choices move downstream quality more than architecture tweaks; mixture weights explain capability personalities.
- Scaling laws: loss falls as a power law in size/data/compute — capability became forecastable. Chinchilla: scale tokens with parameters (~20:1) for compute-optimal training; inference economics then justify deliberate overtraining of smaller models.
- A training run is industrial: thousands of accelerators, composed parallelism, routine hardware failure, checkpoints, ~one epoch. Output: a **base model** — distribution engine, not assistant; fnd-07 adds the assistant.
- Consumer consequences: knowledge cutoffs are structural (ground with retrieval/tools); private data is absent by construction; memorization at the duplicated tails (privacy/license exposure); public benchmarks presumed contaminated (private evals decide); capability steps per generation (re-test failed tasks each release).

## Flashcards

| Q | A |
|---|---|
| The pretraining objective in one line? | Minimize next-token cross-entropy over a curated multi-trillion-token corpus — self-supervised imitation of the text distribution. |
| Why does prediction produce capability? | Every textual regularity (facts, logic, syntax, code) reduces prediction error, so the loss pays the model to internalize it; compression forces generalization. |
| What is a base model? | The raw pretraining artifact: continues text as the corpus would; no instruction-following, helpfulness, or safety contract. |
| Chinchilla's rule and its caveat? | Compute-optimal training scales tokens with parameters (~20:1); caveat — inference costs justify overtraining smaller models past the ratio. |
| Why are knowledge cutoffs unfixable by prompting? | Post-cutoff structure is absent from the weights; prompting steers only what training built. Grounding (RAG/tools) is the fix. |
| The main data-pipeline stages? | Acquire → quality-filter (most of the web is discarded) → deduplicate → weight the mixture → order/curriculum. |
| Why assume benchmark contamination? | Public test sets leak into web-scale corpora, inflating scores — differentially for models with later cutoffs; private evals decide. |
| What drives memorization risk? | Duplication in the corpus; heavily repeated text can be extracted near-verbatim (privacy/license exposure). |
| Emergent abilities — the pragmatic take? | Competence scales smoothly; metrics and product viability create thresholds; re-test failing tasks every model generation. |
| Why do capable small models keep appearing? | Overtraining economics + data quality gains: spend more training once to shrink parameters served billions of times. |

## Further reading

- **Official docs:** none — pretraining lives in papers and lab reports; provider model cards summarize cutoffs and training approaches at consumer depth.
- **Papers:** Kaplan et al., scaling laws (2020)[^kaplan-2020] — figures 1–3; Hoffmann et al., Chinchilla (2022)[^hoffmann-2022] — §1 and table 3; Brown et al., GPT-3 (2020)[^brown-2020] — §1–2 for the in-context-learning moment; Touvron et al., LLaMA (2023)[^touvron-llama] — §2 for a legible data recipe; Carlini et al., extraction (2021)[^carlini-2021]; Wei et al. (2022)[^wei-emergent] vs. Schaeffer et al. (2023)[^schaeffer-mirage] — read as a pair.
- **Books:** none current enough to recommend over the papers.
- **Talks:** Karpathy, "Let's reproduce GPT-2" (YouTube, 2024) — a full pretraining run, end to end, at watchable scale.
- **Tutorials:** the FineWeb blog post[^penedo-fineweb] — the most transparent public walkthrough of industrial data curation; read before any fine-tuning project.

## Check your understanding

1. Explain the compression framing of pretraining, and use it to predict where memorization (vs. generalization) will occur in a trained model.
2. A vendor announces a model "trained on 10× more data" than its predecessor. Using scaling-law logic, what two questions determine whether that translates into better economics *for your product*?
3. Reconstruct the causal chain from "corpus has a data cutoff" to "our architecture needs a retrieval layer" without consulting the chapter.
4. Your eval shows a new model acing a public benchmark but flat on your private suite. Rank the explanations by prior probability and name your next diagnostic step.
5. Why is this chapter `stable/evergreen` when training runs get bigger yearly? Identify the two claims most likely to need revision at the next review, and why they're flagged rather than restructured.

## Sources

[^kaplan-2020]: [T2] Kaplan et al. (2020). "Scaling Laws for Neural Language Models." arXiv:2001.08361. https://arxiv.org/abs/2001.08361 (accessed 2026-07-09)
[^hoffmann-2022]: [T2] Hoffmann et al. (2022). "Training Compute-Optimal Large Language Models." arXiv:2203.15556. https://arxiv.org/abs/2203.15556 (accessed 2026-07-09)
[^brown-2020]: [T2] Brown et al. (2020). "Language Models are Few-Shot Learners." arXiv:2005.14165. https://arxiv.org/abs/2005.14165 (accessed 2026-07-09)
[^touvron-llama]: [T2] Touvron et al. (2023). "LLaMA: Open and Efficient Foundation Language Models." arXiv:2302.13971. https://arxiv.org/abs/2302.13971 (accessed 2026-07-09)
[^penedo-fineweb]: [T4] Penedo et al. (2024). "FineWeb: decanting the web for the finest text data at scale." Hugging Face. https://huggingface.co/spaces/HuggingFaceFW/blogpost-fineweb-v1 (accessed 2026-07-09)
[^wei-emergent]: [T2] Wei et al. (2022). "Emergent Abilities of Large Language Models." arXiv:2206.07682. https://arxiv.org/abs/2206.07682 (accessed 2026-07-09)
[^schaeffer-mirage]: [T2] Schaeffer, Miranda & Koyejo (2023). "Are Emergent Abilities of Large Language Models a Mirage?" arXiv:2304.15004. https://arxiv.org/abs/2304.15004 (accessed 2026-07-09)
[^carlini-2021]: [T2] Carlini et al. (2021). "Extracting Training Data from Large Language Models." arXiv:2012.07805. https://arxiv.org/abs/2012.07805 (accessed 2026-07-09)
