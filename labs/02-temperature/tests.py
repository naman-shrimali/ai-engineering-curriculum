import math

EX1 = [2.0, 1.0, 0.5, -1.0]


def _reference(logits, T=1.0):
    exps = [math.exp(x / T) for x in logits]
    return [e / sum(exps) for e in exps]


def _order(p):
    return sorted(range(len(p)), key=lambda i: -p[i])


def test_softmax_basics():
    """softmax([0, 0]) is [0.5, 0.5] and softmax([0, ln 3]) is [0.25, 0.75]"""
    a, b = softmax([0.0, 0.0]), softmax([0.0, math.log(3)])
    assert approx(a, [0.5, 0.5]), f'softmax([0, 0]) returned {a!r}'
    assert approx(b, [0.25, 0.75]), f'softmax([0, ln 3]) returned {b!r}'


def test_softmax_sums_to_one():
    """The distribution sums to 1"""
    p = softmax([3.2, -1.0, 0.7, 2.2, -4.0])
    assert approx(sum(p), 1.0), f'probabilities sum to {sum(p)!r}'


def test_softmax_is_stable():
    """Huge logits do not overflow: softmax([1000, 1000]) is [0.5, 0.5]"""
    p = softmax([1000.0, 1000.0])
    assert approx(p, [0.5, 0.5]), f'softmax([1000, 1000]) returned {p!r}'
    q = softmax([1000.0, 0.0])
    assert approx(q, [1.0, 0.0]), f'softmax([1000, 0]) returned {q!r}'


def test_exercise_1_t1():
    """Exercise 1 at T = 1"""
    got = apply_temperature(EX1, 1.0)
    assert approx(got, _reference(EX1, 1.0)), f'apply_temperature(EX1, 1.0) returned {got!r}'


def test_exercise_1_sharpen_flatten():
    """Exercise 1: T = 0.5 sharpens toward the top token, T = 2 flattens toward the tail"""
    cold, base, hot = (apply_temperature(EX1, t) for t in (0.5, 1.0, 2.0))
    assert approx(cold, _reference(EX1, 0.5)), f'T=0.5 returned {cold!r}'
    assert approx(hot, _reference(EX1, 2.0)), f'T=2 returned {hot!r}'
    assert cold[0] > base[0] > hot[0], 'the top token should get more probability as T falls'
    assert cold[3] < base[3] < hot[3], 'the tail token should get more probability as T rises'


def test_ordering_never_changes():
    """Temperature never reorders tokens — only the gaps change"""
    logits = [1.3, -0.2, 2.9, 0.4, 2.8, -3.0]
    want = _order(softmax(logits))
    for T in (0.1, 0.5, 1.0, 1.7, 5.0):
        got = _order(apply_temperature(logits, T))
        assert got == want, f'at T={T} the token order became {got}, expected {want}'


def test_greedy_is_the_limit():
    """As T approaches 0 the distribution collapses onto the argmax"""
    p = apply_temperature(EX1, 0.01)
    assert p[0] > 0.999, f'at T=0.01 the top token has {p[0]!r}, expected > 0.999'


def test_rejects_non_positive_t():
    """T <= 0 raises ValueError"""
    for T in (0, -1.0):
        try:
            apply_temperature(EX1, T)
        except ValueError:
            continue
        assert False, f'apply_temperature(..., {T}) should raise ValueError'
