import { $, $$, esc, h, ico, fmtMins, modVar, diffDots } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import { CONTENT } from '../main.js';

async function chapters(el, params, query) {
  let filter = '', mode = 'all';
  const draw = () => {
    const f = filter.toLowerCase().trim();
    const rows = m => (m.chapters.map(G.get).filter(Boolean)).filter(c => {
      const st = G.nodeState(c.id);
      if (mode === 'available' && st !== 'available' && st !== 'reading') return false;
      if (mode === 'done' && st !== 'done') return false;
      if (mode === 'todo' && st === 'done') return false;
      return !f || (c.id + ' ' + c.title + ' ' + (c.keywords || []).join(' ') + ' ' + (c.objective || '')).toLowerCase().includes(f);
    });
    const ov = G.overall();
    el.innerHTML = h`<div class="page">
      <div class="ph"><div><span class="eyebrow">Curriculum</span><h1>All chapters</h1><p>${CONTENT.stats.chapters} chapters across ${CONTENT.modules.length - 1} modules, plus ${CONTENT.stats.engineering} engineering references. Prerequisites gate what is "available"; you can always open anything.</p></div>
        <div class="row"><span class="chip done">${ov.done} done</span><span class="chip">${ov.total - ov.done} to go</span></div></div>
      <div class="filterbar"><input id="cf" placeholder="Filter by id, title, keyword…" value="${esc(filter)}"><div class="seg">${[['all', 'All'], ['available', 'Available'], ['todo', 'Not done'], ['done', 'Done']].map(([k, l]) => `<button type="button" data-mode="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${CONTENT.modules.map(m => {
        const rs = rows(m); if (!rs.length) return '';
        const mp = G.moduleProgress(m.key);
        return `<div id="${m.key}" style="--mc:${modVar(m.key)}"><div class="modhead"><span class="swatch"></span><h2>${m.n < 10 ? m.n + ' · ' : ''}${esc(m.label)}</h2><span class="meta">${mp.done}/${mp.total} done${m.hours ? ` · ~${m.hours}h` : ''}</span></div>
          <p class="dim" style="font-size:13.5px;margin:-4px 0 10px;max-width:70ch">${esc(m.description)}</p>
          ${rs.map(c => {
            const st = G.nodeState(c.id); const p = Math.round(G.sectionProgress(c.id) * 100);
            return `<a class="chaprow ${st}" href="#/c/${c.id}" style="--p:${p}"><span class="st">${st === 'done' ? '✓' : ''}</span><span class="cid">${c.id}</span><span><span class="t">${esc(c.title)}</span><span class="obj">${esc(c.objective || c.summary || '')}</span></span>${diffDots(c.difficulty || 0)}<span class="mins">${fmtMins(c.est_minutes)}</span></a>`;
          }).join('')}</div>`;
      }).join('')}
    </div>`;
    const inp = $('#cf', el); inp.oninput = () => { filter = inp.value; const pos = inp.selectionStart; draw(); const i2 = $('#cf', el); i2.focus(); i2.setSelectionRange(pos, pos); };
    $$('[data-mode]', el).forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
  };
  draw();
  if (query.s) requestAnimationFrame(() => $('#' + CSS.escape(query.s), el)?.scrollIntoView({ block: 'start' }));
  return store.subscribe(draw);
}
export default { chapters };
