/* Diagrams hub: every diagram in the curriculum in one place, each one live and interactive.
   The list is built from the chapter index; each diagram is drawn from its chapter's own source. */
import { $, $$, esc, h, modVar } from '../lib/ui.js';
import * as MD from '../lib/md.js';
import { mountDiagrams, describe } from '../lib/diagrams.js';
import { EXPLORABLES, mountExplorable } from '../lib/explorables.js';
import { CONTENT, go } from '../main.js';

const KINDS = ['explorable', 'decision tree', 'state machine', 'sequence', 'timeline', 'feedback loop', 'flow'];
const ABOUT = {
  explorable: '',
  'decision tree': 'answer each question and follow it to an outcome',
  'state machine': 'run it: choose each transition from the initial state',
  sequence: 'play the messages in order between participants',
  timeline: 'move a playhead through every start and end',
  'feedback loop': 'trace the cycle and step through it',
  flow: 'trace what feeds each step and step through it',
};

const order = c => { const i = CONTENT.chapters.indexOf(c); return i < 0 ? 1000 + CONTENT.engineering.indexOf(c) : i; };

async function diagrams(el, params, query) {
  const items = [];
  for (const c of [...CONTENT.chapters, ...CONTENT.engineering]) {
    (c.diagrams || []).forEach((d, i) => {
      const sec = (c.sections || []).find(s => s.anchor === d.section);
      items.push({ key: `${c.id}-${i + 1}`, c, d, cap: (d.caption || '').replace(/:\s*$/, '') || sec?.h || c.title, sec, kind: null, facts: '' });
    });
  }
  for (const e of EXPLORABLES) {
    const c = [...CONTENT.chapters, ...CONTENT.engineering].find(x => x.id === e.chapter); if (!c) continue;
    items.push({ key: 'x-' + e.id, c, d: { section: e.anchor }, cap: e.title, sec: (c.sections || []).find(s => s.anchor === e.anchor), kind: 'explorable', facts: 'simulation', xp: e });
  }
  items.sort((a, b) => order(a.c) - order(b.c) || (a.xp ? 1 : 0) - (b.xp ? 1 : 0));
  let kind = query.k && KINDS.includes(query.k) ? query.k : 'all', q = '', sel = query.d && items.some(x => x.key === query.d) ? query.d : null;

  el.innerHTML = h`<div class="page dgal">
    <div class="ph"><div><span class="eyebrow">Interactive</span><h1>Diagrams</h1>
      <p>All ${items.filter(x => !x.xp).length} diagrams in the curriculum, live, plus ${EXPLORABLES.length} explorables. Answer the decision trees, run the state machines, play the sequences. Each diagram is drawn from its chapter's own source, so labels and connections are exactly what the chapter says; each explorable implements definitions its chapter states and quotes them.</p></div></div>
    <div class="filterbar dg-filters" id="dg-f"></div>
    <div class="dg-grid">
      <div class="dg-list" id="dg-list" role="listbox" aria-label="Diagrams"></div>
      <div class="dg-stage" id="dg-stage"><div class="dg-meta" id="dg-meta"></div><div class="dg-host" id="dg-host"></div></div>
    </div>
  </div>`;

  const list = $('#dg-list', el), host = $('#dg-host', el), meta = $('#dg-meta', el), fbar = $('#dg-f', el);
  const visible = () => items.filter(x => (kind === 'all' || x.kind === kind) && (!q || (x.cap + ' ' + x.c.id + ' ' + x.c.title).toLowerCase().includes(q)));
  const drawFilters = () => {
    const n = k => items.filter(x => x.kind === k).length;
    fbar.innerHTML = `<button type="button" class="chip ${kind === 'all' ? 'on' : ''}" data-k="all">All <b>${items.length}</b></button>` +
      KINDS.filter(n).map(k => `<button type="button" class="chip ${kind === k ? 'on' : ''}" data-k="${k}">${k}s <b>${n(k)}</b></button>`).join('') +
      `<input id="dg-q" placeholder="Filter by caption or chapter…" value="${esc(q)}" aria-label="Filter diagrams">`;
    $('#dg-q', fbar).oninput = e => { q = e.target.value.toLowerCase().trim(); drawList(); };
  };
  fbar.onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; drawFilters(); drawList(); };
  const drawList = () => {
    const vis = visible();
    list.innerHTML = vis.map(x => `<button type="button" role="option" class="dg-item ${x.key === sel ? 'on' : ''}" data-key="${x.key}" aria-selected="${x.key === sel}" style="--mc:${modVar(x.c.module)}">
        <span class="cid">${x.c.id}</span><span class="b"><span class="t">${esc(x.cap)}</span><span class="s">${esc(x.kind || '…')}${x.facts ? ' · ' + x.facts : ''}</span></span></button>`).join('') || '<div class="empty">No diagrams match.</div>';
  };
  list.onclick = e => { const b = e.target.closest('[data-key]'); if (b) open(b.dataset.key, true); };

  const open = async (key, user) => {
    const x = items.find(i => i.key === key); if (!x) return;
    sel = key;
    for (const b of $$('.dg-item', list)) { const on = b.dataset.key === key; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
    history.replaceState(null, '', '#/diagrams?d=' + key + (kind !== 'all' ? '&k=' + encodeURIComponent(kind) : ''));
    host.style.setProperty('--mc', modVar(x.c.module));
    meta.innerHTML = `<a class="chip mod" style="--mc:${modVar(x.c.module)}" href="#/c/${x.c.id}">${x.c.id}</a><span class="t">${esc(x.c.title)}${x.sec ? ` <span class="dim">· ${esc(x.sec.h)}</span>` : ''}</span>
      <a class="btn sm" href="#/c/${x.c.id}${x.d.section ? '?s=' + encodeURIComponent(x.d.section) : ''}">Read it in context →</a>
      ${x.kind ? `<span class="dg-about">${esc(x.xp ? x.xp.blurb : ABOUT[x.kind] || '')}</span>` : ''}`;
    if (x.xp) { host.innerHTML = '<div></div>'; mountExplorable(host.firstChild, x.xp.id); return; }
    host.innerHTML = `<p class="capwrap"><em class="cap">${esc(x.d.caption || x.cap)}</em></p><div class="mermaid-src" data-src="${esc(x.d.src)}"></div>`;
    if (user && matchMedia('(max-width: 900px)').matches) $('#dg-stage', el).scrollIntoView({ block: 'start', behavior: 'smooth' });
    await mountDiagrams(host, { onNavigate: id => go('#/c/' + id), lookup: MD.chapterById });
  };

  drawFilters(); drawList();
  if (sel) open(sel, false);
  const opened = sel;
  // classify every diagram from Mermaid's parse of its source, then fill in kinds and counts
  for (const x of items) {
    if (x.xp) continue;
    const info = await describe(x.d.src);
    if (!el.isConnected) return;
    x.kind = info.kind; x.facts = info.facts;
  }
  drawFilters(); drawList();
  if (!sel) sel = (items.find(x => x.kind === (kind === 'all' ? 'decision tree' : kind)) || items[0])?.key;
  if (!visible().some(x => x.key === sel)) sel = visible()[0]?.key;
  if (sel && sel !== opened) open(sel, false);
  else if (sel) { const x = items.find(i => i.key === sel); const ab = $('#dg-meta', el); if (x && ab && !ab.querySelector('.dg-about')) ab.insertAdjacentHTML('beforeend', `<span class="dg-about">${esc(ABOUT[x.kind] || '')}</span>`); }
}
export default { diagrams };
