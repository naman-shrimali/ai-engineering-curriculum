def squared_distance(a, b):
    raise NotImplementedError


def assign(vectors, centroids):
    """For each vector, the index of its nearest centroid (ties: lower index)."""
    raise NotImplementedError


def cells_to_probe(query, centroids, nprobe):
    """Indices of the nprobe centroids nearest the query, nearest first."""
    raise NotImplementedError


def exact_search(query, vectors, k):
    """Ids of the k nearest vectors, nearest first (ties: lower id)."""
    raise NotImplementedError


def ivf_search(query, vectors, centroids, assignments, nprobe, k):
    """Search only the vectors in the nprobe nearest cells; return k ids, nearest first."""
    raise NotImplementedError


def recall_at_k(approx_ids, exact_ids, k):
    """|first k of approx ∩ first k of exact| / k."""
    raise NotImplementedError
