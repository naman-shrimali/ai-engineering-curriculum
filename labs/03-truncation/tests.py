EX2 = [0.55, 0.20, 0.10, 0.06, 0.05, 0.04]


def _kept(q):
    return [i for i, x in enumerate(q) if x > 0]


def _renorm(p, keep):
    s = sum(p[i] for i in keep)
    return [p[i] / s if i in keep else 0.0 for i in range(len(p))]


def test_exercise_2_top_k():
    """Exercise 2, top-k with k = 3 keeps the first three tokens, renormalized"""
    got = top_k(EX2, 3)
    assert _kept(got) == [0, 1, 2], f'top_k kept tokens {_kept(got)}, expected [0, 1, 2]'
    assert approx(got, _renorm(EX2, {0, 1, 2})), f'top_k(EX2, 3) returned {got!r}'


def test_exercise_2_top_p():
    """Exercise 2, top-p with p = 0.8 keeps three tokens (0.55 + 0.20 + 0.10 ≥ 0.8)"""
    got = top_p(EX2, 0.8)
    assert _kept(got) == [0, 1, 2], f'top_p kept tokens {_kept(got)}, expected [0, 1, 2]'
    assert approx(got, _renorm(EX2, {0, 1, 2})), f'top_p(EX2, 0.8) returned {got!r}'


def test_exercise_2_min_p():
    """Exercise 2, min-p with min_p = 0.1 keeps four tokens (threshold 0.055)"""
    got = min_p(EX2, 0.1)
    assert _kept(got) == [0, 1, 2, 3], f'min_p kept tokens {_kept(got)}, expected [0, 1, 2, 3]'
    assert approx(got, _renorm(EX2, {0, 1, 2, 3})), f'min_p(EX2, 0.1) returned {got!r}'


def test_same_length_and_sums_to_one():
    """Every rule returns a same-length list that sums to 1"""
    for name, q in (('top_k', top_k(EX2, 2)), ('top_p', top_p(EX2, 0.6)), ('min_p', min_p(EX2, 0.3))):
        assert len(q) == len(EX2), f'{name} returned {len(q)} entries, expected {len(EX2)}'
        assert approx(sum(q), 1.0), f'{name} output sums to {sum(q)!r}'


def test_top_p_adapts_top_k_does_not():
    """Top-p keeps few tokens when the model is confident and many when it is uncertain; top-k keeps k either way"""
    confident, uncertain = [0.95, 0.03, 0.02], [0.25, 0.25, 0.25, 0.25]
    assert len(_kept(top_p(confident, 0.9))) == 1, 'top_p(confident, 0.9) should keep 1 token'
    assert len(_kept(top_p(uncertain, 0.9))) == 4, 'top_p(uncertain, 0.9) should keep 4 tokens'
    assert len(_kept(top_k(confident, 2))) == len(_kept(top_k(uncertain, 2))) == 2, 'top_k(…, 2) should keep 2 tokens in both cases'


def test_top_p_boundary():
    """Top-p stops as soon as the cumulative probability reaches p"""
    got = top_p([0.5, 0.3, 0.2], 0.8)
    assert _kept(got) == [0, 1], f'top_p([0.5, 0.3, 0.2], 0.8) kept {_kept(got)}, expected [0, 1]'


def test_no_truncation_limits():
    """p = 1.0 and k ≥ vocabulary size keep everything"""
    assert approx(top_p(EX2, 1.0), EX2), 'top_p(EX2, 1.0) should return the distribution unchanged'
    assert approx(top_k(EX2, 10), EX2), 'top_k(EX2, 10) should return the distribution unchanged'


def test_ties_prefer_lower_index():
    """Ties go to the lower index, for top-k and greedy"""
    assert _kept(top_k([0.3, 0.3, 0.3, 0.1], 2)) == [0, 1], 'top_k should keep indices 0 and 1 on a tie'
    assert greedy([0.2, 0.4, 0.4]) == 1, 'greedy([0.2, 0.4, 0.4]) should be 1'


def test_sample_respects_truncation():
    """sample walks the CDF and never returns a cut token"""
    q = top_k(EX2, 2)
    draws = {sample(q, u / 100) for u in range(100)}
    assert draws == {0, 1}, f'sampling top_k(EX2, 2) produced tokens {sorted(draws)}, expected [0, 1]'
    assert sample([0.5, 0.5], 0.0) == 0 and sample([0.5, 0.5], 0.75) == 1, 'sample should follow the cumulative distribution'


def test_cut_tokens_never_drawn_even_at_zero():
    """A zero-probability token is never drawn, even when u is exactly 0"""
    got = sample([0.0, 1.0], 0.0)
    assert got == 1, f'sample([0.0, 1.0], 0.0) returned {got!r}; token 0 has probability 0 and must never be drawn'
    got = sample(top_k([0.1, 0.6, 0.3], 1), 0.0)
    assert got == 1, f'after top_k(…, 1) only token 1 survives, but sample returned {got!r}'
