---
id: routing-cascade
title: Routing cascade and cost per successful task
chapter: prd-05
anchor: token-economics-the-building-blocks
functions: [run_cascade, cost_per_successful_task]
difficulty: 2
minutes: 20
basis:
  - "try a cheap, fast model first, and escalate to a more capable one only when a confidence signal or a validation check indicates the cheap attempt isn't sufficient"
  - "pair every cascade with a cheap, concrete validation check, not just model self-reported confidence"
  - "The unit that matters is cost per successfully completed task, not cost per API call."
---
## Goal

Implement the chapter's routing cascade, then compute the number the chapter says actually matters — cost per *successful* task — and see a cheaper-per-call option lose on it.

## What to implement

`run_cascade(request, cheap, capable, validate, min_confidence)`:

- `cheap(request)` and `capable(request)` each return `{"output": ..., "confidence": float, "cost": float}`.
- Call `cheap` first. If its confidence is at least `min_confidence` **and** `validate(output)` is true, return `{"output": output, "escalated": False, "cost": cheap_cost}`.
- Otherwise escalate: call `capable` and return `{"output": its output, "escalated": True, "cost": cheap_cost + capable_cost}` — the cheap attempt was still paid for.

`cost_per_successful_task(records)`:

- `records` is a list of `{"cost": float, "success": bool}`, one per task (cost includes retries and escalations).
- Return total cost divided by the number of successful tasks; `math.inf` if none succeeded.

<details><summary>Hint: the denominator</summary>

Failed tasks still cost money. They count in the numerator, not the denominator.
</details>
