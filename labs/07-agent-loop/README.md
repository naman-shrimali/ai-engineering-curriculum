---
id: agent-loop
title: Build the minimal agent loop
chapter: agt-01
anchor: building-the-minimal-loop
functions: [run_agent, task_success_probability]
difficulty: 3
minutes: 35
basis:
  - "The loop's exit condition is the model declining to call a tool."
  - "errors go back in-band"
  - "Sending the error text back into the conversation rather than raising it"
  - "If each step succeeds independently with probability"
---
## Goal

Write the chapter's forty-line agent yourself — the loop around the tool round trip — against a scripted stand-in for the model API, so the tests can check every detail the chapter says carries the meaning.

## The model stand-in

`model(messages)` takes the conversation so far and returns a response:

```python
{"content": [
    {"type": "text", "text": "Let me look that up."},
    {"type": "tool_use", "id": "call_1", "name": "search", "input": {"query": "refund policy"}},
]}
```

A response with **no** `tool_use` block is the final answer. `tools` maps a tool name to a Python function. Two helpers are already in the starter: `response_text(response)` joins a response's text blocks, and `summarize_incomplete(messages)` is what to return when the budget runs out. Don't change them.

## What to implement

`run_agent(task, tools, model, max_steps=10)`, following the chapter's loop:

1. Start the trajectory as `[{"role": "user", "content": task}]`.
2. Up to `max_steps` times: call `model(messages)` and append `{"role": "assistant", "content": response["content"]}`.
3. If the response has no tool calls, return `response_text(response)`.
4. Otherwise run **every** tool call in order. If a tool raises, its result is `f"error: {e}"` — errors go back in-band, the loop keeps going. Append one message, `{"role": "user", "content": results}`, where each result is `{"type": "tool_result", "tool_use_id": call["id"], "content": str(output)}`.
5. If the steps run out, return `summarize_incomplete(messages)`.

Also implement `task_success_probability(p, n)`: the chance that `n` sequential steps, each succeeding independently with probability `p`, all succeed. The tests check it against the chapter's table.

<details><summary>Hint: append, never rewrite</summary>

The tests check that every model call sees the previous call's messages as an unchanged prefix. Only ever `append` to `messages`.
</details>
