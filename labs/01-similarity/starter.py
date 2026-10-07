import math


def dot(a, b):
    """Sum of a[i] * b[i]. ValueError if the lengths differ."""
    raise NotImplementedError


def norm(a):
    """Euclidean length of a."""
    raise NotImplementedError


def cosine_similarity(a, b):
    """dot(a, b) / (norm(a) * norm(b)). ValueError if either has length zero."""
    raise NotImplementedError


def normalize(a):
    """a scaled to unit length. ValueError for the zero vector."""
    raise NotImplementedError


def euclidean_distance(a, b):
    """norm(a - b)."""
    raise NotImplementedError


def rank(query, docs, metric):
    """Indices of docs, best first, by metric 'dot', 'cosine' or 'euclidean'."""
    raise NotImplementedError
