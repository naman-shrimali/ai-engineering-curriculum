---
id: api-01
title: "LLM API Fundamentals"
module: llm-apis
prerequisites: [fnd-01]
related_ids: [api-02, api-05, fnd-04, fnd-07]
keywords:
  - llm api
  - chat completions
  - messages api
  - system prompt
  - roles
  - statelessness
  - rate limits
  - max tokens
  - finish reason
  - api keys
summary: >-
  The working contract of every LLM API: the stateless messages paradigm,
  roles, request/response anatomy, token accounting, finish reasons, and the
  failure surface of rate limits and retries. Establishes the client-side
  disciplines — conversation management, usage logging, model pinning, key
  hygiene — that every later chapter assumes.
difficulty: 1
est_minutes: 180
status: evolving
volatility: mixed
last_reviewed: 2026-07-09
sources:
  - key: openai-api-ref
    tier: 1
    title: "API Reference — Chat completions"
    org: OpenAI
    url: https://platform.openai.com/docs/api-reference/chat
    accessed: 2026-07-09
  - key: anthropic-messages
    tier: 1
    title: "Messages API reference"
    org: Anthropic
    url: https://docs.anthropic.com/en/api/messages
    accessed: 2026-07-09
  - key: anthropic-errors
    tier: 1
    title: "Errors and rate limits"
    org: Anthropic
    url: https://docs.anthropic.com/en/api/errors
    accessed: 2026-07-09
  - key: openai-ratelimits
    tier: 1
    title: "Rate limits guide"
    org: OpenAI
    url: https://platform.openai.com/docs/guides/rate-limits
    accessed: 2026-07-09
  - key: gemini-api
    tier: 1
    title: "Gemini API reference"
    org: Google
    url: https://ai.google.dev/api
    accessed: 2026-07-09
---

# LLM API Fundamentals

Everything in this curriculum's application layer — prompting, retrieval, agents, evals — happens through one interface: an HTTPS call carrying a list of messages, returning generated tokens and a bill. This chapter establishes the working contract of that interface: the messages paradigm and why it's shaped that way (it mirrors the post-training format from fnd-07), what every field in a request and response actually does, the statelessness that surprises every newcomer, and the failure surface — rate limits, overloads, truncations — that production code must handle. The paradigm and disciplines here are stable across providers; parameter names and limits are per-vendor reading, flagged accordingly. If module 1 taught you what the machine is, this chapter is the socket you plug into it.

## Intuition: a stateless function with a meter

Strip the SDK sugar away and an LLM API is a single pure-ish function:

```text
response = complete(model, messages, params)  →  (new_message, usage, stop_reason)
```

Three properties of that function drive all client-side architecture. **It is stateless:** the provider retains nothing between calls — no memory of your conversation, no session (caching, api-05, is a performance optimization, not memory). Every request must carry *everything* the model should know, which makes conversation a client-side data structure and "what goes in the context" the central engineering question of modules 2–4. **It is metered per token:** input and output tokens (fnd-04) are counted and billed separately, output typically costing several times more (the decode economics of fnd-05). **It is nondeterministic and fallible:** same input may yield different output (fnd-08), and the call itself fails routinely — rate limits, overloads, timeouts — so retry-and-degrade logic is part of the interface, not an add-on.

A useful posture from day one: treat the LLM API like a *flaky, expensive, brilliant remote dependency* — the reliability discipline you'd apply to any third-party API, plus token economics, plus statistical output handling.

## The messages paradigm

Every major provider converged on the same request shape: an ordered list of **messages**, each with a **role** and content.[^openai-api-ref][^anthropic-messages][^gemini-api]

- **`system`** — the operator's standing instructions: persona, rules, constraints, output format. Set by you, invisible-by-convention to end users. Its authority is a *trained convention* (fnd-07's SFT taught the model to weight it), not an enforcement mechanism — which is why prompt injection (sec-01) is possible and why system prompts are not access control.
- **`user`** — input attributed to the human (or to your application acting as one). In production this is usually a *template*: your scaffolding wrapped around end-user text and retrieved data.
- **`assistant`** — the model's prior turns. You send these back on every call to continue a conversation; you can also *seed* one (prefilling the start of the model's answer) as a steering technique.
- **Tool roles/blocks** — provider-specific message types carrying tool calls and results (api-03's territory).

Why this shape? Because it is **the training distribution**: post-training (fnd-07) taught the model on conversations serialized exactly this way, with special tokens (fnd-04) marking the boundaries your JSON structure maps to. The API isn't a convenience wrapper over raw text — it's the interface to the format the model was trained to inhabit. Deviating from it (roles out of order, instructions crammed into the wrong role) moves the model off-distribution and degrades behavior for no benefit.

The statelessness corollary deserves its own emphasis: **a "conversation" is you resending the entire history every turn.** Turn 20 of a chat means 20 turns of tokens in the request — input cost grows with conversation length, and long chats eventually hit the context window. Managing that growth (truncation, summarization, structured memory) is a real design problem taken up in rag-01 and agt-04; this chapter's job is that you *know it exists* before your first production bill teaches it.

## Anatomy of a request and a response

The fields that matter, in the request:

```python
import anthropic  # or openai — shapes are analogous

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
response = client.messages.create(
    model="<pinned-model-version>",   # exact version, never an alias, in prod
    max_tokens=1024,                  # output budget — a hard cap, required here
    system="You are a concise technical assistant.",
    messages=[
        {"role": "user", "content": "Explain idempotency keys in two sentences."},
    ],
    temperature=0.3,                  # fnd-08; set deliberately per task class
)
print(response.content[0].text)
print(response.usage)                 # input_tokens, output_tokens — log this
print(response.stop_reason)          # and ALWAYS check this
```

- **`model`** — pin exact versions in production. Aliases ("latest"-style) silently swap post-training behavior under you (fnd-07's drift); version adoption should be a deliberate, eval-gated event.
- **`max_tokens`** — an output *budget*, not a target. Too low silently truncates; it also bounds your worst-case latency and cost per call (fnd-05's decode economics).
- **Sampling params** (`temperature`, `top_p`) — fnd-08 wholesale; defaults differ by provider, so set them explicitly.
- **`stop` sequences, `metadata`, streaming flags** — structural controls and plumbing; streaming gets its own treatment in api-05.

In the response, the two fields beginners ignore and professionals never do:

- **`usage`** — exact input/output token counts. Log them on every call from day one: they are your cost accounting, your rate-limit forecasting, and your first debugging signal ("why was this request 40k input tokens?").
- **`stop_reason` / `finish_reason`** — *why* generation ended: natural stop, `max_tokens` hit (your output is truncated!), tool call emitted, or content filtered. Unchecked truncation is among the most common silent bugs in LLM applications: the JSON parses right up until it doesn't, the summary just… ends. **Check it on every call.**[^anthropic-messages][^openai-api-ref]

## The failure surface

LLM APIs fail more, and more legitimately, than typical SaaS APIs — you are sharing a finite pool of GPUs (fnd-05's memory economics) with the internet. The canonical failures and contracts:[^anthropic-errors][^openai-ratelimits]

| Failure | Meaning | Correct client behavior |
|---|---|---|
| `429` rate limit | You exceeded requests- or tokens-per-minute quotas | Exponential backoff + jitter; respect `retry-after`; shape traffic proactively |
| `529`/overloaded, `503` | Provider capacity exhausted | Retry with backoff; degrade or fail over if sustained (prd-04) |
| `5xx` server error | Transient provider fault | Retry idempotently a bounded number of times |
| Timeout | Long generations exceed client limits | Timeouts sized to `max_tokens` worst case; prefer streaming for long outputs |
| `400` context overflow | Input + `max_tokens` exceeds the window | Not retryable — fix the request: trim context (rag-01), reduce budget |
| Content filter stop | Output blocked by safety systems | Handle as a product case, not an error (fnd-07 refusals; sec-02) |

Two disciplines to internalize now. **Rate limits are token-denominated as well as request-denominated** — TPM (tokens/minute) usually binds before RPM for context-heavy workloads, which means your rate-limit budget is a function of prompt size; big-context features consume quota nonlinearly. **Retries need idempotency thinking:** a timed-out request may have completed server-side; if the call had side effects downstream (it usually shouldn't — keep generation pure and act on results separately), retries must be deduplicated by request ID, never by comparing outputs (fnd-08: identical inputs don't guarantee identical text).

## Production engineering perspective

The client-side architecture that every serious deployment converges on — introduced here, hardened in prd-01/prd-04:

- **One gateway module, not N call sites.** Route every LLM call through a single internal layer owning: model selection and pinning, retries/backoff, timeout policy, usage logging, and (later) caching, fallbacks, and cost attribution. Scattered direct calls make every one of those a shotgun surgery.
- **Log the full interaction** — request (or a redacted/traceable form of it), response, usage, stop reason, latency, model version — from the very first prototype. These logs become your eval sets (evl-02), your debugging record, and your cost model; retrofitting them is misery. Mind data governance on what you log (sec-03).
- **API keys are production credentials:** server-side only (never in browser/mobile code — a shipped key is a donated budget), scoped per environment, rotated, spend-alerted. Provider dashboards support per-key limits; use them as blast-radius control.
- **SDK vs. raw HTTP:** use official SDKs for retries/typing/streaming ergonomics, but learn the wire format once (this chapter's mini-project) — abstractions leak precisely when you're debugging.
- **Cross-provider portability is a design choice with a cost.** The message shapes are similar, not identical (system prompt placement, tool schemas, parameter semantics differ[^openai-api-ref][^anthropic-messages][^gemini-api]). A thin internal interface keeps migration tractable (api-06), but chasing perfect provider-agnosticism forfeits provider-specific capability — fnd-01's isolation principle, applied here.

> **Volatile:** endpoint names, parameter spellings, rate-limit tiers, and which API generation each vendor recommends (chat-completions-style vs. newer response/agent-oriented endpoints) all churn on provider cycles. The messages paradigm, token metering, statelessness, and the failure-surface disciplines above are the stable contract. Verify specifics against provider references at build time.[^openai-api-ref][^anthropic-messages]

## Historical evolution

**2020–2022:** completion APIs — one raw text string in, continuation out; conversation structure was your string-formatting problem, against base-model behavior (fnd-06). **2023:** chat-completions-style APIs made roles first-class, mirroring the RLHF'd conversation format (fnd-07); function calling arrived and turned the API from text generator into typed component (api-03). **2023–2025:** capability accretion — vision inputs (api-04), streaming refinements, JSON/structured modes, prompt caching and batch tiers (api-05), and agent-oriented endpoints managing tool loops server-side. The direction of travel: the API surface keeps absorbing patterns the community builds (parsing, tool loops, retrieval hooks) — worth remembering when deciding whether to build scaffolding or wait a quarter (fnd-01's wrapper-absorption warning, at API scale).

## Common misconceptions

- **"The model remembers our conversation."** The API is stateless; memory is your message list. Every "it forgot!" bug is a context-management bug on the client (or a truncation you performed).
- **"The system prompt is private and binding."** It's neither: models can be coaxed into revealing or ignoring it (sec-01). Treat it as strong steering — never as secrecy or access control, and never put secrets in it.
- **"An API error means my code is wrong."** 429s and overloads are *weather* — normal operating conditions to be handled, not bugs to be fixed. Conversely, a `400` overflow *is* your bug.
- **"Default parameters are fine."** Defaults are provider choices optimized for demos (often temperature ≈ 1.0) — fnd-08's task-class discipline says set them explicitly, always.
- **"The API is the model."** Between you and the weights sit routing, quantization choices, safety systems, and serving infrastructure — all of which can change behavior without a model-version bump. Another reason evals run against *the API you ship on*, not the model card.
- **"Token counts are what I see in my editor."** Usage is counted post-template, post-tokenizer (fnd-04), including message overhead and (later) tool schemas — trust `usage`, not intuition.

## Failure modes and trade-offs

- **Silent truncation** — `max_tokens` hit, `finish_reason` unchecked, downstream code processes a fragment. *The* classic first-month production bug. Fix: assert on stop reason everywhere; size budgets from measured output distributions.
- **Conversation bloat** — naive append-forever chat history: cost per turn grows linearly, latency follows, then the window overflows at the worst moment. Fix: budgeted history with explicit truncation/summarization policy (rag-01, agt-04).
- **Unpinned model drift** — an alias update shifts behavior; nothing in your deploy history explains the regression. Fix: pin versions; adopt via eval gate (evl-06).
- **Key leakage** — client-side keys, keys in repos, keys in logs. Fix: server-side proxying, secret management, per-key spend caps.
- **Thundering-herd retries** — synchronized backoff amplifying a provider blip into your own outage. Fix: jitter, budget-capped retries, circuit breaking (prd-04).
- **Trade-off running through the chapter:** every robustness layer (retries, gateways, logging, validation) adds latency and code between you and the model. Right-size to stakes — a prototype needs `usage` logging and stop-reason checks; it does not need a circuit breaker on day one.

## Best practices

- **Check `stop_reason` and log `usage` on every call** — the two-line habit that prevents the two most common silent failures.
- **Pin model versions; adopt new ones deliberately** through regression evals (fnd-07's drift is the mechanism; evl-06 is the process).
- **Set sampling parameters explicitly per task class** (fnd-08's table); never inherit defaults.
- **Centralize calls in a gateway module** owning retries (exponential backoff + jitter, bounded), timeouts sized to `max_tokens`, and structured logging.
- **Treat rate limits as capacity planning:** know your TPM budget, measure tokens-per-request, and do the division before launch — not during the incident.
- **Keep generation side-effect-free;** act on validated outputs in a separate step, so retries are always safe.
- **Server-side keys, per-environment scoping, spend alerts** — from the first prototype, because prototypes ship.

## Real-world examples

**The demo that cost 40× in production.** A chat feature ships with append-forever history and a 100k-token window. Average sessions run 30 turns; by turn 30 each request carries ~25k tokens of history, so the *average* request costs an order of magnitude more than the demo's turn-2 requests — and P99 latency follows (prefill, fnd-05). Fix: a 4k-token history budget with rolling summarization; cost per session drops ~80% with no measured quality loss on the team's eval. The lesson is architectural: statelessness means *you* own the memory-cost curve.

**The invisible truncation outage.** An extraction service sets `max_tokens=500` from early testing on short documents. Months later, longer documents push outputs past 500 tokens; JSON truncates mid-array; the parser's error handling discards "malformed" records — silently dropping 7% of production data for weeks. Nobody checked `finish_reason`. The postmortem adds the assertion everywhere and alarms on truncation rate; the deeper fix is output-length monitoring per document cohort.

**The 429 storm.** A batch backfill launches 200 parallel workers against a TPM-limited key; every worker retries immediately on 429; the retry storm keeps the key pinned at its limit for hours, starving the *production* traffic sharing it. Fixes, in order: separate keys per workload (blast radius), client-side token-budget throttling to shape traffic under the limit, jittered backoff — and the realization that this workload belonged on the batch API at half price with no rate pressure (api-05).

## Interview questions

1. **"Walk me through what actually happens when a user sends their 10th chat message in your app."** — Model answer: the client appends the new user message to the stored conversation, assembles a request containing the system prompt plus all ten turns (the API is stateless — history must be resent), and calls the gateway module, which attaches the pinned model version, sampling params, and `max_tokens` budget. Server-side: prefill over the full context, then decode (fnd-05). The response's assistant message is appended to stored history; `usage` is logged; `stop_reason` is checked for truncation. Cost and latency both grew with the history — which is why a history budget with summarization exists past some turn count.

2. **"Why did every provider converge on the messages/roles format?"** — Model answer: because it mirrors the post-training distribution. Assistants are trained on conversations serialized with special tokens marking system, user, and assistant turns; the JSON message list is the developer-facing projection of that format. Using it keeps requests on-distribution, which is why role structure matters behaviorally — and why the system prompt has influence at all: it's a trained convention, not an enforced privilege.

3. **"How do you handle rate limits properly?"** — Model answer: three layers. Reactive: exponential backoff with jitter on 429s, respecting `retry-after`, with bounded retry budgets so storms can't self-sustain. Proactive: know the token-per-minute quota, measure tokens per request, and throttle client-side below the limit — TPM usually binds before request-count limits for context-heavy traffic. Architectural: separate keys/quotas per workload so a backfill can't starve production, and route latency-insensitive bulk work to batch endpoints where the rate economics are different entirely.

4. **"What's wrong with `max_tokens=4096` everywhere 'to be safe'?"** — Model answer: `max_tokens` bounds worst-case latency and cost — set to the ceiling, a runaway generation runs the full budget before stopping, and your P99 latency and spend inherit it; on some providers it also counts against context-window and rate-limit arithmetic. The right sizing comes from measured output distributions per task: budget to a high percentile, then *check `finish_reason`* so the rare legitimate overflow is detected rather than silently truncated. It's a budget with an alarm, not a formality.

5. **"Your LLM feature's behavior changed overnight with no deploy. Diagnose."** — Model answer: prime suspect — unpinned model version: an alias rolled to a new snapshot, and post-training refreshes change refusals, formats, and tone without capability announcements. Second: provider-side serving/safety-system changes beneath a pinned version. Third: an input-distribution shift masquerading as behavior change. Diagnosis path: check pinned-vs-alias, diff current outputs against logged historical outputs on identical inputs (this is why full interaction logging exists), and run the regression eval suite. Prevention: pin versions and adopt via eval gates.

6. **"Design the minimal LLM client layer for a new product."** — Model answer: one internal module wrapping the provider SDK, exposing a typed `complete()` to the codebase. Inside: pinned model config per task, explicit sampling params, `max_tokens` per task class, bounded jittered retries on 429/5xx/timeouts, timeouts derived from output budgets, structured logging of request-hash/response/usage/stop-reason/latency/model-version, and an assertion on truncation. Keys from the environment, server-side only. That's ~150 lines buying: cost visibility, migration tractability, eval-ready logs, and immunity to the classic silent failures — everything else (caching, fallbacks, routing) attaches to this seam later.

## Exercises and mini-project

**Exercises**

1. Write the full request body (raw JSON, no SDK) for a 3-turn conversation with a system prompt, per one provider's current reference.[^anthropic-messages] Label which parts are resent state vs. new content.
2. Your app averages 2k input + 300 output tokens per request. Your key has a 400k TPM limit. Compute max sustainable requests/minute, then recompute if a new feature adds 10k tokens of context per request. What does this tell you about rate limits and product decisions?
3. List the five `stop_reason`/`finish_reason` values in a current provider reference and, for each, the correct application behavior.
4. A timed-out request may have completed server-side. Design the idempotency scheme for a pipeline where each LLM result triggers an email — what's stored, keyed on what, checked when?
5. Find three concrete differences between two providers' message APIs (system placement, tool result format, a parameter semantic). For each: how would your gateway abstraction absorb it?

**Mini-project: the hundred-line client.** Build a CLI chat client in Python using *raw HTTP* (`httpx`/`requests`, no SDK): (a) implement the message-list conversation loop with a system prompt; (b) add bounded exponential backoff + jitter on 429/5xx, timeouts sized to `max_tokens`; (c) log every call's usage, latency, stop reason, and model to a JSONL file; (d) add a `/stats` command reporting session cost from logged usage against current published prices; (e) deliberately trigger and correctly handle: a truncation (tiny `max_tokens`), a context overflow, and — if you can — a rate limit. Target: 3 hours. Success criterion: you've seen the wire format, every failure class, and your own cost accounting, with no SDK between you and any of it. Keep this client: it becomes your experiment harness for api-02.

**Capstone extension:** this gateway grows into your capstone's model-access layer — prd-01 adds fallbacks and routing to it; evl-04 taps its logs for tracing.

## Revision summary

- An LLM API is a stateless, token-metered, fallible function: everything the model should know goes in every request; conversation is a client-side data structure; cost/latency grow with carried history.
- The messages paradigm (system/user/assistant + tool blocks) is the projection of the post-training format — use it as designed; system-prompt authority is trained convention, not enforcement.
- Request essentials: pinned model version, explicit sampling params, `max_tokens` as a budget-with-alarm. Response essentials: log `usage`, always check `stop_reason` — silent truncation is the classic first bug.
- The failure surface is normal weather: 429/overload/5xx/timeout → jittered bounded retries and proactive TPM-aware throttling; context overflow → fix the request; content filter → product case. Keep generation side-effect-free so retries are safe.
- Architecture: one gateway module (pinning, retries, timeouts, logging) from day one; server-side scoped keys with spend alerts; full interaction logs as the seed of evals, debugging, and cost models.

## Flashcards

| Q | A |
|---|---|
| Why must the full conversation be resent every turn? | The API is stateless — the provider stores nothing between calls; history is client-owned context. |
| The three message roles and one line each? | System: operator's standing instructions. User: (templated) human input. Assistant: model's prior turns, resent — or prefilled to steer. |
| Why does the messages format matter behaviorally? | It mirrors the post-training conversation format — on-distribution requests get trained behavior. |
| Two response fields to handle on every call? | `usage` (log it — cost, forecasting, debugging) and `stop_reason` (check it — truncation detection). |
| What does `max_tokens` really control? | The output budget: worst-case latency and cost per call; hitting it silently truncates unless you check the stop reason. |
| Why pin model versions? | Aliases silently swap post-training behavior; adoption should be a deliberate, eval-gated event. |
| Which rate limit usually binds for context-heavy apps? | Tokens-per-minute (TPM) — quota consumption scales with prompt size, not request count. |
| Correct 429 handling in three parts? | Jittered exponential backoff honoring retry-after; bounded retry budgets; proactive client-side throttling under the TPM quota. |
| Why keep generation side-effect-free? | Timed-out calls may have completed server-side; pure generation makes retries always safe, with actions deduplicated separately. |
| Is the system prompt secret or binding? | Neither — it's strong steering by trained convention; never secrets, never access control. |

## Further reading

- **Official docs:** OpenAI chat completions reference[^openai-api-ref] and rate-limits guide[^openai-ratelimits]; Anthropic Messages API[^anthropic-messages] and errors documentation[^anthropic-errors]; Gemini API reference[^gemini-api] — read at least two vendors to see the paradigm vs. the particulars.
- **Papers:** none — this chapter's territory is documented contract, not literature.
- **Books:** none needed.
- **Talks:** none essential.
- **Tutorials:** each provider's quickstart, done once with the SDK and once raw (the mini-project) — the second pass is where the learning is.

## Check your understanding

1. Trace a 15-turn conversation's cost curve and name the two client-side policies that bend it.
2. Enumerate the failure table from memory: six failure classes and the correct behavior for each.
3. Your teammate says "we'll fix logging after launch." Give the three-asset argument for day-one interaction logs.
4. Which parts of this chapter would you re-verify against provider docs before building (the volatile), and which would you bet survive five years (the stable)?
5. Explain to a security reviewer where API keys live in your architecture and what limits their blast radius.

## Sources

[^openai-api-ref]: [T1] OpenAI. "API Reference — Chat completions." https://platform.openai.com/docs/api-reference/chat (accessed 2026-07-09)
[^anthropic-messages]: [T1] Anthropic. "Messages API reference." https://docs.anthropic.com/en/api/messages (accessed 2026-07-09)
[^anthropic-errors]: [T1] Anthropic. "Errors." Anthropic API Docs. https://docs.anthropic.com/en/api/errors (accessed 2026-07-09)
[^openai-ratelimits]: [T1] OpenAI. "Rate limits." https://platform.openai.com/docs/guides/rate-limits (accessed 2026-07-09)
[^gemini-api]: [T1] Google. "Gemini API reference." https://ai.google.dev/api (accessed 2026-07-09)
