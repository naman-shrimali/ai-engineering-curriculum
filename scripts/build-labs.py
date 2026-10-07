#!/usr/bin/env python3
"""Compile labs/ into app/data/labs.json, verifying every lab on the way.

A lab is a directory labs/NN-name/ holding:
  README.md   frontmatter (id, title, chapter, anchor, basis, functions, ...) + the brief
  starter.py  what the learner starts from (must fail the tests)
  solution.py the reference solution (must pass every test)
  tests.py    test_* functions run by labs/harness.py

Checks, all of which fail the build (and CI):
  - the reference solution passes every test, under CPython, through the same harness
    the browser uses; the starter loads cleanly and fails at least one test
  - every `basis` quote appears verbatim in the lab's chapter, and `anchor` is one of
    that chapter's sections — so an edited chapter forces the lab to be revisited
  - every name in `functions` is defined in the starter

Usage: python3 scripts/build-labs.py           # write app/data/labs.json
       python3 scripts/build-labs.py --check   # verify and fail if the JSON is stale
"""
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
LABS = ROOT / 'labs'
OUT = ROOT / 'app/data/labs.json'
sys.path.insert(0, str(LABS))
import harness  # noqa: E402

REQUIRED = ('id', 'title', 'chapter', 'anchor', 'basis', 'functions', 'difficulty', 'minutes')


def slug(s):  # mirrors scripts/build-content.py slug()
    s = re.sub(r'<[^>]+>', '', s).lower()
    s = re.sub(r'[^a-z0-9\s-]', '', s).strip()
    return re.sub(r'-+', '-', re.sub(r'\s+', '-', s))


def chapter_paths():
    index = json.loads((ROOT / 'app/data/content.json').read_text())
    return {c['id']: c['path'] for c in index['chapters'] + index['engineering']}


def load(d, paths, errors):
    text = (d / 'README.md').read_text()
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', text, re.S)
    if not m:
        errors.append(f'{d.name}: README.md has no frontmatter'); return None
    meta, brief = yaml.safe_load(m.group(1)), m.group(2).strip()
    missing = [k for k in REQUIRED if k not in meta]
    if missing:
        errors.append(f'{d.name}: frontmatter missing {missing}'); return None
    files = {f: (d / f'{f}.py').read_text() for f in ('starter', 'solution', 'tests')}
    lab = {**{k: meta[k] for k in REQUIRED}, 'order': int(d.name.split('-')[0]), 'brief': brief, **files}

    # grounding: quotes verbatim, anchor real
    path = paths.get(meta['chapter'])
    if not path:
        errors.append(f"{meta['id']}: unknown chapter {meta['chapter']}"); return lab
    chapter = (ROOT / path).read_text()
    if meta['anchor'] not in {slug(h) for h in re.findall(r'^## (.+)$', chapter, re.M)}:
        errors.append(f"{meta['id']}: section #{meta['anchor']} not found in {path}")
    for q in meta['basis']:
        if q not in chapter:
            errors.append(f"{meta['id']}: basis quote not verbatim in {path}: \"{q}\"")
    for fn in meta['functions']:
        if not re.search(rf'^(def|class) {re.escape(fn)}\b', files['starter'], re.M):
            errors.append(f"{meta['id']}: starter does not define {fn}")

    # grading: reference passes, starter fails
    ref = harness.run(files['solution'], files['tests'])
    if ref['error']:
        errors.append(f"{meta['id']}: solution errors: {ref['error']}")
    elif len(ref['results']) < 4:
        errors.append(f"{meta['id']}: only {len(ref['results'])} tests (want at least 4)")
    for r in ref['results']:
        if not r['ok']:
            errors.append(f"{meta['id']}: solution fails {r['name']}: {r['msg']}")
    st = harness.run(files['starter'], files['tests'])
    if st['error']:
        errors.append(f"{meta['id']}: starter does not load: {st['error']}")
    elif all(r['ok'] for r in st['results']):
        errors.append(f"{meta['id']}: starter already passes every test")
    lab['test_count'] = len(ref['results'])
    lab['test_names'] = [r['doc'] for r in ref['results']]
    return lab


def build():
    errors, paths, labs = [], chapter_paths(), []
    for d in sorted(p for p in LABS.iterdir() if p.is_dir() and re.match(r'^\d\d-', p.name)):
        lab = load(d, paths, errors)
        if lab:
            labs.append(lab)
    ids = [l['id'] for l in labs]
    if len(ids) != len(set(ids)):
        errors.append('duplicate lab ids')
    data = {'harness': (LABS / 'harness.py').read_text(), 'labs': labs}
    return json.dumps(data, ensure_ascii=False, indent=1) + '\n', labs, errors


def main():
    out, labs, errors = build()
    if errors:
        print('Lab build failed:'); [print('  - ' + e) for e in errors]; sys.exit(1)
    tests = sum(l['test_count'] for l in labs)
    if '--check' in sys.argv:
        if not OUT.exists() or OUT.read_text() != out:
            print('STALE — regenerate with: python3 scripts/build-labs.py'); sys.exit(1)
        print(f'labs up to date: {len(labs)} labs, {tests} tests; every reference solution passes, every starter fails, every quote verbatim')
        return
    OUT.write_text(out)
    print(f'wrote {OUT.relative_to(ROOT)}: {len(labs)} labs, {tests} tests (all reference solutions pass, all starters fail)')


if __name__ == '__main__':
    main()
