import math


def dot(a, b):
    if len(a) != len(b):
        raise ValueError('vectors must have the same dimension')
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(dot(a, a))


def cosine_similarity(a, b):
    na, nb = norm(a), norm(b)
    if na == 0 or nb == 0:
        raise ValueError('cosine is undefined for a zero vector')
    return dot(a, b) / (na * nb)


def normalize(a):
    n = norm(a)
    if n == 0:
        raise ValueError('cannot normalize the zero vector')
    return [x / n for x in a]


def euclidean_distance(a, b):
    if len(a) != len(b):
        raise ValueError('vectors must have the same dimension')
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def rank(query, docs, metric):
    if metric == 'dot':
        key = lambda i: -dot(query, docs[i])
    elif metric == 'cosine':
        key = lambda i: -cosine_similarity(query, docs[i])
    elif metric == 'euclidean':
        key = lambda i: euclidean_distance(query, docs[i])
    else:
        raise ValueError('unknown metric: %r' % metric)
    return sorted(range(len(docs)), key=key)
