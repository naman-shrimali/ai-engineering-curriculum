#!/usr/bin/env python3
"""Fail if the hand-drawn prerequisite graph, the manifest and the chapters disagree.

curriculum/dependency-graph.md draws every prerequisite edge in Mermaid; manifest.yaml
lists `prerequisites` per chapter; each chapter's frontmatter repeats them. They are
three copies of one fact (REVIEW.md P3-3), so CI asserts the three edge sets are equal.
"""
import glob, re, sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parent.parent
man = yaml.safe_load((ROOT / 'manifest.yaml').read_text())
manifest = {(p, c['id']) for c in man['chapters'] for p in (c.get('prerequisites') or [])}
graph = {(a[:3] + '-' + a[3:], b[:3] + '-' + b[3:]) for a, b in re.findall(r'^\s*([a-z]{3}\d\d) --> ([a-z]{3}\d\d)\s*$', (ROOT / 'curriculum/dependency-graph.md').read_text(), re.M)}
front = set()
for f in glob.glob(str(ROOT / 'modules/*/*.md')):
    m = re.match(r'^---\n(.*?)\n---', Path(f).read_text(), re.S)
    if m:
        fm = yaml.safe_load(m.group(1))
        front |= {(p, fm['id']) for p in (fm.get('prerequisites') or [])}

problems = []
for name, a, b in (('manifest', manifest, graph), ('dependency-graph.md', graph, manifest), ('manifest', manifest, front), ('chapter frontmatter', front, manifest)):
    other = {'manifest': 'dependency-graph.md' if b is graph else 'chapter frontmatter', 'dependency-graph.md': 'manifest', 'chapter frontmatter': 'manifest'}[name]
    for p, c in sorted(a - b):
        problems.append(f'{c} needs {p} in {name} but not in {other}')
if problems:
    print('Prerequisite graphs disagree:'); [print('  - ' + p) for p in sorted(set(problems))]; sys.exit(1)
print(f'prerequisites consistent: {len(manifest)} edges agree across manifest.yaml, curriculum/dependency-graph.md and chapter frontmatter')
