/* Interactive diagrams.
   Mermaid still draws every diagram from the chapter's own source. This module then asks
   Mermaid's parser for its model of that same source — node labels and shapes, edges and
   their labels, state transitions, sequence messages, timeline tasks — maps it onto the
   rendered SVG, and derives every interaction from it. Nothing shown in a panel is written
   separately from the chapter: labels are verbatim, structure is computed, and "in the text"
   excerpts are quoted sentences from the page itself. */
import mermaid from 'mermaid';
import { esc, $$ } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const MARKS = ['x-cur', 'x-up', 'x-down', 'x-seen', 'x-opt', 'x-done'];
const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = new Set();
let seq = 0, queue = Promise.resolve();
/** Mermaid's diagram databases are module singletons, so render + model read must not interleave. */
const serial = fn => (queue = queue.then(fn, fn));

const ICON = {
  first: '<svg viewBox="0 0 16 16"><path d="M3 3h2v10H3zM13 3 6 8l7 5z"/></svg>',
  prev: '<svg viewBox="0 0 16 16"><path d="M11 3 4 8l7 5z"/></svg>',
  play: '<svg viewBox="0 0 16 16"><path d="M5 3l8 5-8 5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M5 3h2v10H5zM9 3h2v10H9z"/></svg>',
  next: '<svg viewBox="0 0 16 16"><path d="M5 3l7 5-7 5z"/></svg>',
  last: '<svg viewBox="0 0 16 16"><path d="M11 3h2v10h-2zM3 3l7 5-7 5z"/></svg>',
  rot: '<svg viewBox="0 0 16 16"><path d="M3 8a5 5 0 0 1 8.6-3.5M13 8a5 5 0 0 1-8.6 3.5M12 1.5v3H9M4 14.5v-3h3"/></svg>',
  full: '<svg viewBox="0 0 16 16"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>',
  shrink: '<svg viewBox="0 0 16 16"><path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4"/></svg>',
};

/* ================================================================ mount */

/** Replace every `.mermaid-src` placeholder under root with an interactive figure.
    opts: { onNavigate(id), lookup(id) → chapter|undefined, article: Element for "in the text" } */
export async function mountDiagrams(root, opts = {}) {
  for (const d of [...live]) if (!d.fig.isConnected) { d.ac.abort(); live.delete(d); }
  for (const el of $$('.mermaid-src', root)) await mountOne(el, opts);
}

async function mountOne(el, opts) {
  const src = el.dataset.src;
  const capEl = el.previousElementSibling?.classList.contains('capwrap') ? el.previousElementSibling : null;
  const fig = document.createElement('figure');
  fig.className = 'diagram ix';
  fig.innerHTML = `<header class="dhead"><span class="dk">diagram</span><span class="dt">${esc(capEl ? capEl.textContent : '')}</span><div class="dseg" role="tablist" hidden></div></header>
    <div class="dstage"><div class="dwrap"><div class="dload"><i></i><i></i><i></i></div></div>
      <div class="dtools"><button type="button" data-rot hidden aria-label="Rotate layout" title="Rotate layout">${ICON.rot}</button><button type="button" data-z="-" aria-label="Zoom out">−</button><button type="button" data-z="0" aria-label="Fit to view">fit</button><button type="button" data-z="+" aria-label="Zoom in">+</button><button type="button" data-full aria-label="Fullscreen">${ICON.full}</button></div>
      <div class="dhint">drag to pan · ctrl + scroll to zoom</div></div>
    <div class="dpanel" aria-live="polite"></div>`;
  el.replaceWith(fig); capEl?.remove();
  const ac = new AbortController();
  const D = { fig, wrap: fig.querySelector('.dwrap'), src, opts, ac, signal: ac.signal, mode: null, parts: [], raf: 0, timer: 0, rotated: false };
  let first;
  try { first = await renderSvg(src, true); } catch (e) {
    fig.classList.add('err');
    fig.querySelector('.dstage').innerHTML = `<pre>${esc(src)}</pre>`;
    fig.querySelector('.dt').textContent = 'Diagram source (render failed)';
    fig.querySelector('.dpanel').remove();
    return;
  }
  if (!fig.isConnected) return;
  D.model = first.model;
  live.add(D); fig.__dx = D;
  place(D, first.svg);
  // Long left-to-right chains (or very tall trees) shrink to unreadable text in a reading
  // column. Mermaid lays the same nodes and edges out in the other direction, and the
  // rotated layout is used only when it is markedly larger; the toolbar restores the original.
  const alt = rotatedSrc(src);
  if (alt) {
    const rot = D.fig.querySelector('[data-rot]'); rot.hidden = false;
    const k0 = fitK(D, D.W, D.H);
    if (k0 < .62) {
      try {
        const r = await renderSvg(alt, false), vb = vbOf(r.svg);
        if (vb && fitK(D, vb.w, vb.h) > k0 * 1.18) { place(D, r.svg); D.rotated = true; D.altSvg = first.svg; }
        else D.altSvg = r.svg;
      } catch (e) { /* keep the authored layout */ }
    }
    rot.onclick = () => rotate(D, alt);
  }
  D.cam = camera(D);
  hint(D);
  if (D.model && D.model.type !== 'other') {
    try { bind(D); setup(D); } catch (e) { console.warn('diagram bind', e); D.model = null; }
  }
  if (!D.model || D.model.type === 'other') {
    fig.querySelector('.dk').textContent = kindWord(src); fig.querySelector('.dseg').hidden = true; fig.querySelector('.dpanel').remove();
  }
}

function renderSvg(src, withModel) {
  const id = 'mm-' + (++seq);
  return serial(async () => {
    try {
      const { svg } = await mermaid.render(id, src);
      let model = null;
      if (withModel) try { model = await readModel(src); } catch (e) { console.warn('diagram model', e); }
      return { svg, model };
    } catch (e) { document.getElementById('d' + id)?.remove(); throw e; }
  });
}
function vbOf(svgText) {
  const m = svgText.match(/viewBox="\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([\d.e]+)[\s,]+([\d.e]+)\s*"/);
  return m ? { w: +m[3], h: +m[4] } : null;
}
function place(D, svgText) {
  D.wrap.innerHTML = svgText;
  const svg = D.wrap.querySelector('svg');
  svg.removeAttribute('height'); svg.style.maxWidth = 'none';
  const vb = svg.viewBox?.baseVal;
  D.W = vb?.width || svg.getBBox().width; D.H = vb?.height || svg.getBBox().height;
  svg.setAttribute('width', D.W); svg.setAttribute('height', D.H);
  D.svg = svg;
}
const maxH = () => Math.round(Math.max(380, Math.min(700, innerHeight * .72)));
function fitK(D, w, h) {
  const cw = D.wrap.clientWidth || D.fig.clientWidth || 700;
  return Math.min(1, (cw - 24) / w, (maxH() - 24) / h);
}
/** The same diagram source with its layout direction turned 90°; null where that does not apply. */
function rotatedSrc(src) {
  const lines = src.split('\n'), i = lines.findIndex(l => l.trim());
  const head = lines[i] || '';
  const fm = head.match(/^(\s*(?:graph|flowchart))(?:\s+(TD|TB|BT|LR|RL))?\s*$/);
  if (fm) { lines[i] = fm[1] + ' ' + (/LR|RL/.test(fm[2] || 'TD') ? 'TD' : 'LR'); return lines.join('\n'); }
  if (/^\s*stateDiagram(-v2)?\s*$/.test(head)) {
    const d = lines.findIndex(l => /^\s*direction\s+(LR|RL|TB|BT)\s*$/.test(l));
    if (d > -1) lines[d] = lines[d].replace(/(LR|RL|TB|BT)/, m => (/LR|RL/.test(m) ? 'TB' : 'LR'));
    else lines.splice(i + 1, 0, '  direction LR');
    return lines.join('\n');
  }
  return null;
}
async function rotate(D, alt) {
  if (!D.altSvg) { try { D.altSvg = (await renderSvg(D.rotated ? D.src : alt, false)).svg; } catch (e) { return; } }
  const next = D.altSvg; D.altSvg = D.svg.outerHTML;
  stopParticles(D); stopTimers(D);
  place(D, next); D.rotated = !D.rotated;
  hint(D);
  bind(D); attach(D); D.cam.fit();
  // re-apply the current view on the new drawing
  if (D.mode === 'explore') { if (D.sel) select(D, D.sel); else overview(D); }
  else if (D.mode === 'walk') { if (D.path?.length) walkRender(D); else walkStart(D); }
}
function hint(D) {
  D.fig.querySelector('.dhint').textContent = D.rotated ? 'layout rotated to fit · ⟲ restores the original' : 'drag to pan · ctrl + scroll to zoom';
  D.fig.querySelector('[data-rot]').classList.toggle('on', D.rotated);
}

/** Kind and size of a diagram from Mermaid's parse alone (no rendering) — for listings. */
export async function describe(src) {
  try {
    const m = await serial(() => readModel(src));
    if (m.type === 'seq') return { kind: 'sequence', facts: `${m.msgs.length} messages · ${m.actors.length} participants` };
    if (m.type === 'gantt') return { kind: 'timeline', facts: `${m.tasks.length} tasks · ${m.lanes.length} lanes` };
    if (m.type === 'state') return { kind: KIND_WORD(m), facts: `${[...m.nodes.values()].filter(n => n.kind === 'state').length} states · ${m.edges.length} transitions` };
    if (m.type === 'flow') return { kind: KIND_WORD(m), facts: `${[...m.nodes.values()].filter(n => n.kind !== 'group').length} nodes${m.decisions.length ? ` · ${m.decisions.length} decision${m.decisions.length > 1 ? 's' : ''}` : ''}` };
  } catch (e) { /* fall through */ }
  return { kind: kindWord(src), facts: '' };
}
function kindWord(src) {
  const k = src.trim().split(/\s+/)[0];
  return { graph: 'flow', flowchart: 'flow', 'stateDiagram-v2': 'state machine', stateDiagram: 'state machine', sequenceDiagram: 'sequence', gantt: 'timeline' }[k] || k;
}

/* ================================================================ model (from Mermaid's parser) */

function clean(s) {
  if (s == null) return '';
  if (Array.isArray(s)) s = s.join(' ');
  s = String(s).replace(/<br\s*\/?>/gi, ' ');
  if (/[<&]/.test(s)) s = new DOMParser().parseFromString(s, 'text/html').body.textContent;
  return s.replace(/\s+/g, ' ').trim().replace(/^"(.*)"$/, '$1');
}
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

async function readModel(src) {
  const d = await mermaid.mermaidAPI.getDiagramFromText(src);
  const db = d.db, t = d.type;
  if (/^flowchart|^graph/.test(t)) return graphOf(flowModel(db));
  if (/^stateDiagram/.test(t)) return graphOf(stateModel(db));
  if (t === 'sequence') return seqModel(db);
  if (t === 'gantt') return ganttModel(db);
  return { type: 'other' };
}

function flowModel(db) {
  const V = db.getVertices(), vs = V instanceof Map ? [...V.values()] : Object.values(V);
  const nodes = new Map();
  for (const v of vs) nodes.set(v.id, { id: v.id, label: clean(v.text ?? v.id) || v.id, shape: v.type || 'square' });
  const groups = (db.getSubGraphs() || []).map(g => ({ id: g.id, title: clean(g.title), nodes: [...(g.nodes || [])] }));
  for (const g of groups) for (const n of g.nodes) { const x = nodes.get(n); if (x && !x.group) x.group = g.title; }
  const edges = db.getEdges().map((e, i) => ({ i, from: e.start, to: e.end, label: clean(e.text), dotted: e.stroke === 'dotted' }));
  for (const e of edges) for (const id of [e.from, e.to]) if (!nodes.has(id)) {
    const g = groups.find(x => x.id === id);
    nodes.set(id, { id, label: g ? g.title : id, shape: 'group' });
  }
  return { type: 'flow', nodes, edges, groups };
}

function stateModel(db) {
  const nodes = new Map(), edges = [], notes = new Map();
  const add = s => {
    if (nodes.has(s.id)) return;
    const shape = s.id === 'root_start' ? 'start' : s.id === 'root_end' ? 'end' : 'state';
    nodes.set(s.id, { id: s.id, shape, label: shape === 'start' ? 'Start' : shape === 'end' ? 'End' : (clean(s.description) || s.id) });
  };
  const walk = doc => {
    for (const st of doc || []) {
      if (st.stmt === 'relation') { add(st.state1); add(st.state2); edges.push({ i: edges.length, from: st.state1.id, to: st.state2.id, label: clean(st.description) }); }
      else if (st.stmt === 'state') { add(st); if (st.note) notes.set(st.id, clean(st.note.text)); if (st.doc) walk(st.doc); }
    }
  };
  walk(db.getRootDocV2().doc);
  for (const [id, text] of notes) if (nodes.has(id)) nodes.get(id).note = text;
  return { type: 'state', nodes, edges, groups: [] };
}

/** Adjacency, roles and summary facts — all computed from the parsed structure. */
function graphOf(m) {
  m.out = new Map(); m.inn = new Map();
  for (const id of m.nodes.keys()) { m.out.set(id, []); m.inn.set(id, []); }
  for (const e of m.edges) { m.out.get(e.from).push(e); m.inn.get(e.to).push(e); }
  for (const n of m.nodes.values()) {
    const outs = m.out.get(n.id).length;
    n.kind = n.shape === 'diamond' ? 'decision' : n.shape === 'cylinder' ? 'store' : n.shape === 'start' ? 'start' : n.shape === 'end' ? 'end'
      : n.shape === 'group' ? 'group' : m.type === 'state' ? 'state' : outs === 0 ? 'outcome' : 'step';
  }
  m.decisions = [...m.nodes.values()].filter(n => n.kind === 'decision' && m.out.get(n.id).length >= 2);
  m.sources = [...m.nodes.values()].filter(n => n.kind !== 'group' && !m.inn.get(n.id).some(e => !e.dotted && e.from !== n.id)).map(n => n.id);
  if (m.type === 'state') m.sources = m.nodes.has('root_start') ? ['root_start'] : [m.nodes.keys().next().value];
  m.hasLoop = hasCycle(m);
  if (m.type === 'flow') {
    const root = m.nodes.get(m.sources[0]);
    m.isTree = m.sources.length > 0 && (m.decisions.length >= 2 || (root?.kind === 'decision' && m.out.get(root.id).length >= 2));
    for (const n of m.nodes.values()) if (n.kind === 'outcome' && !m.decisions.length) n.kind = 'end';
  }
  return m;
}
function hasCycle(m) {
  const state = new Map();
  const dfs = id => {
    state.set(id, 1);
    for (const e of m.out.get(id) || []) {
      const s = state.get(e.to);
      if (s === 1 || (!s && dfs(e.to))) return true;
    }
    state.set(id, 2); return false;
  };
  for (const id of m.nodes.keys()) if (!state.get(id) && dfs(id)) return true;
  return false;
}

function seqModel(db) {
  const A = db.getActors(), keys = db.getActorKeys ? db.getActorKeys() : (A instanceof Map ? [...A.keys()] : Object.keys(A));
  const get = k => (A instanceof Map ? A.get(k) : A[k]);
  const actors = keys.map(k => ({ id: k, label: clean(get(k)?.description || k) || k }));
  // Mermaid LINETYPE values that draw an arrow between participants
  const ARROWS = new Set([0, 1, 3, 4, 5, 6, 24, 25, 33, 34]);
  const msgs = db.getMessages().filter(x => ARROWS.has(x.type) && x.from && x.to)
    .map((x, i) => ({ i, from: x.from, to: x.to, label: clean(x.message), self: x.from === x.to }));
  return { type: 'seq', actors, msgs };
}

function ganttModel(db) {
  const fmt = (db.getDateFormat?.() || '').trim();
  const unit = fmt === 'X' ? 1000 : fmt === 'x' ? 1 : 0;
  const tasks = db.getTasks().map((t, i) => ({ i, id: t.id, section: clean(t.section), label: clean(t.task), s: +new Date(t.startTime), e: +new Date(t.renderEndTime || t.endTime) }));
  return { type: 'gantt', tasks, lanes: [...new Set(tasks.map(t => t.section))], unit, title: clean(db.getDiagramTitle?.()) };
}

/* ================================================================ bind model → SVG */

function bind(D) {
  const { svg, model: m } = D;
  if (m.type === 'flow' || m.type === 'state') {
    const els = new Map();
    for (const g of $$('g.node', svg)) if (g.dataset.id) els.set(g.dataset.id, g);
    for (const g of $$('g.cluster', svg)) if (g.id && !els.has(g.id)) els.set(g.id, g);
    for (const n of m.nodes.values()) n.el = els.get(n.id) || null;
    if (m.type === 'flow') {
      const paths = $$('path.flowchart-link', svg), used = new Set();
      for (const e of m.edges) {
        const p = paths.find(x => !used.has(x) && x.classList.contains('LS-' + e.from) && x.classList.contains('LE-' + e.to));
        if (p) { used.add(p); e.el = p; }
      }
    } else {
      // state edges are emitted in relation order; note connectors are interleaved and skipped
      const paths = $$('path.transition', svg).filter(p => !p.classList.contains('note-edge'));
      if (paths.length === m.edges.length) m.edges.forEach((e, i) => { e.el = paths[i]; });
      if (!m.edges.every(e => e.el && endsMatch(D, e))) matchByGeometry(D, paths);
    }
    bindLabels(D);
  } else if (m.type === 'seq') {
    const texts = $$('text.messageText', svg), lines = $$('[class*="messageLine"]', svg);
    if (texts.length === m.msgs.length) m.msgs.forEach((x, i) => { x.textEl = texts[i]; x.el = lines[i]; });
    const rects = $$('rect.actor', svg).filter(r => !r.classList.contains('actor-bottom'));
    const lifelines = $$('line[id^="actor"]', svg);
    m.actors.forEach((a, i) => { a.el = rects[i]?.parentNode || null; a.line = lifelines[i] || null; });
  } else if (m.type === 'gantt') {
    const rects = $$('rect.task', svg);
    m.tasks.forEach((t, i) => {
      t.el = svg.querySelector(`rect[id="${CSS.escape(t.id)}"]`) || rects[i] || null;
      t.textEl = svg.querySelector(`text[id="${CSS.escape(t.id)}-text"]`);
    });
  }
}

/** A box in the SVG's viewport pixels (before the camera's CSS transform). */
function rootBox(D, el) {
  const b = el.getBBox(), m = el.getCTM();
  if (!m) return { x: b.x, y: b.y, w: b.width, h: b.height };
  const a = new DOMPoint(b.x, b.y).matrixTransform(m), c = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(m);
  return { x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), w: Math.abs(c.x - a.x), h: Math.abs(c.y - a.y) };
}
function rootPoint(D, el, f) {
  let p;
  if (el.tagName === 'line') {
    const g = k => +el.getAttribute(k);
    p = new DOMPoint(g('x1') + (g('x2') - g('x1')) * f, g('y1') + (g('y2') - g('y1')) * f);
  } else p = el.getPointAtLength(el.getTotalLength() * f);
  const m = el.getCTM();
  return m ? new DOMPoint(p.x, p.y).matrixTransform(m) : p;
}
const boxDist = (p, b) => Math.hypot(Math.max(b.x - p.x, 0, p.x - b.x - b.w), Math.max(b.y - p.y, 0, p.y - b.y - b.h));
function endsMatch(D, e) {
  const a = D.model.nodes.get(e.from)?.el, b = D.model.nodes.get(e.to)?.el;
  if (!a || !b) return false;
  return boxDist(rootPoint(D, e.el, 0), rootBox(D, a)) < 26 && boxDist(rootPoint(D, e.el, 1), rootBox(D, b)) < 26;
}
function matchByGeometry(D, paths) {
  const m = D.model, boxes = [...m.nodes.values()].filter(n => n.el).map(n => [n.id, rootBox(D, n.el)]);
  const near = p => boxes.reduce((best, [id, b]) => { const d = boxDist(p, b); return d < best[1] ? [id, d] : best; }, [null, Infinity])[0];
  const ends = paths.map(p => ({ p, from: near(rootPoint(D, p, 0)), to: near(rootPoint(D, p, 1)) }));
  const used = new Set();
  for (const e of m.edges) {
    e.el = null;
    const hit = ends.find(x => !used.has(x) && x.from === e.from && x.to === e.to);
    if (hit) { used.add(hit); e.el = hit.p; }
  }
}
/** Edge labels carry no id in Mermaid's output: pair each labelled edge with the
    nearest unused label of the same text. */
function bindLabels(D) {
  const labs = $$('g.edgeLabel', D.svg).map(g => ({ g, t: norm(g.textContent) })).filter(x => x.t);
  for (const l of labs) l.b = rootBox(D, l.g);
  const used = new Set();
  for (const e of D.model.edges) {
    if (!e.label || !e.el) continue;
    const mid = rootPoint(D, e.el, .5), t = norm(e.label);
    let best = null, bd = Infinity;
    for (const l of labs) if (!used.has(l) && l.t === t) { const d = boxDist(mid, l.b); if (d < bd) { bd = d; best = l; } }
    if (best) { used.add(best); e.lab = best.g; }
  }
}

/* ================================================================ camera: pan, zoom, pinch, reveal */

function camera(D) {
  const { fig, wrap, signal } = D;
  const st = { k: 1, tx: 0, ty: 0, user: false };
  const full = () => fig.classList.contains('full');
  const apply = glide => { D.svg.classList.toggle('glide', !!glide); D.svg.style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.k})`; };
  const fit = () => {
    const W = D.W, H = D.H, cw = wrap.clientWidth || fig.clientWidth, ch = full() ? wrap.clientHeight : Math.min(H, maxH());
    if (cw < 40) return;
    st.k = Math.min(full() ? 1.6 : 1, (cw - 24) / W, (ch - 24) / H);
    st.tx = Math.max(12, (cw - W * st.k) / 2);
    st.ty = full() ? Math.max(12, (ch - H * st.k) / 2) : 12;
    wrap.style.height = full() ? '' : Math.min(H * st.k, maxH()) + 24 + 'px';
    st.user = false; st.auto = false; apply();
  };
  const zoom = (f, cx, cy) => {
    const nk = Math.min(6, Math.max(.15, st.k * f)), r = wrap.getBoundingClientRect();
    cx = cx ?? r.width / 2; cy = cy ?? r.height / 2;
    st.tx = cx - (cx - st.tx) * (nk / st.k); st.ty = cy - (cy - st.ty) * (nk / st.k); st.k = nk; st.user = true; apply();
  };
  const fitK_ = () => Math.min(full() ? 1.6 : 1, ((wrap.clientWidth || fig.clientWidth) - 24) / D.W, ((full() ? wrap.clientHeight : Math.min(D.H, maxH())) - 24) / D.H);
  /** Pan so a box (svg viewport px) is on screen — only when it is not already, and never
      while the whole fitted drawing is visible. */
  const reveal = b => {
    if (!b) return;
    const cw = wrap.clientWidth, ch = wrap.clientHeight, M = 6;
    if (st.tx >= 0 && st.ty >= 0 && st.tx + D.W * st.k <= cw + 1 && st.ty + D.H * st.k <= ch + 1) return;
    const x1 = st.tx + b.x * st.k, y1 = st.ty + b.y * st.k, x2 = x1 + b.w * st.k, y2 = y1 + b.h * st.k;
    if (x1 >= M && y1 >= M && x2 <= cw - M && y2 <= ch - M) return;
    st.tx += cw / 2 - (x1 + x2) / 2; st.ty += ch / 2 - (y1 + y2) / 2; apply(motionOK());
  };
  /** Walk/play: when the fitted drawing is too small to read, zoom in and follow the current step. */
  const follow = b => {
    if (!b) return;
    if (fitK_() >= .55 && !st.auto) return reveal(b);
    if (fitK_() >= .55) { fit(); return; }
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    st.k = Math.max(st.k, .85);
    st.tx = cw / 2 - (b.x + b.w / 2) * st.k; st.ty = ch / 2 - (b.y + b.h / 2) * st.k;
    st.user = true; st.auto = true; apply(motionOK());
  };
  const tool = fig.querySelector('.dtools');
  tool.querySelector('[data-z="+"]').onclick = () => zoom(1.25);
  tool.querySelector('[data-z="-"]').onclick = () => zoom(.8);
  tool.querySelector('[data-z="0"]').onclick = fit;
  const fsBtn = tool.querySelector('[data-full]');
  const setFull = on => {
    fig.classList.toggle('full', on);
    fsBtn.innerHTML = on ? ICON.shrink : ICON.full; fsBtn.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
    requestAnimationFrame(fit);
  };
  fsBtn.onclick = () => setFull(!full());
  D.setFull = setFull;
  addEventListener('keydown', e => { if (e.key === 'Escape' && full()) { e.stopPropagation(); setFull(false); } }, { signal, capture: true });

  wrap.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey || full())) return;
    e.preventDefault(); const r = wrap.getBoundingClientRect();
    zoom(e.deltaY < 0 ? 1.12 : .89, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false, signal });
  const pts = new Map(); let drag = null, pinch = null;
  wrap.addEventListener('pointerdown', e => {
    if (e.button) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) drag = { id: e.pointerId, ox: e.clientX - st.tx, oy: e.clientY - st.ty, sx: e.clientX, sy: e.clientY, moved: false };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: st.k }; drag = null; }
  }, { signal });
  wrap.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()], r = wrap.getBoundingClientRect();
      zoom(pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d / st.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) { drag.moved = true; wrap.setPointerCapture(e.pointerId); wrap.classList.add('grabbing'); }
    if (drag.moved) { st.tx = e.clientX - drag.ox; st.ty = e.clientY - drag.oy; st.user = true; apply(); }
  }, { signal });
  const end = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (drag?.moved) { D.suppressClick = true; setTimeout(() => { D.suppressClick = false; }, 0); }
    if (drag && drag.id === e.pointerId) drag = null;
    wrap.classList.remove('grabbing');
  };
  wrap.addEventListener('pointerup', end, { signal });
  wrap.addEventListener('pointercancel', end, { signal });
  wrap.addEventListener('click', e => { if (D.suppressClick) { e.stopPropagation(); e.preventDefault(); } }, { capture: true, signal });
  const ro = new ResizeObserver(() => { if (!drag && !st.user) fit(); });
  ro.observe(wrap); signal.addEventListener('abort', () => ro.disconnect());
  requestAnimationFrame(fit);
  return { fit, reveal, follow, st };
}

/* ================================================================ marks + particles */

function clearMarks(D) {
  D.svg.classList.remove('dim');
  for (const el of D.svg.querySelectorAll(MARKS.map(c => '.' + c).join(','))) el.classList.remove(...MARKS);
}
const markEl = (el, c) => el && el.classList.add(c);
function markNode(D, id, c) { const n = D.model.nodes.get(id); if (n) markEl(n.el, c); }
function markEdge(e, c) { markEl(e.el, c); markEl(e.lab, c); }

/** One rAF loop per figure drives every moving dot. */
function particle(D, el, { dur = 900, delay = 0, period = 0, cls = '' } = {}) {
  if (!el || !motionOK()) return;
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('r', cls.includes('big') ? 5.5 : 4); c.setAttribute('class', 'x-part ' + cls); c.style.opacity = 0;
  el.parentNode.appendChild(c);
  const isLine = el.tagName === 'line', L = isLine ? 0 : el.getTotalLength();
  const at = f => {
    if (!isLine) return el.getPointAtLength(f * L);
    const g = k => +el.getAttribute(k); return { x: g('x1') + (g('x2') - g('x1')) * f, y: g('y1') + (g('y2') - g('y1')) * f };
  };
  D.parts.push({ c, at, dur, delay, period, t0: null });
  if (!D.raf) D.raf = requestAnimationFrame(ts => tick(D, ts));
}
function tick(D, ts) {
  if (!D.fig.isConnected) { stopParticles(D); return; }
  D.parts = D.parts.filter(p => {
    if (p.t0 === null) p.t0 = ts + p.delay;
    let t = ts - p.t0;
    if (t < 0) return true;
    if (p.period) t %= p.period; else if (t > p.dur) { p.c.remove(); return false; }
    if (t > p.dur) { p.c.style.opacity = 0; return true; }
    const f = t / p.dur, e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2, pt = p.at(e);
    p.c.setAttribute('cx', pt.x); p.c.setAttribute('cy', pt.y);
    p.c.style.opacity = f < .12 ? f / .12 : f > .88 ? (1 - f) / .12 : 1;
    return true;
  });
  D.raf = D.parts.length ? requestAnimationFrame(t => tick(D, t)) : 0;
}
function stopParticles(D) {
  cancelAnimationFrame(D.raf); D.raf = 0;
  for (const p of D.parts) p.c.remove();
  D.parts = [];
}
function stopTimers(D) { clearTimeout(D.timer); D.timer = 0; cancelAnimationFrame(D.playRaf); D.playRaf = 0; }

/* ================================================================ figure setup + modes */

const KIND_WORD = m => m.type === 'seq' ? 'sequence' : m.type === 'gantt' ? 'timeline' : m.type === 'state' ? 'state machine'
  : m.isTree ? 'decision tree' : m.hasLoop ? 'feedback loop' : 'flow';

function setup(D) {
  const m = D.model, fig = D.fig;
  fig.dataset.kind = m.type;
  fig.querySelector('.dk').textContent = KIND_WORD(m);
  const modes = m.type === 'seq' || m.type === 'gantt' ? [['play', 'Play']]
    : [['explore', 'Explore'], ['walk', m.type === 'state' ? 'Simulate' : m.isTree ? 'Decide' : 'Step through']];
  D.walkWord = modes[1]?.[1];
  const seg = fig.querySelector('.dseg');
  if (modes.length > 1) {
    seg.hidden = false;
    seg.innerHTML = modes.map(([k, t]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="false">${t}</button>`).join('');
    seg.onclick = e => { const b = e.target.closest('[data-mode]'); if (b) setMode(D, b.dataset.mode); };
  }
  attach(D);
  fig.addEventListener('keydown', e => keys(D, e), { signal: D.signal });
  setMode(D, modes[0][0]);
}

function setMode(D, mode) {
  stopTimers(D); stopParticles(D); clearMarks(D);
  if (D.cam.st.auto) D.cam.fit();
  D.svg.classList.remove('x-flowing');
  D.mode = mode; D.sel = null;
  for (const b of D.fig.querySelectorAll('.dseg [data-mode]')) b.setAttribute('aria-selected', String(b.dataset.mode === mode));
  D.fig.dataset.mode = mode;
  if (mode === 'explore') overview(D);
  else if (mode === 'walk') walkStart(D);
  else if (D.model.type === 'seq') seqStep(D, -1);
  else ganttStep(D, -1);
}

function keys(D, e) {
  if (e.target.closest('input, textarea')) return;
  if (D.mode === 'walk') {
    if (/^[1-9]$/.test(e.key)) { const b = D.fig.querySelectorAll('.dw-opt')[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } }
    else if (e.key === 'Backspace' || (e.key === 'ArrowLeft' && !e.target.closest('g.node'))) { e.preventDefault(); walkBack(D); }
  } else if (D.mode === 'play') {
    if (e.key === 'ArrowRight') { e.preventDefault(); D.step(D.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); D.step(D.i - 1); }
    else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); D.toggle(); }
  } else if (D.mode === 'explore' && e.key === 'Escape' && D.sel && !D.fig.classList.contains('full')) select(D, null);
}

/** Listeners on the current drawing (re-run after the layout is rotated). */
function attach(D) {
  const { signal } = D;
  D.svg.addEventListener('click', e => { if (D.mode === 'explore' && !e.target.closest('g.node') && D.sel) select(D, null); }, { signal });
  if (D.model.type !== 'flow' && D.model.type !== 'state') return;
  for (const n of D.model.nodes.values()) {
    const el = n.el; if (!el || n.kind === 'group') continue;
    el.classList.add('x-node', 'k-' + n.kind);
    if (refsIn(D, n.label).length) el.classList.add('x-ref');
    el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');
    el.setAttribute('aria-label', n.label);
    el.addEventListener('mouseenter', () => { if (D.mode === 'explore' && !D.sel) lineage(D, n.id); }, { signal });
    el.addEventListener('mouseleave', () => { if (D.mode === 'explore' && !D.sel) clearMarks(D); }, { signal });
    el.addEventListener('focus', () => { if (D.mode === 'explore' && !D.sel) lineage(D, n.id); }, { signal });
    el.addEventListener('blur', () => { if (D.mode === 'explore' && !D.sel) clearMarks(D); }, { signal });
    const act = () => {
      if (D.mode === 'explore') select(D, D.sel === n.id ? null : n.id);
      else if (D.mode === 'walk') { const opt = (D.opts_ || []).findIndex(o => o.to === n.id); if (opt >= 0) walkChoose(D, D.opts_[opt]); }
    };
    el.addEventListener('click', e => { e.stopPropagation(); act(); }, { signal });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }, { signal });
  }
}

/* ---------------- explore ---------------- */

function reach(m, id, dir) {
  const seen = new Set(), q = [id];
  while (q.length) for (const e of m[dir].get(q.shift()) || []) {
    const nx = dir === 'out' ? e.to : e.from;
    if (!seen.has(nx)) { seen.add(nx); q.push(nx); }
  }
  seen.delete(id); return seen;
}
function lineage(D, id) {
  const m = D.model; clearMarks(D);
  const up = reach(m, id, 'inn'), down = reach(m, id, 'out');
  D.svg.classList.add('dim');
  markNode(D, id, 'x-cur');
  for (const x of up) markNode(D, x, 'x-up');
  for (const x of down) markNode(D, x, 'x-down');
  for (const e of m.edges) {
    if ((e.to === id || up.has(e.to)) && up.has(e.from)) markEdge(e, 'x-up');
    if ((e.from === id || down.has(e.from)) && down.has(e.to)) markEdge(e, 'x-down');
    if (e.from === id && e.to === id) markEdge(e, 'x-down');
  }
  return { up, down };
}

function overview(D) {
  const m = D.model, panel = D.fig.querySelector('.dpanel');
  const nodes = [...m.nodes.values()].filter(n => n.kind !== 'group');
  const facts = m.type === 'state'
    ? [`${nodes.filter(n => n.kind === 'state').length} states`, `${m.edges.length} transitions`]
    : [`${nodes.length} nodes`, `${m.edges.length} connections`, m.decisions.length && `${m.decisions.length} decision point${m.decisions.length > 1 ? 's' : ''}`, m.hasLoop && 'contains a loop', m.groups.length && `${m.groups.length} groups`];
  const verb = m.type === 'state' ? 'Simulate it: start at the initial state and choose each transition.'
    : m.isTree ? 'Decide: answer each question in turn and follow the tree to its outcome.'
      : 'Step through: follow the flow one node at a time, choosing at each branch.';
  const kinds = new Set(nodes.map(n => n.kind));
  const legend = [kinds.has('decision') && ['decision', 'var(--warn)'], kinds.has('store') && ['data store', 'var(--info)'], kinds.has('outcome') && ['outcome', 'var(--ok)'],
    nodes.some(n => refsIn(D, n.label).length) && ['opens a chapter', 'var(--dc)']].filter(Boolean);
  panel.innerHTML = `<div class="dp-over">
      <div class="dp-facts">${facts.filter(Boolean).map(f => `<span>${f}</span>`).join('')}${legend.map(([t, c]) => `<span class="lg"><i style="background:${c}"></i>${t}</span>`).join('')}${D.rotated ? '<button type="button" class="dp-rot" data-unrot>layout rotated to fit · show original</button>' : ''}</div>
      <p class="dp-how"><b>Hover</b> or <b>tap</b> any node to trace what feeds it <i class="sw up"></i> and what it feeds <i class="sw down"></i>. Tap to pin it and see its connections and where the text discusses it.</p>
      <div class="dp-cta"><button type="button" class="btn primary sm" data-go-walk>${ICON.play} ${D.walkWord}</button>
      ${m.type === 'flow' ? `<button type="button" class="btn sm" data-anim aria-pressed="false">Animate flow</button>` : ''}
      <span class="dim dp-verb">${verb}</span></div>
    </div>`;
  panel.querySelector('[data-go-walk]').onclick = () => setMode(D, 'walk');
  const un = panel.querySelector('[data-unrot]'); if (un) un.onclick = () => D.fig.querySelector('[data-rot]').click();
  const anim = panel.querySelector('[data-anim]');
  if (anim) anim.onclick = () => { const on = anim.getAttribute('aria-pressed') !== 'true'; anim.setAttribute('aria-pressed', String(on)); anim.textContent = on ? 'Stop animation' : 'Animate flow'; animateFlow(D, on); };
}

/** Dots travel every connection, staggered by distance from the start nodes. */
function animateFlow(D, on) {
  stopParticles(D); D.svg.classList.toggle('x-flowing', on);
  if (!on) return;
  if (!motionOK()) return;
  const m = D.model, depth = new Map(), q = [];
  for (const s of m.sources.length ? m.sources : [m.nodes.keys().next().value]) { depth.set(s, 0); q.push(s); }
  while (q.length) { const id = q.shift(); for (const e of m.out.get(id)) if (!depth.has(e.to)) { depth.set(e.to, depth.get(id) + 1); q.push(e.to); } }
  for (const id of m.nodes.keys()) if (!depth.has(id)) depth.set(id, 0);
  const max = Math.max(...depth.values()), step = 520, dur = 1100, period = (max + 1) * step + dur + 400;
  for (const e of m.edges) if (e.el && !e.dotted) particle(D, e.el, { dur, delay: depth.get(e.from) * step, period, cls: e.from === e.to ? '' : 'trail' });
}

function select(D, id) {
  D.sel = id;
  const anim = D.fig.querySelector('[data-anim][aria-pressed="true"]');
  if (anim) { anim.setAttribute('aria-pressed', 'false'); anim.textContent = 'Animate flow'; animateFlow(D, false); }
  if (!id) { clearMarks(D); overview(D); return; }
  lineage(D, id);
  const n = D.model.nodes.get(id);
  if (n.el) D.cam.reveal(rootBox(D, n.el));
  inspector(D, n);
}

const KIND_NAME = { decision: 'Decision', store: 'Data store', outcome: 'Outcome', step: 'Step', end: 'End point', start: 'Start', state: 'State', group: 'Group' };

function inspector(D, n) {
  const m = D.model, panel = D.fig.querySelector('.dpanel'), isState = m.type === 'state';
  const ins = m.inn.get(n.id), outs = m.out.get(n.id);
  const item = (e, other) => `<li><button type="button" data-node="${esc(other)}">${other === n.id ? '<span class="dim">itself</span>' : esc(m.nodes.get(other)?.label || other)}</button>${e.label ? `<span class="dp-elab">${esc(e.label)}</span>` : ''}${e.dotted ? '<span class="dp-elab dotted">dotted</span>' : ''}</li>`;
  const list = (title, arr, key) => arr.length ? `<div class="dp-conn"><h6>${title} <span class="dim">${arr.length}</span></h6><ul>${arr.map(e => item(e, e[key])).join('')}</ul></div>` : '';
  panel.innerHTML = `<div class="dp-ins">
    <div class="dp-head"><span class="dp-kind k-${n.kind}">${KIND_NAME[n.kind] || 'Node'}</span>${n.group ? `<span class="dp-grp">in ${esc(n.group)}</span>` : ''}<button type="button" class="dp-x" aria-label="Clear selection">✕</button></div>
    <p class="dp-label">${esc(n.label)}</p>
    ${n.note ? `<p class="dp-note"><b>Note</b> ${esc(n.note)}</p>` : ''}
    <div class="dp-conns">${list(isState ? 'Transitions in' : 'Comes from', ins, 'from')}${list(isState ? 'Transitions out' : 'Leads to', outs, 'to')}</div>
    ${refsHtml(D, n.label)}
    <div class="dp-ment"></div>
  </div>`;
  panel.querySelector('.dp-x').onclick = () => select(D, null);
  panel.onclick = e => { const b = e.target.closest('[data-node]'); if (b) select(D, b.dataset.node); const r = e.target.closest('[data-ref]'); if (r) nav(D, r.dataset.ref); };
  mentions(D, n.label, panel.querySelector('.dp-ment'));
}

function refsIn(D, text) {
  const out = [];
  for (const m of String(text).matchAll(/\b([a-z]{3}-\d\d)\b/g)) { const c = D.opts.lookup?.(m[1]); if (c && !out.some(x => x.id === c.id)) out.push(c); }
  return out;
}
function refsHtml(D, text) {
  const refs = refsIn(D, text);
  return refs.length ? `<div class="dp-refs">${refs.map(c => `<button type="button" class="dp-ref" data-ref="${c.id}" style="--mc:var(--m-${c.module || 'meta'})"><b>${c.id}</b> ${esc(c.title)} <span aria-hidden="true">→</span></button>`).join('')}</div>` : '';
}
function nav(D, id) {
  if (D.fig.classList.contains('full')) D.setFull(false);
  if (D.opts.onNavigate) D.opts.onNavigate(id); else location.hash = '#/c/' + id;
}

/* ---------------- "in the text": quoted sentences that name this node ---------------- */

const STOP = new Set('the a an and or of to in on for with your new plus then via per all each one is it its by as at from into only not no yes'.split(' '));
function phrases(label) {
  const out = new Set();
  for (let p of label.split(/\s[·—–-]\s|:\s|[()?,/]|\s-\s/)) {
    p = p.replace(/\b[a-z]{3}-\d\d\b/g, '').replace(/\s+/g, ' ').trim().replace(/^(the|a|an)\s/i, '');
    const w = p.split(' ').filter(Boolean);
    if (w.length >= 2 && w.length <= 6 && w.some(x => !STOP.has(x.toLowerCase()) && x.length > 3)) out.add(p);
    else if (w.length === 1 && p.length >= 6 && !STOP.has(p.toLowerCase())) out.add(p);
  }
  return [...out].sort((a, b) => b.length - a.length);
}
let seg = null;
function sentences(text) {
  if (!seg && typeof Intl !== 'undefined' && Intl.Segmenter) seg = new Intl.Segmenter('en', { granularity: 'sentence' });
  return seg ? [...seg.segment(text)].map(s => s.segment.trim()).filter(Boolean) : text.split(/(?<=[.!?])\s+(?=[A-Z])/);
}
function mentions(D, label, box) {
  const art = D.opts.article; if (!art || !box) return;
  const ps = phrases(label); if (!ps.length) return;
  const els = $$('p, li, td', art).filter(el => !el.closest('figure, .footnotes, .block, pre') && !el.querySelector('p, li'));
  // the H2 section an element sits in, by document order
  const h2s = $$('h2', art);
  const secOf = el => { let s = null; for (const h of h2s) { if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) s = h; else break; } return s; };
  const sec = secOf(D.fig), inSec = el => !!sec && secOf(el) === sec;
  const hits = [];
  for (const p of ps) {
    const rx = new RegExp('(^|[^a-z0-9])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '(?![a-z0-9])', 'i');
    for (const el of els) {
      if (hits.some(h => h.el === el)) continue;
      const s = sentences(el.textContent).find(x => rx.test(x));
      if (s) hits.push({ el, s, p, near: inSec(el) });
    }
    if (hits.length >= 6) break;
  }
  hits.sort((a, b) => b.near - a.near);
  const top = hits.slice(0, 2); if (!top.length) return;
  const clip = s => s.length > 300 ? s.slice(0, 297).replace(/\s\S*$/, '') + ' …' : s;
  const mark = (s, p) => esc(clip(s)).replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i'), x => `<mark>${x}</mark>`);
  box.innerHTML = `<h6>In the text</h6>` + top.map((h, i) => `<blockquote><p>${mark(h.s, h.p)}</p><button type="button" class="dp-jump" data-hit="${i}">Read in context ↓</button></blockquote>`).join('');
  box.onclick = e => {
    const b = e.target.closest('[data-hit]'); if (!b) return;
    const el = top[+b.dataset.hit].el;
    if (D.fig.classList.contains('full')) D.setFull(false);
    el.scrollIntoView({ block: 'center', behavior: motionOK() ? 'smooth' : 'auto' });
    el.classList.remove('x-flash'); void el.offsetWidth; el.classList.add('x-flash');
    setTimeout(() => el.classList.remove('x-flash'), 2400);
  };
}

/* ---------------- walk: Decide / Step through / Simulate ---------------- */

function walkStart(D) {
  const m = D.model;
  D.path = [];
  const starts = m.sources.length ? m.sources : [m.nodes.keys().next().value];
  if (starts.length === 1) walkTo(D, starts[0], null);
  else walkRender(D, starts);
}
function walkTo(D, id, edge) {
  D.path.push({ id, edge });
  walkRender(D);
  if (edge?.el) particle(D, edge.el, { dur: 750, cls: 'big' });
}
function walkChoose(D, o) { if (o.start) walkTo(D, o.to, null); else walkTo(D, o.to, o.edge); }
function walkBack(D) { if (D.path.length > 1) { D.path.pop(); walkRender(D); } else if (D.path.length === 1 && D.model.sources.length > 1) { D.path = []; walkRender(D, D.model.sources); } }

function walkRender(D, starts) {
  const m = D.model, panel = D.fig.querySelector('.dpanel'), isState = m.type === 'state';
  clearMarks(D); D.svg.classList.add('dim');
  const cur = D.path[D.path.length - 1];
  for (const p of D.path) { markNode(D, p.id, 'x-seen'); if (p.edge) markEdge(p.edge, 'x-seen'); }
  let opts;
  if (starts) opts = starts.map(id => ({ to: id, start: true, text: m.nodes.get(id).label }));
  else {
    markNode(D, cur.id, 'x-cur');
    const n = m.nodes.get(cur.id), outs = m.out.get(cur.id);
    const hide = n.kind === 'decision' && outs.length > 1 && outs.every(e => e.label);
    opts = outs.map(e => ({ to: e.to, edge: e, text: e.label || m.nodes.get(e.to).label, dest: hide || !e.label ? '' : m.nodes.get(e.to).label, loop: D.path.some(p => p.id === e.to) }));
    for (const o of opts) { markNode(D, o.to, 'x-opt'); markEdge(o.edge, 'x-opt'); }
    if (n.el) D.cam.follow(rootBox(D, n.el));
  }
  D.opts_ = opts;
  const n = cur && m.nodes.get(cur.id);
  const qn = D.path.filter(p => m.nodes.get(p.id).kind === 'decision').length;
  const eyebrow = starts ? 'Choose where to start'
    : !opts.length ? (isState ? 'Final state reached' : m.decisions.length ? 'Outcome' : 'End of the flow')
      : isState ? `State · step ${D.path.length}`
        : n.kind === 'decision' && opts.length > 1 ? `Question ${qn}`
          : `Step ${D.path.length}`;
  const prompt = starts ? 'This flow has more than one entry point.' : n.label;
  const lead = !starts && opts.length > 1 ? (isState ? 'Transitions' : n.kind === 'decision' ? 'Your answer' : 'This feeds more than one step — follow one') : '';
  const trail = D.path.slice(0, -1).map((p, i) => {
    const nx = D.path[i + 1];
    return `<li><button type="button" data-back="${i}" title="Go back to this step">${esc(trim(m.nodes.get(p.id).label, 42))}</button>${nx.edge?.label ? `<span class="dw-ans">${esc(trim(nx.edge.label, 30))}</span>` : ''}</li>`;
  }).join('');
  const via = cur?.edge?.label ? `<span class="dw-via">via “${esc(cur.edge.label)}”</span>` : '';
  const hadFocus = D.fig.contains(document.activeElement) && !D.svg.contains(document.activeElement);
  panel.innerHTML = `<div class="dw ${!starts && !opts.length ? 'end' : ''}">
    ${trail ? `<ol class="dw-trail">${trail}</ol>` : ''}
    <div class="dw-card k-${n?.kind || 'start'}">
      <div class="dw-eyebrow">${eyebrow}${via}</div>
      <p class="dw-q">${esc(prompt)}</p>
      ${n?.note ? `<p class="dp-note"><b>Note</b> ${esc(n.note)}</p>` : ''}
      ${lead ? `<div class="dw-lead">${lead}</div>` : ''}
      <div class="dw-opts">${opts.map((o, i) => `<button type="button" class="dw-opt ${o.loop ? 'loop' : ''}" data-o="${i}"><kbd>${i + 1}</kbd><span class="t">${esc(o.text)}${o.dest ? `<small>→ ${esc(o.dest)}</small>` : ''}</span>${o.loop ? '<span class="lp" title="Leads back to a step already visited">↻ loop</span>' : '<span class="ar" aria-hidden="true">→</span>'}</button>`).join('')}</div>
      ${n ? refsHtml(D, n.label) : ''}
      ${!starts && !opts.length ? `<div class="dw-done">${D.path.length} step${D.path.length > 1 ? 's' : ''} · ${D.path.filter(p => p.edge?.label).length} labelled branch${D.path.filter(p => p.edge?.label).length === 1 ? '' : 'es'} taken</div>` : ''}
    </div>
    <div class="dw-foot"><button type="button" class="btn xs ghost" data-act="back" ${D.path.length > 1 || (D.path.length === 1 && m.sources.length > 1) ? '' : 'disabled'}>← Back</button><button type="button" class="btn xs ghost" data-act="restart">Restart</button><span class="dim">Keys 1–${Math.max(1, Math.min(9, opts.length))} choose · Backspace goes back</span></div>
  </div>`;
  // re-rendering the panel removes the focused button; keep keyboard focus inside the figure
  if (hadFocus) (panel.querySelector('.dw-opt') || panel.querySelector('[data-act="restart"]'))?.focus({ preventScroll: true });
  panel.onclick = e => {
    const o = e.target.closest('[data-o]'); if (o) return walkChoose(D, opts[+o.dataset.o]);
    const b = e.target.closest('[data-back]'); if (b) { D.path = D.path.slice(0, +b.dataset.back + 1); return walkRender(D); }
    const a = e.target.closest('[data-act]'); if (a) return a.dataset.act === 'back' ? walkBack(D) : walkStart(D);
    const r = e.target.closest('[data-ref]'); if (r) nav(D, r.dataset.ref);
  };
}
const trim = (s, n) => s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s;

/* ---------------- play: sequence ---------------- */

function controls(D, n) {
  return `<div class="dctl" role="group" aria-label="Playback">
    <button type="button" data-p="first" aria-label="First step">${ICON.first}</button><button type="button" data-p="prev" aria-label="Previous step">${ICON.prev}</button>
    <button type="button" data-p="play" class="pp" aria-label="Play">${ICON.play}</button>
    <button type="button" data-p="next" aria-label="Next step">${ICON.next}</button><button type="button" data-p="last" aria-label="Last step">${ICON.last}</button>
    <div class="dprog" role="progressbar" aria-valuemin="0" aria-valuemax="${n}"><i></i></div><span class="dcount"></span></div>`;
}
function wireControls(D, panel, n, interval) {
  const ctl = panel.querySelector('.dctl');
  const pp = ctl.querySelector('.pp');
  const setPlaying = on => { D.playing = on; pp.innerHTML = on ? ICON.pause : ICON.play; pp.setAttribute('aria-label', on ? 'Pause' : 'Play'); };
  D.toggle = () => {
    if (D.playing) { setPlaying(false); stopTimers(D); return; }
    if (D.i >= n - 1) D.step(-1);
    setPlaying(true);
    const adv = () => { if (!D.playing || !D.fig.isConnected) return; if (D.i >= n - 1) { setPlaying(false); return; } D.step(D.i + 1, true); D.timer = setTimeout(adv, interval()); };
    adv();
  };
  ctl.onclick = e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const a = b.dataset.p;
    if (a === 'play') return D.toggle();
    setPlaying(false); stopTimers(D);
    D.step(a === 'first' ? -1 : a === 'last' ? n - 1 : a === 'next' ? D.i + 1 : D.i - 1);
  };
  setPlaying(false);
}

function seqStep(D, i, auto) {
  const m = D.model, N = m.msgs.length, panel = D.fig.querySelector('.dpanel');
  if (!D.step || D.stepFor !== 'seq') {
    D.stepFor = 'seq'; D.step = (j, a) => seqStep(D, j, a);
    const label = id => m.actors.find(a => a.id === id)?.label || id;
    panel.innerHTML = `<div class="ds">
      <div class="ds-now"></div>
      ${controls(D, N)}
      <ol class="ds-list">${m.msgs.map((x, j) => `<li><button type="button" data-i="${j}"><span class="n">${j + 1}</span><span class="r">${esc(label(x.from))} <i>→</i> ${esc(x.self ? label(x.from) : label(x.to))}</span><span class="t">${esc(x.label)}</span></button></li>`).join('')}</ol>
    </div>`;
    wireControls(D, panel, N, () => 1900);
    panel.querySelector('.ds-list').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { D.toggle && D.playing && D.toggle(); seqStep(D, +b.dataset.i); } };
  }
  i = Math.max(-1, Math.min(N - 1, i)); D.i = i;
  stopParticles(D); clearMarks(D);
  const label = id => m.actors.find(a => a.id === id)?.label || id;
  const now = panel.querySelector('.ds-now');
  if (i < 0) {
    now.innerHTML = `<div class="dw-eyebrow">${N} messages · ${m.actors.length} participants</div><div class="ds-cast">${m.actors.map(a => `<span>${esc(a.label)}</span>`).join('')}</div><p class="dp-how">Press <b>play</b> or use <kbd>→</kbd> to send each message in order.</p>`;
  } else {
    const x = m.msgs[i];
    D.svg.classList.add('dim');
    m.msgs.forEach((y, j) => { if (j < i) { markEl(y.el, 'x-seen'); markEl(y.textEl, 'x-seen'); } });
    markEl(x.el, 'x-cur'); markEl(x.textEl, 'x-cur');
    for (const a of m.actors) if (a.id === x.from || a.id === x.to) { markEl(a.el, 'x-cur'); markEl(a.line, 'x-cur'); }
    if (x.el) { particle(D, x.el, { dur: x.self ? 1100 : 850, cls: 'big' }); D.cam.follow(rootBox(D, x.textEl || x.el)); }
    now.innerHTML = `<div class="dw-eyebrow">Step ${i + 1} of ${N}</div>
      <div class="ds-route"><b>${esc(label(x.from))}</b><span class="ds-arrow ${x.self ? 'self' : ''}" aria-hidden="true">${x.self ? '↻' : '→'}</span><b>${esc(x.self ? 'itself' : label(x.to))}</b></div>
      <p class="dw-q">${esc(x.label)}</p>${refsHtml(D, x.label)}`;
    now.onclick = e => { const r = e.target.closest('[data-ref]'); if (r) nav(D, r.dataset.ref); };
  }
  for (const b of panel.querySelectorAll('.ds-list [data-i]')) { const j = +b.dataset.i; b.classList.toggle('on', j === i); b.classList.toggle('done', j < i); }
  const on = panel.querySelector('.ds-list .on'); if (on && auto) on.scrollIntoView({ block: 'nearest' });
  progress(panel, i + 1, N);
}
function progress(panel, k, n) {
  const bar = panel.querySelector('.dprog');
  bar.querySelector('i').style.width = (n ? k / n * 100 : 0) + '%'; bar.setAttribute('aria-valuenow', k);
  panel.querySelector('.dcount').textContent = `${k} / ${n}`;
}

/* ---------------- play: timeline ---------------- */

function ganttStep(D, j, auto) {
  const m = D.model, panel = D.fig.querySelector('.dpanel');
  const ev = [...new Set(m.tasks.flatMap(t => [t.s, t.e]))].sort((a, b) => a - b);
  const N = ev.length;
  const tfmt = t => m.unit ? String(Math.round((t / m.unit) * 100) / 100) : new Date(t).toLocaleString();
  if (!D.step || D.stepFor !== 'gantt') {
    D.stepFor = 'gantt'; D.step = (k, a) => ganttStep(D, k, a);
    panel.innerHTML = `<div class="dg"><div class="dg-now"></div>${controls(D, N)}<div class="dg-lanes"></div></div>`;
    wireControls(D, panel, N, () => 1500);
    ganttHead(D);
  }
  j = Math.max(-1, Math.min(N - 1, j)); const prevT = D.i >= 0 ? ev[D.i] : ev[0]; D.i = j;
  clearMarks(D);
  const t = j < 0 ? null : ev[j];
  const now = panel.querySelector('.dg-now'), lanes = panel.querySelector('.dg-lanes');
  if (t === null) {
    D.head.style.opacity = 0;
    now.innerHTML = `<div class="dw-eyebrow">${m.tasks.length} tasks · ${m.lanes.length} lanes${m.unit ? ` · t = ${tfmt(ev[0])} to ${tfmt(ev[N - 1])}` : ''}</div>${m.title ? `<p class="dw-q">${esc(m.title)}</p>` : ''}<p class="dp-how">Press <b>play</b> or use <kbd>→</kbd> to move a playhead through every moment a task starts or ends.</p>`;
    lanes.innerHTML = '';
  } else {
    D.svg.classList.add('dim');
    const active = m.tasks.filter(x => x.s <= t && t < x.e), done = m.tasks.filter(x => x.e <= t);
    for (const x of done) { markEl(x.el, 'x-seen'); markEl(x.textEl, 'x-seen'); }
    for (const x of active) { markEl(x.el, 'x-cur'); markEl(x.textEl, 'x-cur'); }
    moveHead(D, prevT, t, auto);
    const starts = m.tasks.filter(x => x.s === t), ends = m.tasks.filter(x => x.e === t);
    const li = (arr, w) => arr.length ? `<div class="dg-ev"><b>${w}</b> ${arr.map(x => `<span>${esc(x.label)} <i>${esc(x.section)}</i></span>`).join('')}</div>` : '';
    now.innerHTML = `<div class="dw-eyebrow">${m.unit ? `t = ${tfmt(t)}` : esc(tfmt(t))} · moment ${j + 1} of ${N}</div>${li(ends, 'Ends')}${li(starts, 'Starts')}${!active.length && j === N - 1 ? '<div class="dg-ev"><b>Done</b> every task has finished</div>' : ''}`;
    lanes.innerHTML = m.lanes.map(l => { const a = active.find(x => x.section === l); return `<div class="dg-lane ${a ? 'on' : ''}"><span class="l">${esc(l)}</span><span class="v">${a ? esc(a.label) : '<span class="dim">no task scheduled</span>'}</span></div>`; }).join('');
  }
  progress(panel, j + 1, N);
}
/** Playhead: time → x is read off the rendered task bars themselves. */
function ganttHead(D) {
  const m = D.model, bars = m.tasks.filter(t => t.el && t.e > t.s);
  if (!bars.length) { D.head = document.createElementNS(NS, 'g'); return; }
  const b0 = bars[0], x0 = +b0.el.getAttribute('x'), w0 = +b0.el.getAttribute('width');
  const a = w0 / (b0.e - b0.s); D.tx = t => x0 + (t - b0.s) * a;
  const ys = bars.map(t => +t.el.getAttribute('y')), hs = bars.map(t => +t.el.getAttribute('y') + +t.el.getAttribute('height'));
  const line = document.createElementNS(NS, 'line');
  line.setAttribute('class', 'x-head'); line.setAttribute('y1', Math.min(...ys) - 10); line.setAttribute('y2', Math.max(...hs) + 10);
  line.style.opacity = 0;
  b0.el.parentNode.appendChild(line); D.head = line;
}
function moveHead(D, from, to, smooth) {
  const line = D.head; if (!line || !D.tx) return;
  line.style.opacity = 1;
  cancelAnimationFrame(D.playRaf);
  const set = t => { const x = D.tx(t); line.setAttribute('x1', x); line.setAttribute('x2', x); };
  if (!smooth || !motionOK() || from === to) { set(to); return; }
  const t0 = performance.now(), dur = 600;
  const f = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); set(from + (to - from) * e); if (k < 1) D.playRaf = requestAnimationFrame(f); };
  D.playRaf = requestAnimationFrame(f);
}
