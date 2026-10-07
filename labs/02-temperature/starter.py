import math


def softmax(logits):
    """Probabilities exp(x_i) / sum_j exp(x_j), computed stably."""
    raise NotImplementedError


def apply_temperature(logits, T):
    """softmax(logit / T for each logit). ValueError if T <= 0."""
    raise NotImplementedError
