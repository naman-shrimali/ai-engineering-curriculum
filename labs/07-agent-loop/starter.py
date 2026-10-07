def response_text(response):
    """All text blocks of a response, joined (provided — do not change)."""
    return ''.join(b['text'] for b in response['content'] if b['type'] == 'text')


def summarize_incomplete(messages):
    """What to return when the step budget is exhausted (provided — do not change)."""
    return f'Incomplete: stopped after {sum(m["role"] == "assistant" for m in messages)} steps without a final answer.'


def run_agent(task, tools, model, max_steps=10):
    """The minimal agent loop. Returns the final answer text, or summarize_incomplete(messages)."""
    raise NotImplementedError


def task_success_probability(p, n):
    """Chance that n independent steps, each succeeding with probability p, all succeed."""
    raise NotImplementedError
