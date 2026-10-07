UNAVAILABLE = 'The assistant is temporarily unavailable. Please try again in a few minutes.'


class CircuitBreaker:
    def __init__(self, threshold, cooldown):
        self.threshold, self.cooldown = threshold, cooldown
        self.state = 'closed'

    def allow(self, now):
        """closed: True. open: False until cooldown has passed, then half_open and True once."""
        raise NotImplementedError

    def record_success(self):
        raise NotImplementedError

    def record_failure(self, now):
        raise NotImplementedError


def call_with_fallbacks(request, chain, breakers, now):
    """Walk (name, fn) pairs in order; return (name, result) or ('unavailable', UNAVAILABLE)."""
    raise NotImplementedError
