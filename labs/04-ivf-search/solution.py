def squared_distance(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b))


def _nearest(query, points, ids=None):
    ids = range(len(points)) if ids is None else ids
    return sorted(ids, key=lambda i: (squared_distance(query, points[i]), i))


def assign(vectors, centroids):
    return [_nearest(v, centroids)[0] for v in vectors]


def cells_to_probe(query, centroids, nprobe):
    return _nearest(query, centroids)[:nprobe]


def exact_search(query, vectors, k):
    return _nearest(query, vectors)[:k]


def ivf_search(query, vectors, centroids, assignments, nprobe, k):
    probed = set(cells_to_probe(query, centroids, nprobe))
    candidates = [i for i, cell in enumerate(assignments) if cell in probed]
    return _nearest(query, vectors, candidates)[:k]


def recall_at_k(approx_ids, exact_ids, k):
    return len(set(approx_ids[:k]) & set(exact_ids[:k])) / k
