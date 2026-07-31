---
id: eng-12
title: "Interview-Prep Pack"
module: engineering
prerequisites: [fnd-01]
related_ids: [fro-05, eng-05, eng-11, evl-01]
keywords:
  - interview prep
  - ai engineer interview
  - llm system design
  - interview questions
  - study plan
  - question bank
  - system design framework
  - portfolio
summary: >-
  The interview-preparation index over the whole repository: the five AI
  engineering interview types mapped to the chapters that prepare each, the
  question bank as a cross-linked index of every chapter's interview section,
  a system-design answer framework built from the engineering docs, and
  one-week and one-month study plans.
difficulty: 2
est_minutes: 45
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources:
  - key: fro-05-pointer
    tier: 1
    title: "This repository — fro-05: The AI Engineer Interview & Portfolio (manifest-specified)"
    org: AI Engineering Curriculum
    url: https://github.com/
    accessed: 2026-07-10
---

# Interview-Prep Pack

The repository already contains a complete interview question bank — every chapter carries 4–8 questions with model answers, written to interview realism — plus flashcards and revision summaries. This doc is the *index and strategy layer* over that material: which interview type draws on which chapters, how to structure system-design answers from the engineering docs, and study plans at two time horizons. Career strategy and portfolio building live in [fro-05](../modules/09-frontier/fro-05-interviews-portfolio.md); this pack is the drill schedule.

## The five interview types

AI engineering loops at startups and big tech converge on five assessment types. Preparation is type-targeted:

| Type | What's assessed | Core chapters | Drill with |
|---|---|---|---|
| **LLM fundamentals** | Do you actually understand the machine? Attention, KV cache, training pipeline, sampling, tokenization | [fnd-04](../modules/01-foundations/fnd-04-tokenization.md), [fnd-05](../modules/01-foundations/fnd-05-transformer-architecture.md), [fnd-06](../modules/01-foundations/fnd-06-llm-pretraining.md), [fnd-07](../modules/01-foundations/fnd-07-post-training.md), [fnd-08](../modules/01-foundations/fnd-08-sampling-and-decoding.md) | Chapter interview sections + flashcards; the fnd-05 napkin math cold |
| **LLM system design** | Design a RAG product / agent / eval system under constraints | [rag-01](../modules/03-retrieval/rag-01-context-engineering.md), [rag-05](../modules/03-retrieval/rag-05-rag-pipeline.md), [agt-01](../modules/04-agents/agt-01-agent-fundamentals.md), [prd-01](../modules/06-production/prd-01-architecture-patterns.md) | [eng-01](eng-01-rag-pipeline-architecture.md)–[eng-05](eng-05-design-patterns.md) as answer skeletons; framework below |
| **Applied / practical** | Build or debug LLM code live: API usage, structured outputs, a small pipeline | [api-01](../modules/02-llm-apis/api-01-llm-api-fundamentals.md)–[api-03](../modules/02-llm-apis/api-03-structured-outputs-tool-calling.md), [fnd-08](../modules/01-foundations/fnd-08-sampling-and-decoding.md) | Your own mini-project code — rebuild the api-01 client and api-03 extractor from memory |
| **Evals & quality sense** | The differentiating round: how do you know it works? Eval design, failure diagnosis, statistical honesty | [evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md), [fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md), [rag-07](../modules/03-retrieval/rag-07-rag-evaluation.md), [evl-03](../modules/05-evaluation/evl-03-llm-as-judge.md) | evl-01's loop + pathologies verbatim; [eng-07](eng-07-eval-checklists-debugging.md)'s playbook as diagnosis drills |
| **Behavioral / judgment** | Trade-off reasoning, incident stories, staying-current habits | [fnd-01](../modules/01-foundations/fnd-01-ai-engineering-landscape.md), [api-06](../modules/02-llm-apis/api-06-model-selection.md), [fro-04](../modules/09-frontier/fro-04-staying-current.md), [fro-05](../modules/09-frontier/fro-05-interviews-portfolio.md) | Your mini-project experiment logs — they *are* your stories |

The field-specific emphasis worth knowing: **the evals round is where senior candidates separate** — most candidates can describe RAG; few can design its evaluation, diagnose its failures by layer, or argue the statistics. Weight preparation accordingly (and note the repo weighted its dependency graph the same way — [evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md) came deliberately early).

## The question bank, indexed

Every chapter's `Interview questions` section, grouped by the theme interviewers actually probe. Drill by reading the question, answering aloud, then diffing against the model answer:

- **"Explain X to an engineer":** attention & KV cache (fnd-05 Q1–Q4), tokenization consequences (fnd-04 Q1, Q4), pretraining→capability (fnd-06 Q1), RLHF and its side effects (fnd-07 Q1–Q4), sampling (fnd-08 Q1–Q3), embeddings (fnd-03 Q1–Q2).
- **Napkin math (memorize the three):** KV-cache size (fnd-05 Q3), training-vs-inference memory (fnd-02 Q4), VRAM sizing with quantization (api-07 Q2). Interviewers use these to separate reading from understanding.
- **Production judgment:** silent truncation and the failure surface (api-01 Q4–Q5), prompt-change safety (api-02 Q4), tool-calling control points (api-03 Q3), caching economics (api-05 Q1–Q2, Q4), long-context vs. RAG (fnd-05 Q7, rag-01 Q3, Q6).
- **Model strategy:** selection process (api-06 Q1), mid-tier economics (api-06 Q2), self-host TCO (api-07 Q1, Q5), migration cost as design outcome (api-06 Q4).
- **Quality & evals:** why evals over tests (evl-01 Q1), eval design end-to-end (evl-01 Q2), the 3-point-delta trap (evl-01 Q3), hallucination mechanisms and mitigations (fnd-09 Q1), jagged-frontier design (fnd-09 Q2), judge trust (fnd-09 Q4, evl-03).
- **Security instinct:** system-prompt-is-not-security (api-01 Q flashcards, eng-09 rules 3–4), injection surfaces including images and tool results (api-04 Q5, api-03 Q3), agent blast radius (eng-02's control points).

## The system-design answer framework

For "design an AI system that does X" — a five-move structure that maps directly onto the engineering docs, so preparation equals rehearsing eng-01/eng-02 aloud:

1. **Requirements → capability bands.** Restate the task; classify its components against [fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md)'s taxonomy (what's transformation, what's recall, what needs tools); surface the constraint set (latency, governance, cost, freshness). *This move alone signals seniority — most candidates skip to boxes.*
2. **Architecture from patterns.** Compose named patterns ([eng-05](eng-05-design-patterns.md)): gateway + retrieve-then-read + assembler for knowledge products; the eng-02 loop + control points for agents. Draw the two-path split (ingestion vs. query — [eng-01](eng-01-rag-pipeline-architecture.md)) where retrieval is involved.
3. **The hard decisions, argued.** Pick the 2–3 that matter for this problem and argue trade-offs with mechanisms: long-context vs. retrieval (rag-01's three costs), model tier + cascade (api-06), sync vs. batch paths (api-05), workflow vs. agent (eng-05 #13).
4. **Quality and safety plan.** Eval design first (golden set, scoring taxonomy, gates — [evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md)); then failure containment: abstention paths, typed boundaries, human gates, injection posture ([eng-09](eng-09-security-guidelines.md)'s ten rules as the checklist).
5. **Operations and evolution.** SLOs decomposed per stage (eng-01), the dashboard/alert set (eng-04), cost per task with its levers (eng-10), and the model-adoption story (api-06's triggers) — "how this survives the next model release" is the closing move interviewers remember.

## Study plans

**One week (interview on the calendar):** Day 1–2 — fundamentals refresh: fnd-05, fnd-07, fnd-08 revision summaries + flashcards; the three napkin calculations until automatic. Day 3 — evals: evl-01 in full; eng-07's playbook as drill material (pick five symptoms, narrate the diagnosis). Day 4 — system design: eng-01 and eng-02 until you can whiteboard both from memory; run the five-move framework on two problems ("support bot over 100k docs," "agent that files expense reports"). Day 5 — question-bank sprint across the index above, answering aloud; re-read your own project logs for behavioral stories. Weekend — one mock loop end to end.

**One month (role targeting):** Weeks 1–2 — close your gaps against the five-type table: read the unread chapters, but *do the mini-projects* for your two weakest types (the projects generate both skill and interview stories — the repo's design intent). Week 3 — system-design reps: one problem daily through the framework, alternating archetypes (copilot / knowledge assistant / agent — [fnd-01](../modules/01-foundations/fnd-01-ai-engineering-landscape.md)); record and review yourself once. Week 4 — the one-week plan above, plus portfolio polish per [fro-05](../modules/09-frontier/fro-05-interviews-portfolio.md) (the capstone thread — eng-03 harness, bake-off logs, capability maps — is the portfolio).

## What interviewers are actually listening for

Distilled from the curriculum's recurring themes — the tells that mark a strong candidate, each drillable:

- **Mechanism-grounded claims:** "output tokens cost more because decode is memory-bandwidth-bound" beats "output is expensive." Every assertion carries its fnd-chapter *why*.
- **Statistical honesty reflexes:** unprompted n-runs, spread, flip-count arithmetic when discussing any quality number (evl-01) — and "I'd need to measure that on our traffic" said without embarrassment.
- **Eval-first instincts:** the answer to "how would you build X" starts with how you'd know X works.
- **Failure-mode fluency:** naming the specific failure class (fluent misreading, lost-in-the-middle, reward hacking, context rot) and its layer, not "the model might be wrong sometimes."
- **Calibrated humility about the volatile layer:** knowing which of your facts are quarterly-perishable (prices, model rankings, limits) and which are structural — and saying so (fro-04's discipline, visible in an interview as good judgment rather than ignorance).

> **Volatile:** interview fashions shift with the field's center of gravity (the current weighting toward agents and evals reflects 2025–2026 hiring; the *types* table is more stable than the emphasis). Re-check role postings against the five-type table at preparation time — the [fro-04](../modules/09-frontier/fro-04-staying-current.md) mini-project's job-posting exercise is exactly this calibration.

## Related chapters

| Chapter | What it explains |
|---|---|
| [fro-05](../modules/09-frontier/fro-05-interviews-portfolio.md) | Career strategy, portfolio construction, interview-loop navigation |
| [evl-01](../modules/05-evaluation/evl-01-evaluation-fundamentals.md) | The differentiating round's entire content |
| [fnd-05](../modules/01-foundations/fnd-05-transformer-architecture.md) / [fnd-07](../modules/01-foundations/fnd-07-post-training.md) / [fnd-08](../modules/01-foundations/fnd-08-sampling-and-decoding.md) | The fundamentals round's core |
| [eng-01](eng-01-rag-pipeline-architecture.md) – [eng-05](eng-05-design-patterns.md) | System-design answer skeletons |
| [eng-07](eng-07-eval-checklists-debugging.md) | Diagnosis drills for the quality round |
| [fnd-09](../modules/01-foundations/fnd-09-capabilities-and-limits.md) | The capability vocabulary running through every strong answer |

## Sources

[^fro-05-pointer]: [T1] This repository. fro-05 "The AI Engineer Interview & Portfolio" — manifest-specified companion chapter (path: modules/09-frontier/fro-05-interviews-portfolio.md). Placeholder URL pending repository publication. (accessed 2026-07-10)
