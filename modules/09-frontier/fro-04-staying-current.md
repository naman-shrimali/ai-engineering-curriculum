---
id: fro-04
title: "Staying Current"
module: frontier
prerequisites: [fnd-01]
related_ids: [api-06, evl-01, fro-05]
keywords:
  - staying current
  - information diet
  - signal filtering
  - model releases
  - capability tracking
  - learning system
  - ai news
  - continuous learning
summary: >-
  A personal system for tracking a field that changes monthly without drowning
  in it: a signal hierarchy mirroring this repo's source tiers, three filter
  questions that separate mechanism from marketing, tiered reading cadences,
  and the test harness — your own evals and capability map — that converts
  news into decisions.
difficulty: 1
est_minutes: 120
status: evolving
volatility: mixed
last_reviewed: 2026-07-09
sources:
  - key: arxiv-cscl
    tier: 2
    title: "arXiv cs.CL (Computation and Language) listings"
    org: arXiv
    url: https://arxiv.org/list/cs.CL/recent
    accessed: 2026-07-09
  - key: openai-changelog
    tier: 1
    title: "OpenAI API changelog"
    org: OpenAI
    url: https://platform.openai.com/docs/changelog
    accessed: 2026-07-09
  - key: anthropic-news
    tier: 1
    title: "Anthropic release notes and news"
    org: Anthropic
    url: https://docs.anthropic.com/en/release-notes/overview
    accessed: 2026-07-09
  - key: willison-blog
    tier: 5
    title: "Simon Willison's Weblog"
    org: Simon Willison
    url: https://simonwillison.net/
    accessed: 2026-07-09
  - key: latent-space
    tier: 5
    title: "Latent Space newsletter and podcast"
    org: swyx & Alessio
    url: https://www.latent.space/
    accessed: 2026-07-09
---

# Staying Current

This field produces a paradigm-shift headline daily, a significant model release monthly, and a genuine mechanism change perhaps twice a year — and nothing in those three categories labels itself honestly. An AI engineer who tries to track everything drowns and ships nothing; one who tracks nothing wakes up a year later maintaining last paradigm's architecture. This short chapter is the meta-skill the rest of the curriculum assumes: a *system* — signal sources ranked, filter questions applied, cadences tiered, and a test harness that converts news into decisions — sized to fit inside a working engineer's week. The deep insight is one you already own: this repo's own conventions (source tiers, volatility tags, review cadences) *are* a staying-current system; this chapter teaches you to run a personal instance of it.

## Intuition: a filter problem, not a coverage problem

The instinct to resist is completionism. The volume is unboundedly large and mostly redundant: every release generates one primary source and hundreds of derivative takes; every capability advance gets reported ten times before it ships and once after. Trying to "keep up with AI news" is trying to drink the derivative layer — infinite, low-nutrition, anxiety-producing.

The correct frame: **you are running an intake filter whose output is decisions, not awareness.** There are only a handful of decisions news can actually change for you: re-run a model bake-off (api-06's triggers), re-map a capability (fnd-09's living map), adopt a new primitive (a new API feature worth wiring into the gateway), re-read a mechanism (something in module 1's territory actually changed), or adjust a plan (pricing, deprecation, terms). Anything that doesn't feed one of those five is entertainment — fine, but budget it as entertainment.

Two structural facts make the filter tractable. First, **the field's knowledge has the volatility structure this repo tagged**: mechanisms (evergreen) change rarely and announce loudly; tooling (volatile) churns constantly and matters selectively; products (hyper-volatile) mostly don't matter at all. Your foundations module is precisely the filter that tells these apart — an engineer who understands fnd-05 through fnd-07 reads a release note in thirty seconds and knows which layer moved. Second, **your own evals are the ultimate filter** (evl-01): "is this release better *for us*" is a batch job, not a discourse.

## The signal hierarchy

Rank sources by the same logic as this repo's citation tiers — proximity to ground truth:

1. **Primary sources (this repo's T1/T2):** provider changelogs and release notes,[^openai-changelog][^anthropic-news] model cards, API docs diffs, and — for mechanisms — the actual papers.[^arxiv-cscl] Highest signal density in the ecosystem: a changelog line is a fact; everything downstream of it is interpretation. The professional habit that feels unnatural and isn't: *read the model card, skip the launch thread.*
2. **Lab engineering blogs (T4):** how the builders themselves deploy and evaluate — mechanism-adjacent, marketing-tinged; read for the graphs, discount the adjectives.
3. **High-quality curators (T5, chosen carefully):** a small number of practitioners who read the primary layer *for* you and have a track record of calling hype correctly — the working-engineer's newsletter/blog tier.[^willison-blog][^latent-space] The selection criterion: curators who run the code and show their experiments, not curators who aggregate headlines. Two or three, not fifteen.
4. **Social feeds (unranked):** occasionally first, systematically unreliable, algorithmically optimized for the exact anxiety this chapter exists to prevent. Useful as a *tripwire* ("something happened") never as an *assessment* ("what it means") — route every tripwire to a primary source before believing anything.

The anti-pattern to name: inverting the pyramid — forming views from the social layer and never reaching the primary one. It feels current and produces systematically wrong models of the field, because the derivative layer amplifies exactly the claims (benchmark leaps, paradigm deaths) that fnd-09 taught you to discount.

## The three filter questions

Applied to any incoming item, in order, ~10 seconds each:

1. **Does it change a mechanism?** Did something in module 1's territory actually move — architecture, training method, decoding, a new primitive class (as tool calling was in 2023, as reasoning RL was in 2024)? These are rare, loud, and worth deep time when real. Test: could you update a specific chapter of your mental foundations with it? If you can't name the chapter, it didn't.
2. **Does it move my capability or economics map?** New model in a tier I use, price change >20%, deprecation notice, context/feature change relevant to my architecture (api-06's re-evaluation triggers, verbatim). These convert directly to scheduled work: a bake-off, a calendar entry, a config change. Test: does it create a ticket?
3. **Does it change what I should build or learn next?** A capability crossing plausibly relevant to your product's failed-task list (fnd-09's living map), a new primitive worth a prototype, a pattern (from the curator tier) worth adopting. Test: does it change a plan?

Three noes = close the tab, guilt-free. The questions encode the volatility structure: question 1 is the evergreen layer (rare, deep), question 2 the volatile layer (frequent, shallow, ticket-shaped), question 3 the roadmap layer (occasional, medium). Most items — benchmark drama, wrapper launches, personnel news, "X is dead" takes — fail all three, which is the system working.

## The cadences

Tiered like an eval suite (evl-01's smoke/full/deep), sized honestly:

- **Daily (~15 minutes, optional):** skim the tripwire layer plus one curator digest. The goal is *ambient awareness*, not comprehension — you're checking whether anything demands the filter questions today. Zero guilt on skipped days; genuinely important items resurface within a week by construction.
- **Weekly (~45 minutes):** process the accumulated queue through the filter questions; read the one or two survivors properly (primary sources); convert question-2 hits into tickets and calendar entries. This is the load-bearing cadence — if you keep only one, keep this.
- **Monthly (~2 hours):** one deep read — a paper that passed question 1, a new primitive's docs end-to-end, a curator's technical deep-dive — *with the laptop open* (the fnd-07/fnd-08 mini-project pattern: run it, don't just read it). Depth on one thing beats coverage of twenty; this is where your foundations actually update.
- **Quarterly (~half day):** the systematic re-map, which this repo already scheduled for you — re-run the capability probes (fnd-09), re-check the model-selection triggers (api-06), review deprecation calendars, and re-read your own decision logs. This is CONVENTIONS.md's volatile-content review cadence, applied to your head instead of these files.

Total steady-state cost: roughly three hours a week, one of them optional. The number matters: a system that demands more gets abandoned in the first busy sprint, and an abandoned system silently becomes "whatever the feed serves me."

## Your test harness is your subscription

The highest-leverage staying-current asset is nothing you read — it's what you've already built through this curriculum:

- **The eval suite (evl-01)** turns "is the new model better?" from discourse into a batch job. Teams with harnesses *experience* releases as diffs; teams without experience them as debates.
- **The capability map (fnd-09)** turns "did the frontier move?" into a re-run: your failed-task list is a standing question the field keeps answering. Crossings are roadmap events you detect the week they happen.
- **The local lab (api-07)** turns "is this open-weight release real?" into an afternoon: pull it, point the harness at it, read the numbers.
- **The decision log (api-06)** turns "should we revisit?" into a diff against recorded reasoning — and makes quarterly reviews fast instead of archaeological.

This inverts the usual relationship with news: instead of reading to *form opinions*, you read to decide *what to measure* — and your infrastructure holds the opinions. It's the evl-01 doctrine applied to the field itself: don't trust claims you can test.

## What to deliberately ignore

The negative space, stated explicitly because the ambient pressure is real:

- **Benchmark horse-races** between models you don't use, on benchmarks you now know how to discount (fnd-09).
- **"X is dead" declarations** — prompt engineering, RAG, fine-tuning, and programming itself have each died several times during this curriculum's coverage window; the pattern (api-02's history section) is that the *incantation layer* dies while the discipline persists. Assume the same until a question-1 mechanism change says otherwise.
- **Speculative capability discourse** — AGI timelines, consciousness debates: intellectually legitimate, professionally non-actionable; nothing in your five decisions changes.
- **Product launch theater** for wrappers and demos (fnd-01's absorption warning — most are gone before your quarterly review).
- **Drama** — lab politics, personality feuds, funding gossip. High engagement, zero tickets.
- **FOMO itself:** the field's genuinely important changes have, historically, been *impossible to miss* — they arrive in every channel simultaneously and stay. The tail you might miss by under-reading is thin; the productivity you lose by over-reading is thick and certain.

## Common misconceptions

- **"Falling a week behind means falling behind."** The half-life of AI news is days; the half-life of AI mechanisms is years. Missing a week costs you re-skimming one digest; missing the foundations costs you misreading everything. Invest accordingly.
- **"Experts read everything."** The engineers whose judgment you trust run *narrower* intake than you'd guess, anchored on primary sources plus their own experiments — depth-first, harness-backed. Breadth is what the curator tier is for.
- **"I need to evaluate every new model."** You need triggers (api-06): releases in *your* tiers, price moves, deprecations, capability-map candidates. The rest is other people's procurement.
- **"Staying current is reading."** Half of it is *running* — the monthly hands-on deep-dive and the harness re-runs are where understanding actually updates. Reading about a primitive you've never invoked produces opinion, not knowledge (the mini-project pattern of this whole curriculum, applied forward).
- **"The feed keeps me informed."** The feed keeps you *engaged* — its selection function is arousal, not decision-relevance. Tripwire only; assessments come from tier 1.

## Best practices

- **Instantiate the system this week:** two curator subscriptions,[^willison-blog][^latent-space] provider changelog bookmarks for your portfolio,[^openai-changelog][^anthropic-news] a read-later queue, and the weekly 45 minutes on the calendar. The whole setup is an hour.
- **Route everything through the three questions;** keep a lightweight log of question-2 tickets and question-3 plan changes — it doubles as your quarterly-review input.
- **Protect the monthly hands-on slot** hardest — it's the one that compounds; a year of them is twelve genuinely-understood primitives, which is more than most of the field manages.
- **Let your triggers subscribe for you:** deprecation calendars, price-change alerts where offered, release notes for your pinned versions — push-based facts beat pull-based browsing.
- **Audit the diet quarterly:** which sources produced tickets or plan changes last quarter? Drop the ones that produced only engagement. (Your sources are a portfolio; api-06's consolidation discipline applies.)
- **When genuinely uncertain whether something matters — run it.** An afternoon with the harness settles what a week of reading takes can't (and is more fun).

## Real-world examples

**The release week, two ways.** A major provider ships a new model family. Engineer A's week: forty feed threads, three hot-take podcasts, a strong opinion, no measurements. Engineer B's hour: changelog + model card (ten minutes — question 2: yes, it's in their tier), bake-off queued on the harness (evl-01's one-day adoption story), a capability-map re-run scheduled for the two long-failed tasks the card's claims touch (question 3), ticket filed, done. B knows *less discourse* and *more facts* — and B's knowledge compounds into the decision log while A's evaporates by Friday.

**The mechanism that was worth a month.** When reasoning-RL models first shipped (fnd-07's history), the filter questions flagged a rare question-1 hit: a genuine mechanism change — test-time compute as a new scaling axis, effort as a new API parameter, a capability-band shift (fnd-09's volatile callout). The correct response wasn't a news skim; it was the deep treatment: papers, docs, a month of monthly-slots running experiments, updated foundations. The system's value is precisely this discrimination — thirty seconds for the daily noise, a month for the twice-a-year real thing, and the foundations to tell which is which.

**The subscription audit.** An engineer's quarterly review finds: curator A produced four tickets and a prototype; curator B produced zero decisions in six months of daily reading; the social feed produced eleven tripwires, nine false. Actions: keep A, drop B guilt-free, demote the feed to weekends. Intake, like every portfolio in this curriculum, pays rent or gets consolidated.

## Interview questions

1. **"How do you stay current in a field that changes this fast?"** — Model answer: a filtered system, not a feed habit. Primary sources first — changelogs, model cards, papers — with two or three trusted practitioner-curators as the digest layer and social feeds demoted to tripwires. Every item passes three questions: does it change a mechanism, move my capability/economics map, or change what I build next? Three noes, closed tab. Cadences: weekly processing, monthly hands-on deep-dive, quarterly systematic re-map against my own eval harness and capability probes — because the real answer to "is the new thing better" is a measurement, not an opinion. Roughly three hours a week, and the foundations to know which layer any news item touches.

2. **"A new model just topped the leaderboards. What do you actually do?"** — Model answer: filter question 2 — is it in a tier and modality I use? If not, nothing. If so: model card and changelog (not the launch thread), check license/terms/deprecation posture, queue the private bake-off on the existing harness — task evals, latency at my prompt shapes, cost-per-task — and re-run the capability map's failed-task list against it, since crossings are roadmap events. Decision lands in the log with triggers for revisiting. Total: an hour of reading, a batch job, a documented outcome — the leaderboard's role ended at 'shortlist candidate.'

3. **"How do you distinguish a genuine paradigm shift from hype?"** — Model answer: the mechanism test — can I name the specific layer of the stack that changed (architecture, training objective, decoding, a new primitive class) and update a specific piece of my foundations with it? Genuine shifts — transformers, in-context learning, RLHF, tool calling, reasoning RL — all pass it and arrive with primary-source evidence that survives replication. Hype fails it: capability claims without mechanism, benchmark jumps without contamination checks, product launches wearing paradigm costumes. Second heuristic: real shifts are impossible to miss and stay news for months; anything demanding I react *today* is selling something.

4. **"Your team keeps getting distracted by AI news. Fix the process."** — Model answer: institutionalize the personal system. One owner runs the weekly filter and posts a two-line digest with tickets, not links; api-06's triggers (tier releases, price moves, deprecations) define what generates work — everything else explicitly doesn't; the eval harness is the designated arbiter, so 'should we switch' becomes a queued bake-off instead of a meeting; and a quarterly re-map slot absorbs the accumulated 'should we look at X' anxiety into scheduled, bounded work. The message to the team: we respond to measurements and triggers, not headlines — which is also, not coincidentally, this curriculum's entire epistemics.

## Exercises and mini-project

**Exercises**

1. Run this week's AI news through the three filter questions; log the verdicts. What fraction survived? (Typical honest answer: under 10%.)
2. Audit your current intake: list every AI source you consume, and mark which produced a ticket or plan change in the last quarter. Draft the cuts.
3. Take one historical "X is dead" claim (prompt engineering, RAG — pick one you remember) and write the three-sentence retrospective: what died, what persisted, which filter question would have called it correctly at the time.
4. Set up the trigger layer: find and bookmark the changelog/deprecation pages for every provider in your api-06 decision log; put the quarterly re-map on your actual calendar.
5. Design the two-line weekly digest format for a team: what fields make it decision-bearing rather than link-sharing?

**Mini-project: instantiate and run the system for one month.** (a) Set up the stack: 2–3 curator subscriptions, changelog bookmarks, a read-later queue, calendar blocks (weekly 45min, monthly 2h); (b) keep the filter log for four weekly cycles: items in, question verdicts, tickets/plans out; (c) spend the monthly slot hands-on with one item that passed question 1 or 3 — run it against your harness or build the minimal prototype; (d) end-of-month memo: items consumed vs. decisions produced, sources ranked by yield, one thing you'd have missed without the system and one thing the system correctly let you ignore. Target: 1 hour setup + the cadences themselves. Success criterion: a measured intake-to-decision ratio — and the subjective one: release-week anxiety replaced by "it's queued on the harness."

**Capstone extension:** the quarterly re-map slot is where your capstone's model portfolio (api-06), capability probes (fnd-09), and eval baselines (evl-01) get their scheduled refresh — this chapter is the maintenance contract for everything the curriculum builds.

## Revision summary

- Staying current is a filter problem with five decision outputs (bake-off, capability re-map, primitive adoption, mechanism re-learn, plan change) — not a coverage problem. Anything feeding none of them is entertainment.
- Signal hierarchy mirrors this repo's tiers: changelogs/cards/papers first, lab blogs second, 2–3 proven practitioner-curators third, social feeds as tripwires only. Never invert the pyramid.
- Three filter questions — mechanism changed? map moved? plans changed? — encode the volatility structure: rare-and-deep, frequent-and-ticket-shaped, occasional-and-roadmap-shaped. Most items fail all three; that's the system working.
- Cadences: optional daily skim, load-bearing weekly processing (45min), protected monthly hands-on deep-dive (the compounding one), quarterly systematic re-map (this repo's review cadence, run on yourself). ~3 hrs/week total.
- Your infrastructure is your best subscription: eval harness, capability map, local lab, and decision log convert news into measurements — read to decide what to test, not what to think.

## Flashcards

| Q | A |
|---|---|
| The five decisions news can actually change? | Re-run a bake-off, re-map a capability, adopt a primitive, re-learn a mechanism, adjust a plan (price/deprecation/terms). |
| The signal hierarchy? | Primary (changelogs, model cards, papers) → lab blogs → 2–3 proven curators → social as tripwire-only. |
| The three filter questions? | Does it change a mechanism? Move my capability/economics map? Change what I build or learn next? |
| The load-bearing cadence? | Weekly 45 minutes: process the queue through the filters, read survivors at the primary source, convert hits to tickets. |
| Which cadence compounds most? | The monthly hands-on deep-dive — run one thing properly; twelve genuinely-understood primitives a year. |
| Why is the eval harness a "subscription"? | It converts every release from discourse into a batch job — you read to decide what to measure, not what to think. |
| The mechanism test for paradigm claims? | Can you name the stack layer that changed and the foundations chapter it updates? No named layer, no paradigm. |
| What does the "X is dead" pattern actually predict? | The incantation layer dies; the discipline persists — assume so until a genuine mechanism change says otherwise. |
| How much time should the whole system cost? | ~3 hours/week — anything heavier gets abandoned, and abandoned systems default to the feed. |
| Quarterly review inputs? | Capability-probe re-runs, api-06 triggers and deprecation calendar, decision-log revisit, and the intake-source audit. |

## Further reading

- **Official docs:** the changelog and release-note pages of every provider in your portfolio[^openai-changelog][^anthropic-news] — these *are* the primary feed; bookmark, don't rediscover.
- **Papers:** the arXiv cs.CL recent listings[^arxiv-cscl] — not to read daily, but to know where question-1 items live; your monthly slot draws from here.
- **Books:** none — the format is structurally too slow for this chapter's volatile layer, which is rather the point of the system.
- **Talks:** conference keynotes age in months; the curator tier will surface the two per year worth watching.
- **Tutorials:** none — the mini-project (running the system for a month) is the tutorial.
- **Curators:** Simon Willison's weblog[^willison-blog] and Latent Space[^latent-space] — [T5, flagged: exemplars of the runs-the-code curator tier; substitute freely as the tier evolves, per this chapter's own audit discipline].

## Check your understanding

1. Reconstruct the full system from memory: hierarchy, questions, cadences, and the infrastructure that closes the loop.
2. Apply the three questions to the last three AI news items you remember — verdicts and (if any) the tickets they'd have produced.
3. Why does this chapter claim your foundations module is itself a news filter? Give two concrete examples of a release note read differently with and without fnd-05/fnd-07.
4. Design the team version: who owns what cadence, what generates work, and what explicitly doesn't.
5. This chapter closes the Day-2 curriculum arc. Which artifacts from earlier chapters (name four) did it promote into standing infrastructure, and what does each replace?

## Sources

[^arxiv-cscl]: [T2] arXiv. "cs.CL — Computation and Language, recent listings." https://arxiv.org/list/cs.CL/recent (accessed 2026-07-09)
[^openai-changelog]: [T1] OpenAI. "API changelog." https://platform.openai.com/docs/changelog (accessed 2026-07-09)
[^anthropic-news]: [T1] Anthropic. "Release notes." https://docs.anthropic.com/en/release-notes/overview (accessed 2026-07-09)
[^willison-blog]: [T5 — proven runs-the-code curator; substitute per your own audit] Willison, S. "Simon Willison's Weblog." https://simonwillison.net/ (accessed 2026-07-09)
[^latent-space]: [T5 — proven practitioner curator; substitute per your own audit] swyx & Alessio. "Latent Space." https://www.latent.space/ (accessed 2026-07-09)
