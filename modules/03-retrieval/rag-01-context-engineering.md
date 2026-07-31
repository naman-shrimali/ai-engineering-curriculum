---
id: rag-01
title: "Context Windows & Context Engineering"
module: retrieval
prerequisites: [api-02, fnd-04]
related_ids: [rag-04, rag-05, agt-04, api-05]
keywords:
  - context engineering
  - context window
  - context budget
  - context rot
  - lost in the middle
  - context assembly
  - truncation
  - summarization
  - context placement
summary: >-
  The context window treated as a managed resource: token budgets with explicit
  allocations, placement informed by attention behavior, curation over
  stuffing, and compaction strategies for growing state. Establishes the
  context-assembly layer — the component that decides what the model sees —
  that retrieval, agents, and memory chapters all build on.
difficulty: 2
est_minutes: 180
status: evolving
volatility: mixed
last_reviewed: 2026-07-09
sources:
  - key: liu-lost-middle
    tier: 2
    title: "Lost in the Middle: How Language Models Use Long Contexts"
    org: arXiv
    url: https://arxiv.org/abs/2307.03172
    accessed: 2026-07-09
  - key: anthropic-context-eng
    tier: 4
    title: "Effective context engineering for AI agents"
    org: Anthropic
    url: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
    accessed: 2026-07-09
  - key: anthropic-long-context
    tier: 1
    title: "Long context prompting tips"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips
    accessed: 2026-07-09
  - key: hsieh-ruler
    tier: 2
    title: "RULER: What's the Real Context Size of Your Long-Context Language Models?"
    org: arXiv
    url: https://arxiv.org/abs/2404.06654
    accessed: 2026-07-09
---

# Context Windows & Context Engineering

Module 2 taught you to steer the model; module 3 begins with the resource that steering happens inside. The context window is the model's entire working world — everything it knows beyond its weights arrives there (fnd-06's cutoff argument), everything it's told competes for influence there (api-02's conditioning frame), and every token there costs money, latency, and attention quality (fnd-05's three-cost budget). **Context engineering** is the discipline of treating that window as a managed resource: budgeted like memory, laid out like a cache-friendly data structure, curated like an editor, and compacted like a log. It has quietly displaced prompt *wording* as where application quality is won — the industry's own framing has shifted from "prompt engineering" to "context engineering" for exactly this reason.[^anthropic-context-eng] This chapter builds the context-assembly layer conceptually; rag-04/rag-05 fill it with retrieved documents, and agt-04 extends it across sessions.

## Intuition: working memory, not a filing cabinet

The seductive wrong model: the context window is storage — capacity to fill, a filing cabinet where more documents means more knowledge. The correct model: **it's working memory with attention as the read mechanism** — and attention is a finite, unevenly-distributed resource (fnd-05). Every token added dilutes the attention available to every other token; irrelevant content doesn't sit harmlessly, it *competes* — as evidence the model conditions on (api-02: everything in context is evidence), as distraction from the load-bearing content, and as attack surface (sec-01's preview).

Three findings convert this intuition into engineering:

- **Position matters.** Models use information at the edges of long contexts far better than information buried in the middle — the "lost in the middle" result you met in fnd-05, which turns *placement* into a design variable.[^liu-lost-middle]
- **Advertised length ≠ usable length.** Long-context benchmarks beyond simple needle-retrieval show effective task performance degrading well before the advertised window is full — with degradation varying by task complexity and model.[^hsieh-ruler] "It fits" is a necessary condition, never a sufficient one; your eval at your real lengths decides (fnd-09's discipline).
- **Context rot is real.** In long-running interactions, accumulated history degrades behavior: early errors become imitated precedent (api-02's history contamination), stale instructions conflict with fresh ones, and the signal-to-noise ratio decays monotonically unless something actively curates.

The professional stance that follows: **more context is a cost to justify, not a capability to celebrate.** The best context is the smallest set of high-signal tokens that lets the model succeed — an editorial standard, not a stuffing standard.[^anthropic-context-eng]

## The context budget

Treat the window like a memory map — explicit allocations, owned regions, enforced limits. A representative production layout:

| Region | Contents | Typical share | Volatility |
|---|---|---|---|
| System contract | Role, rules, output format, tool policy (api-02) | 5–10% | Stable — cache backbone |
| Tool schemas | Definitions the route actually needs (api-03) | 5–15% | Stable per route |
| Exemplars | Few-shot examples, curated (api-02) | 0–10% | Stable per template version |
| Reference context | Retrieved documents, fetched data (rag-05) | 30–60% | Per-request |
| Interaction state | Conversation history / agent trajectory | 10–40%, capped | Growing — the managed region |
| Task | The current question/instruction | small | Per-request |
| Output reservation | `max_tokens` headroom (api-01) | task-dependent | Fixed per task class |

Three budget disciplines make this real rather than aspirational. **Enforce top-down** (fnd-04's doctrine): output reservation first, fixed scaffolding second, variable regions packed to the remainder with exact token counting — never discover overflow at the API (api-01's `400`). **Cap the growing region:** interaction state gets a hard budget and a compaction policy (below) — uncapped history is the api-01 cost-curve example wearing a quality disguise too. **Audit like cost** (because it is): per-region token counts in your api-01 logs; a region that doubled silently is a regression — the same telemetry that watches cache hit rates (api-05) watches budget drift.

Note what the layout already encodes: the **stable→volatile ordering** is simultaneously the cache doctrine (api-05), the placement doctrine (edges are premium — next section), and the diffability doctrine (api-02). One ordering, three payoffs — this is why the budget table is the chapter's central artifact.

## Placement: layout for an uneven reader

Given lost-in-the-middle, the window has a real-estate gradient: **beginning and end are premium; the middle is economy.** The placement rules that follow:

- **Instructions at the start** (the trained convention — fnd-07 — and a premium slot), **restated compactly at the end** for long contexts: "Answer the question above using only the provided documents" *after* 50k tokens of documents measurably outperforms instructions-only-at-top on long-context tasks.[^anthropic-long-context]
- **The task/question near the end** — adjacent to generation, in premium attention territory, and (bonus) in the cache-friendly volatile position (api-05's stable-first rule and the attention rule agree, which is why the doctrine is easy to follow).
- **Critical reference content toward the edges of its region;** bulk supporting material in the middle. When retrieval returns ranked passages (rag-05), *use* the ranking: best material where attention is best — either edge beats the middle.
- **Structure everything** (api-02's delimiting, at scale): tagged, labeled sections — document IDs, source attributions — so the model can *address* content ("per document 3…") and so citations become checkable (rag-07's groundedness machinery depends on this).
- **Verify at your lengths:** placement effects vary by model and length; the fnd-09 probe pattern (same fact, varied positions, measured) takes an afternoon and calibrates your actual model — worth it before committing an architecture.[^hsieh-ruler]

## Curation: the editor's job

The highest-leverage context decision is what to *leave out*. The curation disciplines, each anchored to a mechanism you know:

- **Relevance over completeness.** Retrieval should deliver the passages that answer the question, not the documents that mention its keywords (rag-06's precision work). Every irrelevant passage is attention theft, conditioning noise, and — when retrieval quality is low — a source of confidently-wrong grounding (rag-07 measures this as faithfulness).
- **One good representation beats three mediocre ones.** Duplicate near-identical passages (common with naive retrieval over redundant corpora) waste budget and amplify their content's influence disproportionately — dedup at assembly time (fnd-06's corpus lesson, request-scale).
- **Just-in-time beats just-in-case.** Loading everything the model *might* need front-loads cost and dilution; tools that fetch on demand (api-03) keep the window lean and the information fresh — the direction agentic systems have moved.[^anthropic-context-eng] Trade-off: each fetch is a round-trip; hot-path content earns preloading, tail content earns a tool.
- **Format for density.** Verbose JSON with repeated keys, HTML boilerplate, base64 noise — reformat to compact representations at assembly (tables, cleaned text). Token efficiency is information-per-token, not just fewer tokens (fnd-04's counting discipline, applied editorially).
- **Curate the tool catalog per route** (api-03's lesson, restated as context): unused schemas are pure dilution.

The test that keeps curation honest: *could a competent human answer the task from this context alone, quickly?* If they'd struggle to find the signal, so will attention; if the answer isn't in there, no prompt wording will conjure it (api-02's plateau tree — "missing knowledge" is a context bug, and it's the most common one).

## Compaction: managing the growing region

Conversation history and agent trajectories grow monotonically; the window doesn't. The strategies, in escalation order:

1. **Windowing:** keep the last N turns verbatim, drop the oldest. Simple, predictable, cache-friendly (append-only until the drop) — and lossy exactly where long tasks hurt: early commitments vanish (the "it forgot what we agreed" bug is usually this).
2. **Summarization/compaction:** replace older history with a model-written summary — retains gist at ~10× compression, loses detail, costs a generation, and *invalidates cache* for everything after it (api-05's trade-off — schedule compaction at natural boundaries, not per-turn).
3. **Structured state extraction:** pull the durable facts into an explicit, owned region — decisions made, entities discussed, user preferences, task progress — maintained as *data*, not prose. More engineering, much better fidelity: the state region is small, auditable, and doesn't rot. This is the road to agent memory (agt-04 builds it out).
4. **Externalization:** move history to retrievable storage — fetch relevant past turns on demand (retrieval over your own conversation — rag-05's machinery pointed inward). The scalable endgame for long-lived assistants.

The design rule uniting them: **decide what must survive compaction, and make that explicit.** Instructions and constraints must survive (re-pin them in the stable region, never in compactable history — the "system prompt amnesia" bug is instructions living in turn 3); commitments and decisions should survive (structured state); pleasantries shouldn't (let them fall). Compaction without a survival contract is just slow forgetting.

## Production engineering perspective

- **Build context assembly as a component, not a string template.** A function that takes (task, budget, sources) and returns (messages, region-metrics) — owning counting (fnd-04), allocation, placement, dedup, and formatting. Every serious LLM system converges on this component; building it deliberately beats excavating it from f-strings later. It's also where retrieval plugs in (rag-05), making module 3's architecture literally this chapter's artifact plus a search index.
- **Long-context vs. retrieval is a costed decision, not a doctrine** (fnd-05's three costs, now operational): stuffing pays quadratic prefill + linear cache + middle-loss on *every request*; retrieval pays pipeline complexity + recall risk *once built*. Small stable corpus + caching → stuffing can win (api-05 economics). Large/fresh/selective corpus → retrieval wins. Measure both at your shapes; rag-08 formalizes the frontier as windows grow.
- **Log per-region metrics** — tokens by region, assembly-time dedup hits, compaction events — alongside api-01's usage logs. Context-budget drift predicts cost drift (prd-05) *and* quality drift before either dashboard fires.
- **Eval context decisions like everything else** (evl-01): placement A/Bs, budget-size sweeps, compaction-policy comparisons — all batch-runnable experiments with your harness. "How much context helps?" has an empirical answer per task; teams that measure it usually find their optimum is *smaller* than their instinct.[^hsieh-ruler]
- **Security posture:** the context is the attack surface — everything assembled into it (retrieved docs, tool results, user text) carries whatever instructions it carries (sec-01). Assembly is where provenance labeling and trust-tiering happen; build the hooks now even if the defenses come in module 7.

## Historical evolution

**2020–2022:** windows of 2–4k tokens made context a scarcity problem — the era's engineering was fitting *anything* in. **2023:** windows jumped to 32–128k; "just stuff it" became possible and immediately revealed the quality problems — lost-in-the-middle lands mid-2023 as the era's defining result.[^liu-lost-middle] **2024:** windows reach hundreds of thousands to millions of tokens; benchmarks like RULER document that usable length lags advertised length;[^hsieh-ruler] prompt caching (api-05) reshapes the economics of large stable contexts. **2024–present:** the discipline gets its name — "context engineering" displaces "prompt engineering" as the field's framing for where quality lives, driven by agents (whose growing trajectories made curation and compaction unavoidable) and codified in lab engineering guidance.[^anthropic-context-eng] The arc: from *scarcity* (fit it in) through *abundance* (stuff it in) to *curation* (earn it in) — the third era is the durable one, because attention, not capacity, was the binding constraint all along.

## Common misconceptions

- **"Bigger windows make context engineering obsolete."** Bigger windows make it *matter more*: the gap between "fits" and "works" widens with length (middle-loss, dilution, cost — all scale with tokens).[^hsieh-ruler] Capacity abundance is exactly when curation discipline pays most — the fnd-05 rebuttal, now with usable-length evidence.
- **"The model reads everything you send."** It attends over everything — unevenly, dilutedly, with measured middle-blindness. Sending ≠ communicating; placement and curation are the difference.[^liu-lost-middle]
- **"More relevant-ish context can't hurt."** It can and does: attention dilution, conditioning noise, contradiction risk when near-duplicates disagree, and injection surface — each irrelevant token has negative expected value. The editor's standard, not the hoarder's.
- **"Context problems are prompt problems."** Prompt wording tunes behavior *within* a context; if the information is absent, buried mid-window, or drowned in noise, no phrasing fixes it (api-02's plateau tree, first branch). Diagnose the assembly before the instructions.
- **"Summarize history every turn to stay tidy."** Per-turn compaction invalidates cache (api-05), costs a generation per exchange, and compounds summary-of-summary drift. Compact at boundaries, on budget triggers, with a survival contract.
- **"Advertised context length is a spec."** It's a claim about what the model *accepts*, not what it *uses well* — treat it like a benchmark number (fnd-09's literacy), verified by your own long-context probes.[^hsieh-ruler]

## Failure modes and trade-offs

- **The buried instruction** — critical constraint at position 40% of a 100k context, intermittently ignored. *Fix:* constraints live in the stable region and get restated at the end; never in compactable middle territory.[^anthropic-long-context]
- **Context stuffing** — recall-maximized retrieval dumping 40 passages where 5 answer. *Symptoms:* cost up, latency up, faithfulness *down* (wrong-passage grounding). *Fix:* precision work (rag-06), assembly-time caps, the human-editor test.
- **History rot** — long sessions degrading as errors compound into precedent. *Fix:* capped state region, structured extraction, session-boundary compaction — and per-turn eval sampling to detect it (evl-05).
- **Compaction amnesia** — summaries silently dropping commitments; the survival contract unwritten. *Fix:* explicit must-survive list; structured state for decisions; eval cases that test cross-compaction recall.
- **Cache-hostile assembly** — dynamic content interleaved into stable regions, reorderings per request (api-05's churn, caused by the assembler). *Fix:* region ordering is a frozen contract; volatility only in designated regions.
- **The stuffing/retrieval misfit** — paying quadratic prefill for a corpus that needed an index, or paying pipeline complexity for 20 pages that fit cached. *Fix:* cost both at your shapes (the prd-01 architecture decision, previewed).

## Best practices

- **Write the budget table for every route** — regions, allocations, owners, caps — and enforce it in the assembly component with exact counting.
- **Stable→volatile ordering, frozen;** instructions early + restated late on long contexts; question at the end; best material at region edges.
- **Curate to the human-editor standard:** dedup, reformat for density, relevance-filter, route-scoped tool catalogs. Prefer just-in-time fetching for tail content.
- **Cap growing regions with a compaction policy and a survival contract** — decide what must outlive compaction before deciding how to compact.
- **Probe your real model at your real lengths** (placement, usable-length, needle tests) before architecting around advertised windows.[^hsieh-ruler]
- **Instrument per-region tokens and compaction events;** alert on budget drift like cost drift.
- **Treat assembly as the security checkpoint:** provenance labels on every region now; trust-tier enforcement when module 7 arrives.

## Real-world examples

**The constraint that worked 80% of the time.** A document-review assistant has "flag any indemnification clause" in its instructions — at the top, followed by ~80k tokens of contract. It flags reliably in short documents, intermittently in long ones: the instruction is a needle the middle-blind reader sometimes misses on the way to the end.[^liu-lost-middle] Fix per this chapter: instruction retained at top *and* restated compactly after the documents ("Before answering: list any indemnification clauses found"). Flag rate goes to ~99%; the eval that measured it (20 contracts × 5 runs, evl-01 style) took an hour. Placement was the entire bug.

**The RAG system that got better by retrieving less.** A support assistant retrieves top-20 passages "for safety" (~30k tokens). Symptoms: high cost, 6-second TTFT, and — counterintuitively until this chapter — mediocre faithfulness: answers cite plausible-but-wrong passages from the retrieved noise. Cutting to top-5 with a reranker (rag-06's machinery) drops cost 70%, TTFT to 2s, and *improves* answer quality on the eval — less attention theft, less wrong-grounding surface. The team's summary is this chapter's thesis: retrieval quality problems were being laundered as context quantity.

**The agent that forgot its own plan.** A multi-step coding agent (agt-01 preview) summarizes its trajectory every 10 steps to stay under budget. Users report it "changing its mind": step-30 behavior contradicting step-5 decisions — the decisions lived in prose history and dissolved in summary-of-summary compaction. Fix: structured state region (current plan, decisions log, constraints) maintained as data outside compactable history, re-pinned every request. The "changing its mind" reports stop. Compaction needed a survival contract, and the plan was on it.

## Interview questions

1. **"What is context engineering and why did it displace prompt engineering as the quality frontier?"** — Model answer: the discipline of managing the context window as a scarce resource — budgeting token allocations by region, placing content according to attention behavior (edges premium, middle weak), curating for signal density, and compacting growing state with explicit survival rules. It displaced prompt wording because the failure data moved: production quality problems are dominated by *what the model sees* — missing, buried, or drowned information — rather than how instructions are phrased; and because windows grew large enough that assembly became a real systems problem with cost, latency, and cache dimensions.

2. **"Your model 'ignores' an instruction intermittently on long inputs. Diagnose and fix."** — Model answer: classic lost-in-the-middle presentation — the instruction sits at the top, the input is long, and mid-context attention is unreliable, so compliance decays with input length. Verify with a placement probe: same instruction at start / start+end restated / end-only, measured over the length distribution (n runs, evl-01 style). Fix: constraints in the stable system region *and* compactly restated after the long content, task at the end. If the probe doesn't confirm position sensitivity, next suspects: instruction conflict accumulated in history, or the instruction living in a compacted-away turn.

3. **"How do you decide between stuffing documents into a long context and building retrieval?"** — Model answer: cost the three axes at real shapes. Stuffing: quadratic prefill (money + TTFT) every request — amortizable by prompt caching if the corpus is stable — plus linear cache memory, plus measured middle-degradation at your lengths. Retrieval: build/operate complexity, recall risk, index freshness — paid once, then cheap per request. Decision inputs: corpus size vs. usable window, update frequency (fresh corpora force retrieval), query selectivity (needle-seeking favors retrieval; holistic synthesis favors context), and the caching economics. It's an eval-and-arithmetic decision per workload — small stable corpus + cache often stuffs; large/fresh/selective always retrieves.

4. **"Design the context layout for a tool-using support agent with a knowledge base."** — Model answer: budget table — system contract and tool schemas first (stable, cached, ~15%); retrieved KB passages next (ranked, deduped, capped ~40%, best passages at region edges, provenance-labeled); structured session state (customer, issue, decisions — data not prose, ~10%); recent conversation verbatim within a capped window (~20%); the current message + compact instruction restatement at the end; output reservation held back. Compaction: windowing for chat, structured extraction for decisions, at message boundaries only (cache). Assembly enforces counts, dedup, and provenance tags — one component, logged per-region.

5. **"What's context rot and how do you engineer against it?"** — Model answer: monotonic degradation of long-running interactions — early errors become imitated precedent, stale and fresh instructions conflict, and signal-to-noise decays as history accumulates. Defenses in layers: cap the history region (rot scales with length); keep instructions out of rottable history (stable region, re-pinned); extract durable facts into structured state that's maintained as data; compact at boundaries with an explicit survival contract; and detect it — per-turn quality sampling in production (evl-05) catches the decay curve before users report 'it got weird.' The root cause is architectural (uncurated growth), so the fixes are architectural, not prompt-level.

6. **"A teammate says 'the new model has a 1M window — delete the retrieval pipeline.' Respond."** — Model answer: three-part rebuttal, all measured phenomena. Economics: 1M-token prefill per request is quadratic compute — cost and TTFT that caching only mitigates for *stable* content, and our corpus updates daily. Quality: usable length lags advertised length — long-context benchmarks show task performance degrading well before window exhaustion, and middle-positioned content underperforms at any length; our needle-seeking queries are the worst case. Freshness and access control: retrieval gives us per-request document selection and permissions; a stuffed context gives everyone everything. The window growth *does* change the frontier — bigger working sets, less aggressive chunking — so the right response is re-running the stuffing-vs-retrieval arithmetic (rag-08), not deleting the pipeline.

## Exercises and mini-project

**Exercises**

1. Write the budget table for your api-03 extraction service and your (future) capstone RAG route: regions, percentages, caps, cache implications. Which region is the risk in each?
2. A 60k-token context contains a critical fact at 50% depth. Design the placement probe that measures your model's retrieval of it at 10/50/90% positions — cases, runs, and the decision each outcome triggers.
3. Compute the arithmetic for a 200-page stable manual (≈100k tokens), 1k queries/day: stuffed-with-caching (api-05's pricing model) vs. retrieval (top-5 × 500 tokens). Where's the crossover as the manual's update frequency rises?
4. Take a real multi-turn conversation you've had with an assistant and design its compaction: what goes in structured state, what survives verbatim, what falls — and write the must-survive contract.
5. Your per-region logs show reference-context tokens doubled over a month with flat traffic. List four hypotheses (retrieval config, corpus growth, dedup regression, prompt change) and the log query that distinguishes each.

**Mini-project: the context assembler.** Build the component this chapter specifies, on top of your api-01/api-05 gateway: (a) an assembler function — inputs (task, sources list, budget config), output (messages + per-region token metrics) — enforcing top-down budgets with exact counting (fnd-04), stable→volatile ordering, and dedup; (b) placement probes: run the needle test at 3 positions × 3 context lengths on your model (n=5), and calibrate your own edges-vs-middle map; (c) wire it into your api-03 extraction task with a deliberately oversized document set, and measure quality/cost at 3 budget sizes — find *your* task's context optimum; (d) add windowing + structured-state compaction for a multi-turn variant, with two eval cases testing cross-compaction survival; (e) memo: your placement map, your budget optimum, and what the assembler caught that string templates hid. Target: 4 hours. Success criterion: a reusable assembler with per-region metrics — rag-05 will plug retrieval directly into it.

**Capstone extension:** this assembler is the capstone's context layer — rag-05 feeds it retrieved passages, agt-04 extends its state region into persistent memory, and its per-region metrics feed prd-05's cost model.

## Revision summary

- The window is working memory read by uneven attention, not storage: edges premium, middle weak (lost-in-the-middle), usable length < advertised length (verify at your lengths), and every token competes — irrelevant content has negative expected value. More context is a cost to justify.
- Budget like a memory map: explicit regions (system/tools/exemplars/reference/state/task/output), top-down enforcement with exact counting, capped growing regions, per-region telemetry. Stable→volatile ordering serves caching, attention, and diffability at once.
- Placement: instructions early and restated late, task at the end, best material at region edges, everything structured and provenance-labeled.
- Curation to the human-editor standard: relevance over completeness, dedup, density reformatting, just-in-time fetching, route-scoped catalogs. Missing/buried/drowned information is the most common "prompt problem."
- Compaction with a survival contract: windowing → summarization (at boundaries; cache-aware) → structured state (decisions as data) → externalization. Instructions never live in compactable history.
- Build assembly as a component with metrics; decide stuffing-vs-retrieval by arithmetic and eval, not doctrine — attention, not capacity, is the binding constraint.

## Flashcards

| Q | A |
|---|---|
| The correct mental model of the context window? | Working memory read by finite, unevenly-distributed attention — not a filing cabinet; every token competes. |
| Lost in the middle, operationally? | Content at context edges is used reliably; mid-context content intermittently — placement is a design variable. |
| Advertised vs. usable context length? | Models accept the advertised length; task performance degrades well before it — probe at your real lengths. |
| The budget regions? | System contract, tool schemas, exemplars, reference context, interaction state (capped), task, output reservation. |
| Why does stable→volatile ordering pay three times? | Cache hits (api-05), premium-edge placement for instructions/task, and diffable templates. |
| The long-context instruction pattern? | Constraints in the stable region up top and compactly restated after the long content; task at the end. |
| The curation standard? | Could a competent human answer quickly from this context alone? Signal density, not volume. |
| Compaction escalation ladder? | Windowing → boundary summarization → structured state extraction → externalization to retrieval. |
| What must every compaction policy include? | A survival contract: instructions re-pinned outside history, decisions as structured data, explicit must-survive list. |
| Stuffing vs. retrieval — the deciding inputs? | Corpus size vs. usable window, update frequency, query selectivity, caching economics — arithmetic per workload. |
| What is context rot? | Monotonic quality decay in long interactions: errors become precedent, instructions conflict, noise accumulates — fixed architecturally (caps, state, compaction), not by prompts. |

## Further reading

- **Official docs:** Anthropic's long-context prompting tips[^anthropic-long-context] — short, directly actionable placement guidance.
- **Papers:** Liu et al., "Lost in the Middle" (2023)[^liu-lost-middle] — re-read now with engineering eyes (first assigned in fnd-05); Hsieh et al., RULER (2024)[^hsieh-ruler] — the usable-vs-advertised length evidence, §1 and the results tables.
- **Books:** none — this discipline's canon is lab engineering guidance and papers.
- **Talks:** none essential.
- **Tutorials:** Anthropic's context-engineering engineering post[^anthropic-context-eng] — the practitioner treatment closest to this chapter's framing; read before building the mini-project's assembler.

## Check your understanding

1. Reconstruct the budget table from memory and name each region's volatility class and cache implication.
2. Derive the three placement rules from the two underlying findings (middle-blindness, trained conventions) — mechanism first, rule second.
3. Your RAG answers cite wrong passages despite high retrieval recall. Explain the context-engineering diagnosis and the two-part fix.
4. Write the survival contract for a 50-turn coding-assistant session — what lives where, and what's allowed to dissolve.
5. This chapter opens module 3. State in two sentences how rag-04 (chunking) and rag-05 (the pipeline) will plug into the assembler you now have.

## Sources

[^liu-lost-middle]: [T2] Liu et al. (2023). "Lost in the Middle: How Language Models Use Long Contexts." arXiv:2307.03172. https://arxiv.org/abs/2307.03172 (accessed 2026-07-09)
[^anthropic-context-eng]: [T4] Anthropic (2025). "Effective context engineering for AI agents." Anthropic Engineering. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents (accessed 2026-07-09)
[^anthropic-long-context]: [T1] Anthropic. "Long context prompting tips." https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips (accessed 2026-07-09)
[^hsieh-ruler]: [T2] Hsieh et al. (2024). "RULER: What's the Real Context Size of Your Long-Context Language Models?" arXiv:2404.06654. https://arxiv.org/abs/2404.06654 (accessed 2026-07-09)
