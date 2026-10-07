import math


def test_dot():
    """dot([1, 2, 3], [4, 5, 6]) is 32"""
    got = dot([1, 2, 3], [4, 5, 6])
    assert approx(got, 32), f'dot([1, 2, 3], [4, 5, 6]) returned {got!r}, expected 32'


def test_dimension_mismatch():
    """Vectors of different lengths are rejected with ValueError"""
    try:
        dot([1, 2], [1, 2, 3])
    except ValueError:
        return
    assert False, 'dot([1, 2], [1, 2, 3]) should raise ValueError'


def test_exercise_2_distance():
    """Exercise 2: a = (3, 4), b = (6, 8) are 5 apart"""
    got = euclidean_distance([3, 4], [6, 8])
    assert approx(got, 5.0), f'euclidean_distance([3, 4], [6, 8]) returned {got!r}, expected 5.0'


def test_exercise_2_cosine():
    """Exercise 2: a = (3, 4), b = (6, 8) point the same way, so cosine is 1"""
    got = cosine_similarity([3, 4], [6, 8])
    assert approx(got, 1.0), f'cosine_similarity([3, 4], [6, 8]) returned {got!r}, expected 1.0'


def test_cosine_range():
    """Cosine is -1 for opposite vectors and 0 for orthogonal ones"""
    opp, orth = cosine_similarity([1, 2], [-2, -4]), cosine_similarity([1, 0], [0, 5])
    assert approx(opp, -1.0), f'opposite vectors gave {opp!r}, expected -1.0'
    assert approx(orth, 0.0), f'orthogonal vectors gave {orth!r}, expected 0.0'


def test_cosine_ignores_magnitude():
    """Scaling a vector changes its dot product but not its cosine"""
    a, b = [1.0, 2.0, 0.5], [0.3, -1.0, 2.0]
    big = [10 * x for x in b]
    assert approx(cosine_similarity(a, big), cosine_similarity(a, b)), 'cosine changed when b was scaled by 10'
    assert not approx(dot(a, big), dot(a, b)), 'dot product should grow with magnitude'


def test_zero_vector():
    """Cosine and normalize reject the zero vector with ValueError"""
    for call in (lambda: cosine_similarity([0, 0], [1, 1]), lambda: normalize([0, 0, 0])):
        try:
            call()
        except ValueError:
            continue
        assert False, 'a zero vector should raise ValueError'


def test_normalize_unit_length():
    """normalize returns a unit vector pointing the same way"""
    v = [3.0, -4.0, 12.0]
    u = normalize(v)
    assert approx(norm(u), 1.0), f'norm(normalize(v)) is {norm(u)!r}, expected 1.0'
    assert approx(cosine_similarity(u, v), 1.0), 'normalize changed the direction'


def test_normalized_cosine_is_dot():
    """On unit vectors, cosine similarity equals the dot product"""
    a, b = [2.0, 1.0, -3.0], [0.5, 4.0, 1.0]
    assert approx(dot(normalize(a), normalize(b)), cosine_similarity(a, b))


def test_distance_identity():
    """On unit vectors, distance² = 2 − 2 · dot (so distance is monotonic in cosine)"""
    a, b = normalize([1.0, 7.0, -2.0]), normalize([-3.0, 2.0, 5.0])
    lhs, rhs = euclidean_distance(a, b) ** 2, 2 - 2 * dot(a, b)
    assert approx(lhs, rhs), f'‖â−b̂‖² = {lhs!r} but 2 − 2â·b̂ = {rhs!r}'


def test_raw_rankings_can_disagree():
    """On raw vectors the three metrics can rank documents differently"""
    q = [1.0, 0.0]
    docs = [[10.0, 10.0], [0.9, 0.1], [2.0, 0.0]]
    by = {m: rank(q, docs, m) for m in ('dot', 'cosine', 'euclidean')}
    assert by['dot'] == [0, 2, 1], f"rank(..., 'dot') returned {by['dot']}, expected [0, 2, 1]"
    assert by['cosine'] == [2, 1, 0], f"rank(..., 'cosine') returned {by['cosine']}, expected [2, 1, 0]"
    assert by['euclidean'] == [1, 2, 0], f"rank(..., 'euclidean') returned {by['euclidean']}, expected [1, 2, 0]"


def test_normalized_rankings_agree():
    """After normalizing every vector, all three metrics produce the same ranking"""
    q = normalize([1.0, 0.2, -0.5])
    docs = [normalize(d) for d in ([4.0, 1.0, 0.0], [0.1, 3.0, 2.0], [-1.0, 0.0, 1.0], [2.0, 0.5, -1.5], [0.0, -2.0, 0.3])]
    by = {m: rank(q, docs, m) for m in ('dot', 'cosine', 'euclidean')}
    assert by['dot'] == by['cosine'] == by['euclidean'], f'rankings differ after normalizing: {by}'
