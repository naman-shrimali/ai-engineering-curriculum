import math


def hit_at_k(retrieved, relevant, k):
    raise NotImplementedError


def recall_at_k(retrieved, relevant, k):
    raise NotImplementedError


def precision_at_k(retrieved, relevant, k):
    raise NotImplementedError


def reciprocal_rank(retrieved, relevant):
    raise NotImplementedError


def mean_reciprocal_rank(runs):
    raise NotImplementedError


def hit_rate(runs, k):
    raise NotImplementedError


def ndcg_at_k(retrieved, grades, k):
    raise NotImplementedError
