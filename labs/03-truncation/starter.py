def top_k(probs, k):
    """Keep the k most probable tokens (ties: lower index), zero the rest, renormalize."""
    raise NotImplementedError


def top_p(probs, p):
    """Keep the smallest highest-first set with cumulative probability >= p, renormalize."""
    raise NotImplementedError


def min_p(probs, min_p):
    """Keep tokens with probability >= min_p * max(probs), renormalize."""
    raise NotImplementedError


def greedy(probs):
    """Index of the most probable token (lowest index on ties)."""
    raise NotImplementedError


def sample(probs, u):
    """Inverse-CDF draw: first index whose running total exceeds u (0 <= u < 1)."""
    raise NotImplementedError
