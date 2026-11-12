/* Practice: self-test questions, interview drills and misconception checks,
   per chapter or as a mixed drill across what you have studied. */
import { $, $$, esc, h, ico, modVar } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import { inline } from '../lib/md.js';
import { CONTENT } from '../main.js';

const gradeBtns = g => [['0', 'Couldn’t'], ['1', 'Partly'], ['2', 'Nailed it']].map(([v, l]) => `<button type="button" data-g="${v}" class="g${v} ${g == +v ? 'on' : ''}">${l}</button>`).join('');
const gmark = g => `<span class="gmark ${g != null ? 'g' + g : ''}"></span>`;

function qaCheck(c, q, i) { const g = store.prog(c.id)?.checks?.[i]?.g; return `<div class="qa" data-kind="check" data-c="${c.id}" data-i="${i}"><div class="q"><span class="n">${i + 1}</span><span>${inline(q, c.path)}</span>${gmark(g)}<span class="car">${ico('chev')}</span></div><div class="a"><div class="dim" style="font-size:13px">Answer out loud or on paper, then grade yourself. <a href="#/c/${c.id}">Re-read ${c.id}</a> if you are unsure.</div><div class="grade"><small>How did it go?</small>${gradeBtns(g)}</div></div></div>`; }
function qaInterview(c, q, i) { const g = store.prog(c.id)?.interview?.[i]?.g; return `<div class="qa" data-kind="interview" data-c="${c.id}" data-i="${i}"><div class="q"><span class="n">${i + 1}</span><span>${inline(q.q, c.path)}</span>${gmark(g)}<span class="car">${ico('chev')}</span></div><div class="a"><textarea placeholder="Sketch your answer first — key points, trade-offs, numbers…" id="pv-${c.id}-${i}"></textarea><button class="btn sm reveal" type="button">Reveal model answer</button><div class="model" hidden><span class="eyebrow" style="display:block;margin-bottom:6px">Model answer</span>${inline(q.a, c.path)}</div><div class="grade" hidden><small>Compared to the model answer</small>${gradeBtns(g)}</div></div></div>`; }
function qaMyth(c, m, i) { return `<div class="qa" data-kind="myth"><div class="q"><span class="n">${i + 1}</span><span>“${inline(m.claim, c.path)}” — why is this wrong?</span><span class="car">${ico('chev')}</span></div><div class="a"><div class="model">${inline(m.why, c.path)}</div></div></div>`; }

function wire(root) {
  $$('.qa', root).forEach(qa => {
    qa.querySelector('.q').onclick = () => qa.classList.toggle('open');
    const r = qa.querySelector('.reveal'); if (r) r.onclick = () => { r.hidden = true; qa.querySelector('.model').hidden = false; qa.querySelector('.grade').hidden = false; };
    const ta = qa.querySelector('textarea'); if (ta) { try { ta.value = sessionStorage.getItem(ta.id) || ''; } catch (e) { /* */ } ta.oninput = () => { try { sessionStorage.setItem(ta.id, ta.value); } catch (e) { /* */ } }; }
    $$('.grade button', qa).forEach(btn => btn.onclick = () => { const g = +btn.dataset.g; const id = qa.dataset.c, i = +qa.dataset.i; (qa.dataset.kind === 'check' ? store.setCheck : store.setInterview)(id, i, g); $$('.grade button', qa).forEach(x => x.classList.toggle('on', x === btn)); qa.querySelector('.gmark').className = 'gmark g' + g; });
  });
}

async function practice(el, params, query) {
  let cid = query.c || null, tab = query.t || 'check';
  const studied = () => CONTENT.chapters.filter(c => store.status(c.id));
  const draw = () => {
    const c = cid && cid !== 'mixed' ? G.get(cid) : null;
    const scoreOf = ch => { const p = store.prog(ch.id); const gs = [...Object.values(p?.checks || {}), ...Object.values(p?.interview || {})].map(x => x.g); return gs.length ? Math.round(100 * gs.reduce((a, b) => a + b, 0) / (2 * gs.length)) : null; };
    el.innerHTML = h`<div class="page narrow">
      <div class="ph"><div><span class="eyebrow">Practice</span><h1>${c ? esc(c.title) : cid === 'mixed' ? 'Mixed drill' : 'Practice'}</h1><p>${c ? 'Self-test questions, interview drills and misconceptions from this chapter. Self-grades feed your chapter mastery.' : 'Pick a chapter, or run a mixed drill over everything you have started. Questions and model answers come straight from the chapters.'}</p></div>
        ${c ? `<div class="row"><a class="btn sm" href="#/c/${c.id}">${ico('book')} Open chapter</a><a class="btn sm ghost" href="#/cards?c=${c.id}">${ico('cards')} Cards</a></div>` : ''}</div>
      <div class="filterbar"><select id="pc"><option value="">Choose a chapter…</option><option value="mixed" ${cid === 'mixed' ? 'selected' : ''}>Mixed drill (${studied().length} chapters studied)</option>${CONTENT.modules.filter(m => m.n < 10).map(m => `<optgroup label="${esc(m.label)}">${m.chapters.map(G.get).filter(Boolean).map(x => `<option value="${x.id}" ${cid === x.id ? 'selected' : ''}>${x.id} · ${esc(x.title)}${scoreOf(x) != null ? ` (${scoreOf(x)}%)` : ''}</option>`).join('')}</optgroup>`).join('')}</select>
        ${c ? `<div class="seg">${[['check', `Self-test · ${c.check.length}`], ['interview', `Interview · ${c.interview.length}`], ['myths', `Misconceptions · ${c.misconceptions.length}`]].map(([k, l]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}</div>
      <div id="body"></div></div>`;
    const body = $('#body', el);
    if (c) {
      const p = store.prog(c.id);
      body.innerHTML = tab === 'check' ? `<div class="block" style="--mc:${modVar(c.module)}"><div class="bh"><b>Check your understanding</b><span class="dim">${Object.keys(p?.checks || {}).length}/${c.check.length} graded</span></div>${c.check.map((q, i) => qaCheck(c, q, i)).join('')}</div>`
        : tab === 'interview' ? `<div class="block" style="--mc:${modVar(c.module)}"><div class="bh"><b>Interview questions</b><span class="dim">${Object.keys(p?.interview || {}).length}/${c.interview.length} graded</span></div>${c.interview.map((q, i) => qaInterview(c, q, i)).join('')}</div>`
        : `<div class="block" style="--mc:${modVar(c.module)}"><div class="bh"><b>Common misconceptions</b><span class="dim">explain the flaw, then reveal</span></div>${c.misconceptions.map((m, i) => qaMyth(c, m, i)).join('')}</div>`;
    } else if (cid === 'mixed') {
      const pool = []; for (const ch of studied()) { ch.check.forEach((q, i) => pool.push({ ch, kind: 'check', q, i })); ch.interview.forEach((q, i) => pool.push({ ch, kind: 'interview', q, i })); }
      const pick = shuffle(pool).slice(0, 10);
      body.innerHTML = pick.length ? `<div class="block"><div class="bh"><b>10 random questions</b><span class="dim">from ${new Set(pick.map(x => x.ch.id)).size} chapters · <a href="#" id="reroll">reshuffle</a></span></div>${pick.map((x, n) => { const html = x.kind === 'check' ? qaCheck(x.ch, x.q, x.i) : qaInterview(x.ch, x.q, x.i); return html.replace(`<span class="n">${x.i + 1}</span>`, `<span class="n" title="${x.ch.id}">${n + 1}</span><span class="cid" style="font:600 11px var(--mono);color:${modVar(x.ch.module)};padding-top:3px">${x.ch.id}</span>`); }).join('')}</div>` : `<div class="empty">Open a chapter first — the mixed drill draws from chapters you have started.</div>`;
      $('#reroll', body) && ($('#reroll', body).onclick = e => { e.preventDefault(); draw(); });
    } else {
      const list = CONTENT.chapters.filter(x => store.status(x.id)); const rest = G.nextUp(store.state.track, 3);
      body.innerHTML = `${list.length ? `<h2 style="font-size:16px;margin-bottom:10px">Chapters you have started</h2><div class="nextlist">${list.map(x => `<button type="button" class="chapcard" data-pick="${x.id}" style="--mc:${modVar(x.module)};text-align:left"><span class="cid">${x.id}</span><span><span class="t">${esc(x.title)}</span><span class="s">${x.check.length + x.interview.length} questions${scoreOf(x) != null ? ` · ${scoreOf(x)}% so far` : ''}</span></span><span class="mins">${ico('chev')}</span></button>`).join('')}</div>` : ''}
        ${rest.length ? `<h2 style="font-size:16px;margin:24px 0 10px">Up next</h2><div class="nextlist">${rest.map(x => `<button type="button" class="chapcard" data-pick="${x.id}" style="--mc:${modVar(x.module)};text-align:left"><span class="cid">${x.id}</span><span><span class="t">${esc(x.title)}</span><span class="s">${x.check.length + x.interview.length} questions</span></span><span class="mins">${ico('chev')}</span></button>`).join('')}</div>` : ''}`;
      $$('[data-pick]', body).forEach(b => b.onclick = () => { cid = b.dataset.pick; draw(); });
    }
    wire(body);
    $('#pc', el).onchange = e => { cid = e.target.value || null; tab = 'check'; draw(); };
    $$('[data-tab]', el).forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
  };
  draw();
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export default { practice };
