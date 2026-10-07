def matvec(M, x):
    if any(len(row) != len(x) for row in M):
        raise ValueError('matrix columns must match the vector length')
    return [sum(m * v for m, v in zip(row, x)) for row in M]


def lora_forward(W, A, B, x):
    d, r = len(W), len(A)
    if any(len(row) != d for row in W) or len(x) != d:
        raise ValueError('W must be d x d and x must have length d')
    if any(len(row) != d for row in A):
        raise ValueError('A must be r x d')
    if len(B) != d or any(len(row) != r for row in B):
        raise ValueError('B must be d x r')
    base = matvec(W, x)
    update = matvec(B, matvec(A, x))
    return [b + u for b, u in zip(base, update)]


def trainable_params(d, r, n_matrices=1):
    return n_matrices * (r * d + d * r)


def full_params(d, n_matrices=1):
    return n_matrices * d * d
