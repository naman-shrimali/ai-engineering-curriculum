"""Lab test harness.

Runs one lab's tests against a learner's code and returns structured results.
The same file runs in the browser (Pyodide, in a Web Worker) and in CI
(CPython, via scripts/build-labs.py), so a lab grades identically in both.

Tests are plain functions named test_* in the lab's tests.py. Each one's
docstring is the line the learner sees; its assertion message is the feedback
when it fails. The learner's code and the tests share one namespace, so tests
call the learner's functions by name.
"""
import math
import traceback


def approx(got, want, tol=1e-6):
    """Equality with a float tolerance, recursing into lists, tuples and dicts."""
    if isinstance(want, (list, tuple)):
        return (isinstance(got, (list, tuple)) and len(got) == len(want)
                and all(approx(g, w, tol) for g, w in zip(got, want)))
    if isinstance(want, dict):
        return (isinstance(got, dict) and set(got) == set(want)
                and all(approx(got[k], want[k], tol) for k in want))
    if isinstance(want, float) or isinstance(got, float):
        if isinstance(got, bool) or not isinstance(got, (int, float)):
            return False
        if math.isinf(want) or math.isinf(got):
            return got == want
        return math.isclose(got, want, rel_tol=tol, abs_tol=tol)
    return got == want


def _where(tb):
    """' (line N)' for the deepest frame inside the learner's code, if any."""
    frames = [f for f in traceback.extract_tb(tb) if f.filename == 'solution.py']
    return ' (your code, line %d)' % frames[-1].lineno if frames else ''


def _describe(exc):
    if isinstance(exc, NotImplementedError):
        return 'not implemented yet' + _where(exc.__traceback__)
    if isinstance(exc, AssertionError):
        return str(exc) or 'assertion failed'
    return '%s: %s%s' % (type(exc).__name__, exc, _where(exc.__traceback__))


def run(user_code, test_code):
    """Execute the learner's code, then every test_* in the tests, in order."""
    ns = {'__name__': 'solution'}
    try:
        exec(compile(user_code, 'solution.py', 'exec'), ns)
    except SyntaxError as e:
        return {'error': 'SyntaxError: %s (line %s)' % (e.msg, e.lineno), 'results': []}
    except Exception as e:  # an error at import time, before any test runs
        return {'error': _describe(e), 'results': []}
    tns = dict(ns)
    tns['approx'] = approx
    exec(compile(test_code, 'tests.py', 'exec'), tns)
    tests = [v for k, v in tns.items()
             if k.startswith('test_') and callable(v)
             and getattr(getattr(v, '__code__', None), 'co_filename', '') == 'tests.py']
    results = []
    for t in tests:
        doc = ' '.join((t.__doc__ or t.__name__).split())
        try:
            t()
            results.append({'name': t.__name__, 'doc': doc, 'ok': True, 'msg': ''})
        except Exception as e:
            results.append({'name': t.__name__, 'doc': doc, 'ok': False, 'msg': _describe(e)})
    return {'error': None, 'results': results}
