class Provider:
    """A fake dependency that counts calls and can be switched up or down."""
    def __init__(self, name, up=True):
        self.name, self.up, self.calls = name, up, 0

    def __call__(self, request):
        self.calls += 1
        if not self.up:
            raise ConnectionError(f'{self.name} is down')
        return f'{self.name}: {request}'


def _setup():
    p, s = Provider('primary'), Provider('secondary')
    chain = [('primary', p), ('secondary', s)]
    breakers = {'primary': CircuitBreaker(3, 30), 'secondary': CircuitBreaker(3, 30)}
    return p, s, chain, breakers


def test_closed_allows_and_success_resets():
    """A closed breaker allows requests, and a success resets the failure count"""
    b = CircuitBreaker(3, 30)
    assert b.allow(0) is True and b.state == 'closed'
    b.record_failure(1); b.record_failure(2); b.record_success(); b.record_failure(3); b.record_failure(4)
    assert b.state == 'closed', f'two failures after a success should not open a threshold-3 breaker (state is {b.state!r})'


def test_opens_at_threshold():
    """Three consecutive failures open it, and an open breaker refuses requests"""
    b = CircuitBreaker(3, 30)
    for t in (1, 2, 3):
        b.record_failure(t)
    assert b.state == 'open', f'state is {b.state!r}, expected open'
    assert b.allow(10) is False, 'an open breaker must refuse requests before the cooldown ends'


def test_half_open_after_cooldown():
    """After the cooldown one health-check request is let through, and only one"""
    b = CircuitBreaker(3, 30)
    for t in (1, 2, 3):
        b.record_failure(t)
    assert b.allow(32) is False, 'cooldown is measured from the moment it opened (t=3), so t=32 is too early'
    assert b.allow(33) is True and b.state == 'half_open', f'at t=33 it should let a health check through (state is {b.state!r})'
    assert b.allow(34) is False, 'only one request goes through while the health check is outstanding'


def test_health_check_outcomes():
    """A passing health check closes the breaker; a failing one re-opens it from that moment"""
    b = CircuitBreaker(2, 10)
    b.record_failure(0); b.record_failure(1); b.allow(11); b.record_success()
    assert b.state == 'closed' and b.allow(12), 'a passing health check should close the breaker'
    b.record_failure(20); b.record_failure(21); b.allow(31); b.record_failure(31)
    assert b.state == 'open', f'a failed health check should re-open the breaker (state is {b.state!r})'
    assert b.allow(40) is False and b.allow(41) is True, 'the new cooldown should run from t=31'


def test_falls_back_to_secondary():
    """When the primary fails, the chain serves the request from the secondary"""
    p, s, chain, breakers = _setup()
    p.up = False
    got = call_with_fallbacks('hi', chain, breakers, now=0)
    assert got == ('secondary', 'secondary: hi'), f'returned {got!r}'


def test_fails_fast_once_open():
    """Once the primary's breaker opens, the primary is not called at all"""
    p, s, chain, breakers = _setup()
    p.up = False
    for t in range(3):
        call_with_fallbacks('hi', chain, breakers, now=t)
    assert breakers['primary'].state == 'open', 'three failures should open the primary breaker'
    before = p.calls
    for t in range(3, 10):
        assert call_with_fallbacks('hi', chain, breakers, now=t)[0] == 'secondary'
    assert p.calls == before, f'the primary was called {p.calls - before} more times while its breaker was open'


def test_recovers_after_cooldown():
    """After the cooldown, a healthy primary passes its health check and takes traffic again"""
    p, s, chain, breakers = _setup()
    p.up = False
    for t in range(3):
        call_with_fallbacks('hi', chain, breakers, now=t)
    p.up = True
    assert call_with_fallbacks('hi', chain, breakers, now=10)[0] == 'secondary', 'still cooling down at t=10'
    assert call_with_fallbacks('hi', chain, breakers, now=40)[0] == 'primary', 'the health check at t=40 should succeed'
    assert breakers['primary'].state == 'closed'


def test_honest_unavailability():
    """With every provider down the chain ends in the honest message, without raising"""
    p, s, chain, breakers = _setup()
    p.up = s.up = False
    got = call_with_fallbacks('hi', chain, breakers, now=0)
    assert got == ('unavailable', UNAVAILABLE), f'returned {got!r}'
