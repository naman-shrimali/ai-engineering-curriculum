def matvec(M, x):
    """M (rows of equal length) times vector x. ValueError on a shape mismatch."""
    raise NotImplementedError


def lora_forward(W, A, B, x):
    """Wx + B(Ax) for W: d×d (frozen), A: r×d, B: d×r. ValueError on bad shapes."""
    raise NotImplementedError


def trainable_params(d, r, n_matrices=1):
    raise NotImplementedError


def full_params(d, n_matrices=1):
    raise NotImplementedError
