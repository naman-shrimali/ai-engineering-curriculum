/* App shell: boot, router, navigation, command palette, theme, account. */
import { $, $$, esc, h, ico, toast, modVar, fmtMins, highlight } from './lib/ui.js';
import * as store from './lib/store.js';
import * as G from './lib/graph.js';
import * as MD from './lib/md.js';
import { isDue } from './lib/srs.js';

export const BASE = new URL('./', location.href).href;   // repo root (works at a subpath)
export let CONTENT = null;
const views = {};
let current = { name: null, teardown: null };

const NAV = [
  ['#/', 'home', 'Home'], ['#/map', 'map', 'Curriculum map'], ['#/concepts', 'concepts', 'Concept graph'],
  ['#/chapters', 'book', 'Chapters'], ['#/diagrams', 'diagram', 'Diagrams'], ['#/cards', 'cards', 'Flashcards'], ['#/practice', 'practice', 'Practice'],
  ['#/glossary', 'glossary', 'Glossary'], ['#/reading', 'reading', 'Reading list'],
];
const TABS = [['#/', 'home', 'Home'], ['#/map', 'map', 'Map'], ['#/chapters', 'book', 'Chapters'], ['#/cards', 'cards', 'Cards']];

/* ---------------- boot ---------------- */
async function boot() {
  try {
    CONTENT = await (await fetch(BASE + 'app/data/content.json', { cache: 'no-cache' })).json();
  } catch (e) {
    $('#view').innerHTML = `<div class="boot"><p>Could not load <code>app/data/content.json</code>. Run <code>python3 scripts/build-content.py</code> and serve the repo root (<code>./read.sh</code>).</p></div>`;
    return;
  }
  G.init(CONTENT); MD.init(CONTENT);
  const mods = await Promise.all([
    import('./views/home.js'), import('./views/map.js'), import('./views/concepts.js'), import('./views/chapters.js'),
    import('./views/chapter.js'), import('./views/cards.js'), import('./views/practice.js'), import('./views/glossary.js'),
    import('./views/reading.js'), import('./views/doc.js'), import('./views/profile.js'), import('./views/diagrams.js'),
  ]);
  for (const m of mods) Object.assign(views, m.default);
  renderNav(); wireChrome();
  store.subscribe(() => renderNav());
  addEventListener('hashchange', route);
  route();
  import('./lib/auth.js').then(a => a.init()).catch(e => console.warn('auth unavailable', e));
}

/* ---------------- router ---------------- */
export function parseHash() {
  let hsh = location.hash.slice(1) || '/';
  // legacy reader links: #modules/03-retrieval/rag-05-rag-pipeline.md
  if (!hsh.startsWith('/')) {
    const m = hsh.match(/\/([a-z]{3}-\d\d)-[^/]+\.md$/);
    if (m) return { name: 'chapter', params: { id: m[1] }, query: {} };
    if (hsh.endsWith('.md')) return { name: 'doc', params: { path: hsh }, query: {} };
    return { name: 'home', params: {}, query: {} };
  }
  const [p0, frag] = hsh.split('#');
  const [path, qs] = p0.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  if (frag) query.s = query.s || frag;
  const seg = path.split('/').filter(Boolean);
  const table = { '': 'home', map: 'map', concepts: 'concepts', chapters: 'chapters', c: 'chapter', cards: 'cards', practice: 'practice', glossary: 'glossary', reading: 'reading', doc: 'doc', profile: 'profile', diagrams: 'diagrams' };
  const name = table[seg[0] || ''] || 'home';
  const params = name === 'chapter' ? { id: seg[1] } : name === 'doc' ? { path: seg.slice(1).join('/') } : name === 'glossary' ? { term: seg[1] } : {};
  return { name, params, query };
}

async function route() {
  const r = parseHash();
  const view = views[r.name] || views.home;
  if (current.teardown) { try { current.teardown(); } catch (e) { /* */ } }
  current = { name: r.name, teardown: null };
  $$('.nav a, .tabbar a').forEach(a => a.classList.toggle('on', isActive(a.getAttribute('href'), r)));
  const main = $('#main'); main.scrollTop = 0;
  const el = $('#view'); el.className = 'view view-' + r.name;
  try {
    current.teardown = await view(el, r.params, r.query) || null;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="page"><div class="empty">Something went wrong rendering this view.<br><code>${esc(e.message)}</code></div></div>`;
  }
  drawer(false);
}
function isActive(href, r) {
  const n = parseHash.call(null); void n;
  if (href === '#/') return r.name === 'home';
  const key = href.slice(2).split('/')[0];
  return r.name === key || (key === 'chapters' && (r.name === 'chapter' || r.name === 'doc'));
}
export function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

/* ---------------- nav ---------------- */
function dueCount() {
  let n = 0; const at = Date.now();
  for (const c of CONTENT.chapters) for (let i = 0; i < (c.flashcards || []).length; i++) if (isDue(store.state.cards[`${c.id}:${i}`], at)) n++;
  return n;
}
function renderNav() {
  const r = parseHash();
  const due = dueCount();
  $('#nav').innerHTML = NAV.map(([href, icon, label]) =>
    `<a href="${href}" class="${isActive(href, r) ? 'on' : ''}">${ico(icon)}<span class="lbl">${label}</span>${href === '#/cards' && due ? `<span class="badge-n num">${due > 999 ? '999+' : due}</span>` : ''}</a>`
  ).join('') + `<div class="sep"></div><div class="grp">Reference</div>` +
    [['README.md', 'About this curriculum'], ['curriculum/roadmap.md', 'Roadmap'], ['reading-list.md', 'Papers & blogs'], ['CONVENTIONS.md', 'Conventions']]
      .map(([p, t]) => `<a href="#/doc/${p}" class="${r.name === 'doc' && r.params.path === p ? 'on' : ''}">${ico('reading')}<span class="lbl">${t}</span></a>`).join('');
  $('#tabbar').innerHTML = TABS.map(([href, icon, label]) => `<a href="${href}" class="${isActive(href, r) ? 'on' : ''}">${ico(icon)}${label}</a>`).join('') + `<button type="button" id="tab-more">${ico('menu')}More</button>`;
  $('#tab-more').onclick = () => drawer(true);
}

/* ---------------- chrome ---------------- */
export function drawer(on) {
  const sb = $('#rail'); const want = on === undefined ? !sb.classList.contains('open') : on;
  sb.classList.toggle('open', want); $('#scrim').classList.toggle('on', want);
}
export function toggleTheme() {
  const next = MD.isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('aiec.theme', next); } catch (e) { /* */ }
  MD.initMermaid(); route();
}
function wireChrome() {
  $('#btn-theme').onclick = toggleTheme;
  $('#btn-search').onclick = () => openPalette();
  $('#scrim').onclick = () => drawer(false);
  addEventListener('keydown', e => {
    const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); openPalette(); }
    if (e.key === 't' && !e.metaKey && !e.ctrlKey) toggleTheme();
  });
}

/* ---------------- command palette ---------------- */
let palIndex = null;
function buildIndex() {
  const out = [];
  for (const c of [...CONTENT.chapters, ...CONTENT.engineering]) {
    out.push({ kind: 'chapter', id: c.id, mod: c.module, title: c.title, sub: c.objective || c.summary || '', href: '#/c/' + c.id,
      text: [c.id, c.title, ...(c.keywords || []), c.summary || ''].join(' ').toLowerCase(), mins: c.est_minutes });
    for (const s of c.sections || []) if (!/^(sources|check your understanding|flashcards|further reading|revision summary)$/i.test(s.h))
      out.push({ kind: 'section', id: c.id, mod: c.module, title: s.h, sub: c.title, href: `#/c/${c.id}?s=${s.anchor}`, text: (c.id + ' ' + s.h).toLowerCase() });
  }
  for (const g of CONTENT.glossary) out.push({ kind: 'term', id: 'term', mod: 'meta', title: g.term, sub: g.def, href: '#/glossary#' + g.anchor, text: (g.term + ' ' + g.def).toLowerCase() });
  for (const [href, , label] of NAV) out.push({ kind: 'nav', id: '', mod: 'meta', title: label, sub: 'Go to', href, text: label.toLowerCase() });
  return out;
}
function search(q) {
  q = q.trim().toLowerCase(); if (!palIndex) palIndex = buildIndex();
  if (!q) return palIndex.filter(x => x.kind === 'chapter').slice(0, 12);
  const terms = q.split(/\s+/);
  return palIndex.map(x => {
    let s = 0;
    for (const t of terms) {
      if (!x.text.includes(t)) return null;
      if (x.title.toLowerCase().startsWith(t)) s += 6; else if (x.title.toLowerCase().includes(t)) s += 3; else s += 1;
      if (x.id === t) s += 10;
    }
    s += { chapter: 3, section: 1, term: 2, nav: 0 }[x.kind];
    return { x, s };
  }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 14).map(r => r.x);
}
export function openPalette(prefill = '') {
  const pal = $('#palette'); pal.hidden = false;
  pal.innerHTML = `<div class="pal" role="dialog" aria-label="Search"><input id="pal-q" placeholder="Search chapters, sections, glossary…" autocomplete="off" spellcheck="false" value="${esc(prefill)}"><div class="list" id="pal-list"></div><div class="hint"><span>↑↓ move</span><span>↵ open</span><span>esc close</span></div></div>`;
  const input = $('#pal-q'), list = $('#pal-list'); let sel = 0, items = [];
  const draw = () => {
    items = search(input.value);
    list.innerHTML = items.map((x, i) => `<div class="it ${i === sel ? 'on' : ''}" data-i="${i}" style="--mc:${modVar(x.mod)}"><span class="cid">${x.kind === 'term' ? 'term' : x.kind === 'nav' ? '→' : x.id}</span><span><span class="t">${highlight(x.title, input.value.trim())}</span><span class="s">${esc(x.sub).slice(0, 110)}</span></span><span class="k">${x.kind === 'chapter' ? fmtMins(x.mins) : x.kind}</span></div>`).join('')
      || `<div class="it"><span></span><span class="s">No matches</span></div>`;
    $$('.it', list).forEach(el => { el.onmouseenter = () => { sel = +el.dataset.i; $$('.it', list).forEach(e => e.classList.toggle('on', +e.dataset.i === sel)); }; el.onclick = () => choose(); });
  };
  const close = () => { pal.hidden = true; pal.innerHTML = ''; };
  const choose = () => { const x = items[sel]; if (x) { close(); go(x.href); } };
  input.oninput = () => { sel = 0; draw(); };
  input.onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); $('.it.on', list)?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); $('.it.on', list)?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') choose(); if (e.key === 'Escape') close();
  };
  pal.onclick = e => { if (e.target === pal) close(); };
  draw(); input.focus(); input.select();
}

boot();
