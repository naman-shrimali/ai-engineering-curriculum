import copy


class Script:
    """A stand-in model that replays scripted responses and records what it was shown."""
    def __init__(self, *responses, repeat_last=False):
        self.responses, self.repeat_last, self.seen = list(responses), repeat_last, []

    def __call__(self, messages):
        self.seen.append(copy.deepcopy(messages))
        i = len(self.seen) - 1
        if i >= len(self.responses):
            assert self.repeat_last, 'the model was called again after giving its final answer'
            i = len(self.responses) - 1
        return copy.deepcopy(self.responses[i])


def text(t):
    return {'content': [{'type': 'text', 'text': t}]}


def use(*calls, say=''):
    blocks = [{'type': 'text', 'text': say}] if say else []
    return {'content': blocks + [{'type': 'tool_use', 'id': i, 'name': n, 'input': a} for i, n, a in calls]}


def test_answer_without_tools():
    """No tool call means done: the loop returns the text after one model call"""
    m = Script(text('Paris.'))
    got = run_agent('Capital of France?', {}, m)
    assert got == 'Paris.', f'returned {got!r}'
    assert len(m.seen) == 1, f'the model was called {len(m.seen)} times, expected 1'
    assert m.seen[0] == [{'role': 'user', 'content': 'Capital of France?'}], f'the first call saw {m.seen[0]!r}'


def test_one_tool_round_trip():
    """A tool call runs, its result goes back as a tool_result, and the next answer is returned"""
    calls = []
    tools = {'weather': lambda city: calls.append(city) or f'18C in {city}'}
    m = Script(use(('c1', 'weather', {'city': 'Oslo'}), say='Checking.'), text('It is 18C in Oslo.'))
    got = run_agent('Weather in Oslo?', tools, m)
    assert got == 'It is 18C in Oslo.', f'returned {got!r}'
    assert calls == ['Oslo'], f'the tool was called with {calls}'
    last = m.seen[1][-1]
    assert last == {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': 'c1', 'content': '18C in Oslo'}]}, f'the second call ended with {last!r}'
    assert m.seen[1][1]['role'] == 'assistant', 'the assistant turn must be appended before the tool results'


def test_errors_go_back_in_band():
    """A tool that raises becomes an 'error: …' result and the loop continues"""
    def lookup(order_id):
        raise KeyError('order not found; try searching by email')
    m = Script(use(('c1', 'lookup', {'order_id': 'X9'})), text('I could not find that order.'))
    got = run_agent('Where is order X9?', {'lookup': lookup}, m)
    assert got == 'I could not find that order.', f'returned {got!r} — did the exception escape the loop?'
    result = m.seen[1][-1]['content'][0]
    assert result['content'].startswith('error: '), f'the tool result was {result!r}, expected it to start with "error: "'
    assert 'order not found' in result['content'], 'the error text should reach the model'


def test_parallel_calls_in_order():
    """Several tool calls in one response run in order and return in a single message"""
    tools = {'add': lambda a, b: a + b, 'mul': lambda a, b: a * b}
    m = Script(use(('x', 'add', {'a': 2, 'b': 3}), ('y', 'mul', {'a': 4, 'b': 5})), text('5 and 20'))
    run_agent('compute', tools, m)
    results = m.seen[1][-1]['content']
    assert [(r['tool_use_id'], r['content']) for r in results] == [('x', '5'), ('y', '20')], f'the results were {results!r}'
    assert len(m.seen[1]) == 3, 'expected exactly three messages: task, assistant, tool results'


def test_budget_exhausted():
    """A model that never stops is cut off at max_steps and the loop summarizes"""
    m = Script(use(('c', 'search', {'q': 'again'})), repeat_last=True)
    got = run_agent('find it', {'search': lambda q: 'nothing'}, m, max_steps=4)
    assert len(m.seen) == 4, f'the model was called {len(m.seen)} times, expected max_steps = 4'
    assert got == 'Incomplete: stopped after 4 steps without a final answer.', f'returned {got!r}'


def test_trajectory_is_append_only():
    """Every model call sees the previous call's messages as an unchanged prefix"""
    tools = {'t': lambda: 'ok'}
    m = Script(use(('a', 't', {})), use(('b', 't', {})), use(('c', 't', {})), text('done'))
    run_agent('go', tools, m)
    for before, after in zip(m.seen, m.seen[1:]):
        assert after[:len(before)] == before, 'a later call saw an earlier message changed or removed'
        assert len(after) == len(before) + 2, 'each step should append exactly an assistant turn and a tool-result turn'


def test_compounding_table():
    """p to the n reproduces the chapter's table (rounded to whole percents)"""
    table = {(0.95, 5): 77, (0.95, 10): 60, (0.95, 20): 36, (0.99, 5): 95, (0.99, 10): 90, (0.99, 20): 82}
    for (p, n), pct in table.items():
        got = task_success_probability(p, n)
        assert round(got * 100) == pct, f'task_success_probability({p}, {n}) is {got!r}, the chapter says {pct}%'
