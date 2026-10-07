import math

RETRIEVED = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
RELEVANT = {'b', 'e', 'g', 'z'}          # 'z' is relevant but was never retrieved


def test_hit():
    """hit@k is 1 once any relevant passage is in the top k"""
    assert hit_at_k(RETRIEVED, RELEVANT, 1) == 0.0, 'hit@1 should be 0.0: a is not relevant'
    assert hit_at_k(RETRIEVED, RELEVANT, 2) == 1.0, 'hit@2 should be 1.0: b is relevant'


def test_recall_counts_unretrieved_relevant():
    """recall@k divides by every relevant passage, including ones never retrieved"""
    got = recall_at_k(RETRIEVED, RELEVANT, 5)
    assert approx(got, 2 / 4), f'recall@5 returned {got!r}, expected 2/4 (b, e of b, e, g, z)'
    got = recall_at_k(RETRIEVED, RELEVANT, 10)
    assert approx(got, 3 / 4), f'recall@10 returned {got!r}, expected 3/4 (z was never retrieved)'


def test_recall_undefined_without_labels():
    """recall@k with no relevant passages raises ValueError"""
    try:
        recall_at_k(RETRIEVED, set(), 5)
    except ValueError:
        return
    assert False, 'recall_at_k(..., set(), 5) should raise ValueError'


def test_precision():
    """precision@k is the relevant share of the top k"""
    got = precision_at_k(RETRIEVED, RELEVANT, 5)
    assert approx(got, 2 / 5), f'precision@5 returned {got!r}, expected 2/5'
    got = precision_at_k(RETRIEVED, RELEVANT, 10)
    assert approx(got, 3 / 10), f'precision@10 returned {got!r}, expected 3/10'


def test_reciprocal_rank():
    """Reciprocal rank is 1 / the rank of the first relevant passage, 0 if none"""
    assert approx(reciprocal_rank(RETRIEVED, RELEVANT), 0.5), 'first relevant is b at rank 2, so 1/2'
    assert approx(reciprocal_rank(['x', 'y'], RELEVANT), 0.0), 'nothing relevant retrieved should give 0.0'


def test_mrr_and_hit_rate():
    """MRR averages reciprocal ranks; hit rate is the fraction of queries with a hit in the top k"""
    runs = [(RETRIEVED, RELEVANT), (['q', 'r', 's'], {'q'}), (['m', 'n', 'o'], {'p'})]
    got = mean_reciprocal_rank(runs)
    assert approx(got, (0.5 + 1.0 + 0.0) / 3), f'MRR returned {got!r}, expected 0.5'
    got = hit_rate(runs, 1)
    assert approx(got, 1 / 3), f'hit rate @1 returned {got!r}, expected 1/3'
    got = hit_rate(runs, 3)
    assert approx(got, 2 / 3), f'hit rate @3 returned {got!r}, expected 2/3'


def test_ndcg_hand_computed():
    """nDCG@3 with gain = grade and a log₂(rank + 1) discount"""
    grades = {'b': 3, 'c': 1, 'x': 2}     # 'x' is graded but not retrieved
    dcg = 0 / 1 + 3 / math.log2(3) + 1 / math.log2(4)
    ideal = 3 / 1 + 2 / math.log2(3) + 1 / math.log2(4)
    got = ndcg_at_k(['a', 'b', 'c'], grades, 3)
    assert approx(got, dcg / ideal), f'nDCG@3 returned {got!r}, expected {dcg / ideal!r}'


def test_ndcg_perfect_and_empty():
    """nDCG is 1 for the ideal ordering and 0 when nothing is relevant"""
    grades = {'a': 2, 'b': 1}
    assert approx(ndcg_at_k(['a', 'b', 'c'], grades, 3), 1.0), 'the ideal ordering should score 1.0'
    assert approx(ndcg_at_k(['a', 'b'], {}, 2), 0.0), 'with no graded passages nDCG should be 0.0'


def test_reranker_funnel():
    """Reordering the same 10 candidates can move recall@3 and nDCG@3, never recall@10"""
    grades = {d: 1 for d in RELEVANT}
    reranked = sorted(RETRIEVED, key=lambda d: d not in RELEVANT)   # relevant first, stable otherwise
    assert approx(recall_at_k(reranked, RELEVANT, 10), recall_at_k(RETRIEVED, RELEVANT, 10)), 'recall@10 must not change when only the order changes'
    assert recall_at_k(reranked, RELEVANT, 3) > recall_at_k(RETRIEVED, RELEVANT, 3), 'moving relevant passages up should raise recall@3'
    assert ndcg_at_k(reranked, grades, 3) > ndcg_at_k(RETRIEVED, grades, 3), 'moving relevant passages up should raise nDCG@3'
