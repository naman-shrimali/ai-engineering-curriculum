/* Explorables: small simulations placed next to the chapter text they illustrate.
   Each one implements only definitions its chapter states and quotes those definitions
   verbatim (scripts/check-explorables.py fails CI if a quote drifts from the chapter).
   Data is illustrative and labelled as such; every number shown is computed live. */
import { Delaunay } from 'd3';
import { esc } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const fmt = (x, d = 3) => (Number.isFinite(x) ? (Math.round(x * 10 ** d) / 10 ** d).toFixed(d) : '—');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/** Registry. `basis` quotes must appear verbatim in the chapter file. */
export const EXPLORABLES = [
  {
    id: 'similarity', chapter: 'fnd-03', anchor: 'the-math-that-earns-its-place',
    title: 'Dot product, cosine, distance — drag the vectors',
    blurb: 'Rank three documents against a query by each metric, then normalize and watch the rankings agree.',
    basis: ['is the dot product with magnitude divided out', 'all three metrics produce the same ranking', 'normalize on write, use dot product, move on'],
    mount: similarity,
  },
  {
    id: 'sampling', chapter: 'fnd-08', anchor: 'truncation-top-k-top-p-and-min-p',
    title: 'Sampling lab — temperature, then truncation',
    blurb: 'Reshape a next-token distribution with temperature, cut its tail with top-k, top-p or min-p, and draw tokens.',
    basis: ['Temperature is a single-line modification to the softmax you know from fnd-02', 'Keep only the k highest-probability tokens, renormalize', 'Keep the smallest set whose cumulative probability ≥ p, renormalize', "Keep tokens with probability ≥ (min_p × top token's probability)", 'typically temperature first, then truncation'],
    mount: sampling,
  },
  {
    id: 'ivf', chapter: 'rag-02', anchor: 'ivf-and-product-quantization-partition-then-compress', after: "IVF's",
    title: 'IVF search — partition, probe, and the recall you give up',
    blurb: 'Cluster a toy corpus into cells, probe the nearest few, and see which true neighbours fall across a border.',
    basis: ["assign every vector to its nearest centroid's cell", "a true nearest neighbor sitting just across the border of a cell you didn't probe", 'the fraction of true nearest neighbors your search actually returned', 'Sweep the runtime dial, plot the curve.'],
    mount: ivf,
  },
  {
    id: 'retrieval-metrics', chapter: 'rag-07', anchor: 'retrieval-metrics',
    title: 'Retrieval metrics lab — label a ranking, read the numbers',
    blurb: 'Mark which retrieved passages are relevant and watch recall@k, precision@k, reciprocal rank and nDCG respond — then rerank.',
    basis: ['the fraction of queries for which at least one relevant passage appears in the top k', 'the fraction of all relevant passages retrieved', 'the fraction of retrieved passages that are relevant', 'nDCG additionally weights graded relevance by position', 'tell you immediately whether a reranker is helping or reordering noise'],
    mount: metrics,
  },
  {
    id: 'lora', chapter: 'ftn-02', anchor: 'lora-low-rank-adaptation',
    title: 'LoRA footprint — what rank buys you',
    blurb: 'Size a weight matrix and a rank and compare the trainable parameters of full fine-tuning and LoRA.',
    basis: ['so the number of trainable parameters scales with', 'Output = Wx + BAx', 'rank is a hyperparameter to tune rather than a fixed constant'],
    mount: lora,
  },
];

/** Insert a chapter's explorables into its rendered article. */
export function mountExplorables(art, chapterId, opts = {}) {
  for (const x of EXPLORABLES.filter(e => e.chapter === chapterId)) {
    const h2 = art.querySelector('h2#' + CSS.escape(x.anchor)); if (!h2) continue;
    let at = null, last = h2;
    for (let n = h2.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) {
      last = n;
      if (x.after && !at && n.tagName === 'P' && n.textContent.includes(x.after)) at = n;
    }
    const host = document.createElement('div');
    (at || last).after(host);
    mountExplorable(host, x.id, opts);
  }
}

export function mountExplorable(host, id) {
  const x = EXPLORABLES.find(e => e.id === id); if (!x) return;
  const fig = document.createElement('figure');
  fig.className = 'diagram xp';
  fig.dataset.kind = 'explorable';
  fig.innerHTML = `<header class="dhead"><span class="dk">explorable</span><span class="dt">${esc(x.title)}</span></header>
    <div class="xp-body"></div>
    <footer class="xp-basis"><span class="xp-bl">Implements the text</span>${x.basis.map(q => `<q>${esc(q)}</q>`).join('')}</footer>`;
  host.replaceWith(fig);
  x.mount(fig.querySelector('.xp-body'), fig);
}

/* ------------------------------------------------------------------ shared UI bits */
function slider(label, { min, max, step, value, fmtv = v => v, id }) {
  return `<label class="xp-sl"><span class="l">${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-s="${id}"><output data-o="${id}">${fmtv(value)}</output></label>`;
}
function seg(id, opts, on) {
  return `<div class="xp-seg" role="group" data-g="${id}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${v === on}">${t}</button>`).join('')}</div>`;
}
function wireSeg(root, id, fn) {
  const g = root.querySelector(`[data-g="${id}"]`);
  g.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; for (const x of g.children) x.setAttribute('aria-pressed', String(x === b)); fn(b.dataset.v); };
}
function svgEl(tag, attrs = {}, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function dragger(svg, el, onMove) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('drag');
    const mv = ev => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); onMove(q.x, q.y); };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.classList.remove('drag'); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  });
}

/* ------------------------------------------------------------------ 1. similarity (fnd-03) */
function similarity(body) {
  const S = 300, INIT = { q: [3, 4], d1: [5, 2], d2: [1, 1.5], d3: [-2, 5] }, V = JSON.parse(JSON.stringify(INIT));
  const COL = { q: 'var(--dc)', d1: 'var(--m-llm-apis)', d2: 'var(--m-evaluation)', d3: 'var(--m-agents)' };
  let norm = false, R = 6, sc = S / (2 * R);
  body.innerHTML = `<div class="xp-grid">
      <div class="xp-plot"><svg viewBox="0 0 ${S} ${S}" class="xp-svg" role="img" aria-label="Vector plane"></svg>
        <div class="xp-row">${seg('norm', [['raw', 'Raw vectors'], ['unit', 'Normalized (unit length)']], 'raw')}</div>
        <div class="xp-row"><button type="button" class="btn xs" data-preset="ex">Exercise 2: a = (3, 4), b = (6, 8)</button><button type="button" class="btn xs ghost" data-preset="reset">Reset</button></div></div>
      <div class="xp-out"><table class="xp-tab"><thead><tr><th></th><th>dot q·d</th><th>cosine</th><th>distance ‖q−d‖</th></tr></thead><tbody></tbody></table>
        <div class="xp-rank"></div><p class="xp-note"></p></div></div>`;
  const svg = body.querySelector('svg');
  const X = v => S / 2 + v * sc, Y = v => S / 2 - v * sc;
  const grid = svgEl('g', {}, svg), unit = svgEl('circle', { class: 'unit' }, svg), defs = svgEl('defs', {}, svg);
  const drawGrid = () => {
    const step = norm ? .25 : 1; grid.innerHTML = '';
    for (let i = -R; i <= R + 1e-9; i += step) { const z = Math.abs(i) < 1e-9; svgEl('line', { x1: X(i), y1: 0, x2: X(i), y2: S, class: z ? 'ax' : 'g' }, grid); svgEl('line', { x1: 0, y1: Y(i), x2: S, y2: Y(i), class: z ? 'ax' : 'g' }, grid); }
    unit.setAttribute('cx', X(0)); unit.setAttribute('cy', Y(0)); unit.setAttribute('r', sc);
  };
  const arrows = {}, uid = ('' + Math.random()).slice(2, 7);
  const len = v => Math.hypot(v[0], v[1]), dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const unitv = v => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
  for (const k of Object.keys(V)) {
    const m = svgEl('marker', { id: `xa-${k}-${uid}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    svgEl('path', { d: 'M0 0L10 5L0 10z', style: `fill:${COL[k]}` }, m);
    const line = svgEl('line', { class: 'vec', style: `stroke:${COL[k]}`, 'marker-end': `url(#${m.id})` }, svg);
    const tip = svgEl('circle', { r: 9, class: 'tip', tabindex: 0, role: 'slider', 'aria-label': `vector ${k}`, style: `stroke:${COL[k]}` }, svg);
    const lab = svgEl('text', { class: 'lab', style: `fill:${COL[k]}` }, svg);
    arrows[k] = { line, tip, lab };
    const set = (x, y) => {
      if (norm) { const l = len(V[k]) || 1, a = Math.atan2(y, x); V[k] = [Math.round(l * Math.cos(a) * 100) / 100, Math.round(l * Math.sin(a) * 100) / 100]; }
      else V[k] = [clamp(Math.round(x * 2) / 2, -6, 6), clamp(Math.round(y * 2) / 2, -6, 6)];
      draw();
    };
    dragger(svg, tip, (x, y) => set((x - S / 2) / sc, (S / 2 - y) / sc));
    tip.addEventListener('keydown', e => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!d) return;
      e.preventDefault();
      if (norm) { const a = Math.atan2(V[k][1], V[k][0]) + (d[0] || d[1]) * -0.05 * (d[0] ? 1 : -1); set(Math.cos(a), Math.sin(a)); }
      else set(V[k][0] + d[0] * .5, V[k][1] + d[1] * .5);
    });
  }
  function draw() {
    unit.style.opacity = norm ? 1 : .35;
    for (const k of Object.keys(V)) {
      const v = V[k], shown = norm ? unitv(v) : v, a = arrows[k], tx = X(shown[0]), ty = Y(shown[1]), right = tx > S - 96;
      a.line.setAttribute('x1', X(0)); a.line.setAttribute('y1', Y(0)); a.line.setAttribute('x2', tx); a.line.setAttribute('y2', ty);
      a.tip.setAttribute('cx', tx); a.tip.setAttribute('cy', ty);
      a.tip.setAttribute('aria-valuetext', norm ? `direction (${fmt(shown[0], 2)}, ${fmt(shown[1], 2)})` : `(${v[0]}, ${v[1]})`);
      a.lab.setAttribute('x', right ? tx - 12 : tx + 12); a.lab.setAttribute('y', ty - 10); a.lab.setAttribute('text-anchor', right ? 'end' : 'start');
      a.lab.textContent = norm ? k : `${k} (${v[0]}, ${v[1]})`;
    }
    const q = norm ? unitv(V.q) : V.q;
    const rows = ['d1', 'd2', 'd3'].map(k => { const d = norm ? unitv(V[k]) : V[k]; return { k, dot: dot(q, d), cos: dot(q, d) / ((len(q) * len(d)) || 1), dist: Math.hypot(q[0] - d[0], q[1] - d[1]) }; });
    const order = (key, desc) => [...rows].sort((a, b) => desc ? b[key] - a[key] : a[key] - b[key]).map(r => r.k);
    const rk = { dot: order('dot', true), cos: order('cos', true), dist: order('dist', false) };
    const agree = rk.dot.join() === rk.cos.join() && rk.cos.join() === rk.dist.join();
    body.querySelector('tbody').innerHTML = rows.map(r => `<tr><th style="color:${COL[r.k]}">${r.k}</th><td>${fmt(r.dot, 2)} <i>#${rk.dot.indexOf(r.k) + 1}</i></td><td>${fmt(r.cos, 3)} <i>#${rk.cos.indexOf(r.k) + 1}</i></td><td>${fmt(r.dist, 2)} <i>#${rk.dist.indexOf(r.k) + 1}</i></td></tr>`).join('');
    body.querySelector('.xp-rank').innerHTML = `<span class="xp-badge ${agree ? 'ok' : 'warn'}">${agree ? 'All three metrics rank the documents the same' : 'The metrics disagree on the ranking'}</span>`;
    const uq = unitv(V.q), ud = unitv(V.d1), lhs = (uq[0] - ud[0]) ** 2 + (uq[1] - ud[1]) ** 2, rhs = 2 - 2 * dot(uq, ud);
    body.querySelector('.xp-note').innerHTML = norm
      ? `Every vector is scaled to length 1 (the plane is zoomed to the unit circle; drag to change direction only). Cosine now equals the dot product, and ‖q̂−d̂‖² = 2 − 2 q̂·d̂ (for d1: ${fmt(lhs, 4)} = ${fmt(rhs, 4)}), so the three rankings must agree.`
      : `Raw vectors: the dot product grows with magnitude, cosine ignores magnitude, distance measures the gap between the tips. Drag a document further out along the same direction and watch cosine stay put while the other two change.`;
  }
  const setMode = on => { norm = on; R = norm ? 1.25 : 6; sc = S / (2 * R); drawGrid(); draw(); };
  wireSeg(body, 'norm', v => setMode(v === 'unit'));
  body.querySelector('[data-preset="ex"]').onclick = () => { V.q = [3, 4]; V.d1 = [6, 8]; draw(); };
  body.querySelector('[data-preset="reset"]').onclick = () => { Object.assign(V, JSON.parse(JSON.stringify(INIT))); draw(); };
  setMode(false);
}

/* ------------------------------------------------------------------ 2. sampling (fnd-08) */
function sampling(body) {
  const PRESETS = {
    ex1: { name: 'Exercise 1 logits', logits: [2.0, 1.0, 0.5, -1.0] },
    ex2: { name: 'Exercise 2 distribution', logits: [0.55, 0.20, 0.10, 0.06, 0.05, 0.04].map(Math.log) },
    conf: { name: 'Confident step (illustrative)', logits: [7, 4.2, 3.4, ...Array.from({ length: 21 }, (_, i) => 2.6 - i * 0.12)] },
    unc: { name: 'Uncertain step (illustrative)', logits: Array.from({ length: 24 }, (_, i) => 3 - i * 0.09 - (i > 12 ? (i - 12) * 0.12 : 0)) },
  };
  let preset = 'ex2', T = 1, mode = 'none', k = 3, p = 0.8, mp = 0.1, draws = null;
  body.innerHTML = `<div class="xp-ctl">
      <div class="xp-row">${seg('pre', Object.entries(PRESETS).map(([v, x]) => [v, x.name]), preset)}</div>
      <div class="xp-row">${slider('Temperature T', { min: 0, max: 2, step: .05, value: T, id: 'T', fmtv: v => (+v === 0 ? '0 · greedy' : (+v).toFixed(2)) })}</div>
      <div class="xp-row">${seg('mode', [['none', 'No truncation'], ['topk', 'Top-k'], ['topp', 'Top-p'], ['minp', 'Min-p']], mode)}<span class="xp-par"></span></div>
    </div>
    <p class="xp-note xp-pnote"></p>
    <div class="xp-pipe" aria-hidden="true"><span>logits</span>÷ T<span>softmax</span>→<span class="tr">truncate</span>→<span>renormalize</span>→<span>draw</span></div>
    <div class="xp-bars" role="table" aria-label="Token probabilities"></div>
    <div class="xp-row xp-draw"><button type="button" class="btn sm primary" data-d="1">Draw a token</button><button type="button" class="btn sm" data-d="100">Draw 100</button><span class="xp-dsum dim"></span></div>`;
  const par = body.querySelector('.xp-par');
  const drawPar = () => {
    const n = PRESETS[preset].logits.length;
    k = Math.min(k, n);
    par.innerHTML = mode === 'topk' ? slider('k', { min: 1, max: n, step: 1, value: k, id: 'k' })
      : mode === 'topp' ? slider('p', { min: .05, max: 1, step: .05, value: p, id: 'p', fmtv: v => (+v).toFixed(2) })
        : mode === 'minp' ? slider('min_p', { min: 0, max: 1, step: .01, value: mp, id: 'mp', fmtv: v => (+v).toFixed(2) }) : '';
  };
  function compute() {
    const L = PRESETS[preset].logits, n = L.length;
    let pT;
    if (T === 0) { const m = L.indexOf(Math.max(...L)); pT = L.map((_, i) => (i === m ? 1 : 0)); }
    else { const z = L.map(x => x / T), mx = Math.max(...z), e = z.map(x => Math.exp(x - mx)), s = e.reduce((a, b) => a + b, 0); pT = e.map(x => x / s); }
    const idx = [...Array(n).keys()].sort((a, b) => pT[b] - pT[a] || a - b);
    const keep = new Set();
    if (mode === 'none') idx.forEach(i => keep.add(i));
    else if (mode === 'topk') idx.slice(0, k).forEach(i => keep.add(i));
    else if (mode === 'topp') { let c = 0; for (const i of idx) { keep.add(i); c += pT[i]; if (c >= p - 1e-9) break; } }
    else if (mode === 'minp') { const top = pT[idx[0]]; idx.forEach(i => { if (pT[i] >= mp * top - 1e-12) keep.add(i); }); }
    const s = [...keep].reduce((a, i) => a + pT[i], 0);
    const pF = pT.map((x, i) => (keep.has(i) ? x / s : 0));
    return { L, pT, pF, keep, idx };
  }
  let cur;
  const NOTE = {
    ex1: 'The logits from the chapter\'s first exercise. Check your answers for T = 1, 0.5 and 2.',
    ex2: 'The distribution from the chapter\'s second exercise, entered as its natural logs, so T = 1 reproduces it exactly. Check your top-k, top-p and min-p answers.',
    conf: 'Illustrative logits, not from a real model: one dominant token and a long tail.',
    unc: 'Illustrative logits, not from a real model: many plausible tokens with similar scores.',
  };
  function render() {
    body.querySelector('.xp-pnote').textContent = NOTE[preset];
    cur = compute();
    const { L, pT, pF, keep, idx } = cur, mx = Math.max(...pF, ...pT);
    body.querySelector('.xp-pipe .tr').classList.toggle('off', mode === 'none');
    const total = draws ? draws.reduce((a, b) => a + b, 0) : 0;
    body.querySelector('.xp-bars').innerHTML = `<div class="xp-bh" role="row"><span>token</span><span>logit</span><span>after T <i class="sw g"></i> · final <i class="sw f"></i></span><span>final p</span><span>${total ? 'drawn' : ''}</span></div>` +
      idx.map(i => `<div class="xp-b ${keep.has(i) ? '' : 'cut'}" role="row"><span class="t">t${i + 1}</span><span class="lg">${fmt(L[i], 2)}</span><span class="tr"><i class="g" style="width:${pT[i] / mx * 100}%"></i><i class="f" style="width:${pF[i] / mx * 100}%"></i></span><span class="v">${keep.has(i) ? fmt(pF[i]) : '<span class="dim">cut</span>'}</span><span class="dn">${total ? `<b style="width:${(draws[i] / total) * 100}%"></b>${draws[i]}` : ''}</span></div>`).join('');
    body.querySelector('.xp-dsum').textContent = total ? `${total} draws · ${keep.size} of ${L.length} tokens can be drawn` : `${keep.size} of ${L.length} tokens survive truncation`;
  }
  const sample = n => {
    const r = rng((Date.now() ^ (Math.random() * 1e9)) | 0);
    if (!draws) draws = cur.L.map(() => 0);
    for (let j = 0; j < n; j++) { let u = r(), acc = 0, pick = cur.idx[0]; for (const i of cur.idx) { acc += cur.pF[i]; if (u < acc) { pick = i; break; } } draws[pick]++; }
    render();
  };
  body.addEventListener('input', e => {
    const s = e.target.dataset.s; if (!s) return;
    const v = +e.target.value; if (s === 'T') T = v; if (s === 'k') k = v; if (s === 'p') p = v; if (s === 'mp') mp = v;
    const o = body.querySelector(`[data-o="${s}"]`); if (o) o.textContent = s === 'T' ? (v === 0 ? '0 · greedy' : v.toFixed(2)) : s === 'k' ? v : v.toFixed(2);
    draws = null; render();
  });
  wireSeg(body, 'pre', v => { preset = v; draws = null; drawPar(); render(); });
  wireSeg(body, 'mode', v => { mode = v; draws = null; drawPar(); render(); });
  body.querySelector('.xp-draw').onclick = e => { const b = e.target.closest('[data-d]'); if (b) sample(+b.dataset.d); };
  drawPar(); render();
}

/* ------------------------------------------------------------------ 3. IVF (rag-02) */
function ivf(body) {
  const W = 640, H = 380, N = 600, r = rng(7);
  const blobs = Array.from({ length: 9 }, () => [60 + r() * (W - 120), 50 + r() * (H - 100), 22 + r() * 40]);
  const pts = Array.from({ length: N }, (_, i) => {
    if (i % 6 === 0) return [8 + r() * (W - 16), 8 + r() * (H - 16)];
    const b = blobs[i % blobs.length]; return [clamp(b[0] + gauss(r) * b[2], 6, W - 6), clamp(b[1] + gauss(r) * b[2], 6, H - 6)];
  });
  const queries = Array.from({ length: 60 }, () => pts[Math.floor(r() * N)].map((v, j) => clamp(v + gauss(r) * 18, 6, (j ? H : W) - 6)));
  let nlist = 12, nprobe = 2, K = 10, q = [W * .52, H * .46], cells = null;
  body.innerHTML = `<div class="xp-ctl">
      <div class="xp-row">${slider('nlist (cells)', { min: 2, max: 40, step: 1, value: nlist, id: 'nl' })}${slider('nprobe', { min: 1, max: nlist, step: 1, value: nprobe, id: 'np' })}${seg('k', [['5', 'top-5'], ['10', 'top-10']], String(K))}</div></div>
    <div class="xp-ivf"><svg viewBox="0 0 ${W} ${H}" class="xp-svg" role="img" aria-label="Toy vector corpus partitioned into IVF cells"></svg>
      <div class="xp-legend"><span><i class="lg q"></i>query (drag it)</span><span><i class="lg a"></i>returned</span><span><i class="lg m"></i>missed true neighbour</span><span><i class="lg c"></i>centroid</span></div></div>
    <div class="xp-split"><div class="xp-stats"></div><div class="xp-curve"><svg viewBox="0 0 300 150" class="xp-svg"></svg><div class="xp-cap dim">Average over 60 toy queries · <b>recall@k</b> and <span class="dash">share of corpus searched</span> for every nprobe</div></div></div>
    <p class="xp-note dim">Toy data in two dimensions so it can be drawn, with Euclidean distance. The numbers describe this toy corpus, not real embeddings.</p>`;
  const svg = body.querySelector('.xp-ivf svg');
  const gCells = svgEl('g', { class: 'cells' }, svg), gPts = svgEl('g', { class: 'pts' }, svg), gC = svgEl('g', { class: 'cents' }, svg);
  const dots = pts.map(p => svgEl('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 2.4 }, gPts));
  const qEl = svgEl('g', { class: 'q', tabindex: 0, role: 'slider', 'aria-label': 'query point' }, svg);
  svgEl('circle', { r: 16, class: 'halo' }, qEl); svgEl('circle', { r: 6.5, class: 'qd' }, qEl);
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

  function kmeans() {
    const rr = rng(11 + nlist), C = [pts[Math.floor(rr() * N)]];
    while (C.length < nlist) { // k-means++ seeding
      const D = pts.map(p => Math.min(...C.map(c => d2(p, c)))), s = D.reduce((a, b) => a + b, 0);
      let u = rr() * s, i = 0; while ((u -= D[i]) > 0 && i < N - 1) i++; C.push(pts[i]);
    }
    let cs = C.map(c => [...c]), asg = new Array(N).fill(0);
    for (let it = 0; it < 25; it++) {
      asg = pts.map(p => { let b = 0, bd = Infinity; cs.forEach((c, j) => { const d = d2(p, c); if (d < bd) { bd = d; b = j; } }); return b; });
      cs = cs.map((c, j) => { const m = pts.filter((_, i) => asg[i] === j); return m.length ? [m.reduce((a, p) => a + p[0], 0) / m.length, m.reduce((a, p) => a + p[1], 0) / m.length] : c; });
    }
    asg = pts.map(p => { let b = 0, bd = Infinity; cs.forEach((c, j) => { const d = d2(p, c); if (d < bd) { bd = d; b = j; } }); return b; });
    return { cs, asg };
  }
  const exact = qq => [...pts.keys()].sort((a, b) => d2(pts[a], qq) - d2(pts[b], qq)).slice(0, K);
  const probeOrder = qq => [...cells.cs.keys()].sort((a, b) => d2(cells.cs[a], qq) - d2(cells.cs[b], qq));
  function rebuild() {
    cells = kmeans();
    const vor = Delaunay.from(cells.cs).voronoi([0, 0, W, H]);
    gCells.innerHTML = cells.cs.map((_, j) => `<path d="${vor.renderCell(j)}" data-c="${j}"/>`).join('');
    gC.innerHTML = cells.cs.map(c => `<path d="M${c[0] - 5} ${c[1]}h10M${c[0]} ${c[1] - 5}v10"/>`).join('');
    sweep(); search();
  }
  function search() {
    const order = probeOrder(q), probed = new Set(order.slice(0, nprobe));
    const cand = [...pts.keys()].filter(i => probed.has(cells.asg[i]));
    const A = new Set(cand.sort((a, b) => d2(pts[a], q) - d2(pts[b], q)).slice(0, K)), T = exact(q);
    const hit = T.filter(i => A.has(i)).length, miss = T.filter(i => !A.has(i));
    gCells.querySelectorAll('path').forEach(p => p.classList.toggle('on', probed.has(+p.dataset.c)));
    const candSet = new Set(cand), Tset = new Set(T);
    dots.forEach((d, i) => d.setAttribute('class', A.has(i) ? 'a' : Tset.has(i) ? 'm' : candSet.has(i) ? 'c' : ''));
    qEl.setAttribute('transform', `translate(${q[0].toFixed(1)},${q[1].toFixed(1)})`);
    body.querySelector('.xp-stats').innerHTML = `
      <div class="xp-big"><b>${fmt(hit / K, 2)}</b><span>recall@${K} = |A ∩ T| / ${K} = ${hit} / ${K}</span></div>
      <div class="xp-big sm"><b>${cand.length}</b><span>of ${N} vectors compared exactly (${fmt(cand.length / N * 100, 1)}%) — ${nprobe} of ${nlist} cells probed</span></div>
      <p class="xp-msg ${miss.length ? 'warn' : 'ok'}">${miss.length ? `${miss.length} true neighbour${miss.length > 1 ? 's sit' : ' sits'} in a cell that was not probed — the cell-boundary miss. Raise nprobe or move the query.` : `Every exact top-${K} neighbour was found. Drag the query toward a cell border to make one fall outside.`}</p>`;
    markCurve();
  }
  let curve = null;
  function sweep() {
    const rec = new Array(nlist).fill(0), frac = new Array(nlist).fill(0);
    for (const qq of queries) {
      const T = new Set(exact(qq)), order = probeOrder(qq);
      let seen = 0, found = 0;
      order.forEach((c, j) => {
        for (let i = 0; i < N; i++) if (cells.asg[i] === c) { seen++; if (T.has(i)) found++; }
        rec[j] += found / K; frac[j] += seen / N;
      });
    }
    curve = { rec: rec.map(x => x / queries.length), frac: frac.map(x => x / queries.length) };
    const cs = body.querySelector('.xp-curve svg'), w = 300, h = 150, px = j => 30 + (nlist > 1 ? j / (nlist - 1) : 0) * (w - 44), py = v => h - 22 - v * (h - 34);
    const path = arr => arr.map((v, j) => `${j ? 'L' : 'M'}${px(j).toFixed(1)} ${py(v).toFixed(1)}`).join('');
    cs.innerHTML = `<line x1="30" y1="${py(0)}" x2="${w - 14}" y2="${py(0)}" class="ax"/><line x1="30" y1="${py(1)}" x2="${w - 14}" y2="${py(1)}" class="g"/>
      <text x="24" y="${py(1) + 4}" class="tk" text-anchor="end">1</text><text x="24" y="${py(0) + 4}" class="tk" text-anchor="end">0</text>
      <text x="${px(0)}" y="${h - 6}" class="tk">1</text><text x="${px(nlist - 1)}" y="${h - 6}" class="tk" text-anchor="end">${nlist}</text><text x="${(w + 16) / 2}" y="${h - 6}" class="tk" text-anchor="middle">nprobe</text>
      <path d="${path(curve.frac)}" class="fr"/><path d="${path(curve.rec)}" class="rc"/><g class="mk"></g>`;
    markCurve();
  }
  function markCurve() {
    if (!curve) return;
    const cs = body.querySelector('.xp-curve svg'), w = 300, h = 150, j = nprobe - 1, x = 30 + (nlist > 1 ? j / (nlist - 1) : 0) * (w - 44), py = v => h - 22 - v * (h - 34);
    const mk = cs.querySelector('.mk'); if (!mk) return;
    mk.innerHTML = `<line x1="${x}" x2="${x}" y1="${py(1)}" y2="${py(0)}" class="cur"/><circle cx="${x}" cy="${py(curve.rec[j])}" r="4" class="rc"/><text x="${x + 6}" y="${py(curve.rec[j]) - 6}" class="tk b">${fmt(curve.rec[j], 2)}</text>`;
  }
  dragger(svg, qEl, (x, y) => { q = [clamp(x, 4, W - 4), clamp(y, 4, H - 4)]; search(); });
  svg.addEventListener('click', e => { if (e.target.closest('.q')) return; const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const z = p.matrixTransform(svg.getScreenCTM().inverse()); q = [z.x, z.y]; search(); });
  qEl.addEventListener('keydown', e => { const d = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key]; if (!d) return; e.preventDefault(); q = [clamp(q[0] + d[0], 4, W - 4), clamp(q[1] + d[1], 4, H - 4)]; search(); });
  body.addEventListener('input', e => {
    const s = e.target.dataset.s; if (!s) return; const v = +e.target.value;
    body.querySelector(`[data-o="${s}"]`).textContent = v;
    if (s === 'nl') {
      nlist = v; const np = body.querySelector('[data-s="np"]'); np.max = nlist; nprobe = Math.min(nprobe, nlist); np.value = nprobe;
      body.querySelector('[data-o="np"]').textContent = nprobe; rebuild();
    } else { nprobe = v; search(); }
  });
  wireSeg(body, 'k', v => { K = +v; sweep(); search(); });
  rebuild();
  // open on a query that shows the chapter's failure: a true neighbour just across a cell border
  const missesAt = qq => { const probed = new Set(probeOrder(qq).slice(0, nprobe)); return exact(qq).filter(i => !probed.has(cells.asg[i])).length; };
  if (!missesAt(q)) {
    search: for (let rad = 10; rad < 220; rad += 10) for (let a = 0; a < 360; a += 20) {
      const c = [clamp(W / 2 + rad * Math.cos(a * Math.PI / 180), 20, W - 20), clamp(H / 2 + rad * Math.sin(a * Math.PI / 180), 20, H - 20)], m = missesAt(c);
      if (m >= 1 && m <= 3) { q = c; break search; }
    }
    search();
  }
}

/* ------------------------------------------------------------------ 4. retrieval metrics (rag-07) */
function metrics(body) {
  const INIT = [0, 2, 0, 0, 1, 0, 3, 0, 0, 1].map((g, i) => ({ id: String.fromCharCode(65 + i), g }));
  let rel = INIT.map(x => ({ ...x })), missed = [1], graded = true, k = 5, ranked = false;
  body.innerHTML = `<div class="xp-ctl"><div class="xp-row">${seg('gr', [['g', 'Graded relevance 0–3'], ['b', 'Binary relevant / not']], 'g')}${slider('k', { min: 1, max: 10, step: 1, value: k, id: 'k' })}</div></div>
    <div class="xp-split">
      <div><div class="xp-h">Retrieved, in rank order <span class="dim">— tap a passage to change its label</span></div><ol class="xp-list"></ol>
        <div class="xp-h">Relevant passages the retriever did not return <span class="xp-step"><button type="button" class="btn xs" data-m="-">−</button><b class="mc"></b><button type="button" class="btn xs" data-m="+">+</button></span></div>
        <div class="xp-row"><button type="button" class="btn sm primary" data-act="rerank">Rerank: best first</button><button type="button" class="btn sm" data-act="shuffle">Shuffle</button><button type="button" class="btn sm ghost" data-act="reset">Reset</button></div></div>
      <div class="xp-stats"></div></div>
    <p class="xp-note dim">One illustrative query. Over a query set, MRR is the mean of the reciprocal ranks and recall@k the mean of the per-query values. nDCG here uses gain = grade and discount = log₂(rank + 1), one common form.</p>`;
  const g = x => (graded ? x : x > 0 ? 1 : 0);
  function calc(R) {
    const G = R.map(x => g(x.g)), M = missed.map(g).filter(x => x > 0);
    const totalRel = G.filter(x => x > 0).length + M.length, topk = G.slice(0, k), relk = topk.filter(x => x > 0).length;
    const first = G.findIndex(x => x > 0);
    const dcg = topk.reduce((a, x, i) => a + x / Math.log2(i + 2), 0);
    const ideal = [...G.filter(x => x > 0), ...M].sort((a, b) => b - a).slice(0, k);
    const idcg = ideal.reduce((a, x, i) => a + x / Math.log2(i + 2), 0);
    return { hit: relk > 0 ? 1 : 0, recall: totalRel ? relk / totalRel : 0, recall10: totalRel ? G.filter(x => x > 0).length / totalRel : 0, prec: relk / k, rr: first < 0 ? 0 : 1 / (first + 1), first, ndcg: idcg ? dcg / idcg : 0, dcg, idcg, relk, totalRel };
  }
  let before = null;
  function render() {
    const m = calc(rel);
    body.querySelector('.xp-list').innerHTML = rel.map((x, i) => `<li class="${i < k ? 'in' : ''} g${g(x.g)}"><button type="button" data-i="${i}"><span class="n">${i + 1}</span><span class="t">Passage ${x.id}</span><span class="gr">${graded ? (x.g ? `grade ${x.g}` : 'not relevant') : x.g ? 'relevant' : 'not relevant'}</span></button></li>`).join('');
    body.querySelector('.mc').textContent = missed.length;
    const row = (name, v, sub, prev) => `<div class="xp-met"><span class="nm">${name}</span><b>${fmt(v, 3)}</b>${prev != null && Math.abs(prev - v) > 1e-9 ? `<em class="${v > prev ? 'up' : 'dn'}">${v > prev ? '▲' : '▼'} from ${fmt(prev, 3)}</em>` : ''}<span class="sub">${sub}</span></div>`;
    const b = before;
    body.querySelector('.xp-stats').innerHTML =
      row(`recall@${k} · hit`, m.hit, m.hit ? `a relevant passage is in the top ${k}, so this query counts toward the fraction` : `no relevant passage in the top ${k}`, b?.hit) +
      row(`recall@${k} · share of relevant`, m.recall, `${m.relk} of ${m.totalRel} relevant passages are in the top ${k}`, b?.recall) +
      row(`precision@${k}`, m.prec, `${m.relk} of the ${k} retrieved passages are relevant`, b?.prec) +
      row('reciprocal rank', m.rr, m.first < 0 ? 'no relevant passage retrieved' : `first relevant passage at rank ${m.first + 1} → 1/${m.first + 1}`, b?.rr) +
      row(`nDCG@${k}`, m.ndcg, `DCG ${fmt(m.dcg, 3)} ÷ ideal DCG ${fmt(m.idcg, 3)}`, b?.ndcg) +
      `<div class="xp-met funnel"><span class="nm">recall@10 · candidate set</span><b>${fmt(m.recall10, 3)}</b>${b && Math.abs(b.recall10 - m.recall10) > 1e-9 ? '' : b ? '<em class="eq">unchanged</em>' : ''}<span class="sub">${ranked ? 'Reordering the same ten passages cannot change this — only the top-k numbers move.' : 'Everything the first stage returned, whatever its order.'}</span></div>`;
  }
  body.querySelector('.xp-list').onclick = e => {
    const bt = e.target.closest('[data-i]'); if (!bt) return; const i = +bt.dataset.i;
    rel[i].g = graded ? (rel[i].g + 1) % 4 : rel[i].g ? 0 : 1; before = null; ranked = false; render();
  };
  body.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'), mm = e.target.closest('[data-m]');
    if (mm) { missed = mm.dataset.m === '+' ? [...missed, 1].slice(0, 6) : missed.slice(0, -1); before = null; render(); return; }
    if (!a) return;
    if (a.dataset.act === 'rerank') { before = calc(rel); rel = [...rel].sort((x, y) => g(y.g) - g(x.g)); ranked = true; }
    if (a.dataset.act === 'shuffle') { const r = rng(Date.now() | 0); for (let i = rel.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rel[i], rel[j]] = [rel[j], rel[i]]; } before = null; ranked = false; }
    if (a.dataset.act === 'reset') { rel = INIT.map(x => ({ ...x })); missed = [1]; before = null; ranked = false; }
    render();
  });
  body.addEventListener('input', e => { if (e.target.dataset.s !== 'k') return; k = +e.target.value; body.querySelector('[data-o="k"]').textContent = k; before = null; render(); });
  wireSeg(body, 'gr', v => { graded = v === 'g'; if (!graded) rel.forEach(x => { x.g = x.g ? 1 : 0; }); before = null; render(); });
  render();
}

/* ------------------------------------------------------------------ 5. LoRA (ftn-02) */
function lora(body) {
  const DS = [256, 512, 1024, 2048, 4096, 8192], RS = [1, 2, 4, 8, 16, 32, 64, 128, 256];
  let di = 3, ri = 3, n = 1;
  body.innerHTML = `<div class="xp-ctl"><div class="xp-row">${slider('d (matrix is d × d)', { min: 0, max: DS.length - 1, step: 1, value: di, id: 'd', fmtv: i => DS[i].toLocaleString() })}${slider('rank r', { min: 0, max: RS.length - 1, step: 1, value: ri, id: 'r', fmtv: i => RS[i] })}${slider('matrices adapted', { min: 1, max: 64, step: 1, value: n, id: 'n' })}</div></div>
    <div class="xp-split"><div class="xp-mat"><svg viewBox="0 0 320 300" class="xp-svg" role="img" aria-label="Weight matrix W with LoRA factors A and B drawn to scale"></svg></div><div class="xp-stats"></div></div>
    <p class="xp-note dim">Per adapted d × d weight matrix: W is frozen; A (r × d) and B (d × r) are trained; the layer computes Wx + BAx. Which and how many matrices get an adapter is the target-modules choice.</p>`;
  const svg = body.querySelector('svg');
  function render() {
    const d = DS[di], r = RS[ri], full = d * d, lo = 2 * r * d, side = 200, t = Math.max(1.2, side * r / d);
    svg.innerHTML = `<rect x="60" y="70" width="${side}" height="${side}" class="w"/><text x="160" y="175" class="wl" text-anchor="middle">W  ${d.toLocaleString()} × ${d.toLocaleString()}</text><text x="160" y="195" class="wl s" text-anchor="middle">frozen</text>
      <rect x="60" y="${60 - t}" width="${side}" height="${t}" class="a"/><text x="160" y="${52 - t}" class="al" text-anchor="middle">A  ${r} × ${d.toLocaleString()} (trainable)</text>
      <rect x="${268}" y="70" width="${t}" height="${side}" class="b"/><text x="${276 + t}" y="80" class="al" transform="rotate(90 ${276 + t} 80)">B  ${d.toLocaleString()} × ${r} (trainable)</text>`;
    const ratio = full / lo;
    body.querySelector('.xp-stats').innerHTML = `
      <div class="xp-big"><b>${(n * lo).toLocaleString()}</b><span>trainable with LoRA = ${n > 1 ? n + ' × ' : ''}(r·d + d·r) = ${n > 1 ? n + ' × ' : ''}2 × ${r} × ${d.toLocaleString()}</span></div>
      <div class="xp-big sm"><b>${(n * full).toLocaleString()}</b><span>trainable with full fine-tuning = ${n > 1 ? n + ' × ' : ''}d² for the same matrices</span></div>
      <div class="xp-ratio"><div class="bar"><i style="width:${Math.max(.4, (lo / full) * 100)}%"></i></div><span>LoRA trains ${fmt((lo / full) * 100, lo / full < .01 ? 3 : 2)}% of the parameters — ${ratio >= 1 ? `${fmt(ratio, ratio < 10 ? 1 : 0)}× fewer` : `${fmt(1 / ratio, 1)}× more (r is no longer small next to d)`}</span></div>
      <p class="xp-msg">LoRA's count is linear in r (and in d): doubling either doubles it. Full fine-tuning's count grows with d².</p>`;
  }
  body.addEventListener('input', e => {
    const s = e.target.dataset.s; if (!s) return; const v = +e.target.value;
    if (s === 'd') di = v; if (s === 'r') ri = v; if (s === 'n') n = v;
    body.querySelector(`[data-o="${s}"]`).textContent = s === 'd' ? DS[v].toLocaleString() : s === 'r' ? RS[v] : v;
    render();
  });
  render();
}
