def _keep(probs, keep):
    total = sum(probs[i] for i in keep)
    return [probs[i] / total if i in keep else 0.0 for i in range(len(probs))]


def _by_probability(probs):
    return sorted(range(len(probs)), key=lambda i: (-probs[i], i))


def top_k(probs, k):
    return _keep(probs, set(_by_probability(probs)[:k]))


def top_p(probs, p):
    keep, cum = set(), 0.0
    for i in _by_probability(probs):
        keep.add(i)
        cum += probs[i]
        if cum >= p - 1e-9:
            break
    return _keep(probs, keep)


def min_p(probs, min_p):
    threshold = min_p * max(probs)
    return _keep(probs, {i for i, x in enumerate(probs) if x >= threshold})


def greedy(probs):
    return _by_probability(probs)[0]


def sample(probs, u):
    running = 0.0
    for i, x in enumerate(probs):
        running += x
        if running > u and x > 0:
            return i
    return max(i for i, x in enumerate(probs) if x > 0)
