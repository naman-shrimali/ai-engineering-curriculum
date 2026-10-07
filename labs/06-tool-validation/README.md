---
id: tool-validation
title: Validate, authorize, then execute a tool call
chapter: api-03
anchor: the-tool-calling-loop
functions: [validate_args, execute_tool_call]
difficulty: 2
minutes: 30
basis:
  - "Arguments are model output"
  - "validation-then-authorization before every execution"
  - "never from the model's request"
  - "The guarantee is syntactic, not semantic."
---
## Goal

Write the gate that sits between a model's tool call and your code: check the arguments against the tool's schema, check the **session's** permissions, and only then run the function — returning every failure as text the model can read and act on.

## The data

A tool looks like this:

```python
{
    "permission": "orders:read",
    "schema": {
        "type": "object",
        "properties": {
            "customer_email": {"type": "string"},
            "status": {"type": "string", "enum": ["open", "shipped", "refunded"]},
            "limit": {"type": "integer"},
            "tags": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["customer_email"],
        "additionalProperties": False,
    },
    "fn": search_orders,   # the real function
}
```

A call is `{"name": "search_orders", "input": {...}}` — exactly what the model produced. A session is `{"user": ..., "permissions": {...}}` — what *your* system knows about the caller.

## What to implement

- `validate_args(schema, args)` — return a **list of error strings**, empty when the arguments are valid. Support this subset of JSON Schema: `type` for `string`, `integer`, `number`, `boolean`, `array`, `object`; `enum`; `required`; `additionalProperties: False`; and `items` with a `type` for arrays. JSON Schema semantics apply: booleans are **not** integers or numbers, and an `integer` is a valid `number`. Each error should name the offending field so the model can fix it.
- `execute_tool_call(call, tools, session)` — return a **string**, never raise:
  1. an unknown tool name → a string starting `"error: unknown tool"`;
  2. invalid arguments → `"error: invalid arguments: "` followed by the errors;
  3. the tool's `permission` not in `session["permissions"]` → a string starting `"error: not authorized"`;
  4. otherwise call `fn(**input)` and return `str(result)`; if it raises, return `"error: "` plus the exception message.

  Validation comes before authorization, and the function runs only if both pass.

<details><summary>Hint: Python's bool is an int</summary>

`isinstance(True, int)` is `True` in Python, but `true` is not an integer in JSON Schema. Check for `bool` first.
</details>
