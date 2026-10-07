import math


def run_cascade(request, cheap, capable, validate, min_confidence):
    first = cheap(request)
    if first['confidence'] >= min_confidence and validate(first['output']):
        return {'output': first['output'], 'escalated': False, 'cost': first['cost']}
    second = capable(request)
    return {'output': second['output'], 'escalated': True, 'cost': first['cost'] + second['cost']}


def cost_per_successful_task(records):
    successes = sum(1 for r in records if r['success'])
    if successes == 0:
        return math.inf
    return sum(r['cost'] for r in records) / successes
