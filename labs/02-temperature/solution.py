import math


def softmax(logits):
    m = max(logits)
    exps = [math.exp(x - m) for x in logits]
    total = sum(exps)
    return [e / total for e in exps]


def apply_temperature(logits, T):
    if T <= 0:
        raise ValueError('temperature must be positive')
    return softmax([x / T for x in logits])
