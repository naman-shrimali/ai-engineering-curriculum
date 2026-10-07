def response_text(response):
    """All text blocks of a response, joined (provided — do not change)."""
    return ''.join(b['text'] for b in response['content'] if b['type'] == 'text')


def summarize_incomplete(messages):
    """What to return when the step budget is exhausted (provided — do not change)."""
    return f'Incomplete: stopped after {sum(m["role"] == "assistant" for m in messages)} steps without a final answer.'


def run_agent(task, tools, model, max_steps=10):
    messages = [{'role': 'user', 'content': task}]
    for step in range(max_steps):
        response = model(messages)
        messages.append({'role': 'assistant', 'content': response['content']})
        calls = [b for b in response['content'] if b['type'] == 'tool_use']
        if not calls:
            return response_text(response)
        results = []
        for call in calls:
            tool = tools[call['name']]
            try:
                output = tool(**call['input'])
            except Exception as e:
                output = f'error: {e}'
            results.append({'type': 'tool_result', 'tool_use_id': call['id'], 'content': str(output)})
        messages.append({'role': 'user', 'content': results})
    return summarize_incomplete(messages)


def task_success_probability(p, n):
    return p ** n
