#!/usr/bin/env python3
"""Fail if an explorable's quoted basis no longer appears verbatim in its chapter.

Each explorable in app/lib/explorables.js implements definitions its chapter states and
shows them as quotes. If a chapter is edited, the quote — and possibly the simulation —
must be revisited; this check makes that visible in CI instead of letting them drift.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / 'app/lib/explorables.js').read_text()
index = json.loads((ROOT / 'app/data/content.json').read_text())
paths = {c['id']: c['path'] for c in index['chapters'] + index['engineering']}

def unjs(s):  # JS single/double-quoted string literal body → text
    return s.encode().decode('unicode_escape').encode('latin-1').decode('utf-8') if '\\u' in s else s.replace("\\'", "'").replace('\\"', '"')

failures, checked = [], 0
for block in re.finditer(r"\{\s*id: '([\w-]+)', chapter: '([a-z]{3}-\d\d)', anchor: '([\w-]+)'(.*?)mount:", src, re.S):
    xid, chapter, anchor, body = block.groups()
    if chapter not in paths:
        failures.append(f'{xid}: unknown chapter {chapter}'); continue
    text = (ROOT / paths[chapter]).read_text()
    slugs = {re.sub(r'-+', '-', re.sub(r'\s+', '-', re.sub(r'[^a-z0-9\s-]', '', re.sub(r'<[^>]+>', '', h).lower()).strip())) for h in re.findall(r'^## (.+)$', text, re.M)}
    if anchor not in slugs:
        failures.append(f'{xid}: section #{anchor} not found in {paths[chapter]}')
    basis = re.search(r'basis: \[(.*?)\],\s*\n', body, re.S)
    quotes = re.findall(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"", basis.group(1)) if basis else []
    if not quotes:
        failures.append(f'{xid}: no basis quotes'); continue
    for a, b in quotes:
        q = unjs(a or b); checked += 1
        if q not in text:
            failures.append(f'{xid}: quote not found verbatim in {paths[chapter]}: "{q}"')

if failures:
    print('Explorable basis check failed:'); [print('  - ' + f) for f in failures]; sys.exit(1)
print(f'Explorable basis check: {checked} quotes verified verbatim across {len(set(re.findall(r"chapter: .([a-z]{3}-[0-9]{2}).", src)))} chapters.')
