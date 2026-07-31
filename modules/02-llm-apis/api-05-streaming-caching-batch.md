---
id: api-05
title: "Streaming, Prompt Caching & Batch APIs"
module: llm-apis
prerequisites: [api-01]
related_ids: [fnd-05, prd-01, prd-05, api-02]
keywords:
  - streaming
  - server-sent events
  - prompt caching
  - cached tokens
  - batch api
  - ttft
  - latency
  - cost optimization
  - cache hit rate
summary: >-
  The three levers every provider exposes for cost and latency: streaming
  (perceived latency and long outputs), prompt caching (skip prefill for
  stable prefixes), and batch APIs (half-price asynchronous bulk work). Covers
  the mechanics of each, how they compose, the workload-to-lever mapping, and
  the failure modes — mid-stream errors, cache-hostile prompts, batch misuse.
difficulty: 3
est_minutes: 180
status: evolving
volatility: volatile
last_reviewed: 2026-07-09
sources:
  - key: anthropic-caching
    tier: 1
    title: "Prompt caching"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
    accessed: 2026-07-09
  - key: openai-caching
    tier: 1
    title: "Prompt caching guide"
    org: OpenAI
    url: https://platform.openai.com/docs/guides/prompt-caching
    accessed: 2026-07-09
  - key: openai-streaming
    tier: 1
    title: "Streaming API responses"
    org: OpenAI
    url: https://platform.openai.com/docs/guides/streaming-responses
    accessed: 2026-07-09
  - key: anthropic-streaming
    tier: 1
    title: "Streaming Messages"
    org: Anthropic
    url: https://docs.anthropic.com/en/api/messages-streaming
    accessed: 2026-07-09
  - key: openai-batch
    tier: 1
    title: "Batch API"
    org: OpenAI
    url: https://platform.openai.com/docs/guides/batch
    accessed: 2026-07-09
  - key: anthropic-batch
    tier: 1
    title: "Message Batches API"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/build-with-claude/batch-processing
    accessed: 2026-07-09
---

# Streaming, Prompt Caching & Batch APIs

Every provider exposes the same three levers, because all three fall out of the same serving physics you learned in fnd-05: **streaming** (deliver decode's token-by-token output as it happens — the perceived-latency lever), **prompt caching** (skip prefill for byte-stable prefixes — the real-latency and cost lever), and **batch APIs** (trade latency you don't need for ~half-price bulk processing — the throughput-economics lever). Used well, they routinely cut effective cost 50–90% and transform UX; used blindly, they add failure modes — mid-stream errors, cache-hostile prompt churn, batch jobs on latency-sensitive paths. This chapter covers the mechanism, contract, and failure surface of each lever, and the mapping from workload shape to lever choice that prd-01 and prd-05 will build on. It is `volatile` at the parameter level (pricing ratios, TTLs, minimums churn quarterly) and stable at the mechanism level — learn the physics, verify the numbers.[^anthropic-caching][^openai-caching]

## Intuition: three mismatches, three levers

Each lever exists because a naive request-response API mismatches some workload shape:

- **Mismatch 1: generation is sequential, users are impatient.** Decode produces one token at a time (fnd-05); a 500-token answer *cannot* arrive faster than 500 decode steps. But it can arrive *as it's produced* — streaming converts a 15-second wait into a 1-second wait plus 14 seconds of readable progress. Nothing gets faster; everything *feels* faster, and long outputs stop timing out.
- **Mismatch 2: your prompts repeat, prefill doesn't know it.** Production prompts are overwhelmingly repeated prefixes — same system prompt, same tool schemas, same documents — with a small variable suffix. Prefill (fnd-05's quadratic compute) recomputes the identical KV cache every time. Prompt caching stores it: pay full price once, then a steep discount and a TTFT collapse on every hit.
- **Mismatch 3: bulk work doesn't need answers now, but pays real-time prices.** Evals, backfills, enrichment, synthetic data — millions of requests where "within a day" is fine. Batch APIs queue this work into the provider's off-peak capacity (idle GPU time is otherwise wasted — prd-02's economics) at ~50% price with no rate-limit pressure on your interactive quota.

The unifying frame: these are the **workload-shape adapters** between your traffic and the serving economics of fnd-05. Choosing among them is a classification task — interactive? repeated-prefix? deferrable? — and most products need all three, on different paths.

## Streaming: mechanics and contract

The wire mechanics: instead of one JSON response, the API holds the connection open and emits **server-sent events (SSE)** — a typed event stream: message start, content deltas (the tokens, in chunks), tool-call deltas, usage, message stop.[^openai-streaming][^anthropic-streaming] Your client consumes events as they arrive; SDKs wrap this in iterators.

What streaming changes, precisely: **TTFT (time to first token) is unchanged** — prefill still runs first (fnd-05); what changes is that you receive tokens during decode instead of after it. So the UX math: total latency identical; *perceived* latency ≈ TTFT; and timeout design transforms — instead of one giant request timeout sized to worst-case output, you set a TTFT timeout plus an inter-token staleness timeout, which distinguishes "slow but alive" from "dead" correctly.

The engineering fine print that separates working implementations from flaky ones:

- **Errors become in-band.** A stream can fail *mid-generation* — after your user watched half an answer render. You need a policy: retry-and-replace (idempotency — api-01), resume-style continuation (rarely supported — usually you re-request), or graceful truncation with a retry affordance. "The answer vanished at 80%" is a distinctly bad UX; decide before it happens.
- **Structured data over streams is a state machine.** Tool calls and JSON arrive as deltas; you accumulate until complete — never parse partials as final (api-03's truncation lesson in stream form). SDK accumulators exist; know what yours guarantees.
- **`usage` and `stop_reason` arrive at the end** — your logging and truncation checks (api-01) must consume the final events, not just the content deltas. Streams that get abandoned client-side still bill.
- **Downstream must not buffer.** A streaming API behind a buffering proxy/gateway is a non-streaming API with extra steps — verify end-to-end flushing through your own infrastructure.

When *not* to stream: machine-consumed outputs (your parser gains nothing and inherits the state machine), very short outputs (overhead dominates), and batch-shaped work (below).

## Prompt caching: mechanics and contract

The mechanism is fnd-05's, verbatim: causal masking makes a prefix's KV cache depend only on the prefix, so a **byte-identical** prompt prefix can reuse the stored cache — prefill skipped for that span, billed at a deep discount (cached-input rates are typically 5–10× cheaper than regular input), TTFT correspondingly collapsed.[^anthropic-caching][^openai-caching]

The contract's load-bearing clauses (semantics differ per provider — this is the volatile core):

- **Exactness:** matching is positional and byte-level from token zero. One differing character invalidates *everything after it*. A timestamp on line one of your system prompt is a 0% hit rate.
- **Lifetime:** caches expire on a TTL (minutes-scale by default, refreshed on use; longer tiers exist at different pricing); cold traffic pays full price to re-warm — cache economics depend on request *frequency* per prefix, not just repetition.
- **Granularity:** some providers cache implicitly (automatic prefix detection), some use explicit breakpoints you place in the prompt; minimum cacheable lengths apply. Writes may cost a premium over regular input (check the ratio — caching a prefix used twice can still pay, but do the arithmetic).[^anthropic-caching]
- **Scope:** caches are scoped (per-org at minimum); you cannot rely on cross-tenant warmth, and you shouldn't want to (isolation).

The design doctrine this contract dictates — already previewed in fnd-05 and api-02, now operational:

1. **Order prompts stable→volatile:** system prompt, tool schemas, few-shot examples, reference documents, *then* conversation history, *then* the current query. Every reordering toward this shape is free money.
2. **Kill prefix churn:** no timestamps/request IDs/randomized elements in the stable region; template discipline (api-02's versioning helps — a prompt deploy is a deliberate cache-invalidation event, not a per-request accident).
3. **Structure conversation for append-only growth:** chat history that only appends keeps the prior turns cached (each turn extends the prefix); history *editing* (summarization, trimming — rag-01) invalidates, so schedule it deliberately, not per-turn.
4. **Measure hit rate as a first-class metric:** providers return cached-token counts in `usage` — wire them into your api-01 logging and dashboard. Cache hit rate is a prompt-architecture health metric; a drop is a regression (someone added a dynamic header) worth alarming on.

## Batch APIs: mechanics and contract

The contract: submit a file/collection of requests; the provider processes them asynchronously within a completion window (typically 24 hours, usually much faster); results arrive as a downloadable set; pricing is ~50% of synchronous rates, with dedicated quotas that don't compete with your interactive traffic.[^openai-batch][^anthropic-batch]

What belongs on the batch path — the recognition pattern is "nobody is waiting":

- **Evals** (evl-02/evl-06): your regression suites are the canonical batch workload — hundreds of cases × multiple runs (fnd-08's n-run discipline) at half price, off your production quota.
- **Ingestion and enrichment:** document extraction (api-03/api-04), classification backfills, embedding-adjacent summarization for indexes (rag-04/rag-05).
- **Synthetic data generation** (ftn-03) and periodic re-processing (reindexing after prompt/schema changes).

The engineering fine print:

- **Design for partial completion:** batches complete item-by-item; some items fail (validation, filters, transient errors). Your consumer must handle per-item status, retry failed subsets, and dedupe by your own item IDs — batch jobs are distributed systems, bring the idempotency discipline (api-01).
- **Expiration and windows are real:** results expire; jobs can complete at hour 23. Pipelines need pickup automation and window-aware scheduling, not a human clicking download.
- **Batch is not a queue for eventually-interactive work:** if a user will *ever* see it soon, the completion window is your worst-case SLA. Misclassification here is the lever's classic misuse.

> **Volatile:** every number in this chapter — cache discount ratios, write premiums, TTLs, minimum cacheable lengths, batch pricing and windows, SSE event schemas — is a per-provider, per-quarter fact. The mechanisms (decode delivery, KV reuse, off-peak arbitrage) and the doctrine (stable-first prompts, hit-rate monitoring, nobody-waiting classification) are the durable content. Verify numbers at build time; re-verify at the review cadence.[^anthropic-caching][^openai-caching][^openai-batch]

## Composing the levers

The levers stack, and production systems run all three:

| Workload | Streaming | Caching | Batch |
|---|---|---|---|
| Interactive chat / copilot | Yes — perceived latency | Yes — system prompt + history prefix | No |
| RAG Q&A service | Yes (user-facing) | Yes — instructions + (hot) documents | Ingestion side: yes |
| Extraction pipeline | No — machine-consumed | Schema/instructions prefix | Yes — the bulk path |
| Agent loops (module 4) | Often (progress UX) | Critically — tool schemas + growing trajectory | Sub-tasks sometimes |
| Eval runs | No | Yes — shared rubric prefix | Yes — canonical |

Two composition notes worth flagging now: **caching + agents** is the highest-stakes pairing — agent trajectories are long, append-only, and re-sent every step (agt-01), so cache discipline is the difference between viable and absurd agent economics; **caching + batch** interact per provider (whether batch requests share/populate caches differs — check), which matters for giant eval runs over a shared prefix.

## Production engineering perspective

- **Do the cache arithmetic before the quarter's cost review, not after:** (prefix tokens × requests × hit rate × discount) is usually the largest single line-item saving available without touching quality. A 20k-token document prefix hit 50 times at a 90% discount is not a rounding error.
- **Latency budgets decompose as TTFT + tokens×TPOT (fnd-05):** streaming addresses perception, caching attacks TTFT, output-length discipline (api-01's `max_tokens`, api-02's concise-output prompting) attacks the decode tail. Name which term you're optimizing before reaching for a lever.
- **Route by workload class at the gateway** (api-01's module earns its keep): interactive → stream+cache; deferrable → batch; the classification is a request attribute, not a per-callsite decision.
- **Alert on the two silent regressions:** cache hit-rate drops (prompt churn crept in) and batch-window overruns (pipeline stall). Both are cheap to detect from data you already log.
- **Failure isolation:** batch quotas isolate bulk from interactive traffic — use that as blast-radius design (the api-01 429-storm example's systemic fix), not just as pricing.

## Historical evolution

**2022–2023:** streaming ships early (chat UX demanded it); everything else is community scaffolding — client-side response caches, cron-and-pray bulk scripts. **2023–2024:** batch APIs formalize the bulk tier; prompt caching arrives as an explicit feature (Anthropic's breakpoint model, mid-2024) and as automatic prefix caching elsewhere — the KV-reuse mechanism (long used inside serving engines, prd-02) surfaces into the billing model.[^anthropic-caching][^openai-caching] **2024–present:** cached-token pricing becomes a headline competitive axis, cache TTL tiers and longer windows appear, and agent-era traffic (long trajectories, tool schemas) makes cache discipline a first-order architecture concern. The pattern, third time now: serving-layer physics migrate upward into API contracts — which is exactly why fnd-05 was worth learning before this chapter.

## Common misconceptions

- **"Streaming makes generation faster."** It makes delivery concurrent with generation — total time is unchanged; TTFT is unchanged; *perceived* latency and timeout ergonomics improve. To actually get faster: cache (TTFT), shorten outputs (decode), smaller model (both).
- **"The cache remembers meaning."** It stores KV state for byte-identical prefixes — positional and exact. Semantically identical, differently-worded prompts share nothing. (Semantic caching — matching similar *requests* — is a different, application-layer technique with different correctness risks: prd-05.)
- **"Caching changes model behavior."** A cache hit is mathematically identical computation (fnd-05's causality guarantee) — same distribution, same quality. If outputs differ, that's sampling variance (fnd-08), not the cache.
- **"Batch is just slow regular requests."** It's a different contract: different pricing, quotas, completion semantics, and failure model (per-item, partial). Treating it as a slow queue misses both its economics and its engineering requirements.
- **"We'll add these optimizations later."** Caching is a *prompt-architecture* property (stable-first ordering) — retrofitting it means rewriting prompts; and streaming is a *UX-architecture* property — retrofitting it means rewriting clients. Design for both on day one; enable them when needed.
- **"Cached tokens are free context."** Discounted, not free — and cache hits don't shrink the *context* (attention still runs over everything at decode; lost-in-the-middle still applies — fnd-05). Caching fixes cost/TTFT, never context-quality budgets (rag-01).

## Failure modes and trade-offs

- **Mid-stream failure with no policy** — half-rendered answers vanishing. *Fix:* explicit retry/replace policy, idempotent generation (api-01), UX affordances. *Trade-off:* retry-and-replace re-bills the tokens.
- **Cache-hostile prompt churn** — dynamic headers, per-request IDs, A/B variants multiplying prefixes, aggressive history rewriting. *Fix:* stable-first discipline, hit-rate alarms, deliberate invalidation on deploys. *Trade-off:* history summarization (context quality, rag-01) vs. cache retention — schedule rewrites at natural session boundaries.
- **Cold-traffic cache economics** — low-frequency prefixes paying write premiums for hits that never come. *Fix:* cache only above a measured frequency threshold; arithmetic per prefix class.[^anthropic-caching]
- **Batch misclassification** — user-visible work on a 24h window, or eval runs burning interactive quota. *Fix:* the nobody-waiting test, enforced at the gateway.
- **Partial-batch mishandling** — silent item failures, expired results, duplicate reprocessing. *Fix:* per-item status handling, own-ID idempotency, pickup automation.
- **Buffering middleboxes** — streaming defeated by your own proxy. *Fix:* end-to-end flush verification as a deployment check.

## Best practices

- **Prompt-architect for caching from the first template:** stable→volatile ordering, no dynamic content in the stable region, append-only history between deliberate compaction points.
- **Wire cached-token counts and hit rate into the api-01 logs and dashboard;** alarm on drops. Treat a hit-rate regression like a cost incident, because it is one.
- **Stream every user-facing generation above ~2 seconds;** implement TTFT + staleness timeouts, final-event consumption (`usage`, `stop_reason`), and a mid-stream failure policy.
- **Route all nobody-waiting work to batch** — evals especially; keep interactive quotas for interactive traffic.
- **Build batch consumers as proper distributed-systems citizens:** per-item idempotency, partial-failure retry, automated pickup before expiry.
- **Re-verify the numbers quarterly** (discounts, TTLs, minimums, windows) per this chapter's volatility tag — and re-run the cache arithmetic when they change.
- **Name the latency term before optimizing:** TTFT → caching/prompt-shrinking; decode tail → output discipline; perception → streaming.

## Real-world examples

**The 68% bill cut that was a reorder.** A RAG service sends: user question first (it "read better"), then instructions, then the same 15k-token policy corpus, per request. Cache hit rate: ~0% — the variable question at position zero invalidates everything after (positional exactness). Reordering to instructions + corpus first, question last — a one-day change with identical outputs (causality guarantees it) — yields ~85% of input tokens billed at cached rates: a 68% total cost reduction and TTFT dropping from 4s to 800ms. The entire win was knowing *why* caches match.

**The eval suite that was starving production.** A team's nightly evals (3k cases × 5 runs, fnd-08 discipline) run as synchronous calls on the production key: every night, a 429 storm degrades the product for real users (api-01's example, root-caused). Moving evals to the batch API halves their cost, removes the quota contention entirely, and — the unexpected win — lets the team *triple* eval coverage for the same budget. Bulk work on the bulk tier isn't just cheaper; it stops competing with your users.

**The stream that ate the answer.** A support chat streams beautifully in staging, but production users report answers "freezing at 90%": a gateway timeout closes long streams at 30s, mid-generation, and the client renders the partial silently — no error, no retry affordance. Fixes: flush-verified proxy config, staleness-based (not wall-clock) timeouts, final-event assertion (a stream without a stop event is a failure, not a completion), and a "response interrupted — retry" UX state. Streaming moved the failure surface *into* the response; the client has to know that.

## Interview questions

1. **"A PM asks: 'can we make the model respond faster?' Decompose the question."** — Model answer: latency = TTFT + output_tokens × per-token time (fnd-05's two phases). TTFT is prefill — attack with prompt caching (stable-prefix architecture), shorter prompts, or retrieval instead of context-stuffing. The decode tail — attack with output-length discipline (`max_tokens`, concise-output prompting) or a faster/smaller model. *Perceived* latency — attack with streaming, which changes no physics but converts a 15s wait into 1s-plus-progress. First question back to the PM: which of the three do users actually feel?

2. **"Explain how prompt caching works and why it requires byte-identical prefixes."** — Model answer: causal masking (fnd-05) means each position's KV vectors depend only on preceding tokens — so a stored prefix cache is valid for any continuation, and prefill can be skipped for the matched span, billed at a deep discount with TTFT collapsing. Byte-exactness follows from the same mechanism: KV state is positional — one changed token means every subsequent position's cached state was computed over different context and is invalid. Hence the doctrine: stable content first, volatile last, no timestamps in the prefix, append-only history.

3. **"Design the request-routing policy for a product with chat, document ingestion, and nightly evals."** — Model answer: classify at the gateway by workload shape. Chat: synchronous, streamed (perceived latency), cached system-prompt + append-only history prefix, TTFT/staleness timeouts. Ingestion: batch API — nobody's waiting; per-item idempotency, partial-failure retries, automated pickup; caching on the shared extraction-schema prefix if the provider supports batch-cache interaction. Evals: batch, always — half price, n-run replication affordable, zero contention with interactive quota. Each class gets its own key/quota for blast-radius isolation.

4. **"Your cache hit rate dropped from 80% to 15% overnight. Walk through the diagnosis."** — Model answer: hit rate is a prompt-stability metric, so suspect prefix churn: check recent prompt-template deploys (a legitimate, expected invalidation — should re-warm quickly), then dynamic content creep (a timestamp, request ID, or user-specific header added into the stable region — the classic), then A/B tests multiplying prefix variants (each variant is a separate cold cache), then traffic-pattern changes (frequency per prefix fell below TTL — cold-traffic economics), then provider-side changes to TTL/minimums. The logs make this fast: cached-token counts per template version pinpoint which prefix went cold and when.

5. **"When is prompt caching the wrong tool?"** — Model answer: low-frequency prefixes (TTL expires between uses — write premiums with no hits; do the arithmetic), genuinely per-request content (nothing stable to cache), and any problem that's actually about *context quality* rather than cost — caching discounts tokens but doesn't improve attention over them; a bloated context stays bloated (rag-01's problem). Also distinguish it from semantic caching of similar *requests* — an application-layer technique with real staleness/correctness risks that KV caching doesn't have. KV caching is free correctness-wise; that's exactly why it's the first lever, not the last.

6. **"What makes consuming a batch API harder than it looks?"** — Model answer: it's a distributed system wearing a convenience API. Per-item partial failure (some requests fail validation or filtering — handle statuses individually, retry subsets), idempotency across resubmission (your own item IDs, dedupe on ingest), completion-window scheduling (results at hour 23 are within contract — pipelines must tolerate it), result expiration (automated pickup, not manual download), and quota/cache interactions that differ per provider. The payoff justifying the ceremony: ~50% pricing and total isolation from interactive quotas.

## Exercises and mini-project

**Exercises**

1. A service sends 10k requests/day with a 12k-token stable prefix and 500 variable tokens. Using one provider's current cached/uncached/write pricing,[^anthropic-caching] compute daily input cost at 0%, 50%, and 90% hit rates. At what request frequency does the TTL make 90% achievable?
2. Reorder this prompt for caching, and state what invalidates where: `[user question] [today's date] [system instructions] [product docs, 8k tokens] [3 few-shot examples]`.
3. Design the mid-stream failure policy for a code-generation UI: detection (which timeout, which missing event), user experience, retry semantics, and billing implications.
4. Classify onto levers, with one-line justifications: (a) nightly re-summarization of 50k tickets; (b) an agent's 15-step trajectory; (c) a 3-word classification response; (d) a user-facing 800-token report.
5. Your batch job of 10k extractions returns 9,400 succeeded / 600 failed. Write the handling logic: what gets retried, keyed how, and what alarms.

**Mini-project: instrument the three levers.** Extend your api-01 client/gateway: (a) add streaming with TTFT + staleness timeouts, final-event assertion, and per-request TTFT/total-latency logging; (b) restructure one real prompt from your api-02/api-03 projects into stable-first form, enable caching, and measure — hit rate, cached-token counts, TTFT, and cost across 50 requests vs. the unordered baseline; (c) take your api-03 extraction eval (30 docs) and run it three ways: synchronous, synchronous-with-cache, batch — record cost, wall time, and quota consumption for each; (d) produce the memo: measured cost/latency for all configurations, your product's routing table (which traffic → which lever), and the two alarms you'd wire (hit-rate drop, batch overrun). Target: 3–4 hours. Success criterion: you have *measured* the cache reorder win and the batch discount on your own workload — numbers you'll reuse in prd-05.

**Capstone extension:** this instrumented gateway becomes the capstone's serving-cost layer: prd-01 adds routing/fallbacks, prd-05 turns the measurements into its cost model, and the eval-on-batch pattern becomes evl-06's CI economics.

## Revision summary

- Three levers = three workload-shape adapters over fnd-05's physics: streaming delivers decode as it happens (perceived latency, timeout ergonomics — total time unchanged); prompt caching reuses byte-identical prefix KV state (TTFT collapse + deep input discounts — correctness-free by causality); batch APIs arbitrage off-peak capacity (~50% price, isolated quotas, 24h windows) for nobody-waiting work.
- Streaming contract: SSE deltas, errors in-band (policy required), accumulate-don't-parse partials, final events carry `usage`/`stop_reason`, verify end-to-end flushing.
- Caching contract: positional byte-exactness (stable→volatile ordering; no dynamic prefix content; append-only history), TTL economics (frequency matters), write premiums (do the arithmetic), hit rate as an alarmed first-class metric.
- Batch contract: per-item partial completion, own-ID idempotency, window-aware automated pickup — a distributed system at half price; evals are its canonical tenant.
- Doctrine: name the latency term (TTFT/decode/perception) before choosing a lever; route by workload class at the gateway; design prompts and clients for these levers on day one — retrofits are rewrites. Mechanisms stable; every number volatile — verify quarterly.

## Flashcards

| Q | A |
|---|---|
| What does streaming actually change? | Delivery becomes concurrent with decode — perceived latency ≈ TTFT and timeouts get saner; total generation time is unchanged. |
| Why must cached prefixes be byte-identical? | KV state is positional — one changed token invalidates all subsequent cached state (computed over different context). |
| The prompt-ordering doctrine and its three payoffs? | Stable→volatile: cache hits (cost/TTFT), attention placement, diffable templates. |
| Why is a cache hit correctness-free? | Causal masking guarantees prefix KV state is identical computation — same distribution, same quality, only cheaper. |
| What decides cache economics besides repetition? | Frequency vs. TTL (cold prefixes expire between uses) and the write premium — arithmetic per prefix class. |
| The batch-eligibility test? | Nobody is waiting: if a user could ever see it soon, the completion window is your worst-case SLA — keep it synchronous. |
| Three things batch consumers must handle? | Per-item partial failure, idempotent resubmission via own IDs, automated pickup before result expiry. |
| Where do `usage` and `stop_reason` live in a stream? | In the final events — logging and truncation checks must consume stream-end, not just content deltas. |
| Latency term → lever mapping? | TTFT → caching/shorter prompts; decode tail → output-length discipline/smaller model; perception → streaming. |
| What in this chapter is volatile vs. stable? | All numbers (discounts, TTLs, windows, event schemas) volatile per provider/quarter; mechanisms (KV reuse, decode delivery, off-peak arbitrage) and doctrine stable. |

## Further reading

- **Official docs:** Anthropic prompt caching[^anthropic-caching] and Message Batches[^anthropic-batch]; OpenAI prompt caching[^openai-caching], streaming[^openai-streaming], and Batch API[^openai-batch] — the two vendors' caching models differ instructively (explicit breakpoints vs. automatic prefixes).
- **Papers:** none required — the mechanism paper trail is fnd-05's (PagedAttention et al.); this chapter is contract engineering.
- **Books:** none.
- **Talks:** none essential.
- **Tutorials:** each provider's caching cookbook — run one end-to-end with the token-count assertions before trusting your own arithmetic.

## Check your understanding

1. Derive, from fnd-05's two-phase request model, why caching attacks TTFT while streaming attacks perception — and why neither helps the decode tail.
2. Rewrite a cache-hostile prompt from memory (dynamic date, question-first) into cache-friendly form and state the expected hit-rate and TTFT effects.
3. Your team wants evals "moved to batch to save money." List the three engineering requirements that come with the 50% discount.
4. Which numbers in your gateway's config came from this chapter's volatile layer, and what's your re-verification trigger?
5. Explain to a reviewer why enabling caching cannot change output quality — cite the specific architectural property.

## Sources

[^anthropic-caching]: [T1] Anthropic. "Prompt caching." https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching (accessed 2026-07-09)
[^openai-caching]: [T1] OpenAI. "Prompt caching." https://platform.openai.com/docs/guides/prompt-caching (accessed 2026-07-09)
[^openai-streaming]: [T1] OpenAI. "Streaming API responses." https://platform.openai.com/docs/guides/streaming-responses (accessed 2026-07-09)
[^anthropic-streaming]: [T1] Anthropic. "Streaming Messages." https://docs.anthropic.com/en/api/messages-streaming (accessed 2026-07-09)
[^openai-batch]: [T1] OpenAI. "Batch API." https://platform.openai.com/docs/guides/batch (accessed 2026-07-09)
[^anthropic-batch]: [T1] Anthropic. "Message Batches API." https://docs.anthropic.com/en/docs/build-with-claude/batch-processing (accessed 2026-07-09)
