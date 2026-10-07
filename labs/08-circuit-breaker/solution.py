UNAVAILABLE = 'The assistant is temporarily unavailable. Please try again in a few minutes.'


class CircuitBreaker:
    def __init__(self, threshold, cooldown):
        self.threshold, self.cooldown = threshold, cooldown
        self.state = 'closed'
        self.failures = 0
        self.opened_at = None

    def allow(self, now):
        if self.state == 'closed':
            return True
        if self.state == 'open' and now - self.opened_at >= self.cooldown:
            self.state = 'half_open'
            return True
        return False

    def record_success(self):
        self.state, self.failures, self.opened_at = 'closed', 0, None

    def record_failure(self, now):
        if self.state == 'half_open':
            self.state, self.opened_at = 'open', now
            return
        self.failures += 1
        if self.failures >= self.threshold:
            self.state, self.opened_at = 'open', now


def call_with_fallbacks(request, chain, breakers, now):
    for name, fn in chain:
        breaker = breakers[name]
        if not breaker.allow(now):
            continue
        try:
            result = fn(request)
        except Exception:
            breaker.record_failure(now)
            continue
        breaker.record_success()
        return name, result
    return 'unavailable', UNAVAILABLE
