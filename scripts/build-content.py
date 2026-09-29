#!/usr/bin/env python3
"""
build-content.py — compile the Markdown corpus into app/data/content.json.

The interactive app (index.html + app/) renders chapters live from the .md
files; this index only carries *structure* derived from them — frontmatter,
section outline, flashcards, self-test questions, interview Q&A, exercises,
revision bullets, diagram sources, glossary, concept graph, learning tracks —
so the UI can build dashboards, maps, trainers and search without re-parsing
79 files in the browser. Nothing here rewrites content: every string in the
output is a verbatim slice of a source file.

Usage:
  python3 scripts/build-content.py            # write app/data/content.json (+ tutor/files.json)
  python3 scripts/build-content.py --check    # exit 1 if the committed index is stale (CI)
"""
import json, os, re, sys, hashlib
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'data', 'content.json')
FILES_JSON = os.path.join(ROOT, 'tutor', 'files.json')

try:
    import yaml  # PyYAML is present in most environments; fall back to a mini parser otherwise
except ImportError:  # pragma: no cover
    yaml = None

# ---------------------------------------------------------------- helpers

def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()

def slug(s):
    """Heading → anchor id. Mirrors app/lib/md.js slug() exactly — keep in sync."""
    s = re.sub(r'<[^>]+>', '', s)
    s = s.lower()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'\s+', '-', s.strip())
    s = re.sub(r'-+', '-', s)
    return s

def words(s):
    return len(re.findall(r"[\w'’-]+", s))

def strip_md(s):
    """Light inline-markdown strip for summaries/labels (keeps text verbatim otherwise)."""
    s = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', s)
    s = re.sub(r'`([^`]+)`', r'\1', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'\1', s)
    s = re.sub(r'\*([^*]+)\*', r'\1', s)
    s = re.sub(r'\[\^[\w-]+\]', '', s)
    return s.strip()

def split_frontmatter(raw):
    if not raw.startswith('---'):
        return {}, raw
    end = raw.find('\n---', 3)
    if end < 0:
        return {}, raw
    fm_txt = raw[3:end]
    body = raw[end + 4:]
    meta = yaml.safe_load(fm_txt) if yaml else mini_yaml(fm_txt)
    return (meta or {}), body

def mini_yaml(txt):
    """Minimal YAML subset parser for frontmatter when PyYAML is unavailable."""
    meta, key, buf, lst = {}, None, [], None
    for line in txt.splitlines():
        if not line.strip():
            continue
        m = re.match(r'^(\w+):\s*(.*)$', line)
        if m and not line.startswith(' '):
            if key and buf:
                meta[key] = ' '.join(buf).strip(); buf = []
            key, val = m.group(1), m.group(2).strip()
            if val in ('>-', '>', '|'):
                buf = []; lst = None
            elif val == '':
                meta[key] = []; lst = meta[key]
            elif val.startswith('['):
                meta[key] = [x.strip() for x in val.strip('[]').split(',') if x.strip()]
                lst = None
            else:
                meta[key] = val.strip('"\''); lst = None
        elif line.startswith('  - ') and lst is not None:
            lst.append(line[4:].strip().strip('"\''))
        elif line.startswith('  ') and key:
            buf.append(line.strip())
    if key and buf:
        meta[key] = ' '.join(buf).strip()
    return meta

# ---------------------------------------------------------------- manifest

MANIFEST = yaml.safe_load(read('manifest.yaml')) if yaml else None
if MANIFEST is None:
    # regex fallback identical to the classic reader's
    man = read('manifest.yaml')
    rx = re.compile(r'- id: (\S+)\s*\n\s+path: (\S+)\s*\n\s+module: (\S+)\s*\n\s+prerequisites: (\[[^\]]*\])\s*\n\s+status: (\S+)')
    entries = [{'id': m[1], 'path': m[2], 'module': m[3], 'status': m[5],
                'prerequisites': [x.strip() for x in m[4].strip('[]').split(',') if x.strip()]}
               for m in rx.findall(man)]
    MANIFEST = {'chapters': [e for e in entries if not e['id'].startswith(('eng-', 'tut-'))],
                'engineering_docs': [e for e in entries if e['id'].startswith('eng-')],
                'tutor_docs': [e for e in entries if e['id'].startswith('tut-')],
                'spec_version': 3}

# ---------------------------------------------------------------- modules (from roadmap)

MODULE_KEYS = ['foundations', 'llm-apis', 'retrieval', 'agents', 'evaluation',
               'production', 'safety-security', 'fine-tuning', 'frontier']
MODULE_SHORT = {
    'foundations': 'Foundations', 'llm-apis': 'LLM APIs', 'retrieval': 'Retrieval',
    'agents': 'Agents', 'evaluation': 'Evaluation', 'production': 'Production',
    'safety-security': 'Safety & Security', 'fine-tuning': 'Fine-tuning', 'frontier': 'Frontier',
}

def parse_roadmap():
    txt = read('curriculum/roadmap.md')
    mods, objectives = [], {}
    blocks = re.split(r'^## ', txt, flags=re.M)[1:]
    for b in blocks:
        head, _, rest = b.partition('\n')
        m = re.match(r'Module (\d+) — (.+?) \(`(\d\d)-([\w-]+)`\)', head)
        if not m:
            continue
        n, title, prefix, dirslug = int(m.group(1)), m.group(2), m.group(3), m.group(4)
        key = MODULE_KEYS[n - 1]
        desc = ''
        for line in rest.splitlines():
            if line.strip() and not line.startswith('|') and not line.startswith('**'):
                desc = strip_md(line.strip()); break
        hrs = re.search(r'\*\*Module total: ~(\d+)h\*\*', rest)
        rows = re.findall(r'^\| ([a-z]{3}-\d\d) \| (.+?) \| (.+?) \| (.+?) \| (\d+) \| (\d) \| (\w+) \|', rest, flags=re.M)
        for cid, ctitle, obj, _pre, h, d, vol in rows:
            objectives[cid] = {'objective': strip_md(obj), 'hours': int(h)}
        mods.append({'key': key, 'n': n, 'label': title, 'short': MODULE_SHORT[key],
                     'dir': f'modules/{prefix}-{dirslug}', 'description': desc,
                     'hours': int(hrs.group(1)) if hrs else sum(int(r[4]) for r in rows),
                     'chapters': [r[0] for r in rows]})
    return mods, objectives

MODULES, OBJECTIVES = parse_roadmap()
MODULES.append({'key': 'engineering', 'n': 10, 'label': 'Engineering Reference', 'short': 'Engineering',
                'dir': 'engineering',
                'description': 'Practitioner reference: architectures, pattern catalogs, checklists and templates a working engineer copies from — each cross-linked to the chapters that explain its mechanisms.',
                'hours': 0, 'chapters': [e['id'] for e in MANIFEST['engineering_docs']]})

# ---------------------------------------------------------------- tracks (README "Suggested tracks")

def expand(spec):
    ids = []
    for part in spec:
        m = re.match(r'([a-z]{3})-(\d\d)…(\d\d)$', part)
        if m:
            ids += [f'{m.group(1)}-{i:02d}' for i in range(int(m.group(2)), int(m.group(3)) + 1)]
        else:
            ids.append(part)
    return ids

def module_ids(*keys):
    out = []
    for k in keys:
        out += next(m for m in MODULES if m['key'] == k)['chapters']
    return out

TRACKS = [
    {'id': 'fast', 'name': 'Fast track to productive', 'blurb': 'The shortest path to shipping: APIs, retrieval, a first agent, and the eval habit.',
     'ids': expand(['fnd-01', 'api-01…03', 'rag-01…05', 'agt-01', 'agt-02', 'evl-01…03'])},
    {'id': 'full', 'name': 'Full course', 'blurb': 'Every chapter in roadmap order — the complete curriculum.',
     'ids': [c['id'] for c in MANIFEST['chapters']]},
    {'id': 'systems', 'name': 'Systems specialization', 'blurb': 'Model internals, APIs and production serving, plus the fine-tuning methods that matter for inference.',
     'ids': module_ids('foundations', 'llm-apis', 'production') + ['ftn-02', 'ftn-06']},
    {'id': 'product', 'name': 'Product / agents specialization', 'blurb': 'APIs, retrieval, agents, evaluation and safety — the application layer end to end.',
     'ids': module_ids('llm-apis', 'retrieval', 'agents', 'evaluation', 'safety-security')},
]

# ---------------------------------------------------------------- chapter parsing

def h2_sections(body):
    """Split body at H2; return lede text + [{h, anchor, text, sub:[{h,anchor}]}]. Ignores headings inside code fences."""
    lines = body.split('\n')
    sections, cur, lede, in_fence = [], None, [], False
    for line in lines:
        if line.startswith('```'):
            in_fence = not in_fence
        if not in_fence and line.startswith('## '):
            cur = {'h': line[3:].strip(), 'anchor': slug(line[3:]), 'lines': [], 'sub': []}
            sections.append(cur); continue
        if not in_fence and line.startswith('### ') and cur is not None:
            cur['sub'].append({'h': line[4:].strip(), 'anchor': slug(line[4:])})
        (cur['lines'] if cur else lede).append(line)
    for s in sections:
        s['text'] = '\n'.join(s.pop('lines'))
    return '\n'.join(lede), sections

def section_text(sections, name):
    for s in sections:
        if s['h'].lower() == name.lower():
            return s['text']
    return ''

def numbered_items(text):
    """Top-level '1. ...' items; continuation lines (indented) are folded in."""
    items = []
    for line in text.split('\n'):
        m = re.match(r'^(\d+)\.\s+(.*)$', line)
        if m:
            items.append(m.group(2).strip())
        elif items and line.startswith(('   ', '\t')) and line.strip():
            items[-1] += ' ' + line.strip()
    return items

def bullet_items(text):
    items = []
    for line in text.split('\n'):
        m = re.match(r'^[-*]\s+(.*)$', line)
        if m:
            items.append(m.group(1).strip())
        elif items and line.startswith(('  ', '\t')) and line.strip() and not re.match(r'^\s*[-*]\s', line):
            items[-1] += ' ' + line.strip()
    return items

def table_rows(text):
    rows = []
    for line in text.split('\n'):
        if not line.startswith('|'):
            continue
        cells = [c.strip() for c in re.split(r'(?<!\\)\|', line.strip().strip('|'))]
        cells = [c.replace('\\|', '|') for c in cells]
        if all(re.match(r'^:?-{2,}:?$', c) for c in cells if c) or (cells and cells[0].lower() in ('q', 'question')):
            continue
        if len(cells) >= 2:
            rows.append(cells)
    return rows

def parse_interview(text):
    out = []
    for item in numbered_items(text):
        m = re.match(r'^\*\*(.+?)\*\*\s*(?:[—–-]+\s*)?(?:\*?Model answer:?\*?\s*)?(.*)$', item, flags=re.S)
        if m:
            q = m.group(1).strip().strip('"“”')
            out.append({'q': q, 'a': m.group(2).strip()})
        else:
            out.append({'q': item, 'a': ''})
    return out

def parse_misconceptions(text):
    out = []
    for b in bullet_items(text):
        m = re.match(r'^\*\*(.+?)\*\*\s*(.*)$', b, flags=re.S)
        if m:
            out.append({'claim': m.group(1).strip().strip('"“”'), 'why': m.group(2).strip()})
        else:
            out.append({'claim': b, 'why': ''})
    return out

def parse_exercises(text):
    ex, project = [], []
    mode = None
    for line in text.split('\n'):
        if re.match(r'^\*\*Exercises\*\*', line):
            mode = 'ex'; continue
        if re.match(r'^\*\*(Mini-project|Capstone|Project)', line):
            mode = 'proj'
        if mode == 'proj' and line.strip():
            project.append(line.strip())
        elif mode in (None, 'ex'):
            m = re.match(r'^(\d+)\.\s+(.*)$', line)
            if m:
                ex.append(m.group(2).strip())
            elif ex and line.startswith(('   ', '\t')) and line.strip():
                ex[-1] += ' ' + line.strip()
    return ex, project

def mermaid_blocks(body, sections):
    out = []
    for s in sections:
        for m in re.finditer(r'```mermaid\n(.*?)```', s['text'], flags=re.S):
            src = m.group(1).strip()
            # italic caption on the line(s) immediately before the fence
            before = s['text'][:m.start()].rstrip().split('\n')
            cap = before[-1].strip() if before else ''
            cap = cap[1:-1] if cap.startswith('*') and cap.endswith('*') and len(cap) > 2 else ''
            kind = src.split()[0] if src.split() else 'graph'
            out.append({'section': s['anchor'], 'caption': strip_md(cap), 'kind': kind, 'src': src})
    return out

def parse_doc(entry, kind):
    path = entry['path']
    full = os.path.join(ROOT, path)
    exists = os.path.exists(full) and os.path.getsize(full) > 200
    d = {'id': entry['id'], 'path': path, 'module': entry['module'], 'kind': kind,
         'prereqs': entry.get('prerequisites', []) or [], 'status': entry.get('status', ''), 'exists': exists}
    if not exists:
        d['title'] = re.sub(r'^[a-z]+-\d+-', '', os.path.basename(path)[:-3]).replace('-', ' ')
        return d
    raw = read(path)
    meta, body = split_frontmatter(raw)
    lede, sections = h2_sections(body)
    h1 = re.search(r'^# (.+)$', body, flags=re.M)
    d.update({
        'title': meta.get('title') or (h1.group(1).strip() if h1 else d['id']),
        'related': meta.get('related_ids', []) or [],
        'keywords': meta.get('keywords', []) or [],
        'summary': (meta.get('summary') or '').strip(),
        'difficulty': meta.get('difficulty'),
        'est_minutes': meta.get('est_minutes'),
        'status': meta.get('status', d['status']),
        'volatility': meta.get('volatility'),
        'last_reviewed': str(meta.get('last_reviewed') or ''),
        'sources': len(meta.get('sources') or []),
        'words': words(body),
        'lede': strip_md(re.sub(r'^# .+$', '', lede, flags=re.M)).strip()[:600],
        'sections': [{'h': s['h'], 'anchor': s['anchor'], 'words': words(s['text']),
                      'sub': s['sub'], 'diagrams': s['text'].count('```mermaid'),
                      'code': len(re.findall(r'```(?!mermaid)\w', s['text']))} for s in sections],
        'diagrams': mermaid_blocks(body, sections),
    })
    if kind == 'chapter':
        ex, proj = parse_exercises(section_text(sections, 'Exercises and mini-project'))
        d.update({
            'flashcards': [{'q': r[0], 'a': r[1]} for r in table_rows(section_text(sections, 'Flashcards'))],
            'check': numbered_items(section_text(sections, 'Check your understanding')),
            'interview': parse_interview(section_text(sections, 'Interview questions')),
            'exercises': ex, 'project': proj,
            'revision': bullet_items(section_text(sections, 'Revision summary')),
            'misconceptions': parse_misconceptions(section_text(sections, 'Common misconceptions')),
        })
        if d['id'] in OBJECTIVES:
            d['objective'] = OBJECTIVES[d['id']]['objective']
            d['hours'] = OBJECTIVES[d['id']]['hours']
    return d

# ---------------------------------------------------------------- glossary

def parse_glossary():
    txt = read('glossary.md')
    out = []
    for m in re.finditer(r'^### (.+?)\n+(.+?)(?=\n### |\Z)', txt, flags=re.S | re.M):
        term, para = m.group(1).strip(), m.group(2).strip()
        see = re.search(r'\*See:\s*([^*]+)\*', para)
        defn = re.sub(r'\s*\*See:[^*]+\*\s*$', '', para).strip()
        out.append({'term': term, 'anchor': slug(term), 'def': defn,
                    'see': [x.strip().rstrip('.') for x in see.group(1).split(',')] if see else []})
    return out

# ---------------------------------------------------------------- concept graph (tutor/knowledge-graph.md)

def parse_concepts():
    txt = read('tutor/knowledge-graph.md')
    nodes, edges, groups = {}, [], []
    for sec in re.split(r'^## ', txt, flags=re.M)[1:]:
        head = sec.split('\n', 1)[0].strip()
        blocks = re.findall(r'```mermaid\n(.*?)```', sec, flags=re.S)
        if not blocks:
            continue
        gid = slug(head)
        groups.append({'id': gid, 'label': head})
        for b in blocks:
            for line in b.split('\n'):
                line = line.strip()
                if not line or line.startswith(('graph', 'flowchart', '%%')):
                    continue
                # register node declarations A[label · id]
                for nm in re.finditer(r'([A-Za-z0-9_]+)\[([^\]]+)\]', line):
                    nid, label = nm.group(1), nm.group(2)
                    lm = re.match(r'^(.*?)\s*·\s*([a-z]{3}-\d\d)$', label)
                    nodes.setdefault(nid, {'id': nid, 'label': (lm.group(1) if lm else label).strip(),
                                           'chapter': lm.group(2) if lm else None, 'group': gid})
                em = re.match(r'^([A-Za-z0-9_]+)(?:\[[^\]]*\])?\s*-->\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)', line)
                if em:
                    edges.append({'s': em.group(1), 't': em.group(2), 'group': gid})
    return {'groups': groups, 'nodes': list(nodes.values()), 'edges': edges}

# ---------------------------------------------------------------- assemble

def build():
    chapters = [parse_doc(e, 'chapter') for e in MANIFEST['chapters']]
    eng = [parse_doc(e, 'eng') for e in MANIFEST['engineering_docs']]
    tut = [parse_doc(e, 'tutor') for e in MANIFEST.get('tutor_docs', [])]
    # forward map: who depends on me
    dependents = {}
    for c in chapters + eng:
        for p in c['prereqs']:
            dependents.setdefault(p, []).append(c['id'])
    for c in chapters + eng:
        c['dependents'] = dependents.get(c['id'], [])
    files = {}
    for dp, _, fns in os.walk(ROOT):
        for fn in fns:
            if fn.endswith('.md'):
                rel = os.path.relpath(os.path.join(dp, fn), ROOT)
                if not rel.startswith('.') and not rel.startswith('node_modules'):
                    files[rel] = os.path.getsize(os.path.join(dp, fn))
    data = {
        'spec_version': MANIFEST.get('spec_version', 3),
        'modules': MODULES,
        'tracks': TRACKS,
        'chapters': chapters,
        'engineering': eng,
        'tutor': tut,
        'glossary': parse_glossary(),
        'concepts': parse_concepts(),
        'files': dict(sorted(files.items())),
        'stats': {
            'chapters': len(chapters), 'written': sum(1 for c in chapters if c['exists']),
            'engineering': len(eng), 'words': sum(c.get('words', 0) for c in chapters + eng),
            'flashcards': sum(len(c.get('flashcards', [])) for c in chapters),
            'questions': sum(len(c.get('check', [])) + len(c.get('interview', [])) for c in chapters),
            'diagrams': sum(len(c.get('diagrams', [])) for c in chapters + eng + tut),
            'hours': sum(c.get('hours', 0) for c in chapters),
        },
    }
    return data, files

def main():
    data, files = build()
    txt = json.dumps(data, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    files_txt = '{\n' + ',\n'.join(f'"{k}": {v}' for k, v in sorted(files.items())) + '\n}\n'
    if '--check' in sys.argv:
        stale = []
        if not os.path.exists(OUT) or open(OUT, encoding='utf-8').read() != txt:
            stale.append(OUT)
        if not os.path.exists(FILES_JSON) or open(FILES_JSON, encoding='utf-8').read() != files_txt:
            stale.append(FILES_JSON)
        if stale:
            print('STALE — regenerate with: python3 scripts/build-content.py')
            for s in stale: print('  ', os.path.relpath(s, ROOT))
            sys.exit(1)
        print('content index up to date'); return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(txt)
    with open(FILES_JSON, 'w', encoding='utf-8') as f:
        f.write(files_txt)
    s = data['stats']
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({len(txt)//1024} KB): "
          f"{s['written']}/{s['chapters']} chapters, {s['engineering']} eng docs, "
          f"{s['flashcards']} flashcards, {s['questions']} questions, {s['diagrams']} diagrams, "
          f"{len(data['glossary'])} glossary terms, {len(data['concepts']['nodes'])} concept nodes")
    # sanity report: chapters with empty derived sections
    for c in data['chapters']:
        if not c['exists']: continue
        missing = [k for k in ('flashcards', 'check', 'interview', 'exercises', 'revision', 'misconceptions') if not c.get(k)]
        if missing: print(f"  warn {c['id']}: empty {missing}")
        bad = [q for q in c['interview'] if not q['a']]
        if bad: print(f"  warn {c['id']}: {len(bad)} interview items without parsed answer")

if __name__ == '__main__':
    main()
