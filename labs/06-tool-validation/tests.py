SCHEMA = {
    'type': 'object',
    'properties': {
        'customer_email': {'type': 'string'},
        'status': {'type': 'string', 'enum': ['open', 'shipped', 'refunded']},
        'limit': {'type': 'integer'},
        'min_total': {'type': 'number'},
        'include_items': {'type': 'boolean'},
        'tags': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['customer_email'],
    'additionalProperties': False,
}
RUNS = []


def _search(customer_email, status='open', limit=10, **_):
    RUNS.append(customer_email)
    if customer_email == 'boom@example.com':
        raise LookupError('order service timed out; retry in a few seconds')
    return f'2 {status} orders for {customer_email}'


def _tools():
    return {'search_orders': {'permission': 'orders:read', 'schema': SCHEMA, 'fn': _search}}


READER = {'user': 'agent-7', 'permissions': {'orders:read'}}
NOBODY = {'user': 'guest', 'permissions': set()}


def _mentions(errors, field):
    return any(field in e for e in errors)


def test_valid_args():
    """Valid arguments produce no errors"""
    got = validate_args(SCHEMA, {'customer_email': 'a@b.com', 'status': 'shipped', 'limit': 5, 'min_total': 9.5, 'include_items': True, 'tags': ['x']})
    assert got == [], f'expected no errors, got {got}'


def test_missing_required():
    """A missing required field is reported by name"""
    got = validate_args(SCHEMA, {'status': 'open'})
    assert got and _mentions(got, 'customer_email'), f'expected an error naming customer_email, got {got}'


def test_wrong_types():
    """Type errors name the field, and booleans are not integers or numbers"""
    for field, bad in (('limit', '10'), ('limit', True), ('min_total', False), ('customer_email', 42), ('include_items', 'yes')):
        got = validate_args(SCHEMA, {'customer_email': 'a@b.com', field: bad} if field != 'customer_email' else {field: bad})
        assert got and _mentions(got, field), f'{field}={bad!r} should be rejected with an error naming {field}, got {got}'


def test_integer_is_a_number():
    """An integer is a valid number"""
    got = validate_args(SCHEMA, {'customer_email': 'a@b.com', 'min_total': 10})
    assert got == [], f'min_total=10 should be valid, got {got}'


def test_enum_and_extra_fields():
    """Invented enum values and unexpected fields are rejected"""
    got = validate_args(SCHEMA, {'customer_email': 'a@b.com', 'status': 'lost'})
    assert got and _mentions(got, 'status'), f"status='lost' should be rejected, got {got}"
    got = validate_args(SCHEMA, {'customer_email': 'a@b.com', 'is_admin': True})
    assert got and _mentions(got, 'is_admin'), f'an unexpected field should be rejected, got {got}'


def test_array_items():
    """Array items are checked against the items type"""
    got = validate_args(SCHEMA, {'customer_email': 'a@b.com', 'tags': ['ok', 3]})
    assert got and _mentions(got, 'tags'), f'tags with a non-string item should be rejected, got {got}'


def test_executes_valid_authorized_call():
    """A valid, authorized call runs the function and returns its result as a string"""
    RUNS.clear()
    got = execute_tool_call({'name': 'search_orders', 'input': {'customer_email': 'a@b.com', 'status': 'shipped'}}, _tools(), READER)
    assert got == '2 shipped orders for a@b.com', f'returned {got!r}'
    assert RUNS == ['a@b.com'], 'the tool should have run exactly once'


def test_invalid_args_never_execute():
    """Invalid arguments come back in-band and the function never runs"""
    RUNS.clear()
    got = execute_tool_call({'name': 'search_orders', 'input': {'customer_email': 'a@b.com', 'limit': 'ten'}}, _tools(), READER)
    assert isinstance(got, str) and got.startswith('error: invalid arguments'), f'returned {got!r}'
    assert 'limit' in got, 'the error should name the field so the model can fix it'
    assert RUNS == [], 'the tool must not run on invalid arguments'


def test_authorization_comes_from_the_session():
    """A valid call from a session without the permission is refused and never runs"""
    RUNS.clear()
    call = {'name': 'search_orders', 'input': {'customer_email': 'ceo@example.com'}}
    got = execute_tool_call(call, _tools(), NOBODY)
    assert isinstance(got, str) and got.startswith('error: not authorized'), f'returned {got!r}'
    assert RUNS == [], 'the tool must not run without permission'


def test_validation_before_authorization():
    """Validation happens first: an invalid call is reported as invalid even without permission"""
    RUNS.clear()
    got = execute_tool_call({'name': 'search_orders', 'input': {}}, _tools(), NOBODY)
    assert isinstance(got, str) and got.startswith('error: invalid arguments'), f'returned {got!r}'
    assert RUNS == []


def test_failures_stay_in_band():
    """Unknown tools and tool exceptions come back as error strings, never as raised exceptions"""
    got = execute_tool_call({'name': 'delete_everything', 'input': {}}, _tools(), READER)
    assert isinstance(got, str) and got.startswith('error: unknown tool'), f'returned {got!r}'
    got = execute_tool_call({'name': 'search_orders', 'input': {'customer_email': 'boom@example.com'}}, _tools(), READER)
    assert got == 'error: order service timed out; retry in a few seconds', f'returned {got!r}'
