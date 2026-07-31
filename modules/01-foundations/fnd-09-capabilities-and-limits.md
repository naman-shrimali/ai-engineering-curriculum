---
id: fnd-09
title: "Capabilities & Limits of LLMs"
module: foundations
prerequisites: [fnd-06, fnd-08]
related_ids: [api-06, evl-01, rag-05]
keywords:
  - llm capabilities
  - hallucination
  - jagged frontier
  - benchmarks
  - calibration
  - in-context learning
  - reversal curse
  - benchmark contamination
  - capability evaluation
summary: >-
  A calibrated mental model of what LLMs can and cannot do: why hallucination
  is structural, why the capability surface is jagged rather than smooth, what
  in-context learning buys, and how to read benchmarks without being fooled.
  Ends with the engineering doctrine — design for the frontier's shape, verify
  where cheap, and re-map capabilities every model generation.
difficulty: 2
est_minutes: 180
status: evolving
volatility: mixed
last_reviewed: 2026-07-09
sources:
  - key: kalai-2025
    tier: 2
    title: "Why Language Models Hallucinate"
    org: OpenAI / arXiv
    url: https://arxiv.org/abs/2509.04664
    accessed: 2026-07-09
  - key: ji-survey
    tier: 2
    title: "Survey of Hallucination in Natural Language Generation"
    org: arXiv
    url: https://arxiv.org/abs/2202.03629
    accessed: 2026-07-09
  - key: dellacqua-2023
    tier: 2
    title: "Navigating the Jagged Technological Frontier"
    org: Harvard Business School working paper
    url: https://www.hbs.edu/faculty/Pages/item.aspx?num=64700
    accessed: 2026-07-09
  - key: mccoy-embers
    tier: 2
    title: "Embers of Autoregression: Understanding Large Language Models Through the Problem They are Trained to Solve"
    org: arXiv
    url: https://arxiv.org/abs/2309.13638
    accessed: 2026-07-09
  - key: berglund-reversal
    tier: 2
    title: "The Reversal Curse: LLMs trained on 'A is B' fail to learn 'B is A'"
    org: arXiv
    url: https://arxiv.org/abs/2309.12288
    accessed: 2026-07-09
  - key: kadavath-2022
    tier: 2
    title: "Language Models (Mostly) Know What They Know"
    org: Anthropic / arXiv
    url: https://arxiv.org/abs/2207.05221
    accessed: 2026-07-09
  - key: liang-helm
    tier: 2
    title: "Holistic Evaluation of Language Models (HELM)"
    org: Stanford CRFM / arXiv
    url: https://arxiv.org/abs/2211.09110
    accessed: 2026-07-09
---

# Capabilities & Limits of LLMs

This chapter closes the foundations module by assembling everything before it — training objectives (fnd-06), post-training incentives (fnd-07), tokenization artifacts (fnd-04), sampling variance (fnd-08) — into the thing an AI engineer actually needs: **a calibrated mental model of what these systems can be trusted to do**. The field's public discourse oscillates between "it's basically AGI" and "it's a stochastic parrot"; both are useless for engineering. The truth is stranger and more specific: LLM capability is *jagged* — superhuman and incompetent at tasks that look adjacent — hallucination is structural rather than a bug awaiting a patch, and benchmark numbers systematically overstate what will survive contact with your traffic. The durable skills here are a capability taxonomy, a diagnostic vocabulary for failure, and benchmark literacy. The specific frontier location is the most volatile fact in this repo — which is why this chapter teaches you to *re-map it per model generation* rather than memorize today's map.

## Intuition: the jagged frontier

The single most useful image: LLM capability is not a rising tide that covers "easy" tasks first and "hard" tasks later. It is a **jagged coastline** — deep capability inlets into territory humans find hard (produce idiomatic code in thirty languages, summarize a 100-page contract in seconds) directly adjacent to shallows on tasks a child manages (count the words in this sentence, reliably know what it doesn't know). The term comes from a large field experiment with consultants: for tasks inside the frontier, AI assistance massively boosted performance; for tasks just *outside* it — deliberately designed to look similar — AI assistance made professionals perform *worse*, because they trusted fluent output on a task the model couldn't do.[^dellacqua-2023]

That last clause is the engineering point. The danger isn't that models fail — everything fails — it's that **failure is not marked**: output quality is nearly uniform in *style* whether the substance is excellent or fabricated. Human experts signal uncertainty; LLMs emit the same confident prose either way. So the jaggedness plus unmarked failure yields the profession's core discipline, which the rest of this chapter justifies: **never infer capability at task B from performance at task A, however similar they look — measure each, and design the system so that being wrong is survivable.**

Why is the frontier jagged? Because capability tracks *the training distribution and objective*, not human difficulty rankings. Tasks abundantly represented in text (translation, code idioms, essay structure) are deep inlets; tasks that fight the substrate — character-level operations against tokenization (fnd-04), precise state tracking against single-pass generation, rare fact recall against lossy compression (fnd-06) — are shallows, regardless of how easy they feel to humans.[^mccoy-embers]

## Hallucination from first principles

Hallucination — fluent, confident, false output — is the limit engineers must understand most deeply, because product trust dies on it. It is not a defect to be patched; it follows from the construction, via three converging mechanisms:

- **The objective is distribution-matching, not truth-telling** (fnd-06). Training pressure rewards *plausible* continuations; where the model lacks the fact, the most plausible continuation is a well-formed invention — the correct *shape* of an answer with fabricated content. Recall is reconstruction from lossy compression, and reconstruction fills gaps silently.
- **Sparse facts sit below the reliability floor.** Facts seen once or twice in the corpus can't be reliably distinguished from noise at training time; recent theoretical work formalizes this — even an otherwise-ideal model *must* err on facts whose appearance in training data is essentially singleton, at rates tied to how much of the fact distribution is rare.[^kalai-2025] Long-tail entities, niche APIs, precise numbers, citations: structurally unreliable.
- **Evaluation and post-training reward guessing.** Benchmarks and raters score confident answers above "I don't know," so post-training (fnd-07) teaches the format of certainty even where knowledge is absent — the same paper's sharpest point: the ecosystem's grading schemes penalize calibrated abstention, so models are *optimized into* overconfidence.[^kalai-2025]

On calibration, the evidence is two-sided and worth holding precisely: models' internal signals carry real self-knowledge — probability estimates on their own answers are meaningfully calibrated in controlled settings[^kadavath-2022] — but that latent calibration degrades through post-training and does not surface in the *prose*: verbal confidence ("certainly", "definitely") is nearly uncorrelated with correctness. Engineering translation: confidence must come from **system design** — grounding (module 3), verification (module 5), logprob-style comparative signals (fnd-08) — never from the model's tone.

What moves hallucination rates: grounding facts in context (retrieval — the single biggest lever), verifiable-domain post-training (fnd-07), and abstention-friendly prompting/product design. What doesn't: temperature (fnd-08's misconception — a wrong model at T=0 is reproducibly wrong), sternly instructing the model not to hallucinate (weak effect at best), and scale alone (rates fall, the structural floor remains[^ji-survey][^kalai-2025]).

## A capability taxonomy for engineers

The map below organizes reliability by *task structure* — the dimension that actually predicts it. Fluency, breadth, and the specific frontier location are volatile; the *ordering* of these bands has been stable across model generations and is the durable content.

**Deep inlets — reliably strong (build on with light verification):**

- **Transformation with the source present:** summarization, rewriting, translation, format conversion, style transfer. The information is *in the context*; the model reshapes rather than recalls. This is the safest capability class in the catalog — and the architectural reason RAG works: retrieval converts a recall task (unreliable) into a transformation task (reliable).
- **Code in well-trodden territory:** idiomatic usage of popular languages and libraries, boilerplate, test scaffolding, explanation of given code — plus the enormous advantage that code is *cheaply verifiable* (it runs or it doesn't), which both enables verifier-based training (fnd-07) and gives your system a free correctness oracle.
- **Pattern-rich judgment at scale:** classification, extraction from provided text, sentiment/intent labeling, first-draft anything — tasks where "pretty good, instantly, forever" beats "perfect, slowly, sometimes."
- **In-context learning:** shown a few examples of a novel format or micro-task in the prompt, models generalize to new instances remarkably well (fnd-05's induction machinery is a plausible mechanism) — the capability that makes prompting a programming model at all.

**Shallows — structurally unreliable (design around, verify, or avoid):**

- **Unsourced fact recall in the long tail:** citations, niche numbers, minor entities, post-cutoff anything (fnd-06). The reversal curse sharpens how *unlike a database* the storage is: models trained that "A is B" routinely fail to answer "what is B?" with A — retrieval direction matters because it's learned pattern, not indexed fact.[^berglund-reversal]
- **Precise counting, character operations, and arithmetic at length:** fights tokenization (fnd-04) and single-pass generation both.[^mccoy-embers] Tool calls (module 4) exist for exactly this.
- **Long-horizon state tracking:** many-step processes where an early silent error compounds autoregressively (fnd-08's mechanism at task scale) — the central reliability challenge of agents (agt-09).
- **Knowing what it doesn't know, in prose:** the calibration gap above; abstention must be engineered, not expected.
- **Genuine novelty:** synthesis far outside the training distribution. Models interpolate and recombine masterfully; extrapolation is where fluent output most outruns substance.

> **Volatile:** reasoning-trained models (fnd-07) have pushed several shallows — multi-step math, some state tracking — meaningfully deeper, at token-budget cost. The taxonomy's bands hold; the waterline within each moves per generation. Re-test at every major release; treat this callout as the chapter's standing errand.

## Benchmark literacy

Public benchmarks are how the field talks about capability, and they mislead consumers in systematic ways. The defenses:

- **Contamination is the default assumption** (fnd-06): benchmarks published before a model's data cutoff have plausibly leaked into training; scores measure memorization-plus-capability in unknown proportion. Prefer post-cutoff benchmarks; trust private data most.
- **Saturation and Goodharting:** headline benchmarks get optimized *for* — labs tune data mixtures toward them — so scores compress toward ceilings and lose discriminative power precisely as marketing leans on them. A 2-point gap on a saturated benchmark predicts nothing about your workload.
- **Aggregate scores hide the jaggedness:** a single number averages over the exact task variance you need to know about; holistic multi-metric evaluation (accuracy *and* calibration, robustness, bias — the HELM framing[^liang-helm]) is the honest shape, and even that is someone else's task distribution, not yours.
- **The only benchmark that predicts your product is one built from your traffic** — which is the entire thesis of module 5, and why evl-01 sits so early in this curriculum's dependency graph. Public numbers shortlist candidates (api-06); private evals decide.

Reading a model card well is a skill: look for the cutoff date, the benchmark *versions* and whether they postdate it, calibration or refusal metrics if reported, and what *isn't* claimed — silence about a capability class is itself information.

## Production engineering perspective

Designing for the jagged frontier is the job description. The doctrine that the rest of this curriculum operationalizes:

- **Decompose toward the inlets.** Split workflows so the model handles transformation, classification, and drafting while retrieval supplies facts, tools handle arithmetic and lookups, and code paths handle state. Most "the model can't do X" problems dissolve into "the system shouldn't have asked the model to do X."
- **Verify where verification is cheap.** Code → run it; extraction → schema-validate against the source; claims → require citations into supplied context and spot-check them. Route the residual — expensive-to-verify, high-stakes output — to humans (agt-09's gates).
- **Make wrongness survivable.** Confidence-tiered UX (assert vs. suggest vs. ask), reversible actions by default, provenance surfaced to users. Products fail on *unmarked* wrongness; marked uncertainty is just software.
- **Engineer abstention.** Give the model explicit outs ("answer only from the provided context; otherwise say 'not found'"), reward them in your evals (deliberately counter to the ecosystem's grading bias[^kalai-2025]), and measure false-abstention alongside hallucination.
- **Maintain a living capability map.** A suite of currently-failing and barely-passing tasks from your domain, re-run each model generation (fnd-06's roadmap discipline) — capability crossings are product opportunities, and the map is your early-warning system in both directions.

## Historical evolution

The frontier's movement in one paragraph: **2019** — fluent text generation itself was the surprise; capability discourse was "coherent paragraphs." **2020** — in-context learning arrived with scale (fnd-06); tasks became promptable. **2022** — instruction-following and chat (fnd-07) made capability *legible*; the public discovered hallucination the same month it discovered assistants. **2023–2024** — tool use, structured outputs, and long context moved whole task families from shallows to inlets by *system design* rather than raw model change. **2024–present** — reasoning training pushed verifiable-domain shallows (math, multi-step logic) dramatically deeper and made capability *purchasable per-request* via test-time compute (fnd-07). The meta-lesson for an engineer reading this history: the frontier moves by *mechanism* — each advance traces to an identifiable change in training or system architecture, which is why the foundations module you've just finished is the lens that keeps working after this chapter's specifics age.

## Common misconceptions

- **"It reasons like a person, just faster."** It optimizes text-distribution objectives; performance tracks training-distribution density, not human difficulty — the source of both jaggedness and the persistent surprise at "easy" failures.[^mccoy-embers]
- **"Hallucination is a bug they'll fix soon."** Rates fall with grounding, verification training, and scale; the structural floor — sparse facts below the learnability threshold, incentives rewarding guesses — remains.[^kalai-2025] Systems, not patches, are the answer.
- **"The model knows when it's unsure — just ask it."** Latent self-knowledge exists[^kadavath-2022]; surfaced verbal confidence is nearly uncorrelated with correctness. Confidence is a system property you build, not a model property you query.
- **"It aced MMLU-class benchmarks, so it can handle our workload."** Contamination, saturation, Goodharting, and distribution mismatch each independently break that inference. Shortlist publicly, decide privately.
- **"If it can do the hard version, the easy version is safe."** The defining error of the jagged frontier — and empirically the one that made skilled professionals *worse* with AI assistance.[^dellacqua-2023] Adjacent-looking ≠ adjacent-capability; measure both.
- **"Bigger model = better at everything."** Better on average; per-task regressions across generations are routine (behavior drift, fnd-07; mixture shifts, fnd-06). This is why version adoption gets regression evals, not celebrations.

## Failure modes and trade-offs

The diagnostic vocabulary — name the failure, and this module tells you the mechanism and the fix:

- **Hallucination** (fluent fabrication) → mechanism: fnd-06 compression + fnd-07 incentives → fix: grounding, citations, verification, abstention design.
- **Prompt brittleness** (paraphrase flips the answer) → distribution sensitivity → fix: eval across phrasings, robust prompt patterns (api-02), don't ship one-prompt miracles.
- **Sycophantic collapse** (folds under user pushback) → fnd-07's rater incentives → fix: blind judgments, opinion-free framing.
- **Long-horizon drift** (step 14 quietly contradicts step 3) → autoregressive compounding → fix: checkpointing, external state, decomposition (agt-04/agt-09).
- **Tokenizer-shaped failures** (counting, spelling, numbers) → fnd-04 → fix: tools, not prompts.
- **Temporal confusion** (post-cutoff blanks, stale APIs presented as current) → fnd-06 → fix: retrieval with freshness, dates surfaced in context.
- **Trade-off running through all of them:** every mitigation spends something — latency (verification), cost (multi-sample, reasoning budgets), UX friction (abstention, confirmations), engineering (retrieval, tools). Capability engineering is choosing which failures your product can afford, then spending precisely against the rest.

## Best practices

- **Write the capability assumption down** for every LLM feature: which taxonomy band it relies on, and what marks failure. If the band is a shallow, redesign before you build.
- **Convert recall to transformation wherever possible** — retrieve, then ask; it's the highest-leverage reliability move in the field.
- **Trust tone never, provenance always:** citations into supplied context, verifiable intermediate artifacts, logprob-style comparative signals over verbal confidence.
- **Build the abstention path first,** not as an afterthought — "not found" handling shapes the whole UX and the eval design.
- **Run capability probes, not vibe checks, on new models:** your private suite, n-run pass rates (fnd-08), per-task diffs against the incumbent — before any traffic shifts.
- **Budget verification proportional to blast radius:** free oracles (execution, schemas) always; judges and humans where consequences warrant (module 5 and agt-09 build the machinery).
- **Revisit this chapter's volatile callout at every review cycle** — it is the repo's designated tripwire for frontier movement.

## Real-world examples

**The citation that didn't exist.** A law firm submits a brief containing case citations an assistant model fabricated — well-formed reporter numbers, plausible case names, entirely invented. Every mechanism in this chapter appears: long-tail unsourced recall (structurally unreliable), fluent unmarked failure (citations *looked* exactly right), misplaced trust inside a jagged frontier (the model *had* drafted good legal prose before). The engineering fix, had the workflow been a product: retrieval against a legal database with citations required to resolve, converting recall to transformation — plus provenance UX making unverified claims visually distinct.

**The support bot that invented a refund policy.** A customer-facing bot, asked about an edge-case refund, confidently describes a generous policy that doesn't exist; a customer screenshots it; the company honors it. Diagnosis: ungrounded generation in a domain where the model had *general* knowledge (refund policies as a genre — deep inlet) but not *this company's* facts (shallow). Fix: the rag-05 pattern with answer-only-from-context prompting, an abstention path to human handoff, and an eval measuring exactly this failure (rag-07's groundedness). The incident cost more than the retrieval pipeline would have.

**The capability crossing that became a product.** A team's living capability map includes "reconcile two 50-page contracts and list substantive differences" — failing for two model generations, then crossing to 90%+ on a reasoning-model release (verifiable-adjacent structure, deeper waterline). Because the probe suite existed, the team detected the crossing the week the model shipped and launched the feature a quarter before competitors — the fnd-06 "re-test failed tasks" discipline paying its rent.[^dellacqua-2023]

## Interview questions

1. **"Why do LLMs hallucinate, and what actually reduces it?"** — Model answer: three converging mechanisms — the training objective rewards plausible continuation rather than truth, so gaps get filled with well-formed inventions; facts appearing rarely in the corpus sit below a statistical learnability floor, so long-tail recall must err; and evaluation-plus-post-training reward confident guessing over abstention, teaching the format of certainty without the substance. What works: grounding facts in context via retrieval (converting recall to transformation), verification layers with cheap oracles, and abstention-friendly design. What doesn't: temperature changes, "do not hallucinate" instructions, or waiting for a patch — the floor is structural.

2. **"What is the jagged frontier and how does it change system design?"** — Model answer: LLM capability doesn't track human difficulty — it tracks training-distribution density, producing deep competence adjacent to surprising incompetence, with failures unmarked by any change in tone. Field evidence shows professionals perform *worse* with AI on tasks just outside the frontier because fluency invites misplaced trust. Design consequences: never generalize capability across adjacent-looking tasks — measure each; decompose systems so models handle strong bands (transformation, classification, drafting) while tools, retrieval, and code handle weak ones; and make wrongness survivable with verification and confidence-tiered UX.

3. **"How do you evaluate whether a new model is better for your product?"** — Model answer: public benchmarks only shortlist — contamination (test sets leak into training), saturation, and Goodharting make headline numbers weak evidence, and aggregates hide per-task variance. The decision comes from a private eval built from real traffic: task metrics plus behavioral metrics (refusal rate, format compliance, groundedness), run n times per case for statistical stability, diffed per-task against the incumbent — because averages improving while three of your tasks regress is the common case, not the edge case.

4. **"Can you trust a model's expressed confidence?"** — Model answer: no — and the nuance matters. Internally, models carry meaningful calibration: their probability estimates on own answers correlate with correctness in controlled settings. But post-training distorts it, and none of it surfaces reliably in prose — verbal certainty is nearly uncorrelated with accuracy. So confidence must be engineered: comparative logprob signals, citation-into-context requirements, verifier checks, and abstention paths, with expressed tone treated as styling.

5. **"Your PM wants to extend the working contract-summarizer to also answer questions about contract law. Assess."** — Model answer: that's a frontier-adjacency trap. Summarization is transformation over supplied text — the model's strongest band. Legal Q&A is unsourced long-tail recall plus high stakes — the weakest band with the worst failure economics, as the fabricated-citations genre of incident shows. The extension needs a different architecture, not a bigger prompt: retrieval over an authoritative legal corpus, answers constrained to retrieved context with resolvable citations, abstention and escalation paths, and a groundedness eval before launch. Same model, different system.

6. **"What is the reversal curse and what does it teach you about LLM knowledge?"** — Model answer: models trained on "A is B" often fail to answer "what is B?" with A — knowledge is stored as directional learned patterns, not as an indexed database supporting arbitrary queries. It's the cleanest single demonstration that recall is pattern-completion over compression, which predicts the broader shallows: long-tail facts, citation precision, novel query directions. Engineering moral: if you need database semantics — completeness, inverse lookup, freshness — use a database, and let the model transform what it retrieves.

7. **"How should a team operationalize 'capabilities improve every few months'?"** — Model answer: a living capability map — a versioned suite of currently-failing and barely-passing tasks from the product's own domain, with n-run pass rates, re-executed on every major model release. Crossings in one direction are roadmap events (features that just became possible); regressions in the other are adoption blockers caught before traffic moves. It converts frontier movement from news-cycle noise into a measured input, and it's cheap — the eval harness already exists if the team practices module-5 discipline.

## Exercises and mini-project

**Exercises**

1. Classify each into the taxonomy's bands, with the mechanism from this module that justifies the placement: (a) "translate this error log to plain English"; (b) "what year was [minor historical figure] born?"; (c) "how many sentences did I just write?"; (d) "draft unit tests for this function"; (e) "list the differences between these two supplied policies."
2. Using the three hallucination mechanisms, explain why fabricated *citations* are the genre's most persistent failure — which mechanism does each property of a citation (rare, precise, formulaic) trigger?
3. A vendor announces +4 points on a famous benchmark vs. its predecessor. List four reasons this may not transfer to your workload, each traceable to a section of this chapter.
4. Design the abstention contract for a RAG support bot: the prompt clause, the UX behavior, and the two metrics (missed-abstention and false-abstention) with target directions.
5. Take a real incident you've seen (or the legal-citations case) and write its five-line diagnosis using this chapter's failure vocabulary: failure mode → mechanism → chapter reference → fix → eval that would have caught it.

**Mini-project: map a jagged frontier.** Pick one accessible model (API or local). (a) Design 24 probes: four per band across six categories — transformation, grounded extraction, code, long-tail recall, counting/character ops, multi-step state tracking — each objectively scoreable; (b) run each probe 5 times (fnd-08's statistical discipline), score pass rates; (c) plot the capability profile — you should *see* the jaggedness: near-100% bands adjacent to near-0% ones; (d) for the two worst bands, apply one system-level fix each (supply the facts in context; delegate counting to a instructed tool-style workaround) and re-measure; (e) write a one-page memo: your model's frontier map, the two fixes' deltas, and which product features you would green-light, redesign, or refuse on this evidence. Target: 3 hours. Success criterion: an empirical jaggedness plot you made yourself, and a demonstrated recall→transformation reliability jump.

**Capstone extension:** your probe suite becomes the capability-regression layer of the capstone's model-adoption gate (evl-06), and the recall→transformation fix is the design argument for its retrieval architecture (rag-05).

## Revision summary

- Capability is jagged: it tracks training-distribution density and objective structure, not human difficulty — deep inlets (transformation over supplied text, well-trodden code, classification, in-context learning) adjacent to structural shallows (long-tail unsourced recall, counting/character ops, long-horizon state, surfaced calibration, genuine novelty). Failure is unmarked; tone is uniform across excellence and fabrication.
- Hallucination is structural: distribution-matching fills gaps with plausible inventions; singleton facts sit below the learnability floor; grading schemes reward confident guessing over abstention. Grounding, verification, and abstention design move rates; temperature and instructions don't; a floor remains.
- Latent calibration exists but doesn't surface in prose — confidence is a system property (provenance, verifiers, comparative signals), never a tone property.
- Benchmarks: assume contamination, discount saturated leaderboards, distrust aggregates; shortlist publicly, decide on private evals from your traffic.
- Doctrine: decompose toward the inlets (retrieval converts recall→transformation — the field's highest-leverage move), verify where cheap, make wrongness survivable, engineer abstention, and maintain a living capability map re-run every model generation.

## Flashcards

| Q | A |
|---|---|
| The jagged frontier in one sentence? | Capability tracks training-distribution density, not human difficulty — deep competence sits adjacent to surprising incompetence, with failures unmarked. |
| Three structural causes of hallucination? | Plausibility-rewarding objective fills knowledge gaps; singleton facts fall below the learnability floor; evals and post-training reward guessing over abstention. |
| The most reliable capability band? | Transformation with the source present in context — summarize, rewrite, extract, convert. |
| Why does RAG improve factual reliability, in taxonomy terms? | It converts unsourced recall (shallow) into grounded transformation (deep inlet). |
| What does the reversal curse demonstrate? | Knowledge is directional pattern-completion, not an indexed database — "A is B" doesn't yield "B is A." |
| Can you trust verbal confidence? | No — latent calibration exists internally but verbal certainty is nearly uncorrelated with correctness; engineer confidence via provenance and verification. |
| Why are public benchmark scores weak evidence? | Contamination by training data, saturation/Goodharting, and aggregate scores hiding per-task variance — plus it's not your task distribution. |
| The professional's core discipline on the frontier? | Never infer capability at task B from task A; measure each; design so wrongness is survivable. |
| What is a living capability map? | A versioned suite of failing/barely-passing domain tasks re-run each model generation — crossings are roadmap events, regressions are adoption blockers. |
| What's this chapter's designated volatile claim? | The current waterline within each capability band (esp. reasoning-model gains) — re-tested per release; the band ordering itself is stable. |

## Further reading

- **Official docs:** provider model cards — practice reading them with this chapter's checklist (cutoff, benchmark vintage, what's not claimed).
- **Papers:** Kalai et al., "Why Language Models Hallucinate" (2025)[^kalai-2025] — the statistical argument, §1–3; Dell'Acqua et al., jagged frontier field experiment (2023)[^dellacqua-2023]; McCoy et al., "Embers of Autoregression" (2023)[^mccoy-embers] — teleological analysis of the shallows; Berglund et al., reversal curse (2023)[^berglund-reversal]; Kadavath et al., self-knowledge (2022)[^kadavath-2022]; Ji et al., hallucination survey (2022)[^ji-survey] — reference, not cover-to-cover; Liang et al., HELM (2022)[^liang-helm] — the holistic-evaluation framing.
- **Books:** none current enough; this chapter's territory moves too fast for book-length treatments to stay accurate.
- **Talks:** conference talks on capability age in months; prefer the papers plus your own probe suite.
- **Tutorials:** none — the mini-project *is* the tutorial, and it produces an artifact you'll reuse.

## Check your understanding

1. Reconstruct the capability taxonomy from memory and, for each shallow, name the foundations-module mechanism (chapter and concept) that explains it.
2. Explain the three-mechanism account of hallucination to a skeptical PM who "just wants the model to stop making things up," ending with what you'd build instead.
3. Your model upgrade improves the aggregate eval score by 6% but you haven't looked deeper. What does this chapter make you check before rollout, and why?
4. A feature idea requires the model to recall your company's product SKUs. Walk the redesign this chapter mandates, naming the taxonomy bands before and after.
5. Module 1 is now complete. In five sentences, trace how fnd-02 through fnd-08 each contribute one mechanism to this chapter's capability map — the test of whether the module cohered.

## Sources

[^kalai-2025]: [T2] Kalai et al. (2025). "Why Language Models Hallucinate." arXiv:2509.04664. https://arxiv.org/abs/2509.04664 (accessed 2026-07-09)
[^ji-survey]: [T2] Ji et al. (2022). "Survey of Hallucination in Natural Language Generation." arXiv:2202.03629. https://arxiv.org/abs/2202.03629 (accessed 2026-07-09)
[^dellacqua-2023]: [T2] Dell'Acqua et al. (2023). "Navigating the Jagged Technological Frontier: Field Experimental Evidence of the Effects of AI on Knowledge Worker Productivity and Quality." Harvard Business School Working Paper 24-013. https://www.hbs.edu/faculty/Pages/item.aspx?num=64700 (accessed 2026-07-09)
[^mccoy-embers]: [T2] McCoy et al. (2023). "Embers of Autoregression: Understanding Large Language Models Through the Problem They are Trained to Solve." arXiv:2309.13638. https://arxiv.org/abs/2309.13638 (accessed 2026-07-09)
[^berglund-reversal]: [T2] Berglund et al. (2023). "The Reversal Curse: LLMs trained on 'A is B' fail to learn 'B is A'." arXiv:2309.12288. https://arxiv.org/abs/2309.12288 (accessed 2026-07-09)
[^kadavath-2022]: [T2] Kadavath et al. (2022). "Language Models (Mostly) Know What They Know." arXiv:2207.05221. https://arxiv.org/abs/2207.05221 (accessed 2026-07-09)
[^liang-helm]: [T2] Liang et al. (2022). "Holistic Evaluation of Language Models (HELM)." arXiv:2211.09110. https://arxiv.org/abs/2211.09110 (accessed 2026-07-09)
