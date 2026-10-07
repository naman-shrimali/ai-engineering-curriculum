---
id: circuit-breaker
title: Circuit breaker and fallback chain
chapter: prd-04
anchor: fallback-chains
functions: [CircuitBreaker, call_with_fallbacks]
difficulty: 3
minutes: 35
basis:
  - "after a threshold of failures, stop sending requests to the failing dependency for a cooldown period and fail fast to a fallback"
  - "Failing fast is the point"
  - "cooldown elapses · health check passes"
  - "ending in an honest unavailability message"
---
## Goal

Build the machinery behind the chapter's fallback-chain state diagram: a circuit breaker per provider, and a chain that walks providers in order of degrading capability — failing fast past broken ones — and ends in an honest message rather than an exception.

Time is passed in explicitly as `now` (seconds), so behaviour is deterministic and testable.

## What to implement

`CircuitBreaker(threshold, cooldown)` with a `state` attribute that is `"closed"`, `"open"` or `"half_open"`:

- `allow(now)` — may a request go through? **closed**: yes. **open**: no, until `cooldown` seconds have passed since it opened; at that point it moves to **half_open** and lets one request through as the health check. **half_open**: no further requests until that check reports back.
- `record_success()` — the request worked: go to **closed** and reset the failure count.
- `record_failure(now)` — the request failed. When **closed**, count it; at `threshold` **consecutive** failures, open (remember `now`). When **half_open**, the health check failed: open again from `now`. (The chapter says "a threshold of failures"; this lab counts consecutive ones.)

`call_with_fallbacks(request, chain, breakers, now)`:

- `chain` is a list of `(name, fn)` pairs, most capable first; `breakers` maps each name to its `CircuitBreaker`.
- Try each provider in order. Skip it without calling it if its breaker does not allow the request. If `fn(request)` returns, record success and return `(name, result)`. If it raises, record the failure and move on.
- If nothing succeeds, return `("unavailable", UNAVAILABLE)` — the honest message defined in the starter. Never raise.

<details><summary>Hint: what does fail fast mean in a test?</summary>

The tests count calls. While a breaker is open, its provider's function must not be called at all.
</details>
