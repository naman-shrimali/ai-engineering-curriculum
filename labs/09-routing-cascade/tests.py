import json
import math

CALLS = []


def model(name, output, confidence, cost):
    def call(request):
        CALLS.append(name)
        return {'output': output, 'confidence': confidence, 'cost': cost}
    return call


def parses(output):
    try:
        json.loads(output)
        return True
    except ValueError:
        return False


GOOD, BROKEN = '{"total": 42}', '{"total": 42'
CAPABLE = model('capable', '{"total": 41.5}', 0.95, 0.010)


def test_confident_and_valid_stays_cheap():
    """A confident, valid cheap answer is returned without escalating"""
    CALLS.clear()
    got = run_cascade('q', model('cheap', GOOD, 0.9, 0.001), CAPABLE, parses, 0.8)
    assert got == {'output': GOOD, 'escalated': False, 'cost': 0.001}, f'returned {got!r}'
    assert CALLS == ['cheap'], f'models called: {CALLS}'


def test_low_confidence_escalates():
    """Low confidence escalates, and the cost includes the cheap attempt"""
    CALLS.clear()
    got = run_cascade('q', model('cheap', GOOD, 0.5, 0.001), CAPABLE, parses, 0.8)
    assert got['escalated'] is True and got['output'] == '{"total": 41.5}', f'returned {got!r}'
    assert approx(got['cost'], 0.011), f"cost is {got['cost']!r}, expected 0.001 + 0.010"
    assert CALLS == ['cheap', 'capable'], f'models called: {CALLS}'


def test_failed_validation_escalates_despite_confidence():
    """A confidently wrong cheap answer still escalates when validation fails"""
    got = run_cascade('q', model('cheap', BROKEN, 0.99, 0.001), CAPABLE, parses, 0.8)
    assert got['escalated'] is True, 'output that fails validation must escalate even at 0.99 confidence'


def test_cost_per_successful_task():
    """Total cost divided by successful tasks: failures add cost but not successes"""
    records = [{'cost': 0.02, 'success': True}, {'cost': 0.03, 'success': False}, {'cost': 0.01, 'success': True}]
    got = cost_per_successful_task(records)
    assert approx(got, 0.06 / 2), f'returned {got!r}, expected 0.03'


def test_no_successes():
    """With no successful task the cost per success is infinite"""
    got = cost_per_successful_task([{'cost': 0.5, 'success': False}])
    assert got == math.inf, f'returned {got!r}'


def test_cheaper_per_call_can_cost_more():
    """A model that is cheaper per call can be more expensive per successful task"""
    a = [{'cost': 1.0, 'success': i < 9} for i in range(10)]   # 1.0 per call, 90% succeed
    b = [{'cost': 0.6, 'success': i < 5} for i in range(10)]   # 0.6 per call, 50% succeed
    per_call_a, per_call_b = 1.0, 0.6
    ca, cb = cost_per_successful_task(a), cost_per_successful_task(b)
    assert per_call_b < per_call_a, 'setup: b is cheaper per call'
    assert approx(ca, 10 / 9) and approx(cb, 6 / 5), f'got {ca!r} and {cb!r}, expected 10/9 and 6/5'
    assert cb > ca, 'b should cost more per successful task than a'
