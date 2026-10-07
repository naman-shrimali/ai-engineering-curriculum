import math


def hit_at_k(retrieved, relevant, k):
    return 1.0 if any(d in relevant for d in retrieved[:k]) else 0.0


def recall_at_k(retrieved, relevant, k):
    if not relevant:
        raise ValueError('recall is undefined with no relevant passages')
    return len(set(retrieved[:k]) & set(relevant)) / len(relevant)


def precision_at_k(retrieved, relevant, k):
    return sum(1 for d in retrieved[:k] if d in relevant) / k


def reciprocal_rank(retrieved, relevant):
    for rank, d in enumerate(retrieved, start=1):
        if d in relevant:
            return 1.0 / rank
    return 0.0


def mean_reciprocal_rank(runs):
    return sum(reciprocal_rank(r, rel) for r, rel in runs) / len(runs)


def hit_rate(runs, k):
    return sum(hit_at_k(r, rel, k) for r, rel in runs) / len(runs)


def _dcg(gains):
    return sum(g / math.log2(i + 1) for i, g in enumerate(gains, start=1))


def ndcg_at_k(retrieved, grades, k):
    dcg = _dcg([grades.get(d, 0) for d in retrieved[:k]])
    ideal = _dcg(sorted((g for g in grades.values() if g > 0), reverse=True)[:k])
    return dcg / ideal if ideal else 0.0
