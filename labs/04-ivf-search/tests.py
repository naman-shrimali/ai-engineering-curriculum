# Four cells around centroids at the corners of a square; a handful of points in each.
CENTROIDS = [[0.0, 0.0], [10.0, 0.0], [0.0, 10.0], [10.0, 10.0]]
VECTORS = [
    [1.0, 1.0], [2.0, 0.5], [0.5, 2.5],      # cell 0
    [9.0, 1.0], [8.0, 2.0], [5.2, 0.4],      # cell 1 (5.2, 0.4 sits just across the 0/1 border)
    [1.0, 9.0], [2.0, 8.0],                  # cell 2
    [9.0, 9.0], [8.5, 7.5], [6.0, 6.0],      # cell 3
]
QUERY = [4.6, 0.5]                           # inside cell 0, right next to the border with cell 1


def test_squared_distance():
    """squared_distance([1, 2], [4, 6]) is 25"""
    got = squared_distance([1, 2], [4, 6])
    assert approx(got, 25), f'squared_distance([1, 2], [4, 6]) returned {got!r}, expected 25'


def test_assign():
    """Every vector lands in its nearest centroid's cell"""
    got = assign(VECTORS, CENTROIDS)
    want = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 3]
    assert got == want, f'assign returned {got}, expected {want}'


def test_cells_to_probe():
    """The query's nearest cells come back nearest first"""
    got = cells_to_probe(QUERY, CENTROIDS, 2)
    assert got == [0, 1], f'cells_to_probe(QUERY, CENTROIDS, 2) returned {got}, expected [0, 1]'


def test_exact_search():
    """Exact search ranks every vector: the nearest to the query is across the border"""
    got = exact_search(QUERY, VECTORS, 3)
    assert got == [5, 1, 0], f'exact_search(QUERY, VECTORS, 3) returned {got}, expected [5, 1, 0]'


def test_cell_boundary_miss():
    """With nprobe = 1 the true nearest neighbour, one cell over, is never returned"""
    cells = assign(VECTORS, CENTROIDS)
    got = ivf_search(QUERY, VECTORS, CENTROIDS, cells, nprobe=1, k=3)
    assert got == [1, 0, 2], f'ivf_search(..., nprobe=1, k=3) returned {got}, expected [1, 0, 2]'
    assert 5 not in got, 'vector 5 lives in cell 1, which was not probed, so it cannot be returned'
    r = recall_at_k(got, exact_search(QUERY, VECTORS, 3), 3)
    assert approx(r, 2 / 3), f'recall@3 is {r!r}, expected 2/3'


def test_more_probes_recover_it():
    """Raising nprobe to 2 searches the neighbouring cell and recovers the miss"""
    cells = assign(VECTORS, CENTROIDS)
    got = ivf_search(QUERY, VECTORS, CENTROIDS, cells, nprobe=2, k=3)
    assert got == [5, 1, 0], f'ivf_search(..., nprobe=2, k=3) returned {got}, expected [5, 1, 0]'


def test_probe_everything_is_exact():
    """Probing every cell is brute force: identical to exact search"""
    cells = assign(VECTORS, CENTROIDS)
    for q in ([4.6, 0.5], [5.0, 5.0], [9.5, 2.0], [0.0, 9.9]):
        got, want = ivf_search(q, VECTORS, CENTROIDS, cells, nprobe=4, k=4), exact_search(q, VECTORS, 4)
        assert got == want, f'for query {q}, nprobe=4 returned {got} but exact search gives {want}'


def test_recall_never_drops_with_more_probes():
    """Recall@k is non-decreasing as nprobe grows"""
    cells = assign(VECTORS, CENTROIDS)
    for q in ([4.6, 0.5], [5.0, 5.0], [4.0, 7.0]):
        truth = exact_search(q, VECTORS, 4)
        rs = [recall_at_k(ivf_search(q, VECTORS, CENTROIDS, cells, n, 4), truth, 4) for n in (1, 2, 3, 4)]
        assert rs == sorted(rs), f'for query {q} recall by nprobe was {rs}, which drops somewhere'
        assert approx(rs[-1], 1.0), f'for query {q} probing every cell should give recall 1.0, got {rs[-1]!r}'


def test_recall_formula():
    """recall@k counts overlap in the first k ids, ignoring their order"""
    assert approx(recall_at_k([3, 1, 2], [1, 2, 3], 3), 1.0), 'same ids in a different order is recall 1.0'
    assert approx(recall_at_k([9, 1, 8, 2], [1, 2, 3, 4], 4), 0.5), 'two of four true neighbours found is 0.5'
    assert approx(recall_at_k([1, 9, 2], [1, 2, 3], 2), 0.5), 'only the first k of each list count'
