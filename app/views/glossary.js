import { $, $$, esc, h, modVar } from '../lib/ui.js';
import * as G from '../lib/graph.js';
import { CONTENT } from '../main.js';

async function glossary(el, params, query) {
  let q = '';
  const draw = () => {
    const f = q.toLowerCase().trim();
    const terms = CONTENT.glossary.filter(t => !f || (t.term + ' ' + t.def).toLowerCase().includes(f));
    el.innerHTML = h`<div class="page">
      <div class="ph"><div><span class="eyebrow">Reference</span><h1>Glossary</h1><p>${CONTENT.glossary.length} shared terms, each defined in two sentences or fewer and used across three or more chapters. The same definitions appear as hover cards inside chapters.</p></div></div>
      <div class="filterbar"><input id="gq" placeholder="Filter terms…" value="${esc(q)}"></div>
      <div class="glist">${terms.map(t => `<div class="gterm" id="${t.anchor}"><h3>${esc(t.term)}</h3><p>${esc(t.def)}</p><div class="see">${t.see.map(id => { const c = G.get(id); return c ? `<a class="chip mod" style="--mc:${modVar(c.module)}" href="#/c/${id}" title="${esc(c.title)}">${id}</a>` : `<span class="chip">${esc(id)}</span>`; }).join('')}</div></div>`).join('') || '<div class="empty">No terms match.</div>'}</div>
    </div>`;
    const inp = $('#gq', el); inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; draw(); const i2 = $('#gq', el); i2.focus(); i2.setSelectionRange(pos, pos); };
  };
  draw();
  const target = params.term || query.s;
  if (target) requestAnimationFrame(() => { const t = $('#' + CSS.escape(target), el); if (t) { t.scrollIntoView({ block: 'center' }); t.style.borderColor = 'var(--accent)'; } });
}
export default { glossary };
