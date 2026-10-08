import copy

W = [[1, 0, 2], [0, 1, 0], [3, 0, 1]]           # d = 3
A = [[1, 1, 0]]                                  # r = 1: 1 × 3
B = [[2], [0], [-1]]                             # 3 × 1
X = [1, 2, 3]


def test_matvec():
    """matvec multiplies a matrix by a vector"""
    got = matvec(W, X)
    assert got == [7, 2, 6], f'matvec(W, X) returned {got!r}, expected [7, 2, 6]'


def test_matvec_shape_check():
    """matvec rejects a vector of the wrong length"""
    try:
        matvec(W, [1, 2])
    except ValueError:
        return
    assert False, 'matvec(W, [1, 2]) should raise ValueError'


def test_lora_forward_by_hand():
    """Wx + B(Ax): Ax = [3], B(Ax) = [6, 0, -3], so the output is [13, 2, 3]"""
    got = lora_forward(W, A, B, X)
    assert approx(got, [13, 2, 3]), f'lora_forward returned {got!r}, expected [13, 2, 3]'


def test_scale_alpha_over_r():
    """scale = α/r multiplies only the low-rank path: with scale 2 the update [6, 0, -3] doubles, giving [19, 2, 0]"""
    got = lora_forward(W, A, B, X, scale=2.0)
    assert approx(got, [19, 2, 0]), f'lora_forward(..., scale=2.0) returned {got!r}, expected [19, 2, 0]'


def test_zero_update_is_the_base_layer():
    """With B all zeros the adapter contributes nothing: the output is Wx"""
    got = lora_forward(W, A, [[0], [0], [0]], X)
    assert approx(got, matvec(W, X)), f'returned {got!r}, expected Wx = {matvec(W, X)!r}'


def test_w_stays_frozen():
    """The forward pass does not modify W"""
    w = copy.deepcopy(W)
    lora_forward(w, A, B, X)
    assert w == W, 'lora_forward changed W'


def test_shapes_enforced():
    """A must be r × d and B must be d × r"""
    for a, b in (([[1, 1]], B), (A, [[2, 1], [0, 0], [1, 1]]), (A, [[2], [0]])):
        try:
            lora_forward(W, a, b, X)
        except ValueError:
            continue
        assert False, f'lora_forward should reject A={a!r}, B={b!r}'


def test_parameter_counts():
    """For d = 4096 and r = 8, LoRA trains 65,536 parameters against full fine-tuning's 16,777,216"""
    assert trainable_params(4096, 8) == 65_536, f'trainable_params(4096, 8) returned {trainable_params(4096, 8)!r}'
    assert full_params(4096) == 16_777_216, f'full_params(4096) returned {full_params(4096)!r}'
    assert trainable_params(4096, 8, n_matrices=32) == 32 * 65_536, 'n_matrices should multiply the count'


def test_scaling():
    """LoRA's count doubles with r (and with d); full fine-tuning's grows with d²"""
    assert trainable_params(1024, 16) == 2 * trainable_params(1024, 8), 'doubling r should double the LoRA count'
    assert trainable_params(2048, 8) == 2 * trainable_params(1024, 8), 'doubling d should double the LoRA count'
    assert full_params(2048) == 4 * full_params(1024), 'doubling d should quadruple the full count'
