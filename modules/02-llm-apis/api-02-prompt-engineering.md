---
id: api-02
title: "Prompt Engineering"
module: llm-apis
prerequisites: [api-01, fnd-08]
related_ids: [api-03, rag-01, evl-01, fnd-07]
keywords:
  - prompt engineering
  - prompting
  - few-shot
  - in-context learning
  - chain of thought
  - system prompt
  - prompt template
  - instruction design
  - prompt brittleness
summary: >-
  The durable principles of steering LLMs — specificity, demonstration,
  decomposition, structure, room to think — separated from the folklore that
  doesn't replicate. Covers few-shot mechanics, chain-of-thought and its
  reasoning-model successors, message architecture, and the empirical method:
  prompts as versioned hypotheses tested against evals, never vibes.
difficulty: 2
est_minutes: 240
status: evolving
volatility: mixed
last_reviewed: 2026-07-09
sources:
  - key: anthropic-pe
    tier: 1
    title: "Prompt engineering overview"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
    accessed: 2026-07-09
  - key: openai-pe
    tier: 1
    title: "Prompt engineering guide"
    org: OpenAI
    url: https://platform.openai.com/docs/guides/prompt-engineering
    accessed: 2026-07-09
  - key: wei-cot
    tier: 2
    title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models"
    org: arXiv
    url: https://arxiv.org/abs/2201.11903
    accessed: 2026-07-09
  - key: kojima-zs
    tier: 2
    title: "Large Language Models are Zero-Shot Reasoners"
    org: arXiv
    url: https://arxiv.org/abs/2205.11916
    accessed: 2026-07-09
  - key: brown-2020
    tier: 2
    title: "Language Models are Few-Shot Learners"
    org: arXiv
    url: https://arxiv.org/abs/2005.14165
    accessed: 2026-07-09
  - key: sclar-2023
    tier: 2
    title: "Quantifying Language Models' Sensitivity to Spurious Features in Prompt Design"
    org: arXiv
    url: https://arxiv.org/abs/2310.11324
    accessed: 2026-07-09
  - key: zhao-calibrate
    tier: 2
    title: "Calibrate Before Use: Improving Few-Shot Performance of Language Models"
    org: arXiv
    url: https://arxiv.org/abs/2102.09690
    accessed: 2026-07-09
---

# Prompt Engineering

Prompting is how you program a distribution. Everything the model does, it does as a continuation of the context you assembled (fnd-05), through behaviors post-training rehearsed (fnd-07), decoded by the sampler you configured (fnd-08) — and the prompt is the only one of those you rewrite daily. This chapter separates the field's durable principles from its folklore. The durable part is smaller than the internet suggests: a handful of principles (specificity, demonstration, structure, decomposition, room to think) that follow directly from module 1's mechanics, plus one meta-skill that outranks all of them — treating every prompt as a hypothesis to be tested against an eval, not a spell to be perfected. The folklore part is large, unreplicated, and model-version-fragile; you'll learn to recognize it by asking "what mechanism would make this work?" A warning against over-investment up front: prompting is the *first* lever, not the only one — when prompting plateaus, the answer is usually context (module 3), tools (module 4), or a different model, not a cleverer incantation.

## Intuition: writing for a distribution, not a reader

The prompt is not instructions to an employee; it is **conditioning for a next-token distribution**. The model will produce whatever text is most plausible *following your prompt, according to its training*. This single reframing generates most good practice:

- **Ambiguity doesn't get resolved in your favor — it gets averaged over.** A vague prompt makes many completions plausible, and you'll sample across all of them (fnd-08): inconsistent formats, drifting tone, occasional weirdness. Specificity works by *collapsing the distribution* onto the behavior you want. When outputs are inconsistent, the cause is usually a prompt that's consistent with all of them.
- **The model matches patterns more strongly than it follows meta-statements.** Showing two examples of the exact output you want typically beats three paragraphs describing it, because pattern-continuation is the native operation (fnd-05's induction machinery) while instruction-following is a trained-on-top behavior (fnd-07).
- **Everything in context is evidence.** Tone begets tone, sloppiness begets sloppiness, and a typo-riddled prompt conditions the model toward the part of the distribution where typo-riddled text lives. Your prompt's register is itself an instruction.
- **You're writing for the post-trained persona.** Formats the assistant rehearsed (system-then-user, markdown structure, delimited sections) are grooved paths; exotic structures are off-distribution and behave accordingly (api-01's message-architecture point, extended).

The corollary that separates professionals: because outputs are samples from a conditioned distribution, **no single good output proves anything**. Prompt quality is a statistical property, measurable only over multiple runs and multiple inputs — which is why the empirical-method section below, not any specific trick, is this chapter's real payload.

## The durable principles

Six principles that follow from mechanisms and have survived every model generation. Each is stated with its *why*, because the why is what lets you apply it in novel situations.

**1. Be specific about the task, format, and constraints.** State what to do, what the output must look like (format, length, fields, what to do when unsure — the abstention path from fnd-09), and what to avoid. *Mechanism:* collapsing the plausible-completion set. The test: could a competent stranger with no context execute your prompt to your spec? If they'd ask clarifying questions, the model needed them too — and unlike the stranger, it won't ask; it will guess, fluently.

**2. Show, don't just tell (few-shot examples).** Two to five input→output demonstrations of the exact transformation. *Mechanism:* in-context pattern induction — the capability that made GPT-3 famous (fnd-06, [^brown-2020]). Examples define by demonstration what instructions define by description, and they pin down the unstatable: tone, edge-case handling, exactly-how-terse. Include one *hard* example (ambiguous input, the tricky edge) — models overfit to the easy pattern your easy examples establish.

**3. Give the model room to think — or know that it has it.** For multi-step problems, eliciting intermediate reasoning before the answer ("think step by step"; "analyze, then conclude") improves accuracy substantially on arithmetic, logic, and multi-hop tasks.[^wei-cot][^kojima-zs] *Mechanism:* each generated token is one forward pass (fnd-05); reasoning tokens are literally *computation* — a model answering immediately spends less compute than one that works through the problem. The volatile edge: reasoning-trained models (fnd-07) do this internally, so explicit CoT prompting matters less there — see the callout below.

**4. Structure the prompt; delimit everything injected.** Clear sections (instructions / context / examples / input), consistent delimiters (XML-style tags or markdown headers), user data always fenced. *Mechanism:* structure disambiguates what is instruction vs. data — for the model *and* for injection defense (sec-01) — and stable structure enables prefix caching (fnd-05/api-05). Bonus: structured prompts are diffable and reviewable, which matters once prompts are code (below).

**5. Decompose instead of piling on.** When a prompt accumulates many jobs (extract, then classify, then summarize, then format), split it into chained calls with narrow prompts. *Mechanism:* each instruction competes for influence in one distribution; conflicts and de-prioritization are silent. Narrow prompts are also independently testable and independently cacheable. The trade-off is real — more calls, more latency, more plumbing — so decompose at the point of measured quality loss, not preemptively.

**6. Tell it what to do, not only what not to do.** Prohibitions underperform affirmative instructions ("Respond in formal English" beats "Don't be casual"). *Mechanism:* a negation still activates the concept's patterns, and the model must represent the forbidden thing to avoid it; a positive target gives the distribution somewhere to go. Use prohibitions as backup, paired with a positive replacement behavior.

> **Volatile:** how much explicit CoT prompting helps is now model-dependent — reasoning models allocate their own thinking (often better than your scaffold), and some providers advise *against* manual step-by-step scaffolds on them, exposing effort parameters instead (agt-03). The durable core: reasoning quality tracks computation spent before committing to an answer; *who* orchestrates that computation shifted from prompter to model. Check current provider guidance per model.[^anthropic-pe][^openai-pe]

## Few-shot mechanics: the fine print

Because examples are the strongest tool, their failure modes deserve precision — all three are empirically documented:

- **Ordering and recency effects:** models over-weight the last examples; accuracy can swing meaningfully under reordering alone.[^zhao-calibrate] Put a representative (not exotic) example last.
- **Label and majority bias:** in classification, models drift toward labels frequent in the examples and toward the last-seen label — balance your example classes.[^zhao-calibrate]
- **Format overfitting:** the model copies the examples' surface format more faithfully than their logic. This is a *feature* for format control and a *bug* if your examples are subtly inconsistent — the inconsistency is what gets learned.

The professional habit: examples are *curated data, not decoration*. Version them, balance them, and — once you have evals — select them empirically: swap candidate example sets and measure, because example choice frequently moves metrics more than instruction wording does.

## Message architecture: what goes where

The roles from api-01, used deliberately:

- **System prompt:** durable operator intent — identity, rules, output contracts, tone, tool-use policy. Stable across requests (cache-friendly, fnd-05) and *first*, because it frames everything after. Not secrets, not access control (api-01).
- **User message(s):** the task instance — templated scaffolding around the actual input, with injected content (user text, retrieved documents) explicitly delimited and, for retrieval, placed with the lost-in-the-middle findings in mind (fnd-05; rag-01 owns placement).
- **Assistant prefill:** starting the model's answer for it (`{` to force bare JSON; "Step 1:" to force reasoning-first) — the cheapest format-forcing trick available, where the provider supports it.[^anthropic-pe]
- **Conversation history:** context, but also *precedent* — the model imitates its own prior turns, so a bad early answer propagates style and errors forward. Long-running quality drift is often history contamination; the fix is history hygiene (trim, summarize, or reset), not more instructions.

One architectural rule ties this to production: **stable content early, volatile content late** — it's simultaneously the caching win (api-05), the attention-placement win (fnd-05), and what keeps your prompts diffable.

## The empirical method

The skill that outranks every technique: **prompts are hypotheses; evals are experiments; everything else is anecdote.**

The evidence for why vibes fail: model performance swings dramatically under *semantically meaningless* format changes — separator choice, casing, spacing — with spreads that can exceed the gains of the techniques above.[^sclar-2023] If formatting noise moves results that much, a single impressive output tells you almost nothing, and "it worked when I tried it" is not evidence. The consequences:

1. **Build the eval before polishing the prompt.** Ten to fifty input→expected-behavior pairs, including the hard cases and abstention cases (fnd-09), scored automatically where possible. This is evl-01's discipline arriving early — deliberately, per this curriculum's design.
2. **Measure over runs and inputs** (fnd-08's n-run pass rates), change one thing at a time, and keep the experiment log — fnd-02's training discipline transplanted whole.
3. **Version prompts as code:** in the repo, reviewed, diffable, with sampling params attached (fnd-08), deployed and rolled back like code — because a prompt change *is* a behavior deploy (evl-06 builds the CI).
4. **Test robustness, not just accuracy:** paraphrase your own template, vary input phrasing, and measure the spread. A prompt that only works as one exact string is a liability with a countdown attached (model migration, api-06, will find it).

## Production engineering perspective

- **Prompts are config with the blast radius of code.** Store templates in version control; render with explicit variables; forbid string-concatenation of user input without delimiting (fnd-04's boundary hygiene + sec-01's injection surface). A prompt-template registry with owners and eval coverage is not over-engineering past ~5 production prompts.
- **Cost and latency are prompt-design outputs.** Every instruction, example, and preamble is tokens paid on *every* request (api-01); few-shot examples are often the bulk of a prompt's cost. Measure marginal value: drop an example, run the eval, read the delta — prompts accrete cruft exactly like config files do.
- **Migration is a first-class concern.** Prompts calibrate to a model's post-training (fnd-07); they do not transfer intact across providers or major versions. Budget a re-tuning pass (with your eval as the target) into any migration plan — and prefer prompts built on durable principles over model-specific quirk exploitation, precisely because the former migrate better.
- **Know when to stop prompting.** Plateaued after honest iteration? The bottleneck is usually: missing knowledge → retrieval (module 3); precision operations → tools (api-03/module 4); capability shortfall → different model (api-06); fuzzy target → your spec, not the model. Prompt-tuning past its plateau is the field's most common wasted month — fnd-09's decomposition doctrine tells you which wall you've hit.

## Historical evolution

**2020:** GPT-3 makes prompting *the* interface — few-shot in-context learning replaces per-task training.[^brown-2020] **2021–2022:** the folklore era (magic phrases, incantation lists) alongside real discoveries: chain-of-thought[^wei-cot] and its zero-shot variant[^kojima-zs] show that *elicited computation* is a mechanism, not a trick. **2023–2024:** professionalization — provider guides mature,[^anthropic-pe][^openai-pe] structured outputs absorb format-forcing (api-03), evals displace vibes, and research quantifies brittleness.[^sclar-2023] **2024–present:** reasoning models internalize CoT, shifting prompt effort from "how to think" scaffolds toward task specification and context curation — the discipline's center of gravity moving from *prompt* engineering toward *context* engineering (rag-01), with specification skill as the invariant. The through-line: every era's "prompt hack" either got absorbed into the models/API (and died as a skill) or turned out to be a durable principle in disguise. Bet on principles.

## Common misconceptions

- **"There are magic words."** Documented effects of politeness tokens, tips, and threats are small, inconsistent, and model-version-fragile — noise compared to specificity, examples, and decomposition.[^sclar-2023] If a trick has no mechanism story, expect it not to replicate.
- **"More instructions make output better."** Instructions compete; long rule-lists get partially followed with silent prioritization. Past a modest budget, quality *falls* with instruction count — decompose instead.
- **"A great demo output means the prompt works."** One sample from a distribution proves the distribution *can* produce it, nothing more. Pass rates over inputs × runs or it didn't happen.
- **"Prompt engineering is dead (structured outputs / reasoning models / agents killed it)."** The incantation layer keeps dying; the specification layer — precisely defining task, constraints, context, and examples — keeps growing in value, because it's requirements engineering wearing a new name. What died is the part that was never engineering.
- **"The perfect prompt exists; keep polishing."** Prompts have plateaus, and the plateau is information: it names the next lever (context, tools, model). The perfect-prompt search past the plateau is a sunk-cost trap.
- **"CoT makes the model actually reason / its trace is the reasoning."** Elicited steps improve accuracy by spending computation, but the visible trace is trained output, not a faithful log (fnd-07) — useful work product, unproven introspection.

## Failure modes and trade-offs

- **Prompt bloat** — months of appended edge-case rules; conflicts accumulate; every addition risks silent regression elsewhere. *Fix:* periodic rewrite from the eval spec; decomposition. *Trade-off:* rewrites need eval coverage to be safe — another reason evals come first.
- **Example set rot** — few-shot examples drift out of sync with evolved requirements; the model faithfully reproduces last quarter's format. *Fix:* examples versioned with the template, eval-checked together.
- **Brittleness masquerading as quality** — a hyper-tuned prompt exploiting one model's quirks aces today and shatters on migration.[^sclar-2023] *Trade-off:* peak single-model performance vs. robustness; production favors robustness.
- **History contamination** — multi-turn drift as the model imitates its own degrading output. *Fix:* history hygiene policies; detection via per-turn eval sampling (evl-05).
- **Instruction/data confusion** — user input interpreted as instructions: the prompt-injection surface (sec-01). *Fix:* delimiting, role discipline, and never trusting structure alone.
- **Cost creep** — every "just add an example" multiplies across millions of requests. *Fix:* token-budget reviews of prompts as part of cost engineering (prd-05).

## Best practices

- **Spec first:** write the task description a competent stranger could execute — format, constraints, edge behavior, abstention path — before touching techniques.
- **Then examples:** 2–5 curated, class-balanced, hard-case-inclusive, representative-last; treat as versioned data.[^zhao-calibrate]
- **Then structure:** delimited sections, stable-prefix ordering, injected content fenced; assistant prefill for format forcing where supported.
- **Eval from day one:** 10+ cases before iteration begins; n-run pass rates; one change at a time; experiment log (the fnd-02 discipline, third appearance in this curriculum — it keeps being the answer).
- **Version prompts + params + examples together;** review diffs; deploy like code (evl-06).
- **Audit token cost quarterly;** justify every example and instruction with an eval delta.
- **Re-tune on migration; prefer principles over quirks** so there's less to re-tune.
- **Recognize the plateau** and escalate to context/tools/model instead of polishing.

## Real-world examples

**The support-ticket classifier that "randomly" broke.** A classifier prompt works at 92% for months, then a routine model-version adoption drops it to 74%. Diagnosis: the prompt had accreted 14 rules, several conflicting; the old model resolved conflicts one way, the new one differently — brittleness invisible until migration.[^sclar-2023] The rebuild: a from-scratch prompt written against the eval spec — 5 rules, 4 balanced examples with the hard case included — hits 94% on *both* model versions. Less prompt, more robustness; the eval made the rewrite safe.

**The example that taught the wrong lesson.** An extraction prompt's three examples all show complete source records, so on incomplete records the model *fabricates* the missing fields — the examples taught "output is always complete" more strongly than the instruction "leave unknown fields null" taught the opposite. One added example of an incomplete record with nulls outperforms every instruction-wording fix attempted. Demonstration beats description, in both directions — your examples are the spec the model actually reads.

**The two-week polish that should have been a retrieval ticket.** A team iterates prompts for two weeks trying to fix wrong answers about their product's current pricing. The eval plateaus at 60% no matter the technique — because the knowledge isn't in the model (fnd-06 cutoff; fnd-09 shallows). One engineer adds retrieval of the pricing page into context; accuracy jumps to 97% with the *original, un-polished* prompt. The plateau was the diagnosis; recognizing which wall you've hit is the skill.

## Interview questions

1. **"What actually makes a prompt 'good'?"** — Model answer: measured behavior over a distribution, not any property of the text. Concretely: high pass rate on an eval spanning representative and hard inputs, across multiple runs; robustness to paraphrase and format noise; token efficiency; and migration survivability. Mechanistically, good prompts collapse the completion distribution onto intended behavior — via specificity, demonstrations, structure, and (where needed) elicited reasoning — and the only way to know the distribution collapsed is to sample it systematically.

2. **"Why do few-shot examples work, and what are their failure modes?"** — Model answer: pattern induction is the model's native operation — in-context examples define the transformation by demonstration, pinning format and edge behavior that instructions describe only loosely. Failure modes are documented: recency effects (last examples over-weighted), label bias in classification (balance classes), and format overfitting (inconsistent examples teach the inconsistency; complete-looking examples teach fabrication on incomplete inputs). Treat examples as curated, versioned, eval-selected data.

3. **"Explain chain-of-thought and its status on modern models."** — Model answer: eliciting intermediate reasoning before the answer improves multi-step accuracy because generated tokens are literally computation — one forward pass each — so reasoning-first spends more compute than answer-first. On reasoning-trained models the allocation moved inside: they generate their own thinking, provider guidance often discourages manual scaffolds, and the knob became an effort parameter. Durable principle: accuracy tracks pre-commitment computation; volatile detail: who orchestrates it.

4. **"How do you stop prompt changes from breaking production?"** — Model answer: treat prompts as code with behavioral blast radius. Templates, examples, and sampling params versioned together in the repo; changes via review with eval diffs attached — n-run pass rates on a suite including hard and abstention cases, because single-run diffs are noise; staged rollout with monitoring; rollback as cheap as a revert. Plus regression protection in the other direction: the same suite gates model-version adoption, since prompts calibrate to a model's post-training.

5. **"Your prompt iteration has plateaued at 70% on the eval. Walk me through your decision tree."** — Model answer: first classify the failures. Wrong/missing knowledge → the model can't know it; add retrieval or tools — no prompt fixes absent facts. Precision failures (math, counting, exact formats) → delegate to tools or constrained decoding. Capability failures on well-specified tasks → try a stronger model or decompose the task. Inconsistent-but-sometimes-right → tighten the spec and examples, check sampling params. Ambiguous ground truth → the spec is the problem; fix the eval. The plateau's failure taxonomy names the next lever; more polishing is only indicated if the failures are genuinely specification-shaped.

6. **"A colleague's prompt has 'You will be tipped $200 for a good answer' in it. Assess."** — Model answer: that's folklore-era incantation — reported effects are small, inconsistent across models and versions, and mechanism-free compared to specificity and examples. It costs tokens on every request, adds nothing an eval would detect reliably, and signals vibe-driven iteration. I'd cut it, confirm no regression on the eval, and check the prompt for the patterns that actually move metrics: is the task specified? Are there examples? Is injected content delimited? — then invest wherever that audit finds gaps.

## Exercises and mini-project

**Exercises**

1. Take this vague prompt: "Summarize this customer feedback." Rewrite it applying principles 1, 4, and 6 — specify format, length, abstention behavior, and delimit the input. List each ambiguity you eliminated and what inconsistency it would have caused.
2. Design a 4-example few-shot set for sentiment classification (positive/negative/neutral) that respects the documented biases: balanced labels, hard case included, representative example last.[^zhao-calibrate] Annotate each choice.
3. A prompt contains 12 instructions. Sketch its decomposition into a 2–3 call chain: which instructions group together, what each call's narrow prompt owns, and what the chaining costs.
4. Write the same task prompt twice: once exploiting a model-specific quirk you invent, once from durable principles. Predict which survives a provider migration and why.
5. Your eval shows 85% ± 9% across 5 runs (n=40 inputs). A colleague's "improved" prompt shows 88% on a single run. What can you conclude? Design the experiment that settles it.

**Mini-project: the eval-driven prompt lab.** Pick one real task (classify your own emails, extract fields from receipts, summarize PRs — something with checkable answers): (a) write a 30-case eval (include 5 hard cases, 3 abstention cases) with automatic scoring; (b) baseline a naive one-line prompt: 5 runs, pass rate with spread; (c) iterate through the principles *one at a time* — specificity, then examples, then structure, then CoT if applicable — measuring each delta with 5-run evals and keeping the experiment log; (d) run the robustness check: three paraphrases of your final template, measure the spread;[^sclar-2023] (e) run the cost check: tokens per request at each iteration — compute the quality-per-token curve; (f) write the one-page memo: which principle bought the most, what plateaued, and what lever comes after prompting for this task. Use your api-01 client as the harness. Target: 4 hours. Success criterion: an experiment log showing measured deltas per principle — and at least one "obvious improvement" that the eval revealed did nothing.

**Capstone extension:** this eval harness and prompt-versioning workflow become the capstone's prompt-management layer; rag-01 extends it with context assembly, evl-06 wires it into CI.

## Revision summary

- A prompt conditions a distribution: ambiguity gets sampled over, patterns beat meta-statements, everything in context is evidence, and single outputs prove nothing — quality is a pass rate.
- Durable principles: specify (collapse the distribution); demonstrate (2–5 curated examples — balanced, hard-case-inclusive, representative-last); give room to think (computation before commitment — internalized by reasoning models); structure and delimit (disambiguation + injection defense + caching); decompose past the instruction-competition point; prefer affirmative instructions.
- Message architecture: durable intent in system, templated instances in user, prefill for format-forcing, history as double-edged precedent; stable-early/volatile-late throughout.
- The empirical method outranks all techniques: eval before polish, n-run measurements, one change at a time, prompts+examples+params versioned and deployed as code, robustness tested against paraphrase — because format noise alone moves results more than most tricks.
- Prompting is the first lever, not the last: plateau failure-taxonomy → retrieval, tools, model, or spec. The incantation layer keeps dying; specification skill compounds.

## Flashcards

| Q | A |
|---|---|
| The core reframe of prompting? | You're conditioning a next-token distribution, not instructing a reader — ambiguity gets averaged over, so specificity collapses the distribution. |
| Why do examples beat descriptions? | Pattern induction is the native operation; demonstrations pin format and edge behavior that prose describes only loosely — in both directions (they teach mistakes too). |
| Three documented few-shot biases? | Recency (last examples over-weighted), label/majority bias in classification, format overfitting. |
| Why does chain-of-thought improve accuracy? | Generated tokens are computation (one forward pass each) — reasoning before answering spends more compute; reasoning models now allocate this internally. |
| The stable-early/volatile-late rule serves which three masters? | Prefix caching (cost/latency), attention placement, and prompt diffability. |
| Why is a single great output not evidence? | Outputs are samples from a distribution; only pass rates over inputs × runs measure the distribution. |
| What did the format-sensitivity research show? | Semantically meaningless changes (separators, casing) swing performance by margins exceeding most techniques — vibes-based iteration measures noise. |
| The prompt-plateau decision tree? | Classify failures: missing knowledge → retrieval; precision ops → tools; capability → model/decompose; ambiguity → fix the spec. |
| How do prompts relate to model migration? | They're calibrated to a model's post-training — budget re-tuning against your eval; principle-based prompts migrate better than quirk-based ones. |
| What died and what survived from the "magic words" era? | Incantations died (absorbed or unreplicated); specification, demonstration, and decomposition survived — they're requirements engineering. |

## Further reading

- **Official docs:** Anthropic prompt engineering guide[^anthropic-pe] and OpenAI's equivalent[^openai-pe] — read both, note where they agree (that's the durable core) and where they diverge (that's per-model calibration).
- **Papers:** Wei et al., chain-of-thought (2022)[^wei-cot]; Kojima et al., zero-shot CoT (2022)[^kojima-zs]; Zhao et al., "Calibrate Before Use" (2021)[^zhao-calibrate] — the few-shot fine print; Sclar et al., format sensitivity (2023)[^sclar-2023] — the case for evals over vibes; Brown et al. (2020)[^brown-2020] — §3 for in-context learning's debut.
- **Books:** none that outrun the provider docs plus papers.
- **Talks:** provider prompt-engineering talks date in months; skip in favor of the written guides.
- **Tutorials:** Anthropic's interactive prompt-engineering tutorial (linked from the guide[^anthropic-pe]) — worked exercises that pair well with this chapter's mini-project.

## Check your understanding

1. Explain "you're conditioning a distribution" to a new teammate, and derive two of the six principles from it live.
2. Your few-shot classifier favors the "urgent" label. List the three example-set audits this chapter prescribes, in order.
3. Defend "eval before polish" to a manager who wants the prompt shipped this week — what does skipping it cost, concretely?
4. Which parts of this chapter would you expect to re-verify at the next review cycle (volatile), and which would you teach unchanged in three years?
5. Name the last technique you'd reach for — and the three levers you'd check first — when a prompt plateaus at 70%.

## Sources

[^anthropic-pe]: [T1] Anthropic. "Prompt engineering overview." https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview (accessed 2026-07-09)
[^openai-pe]: [T1] OpenAI. "Prompt engineering." https://platform.openai.com/docs/guides/prompt-engineering (accessed 2026-07-09)
[^wei-cot]: [T2] Wei et al. (2022). "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models." arXiv:2201.11903. https://arxiv.org/abs/2201.11903 (accessed 2026-07-09)
[^kojima-zs]: [T2] Kojima et al. (2022). "Large Language Models are Zero-Shot Reasoners." arXiv:2205.11916. https://arxiv.org/abs/2205.11916 (accessed 2026-07-09)
[^brown-2020]: [T2] Brown et al. (2020). "Language Models are Few-Shot Learners." arXiv:2005.14165. https://arxiv.org/abs/2005.14165 (accessed 2026-07-09)
[^sclar-2023]: [T2] Sclar et al. (2023). "Quantifying Language Models' Sensitivity to Spurious Features in Prompt Design." arXiv:2310.11324. https://arxiv.org/abs/2310.11324 (accessed 2026-07-09)
[^zhao-calibrate]: [T2] Zhao et al. (2021). "Calibrate Before Use: Improving Few-Shot Performance of Language Models." arXiv:2102.09690. https://arxiv.org/abs/2102.09690 (accessed 2026-07-09)
