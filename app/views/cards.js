/* Flashcard trainer: spaced repetition over every chapter's flashcards. */
import { $, $$, esc, h, ico, modVar, toast } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import { schedule, isDue, preview } from '../lib/srs.js';
import { inline } from '../lib/md.js';
import { CONTENT } from '../main.js';

function allCards() {
  const out = [];
  for (const c of CONTENT.chapters) (c.flashcards || []).forEach((f, i) => out.push({ id: `${c.id}:${i}`, ch: c, i, q: f.q, a: f.a }));
  return out;
}
function mastered(card) { return card && card.interval >= 21; }

async function cards(el, params, query) {
  let scope = query.c || query.m || 'all', queue = [], cur = null, flipped = false, reviewed = 0, mode = 'due';
  const pool = () => allCards().filter(k => scope === 'all' || k.ch.id === scope || k.ch.module === scope);
  const build = () => {
    const at = Date.now(); const p = pool();
    queue = mode === 'due' ? p.filter(k => isDue(store.state.cards[k.id], at)).sort((a, b) => (store.state.cards[a.id]?.due || 0) - (store.state.cards[b.id]?.due || 0)) : shuffle(p);
    cur = queue.shift() || null; flipped = false;
  };
  const stats = () => {
    const p = pool(); const at = Date.now(); const cs = store.state.cards;
    return { total: p.length, due: p.filter(k => isDue(cs[k.id], at)).length, seen: p.filter(k => cs[k.id]).length, mastered: p.filter(k => mastered(cs[k.id])).length,
      today: Object.values(cs).filter(c => c.last && new Date(c.last).toDateString() === new Date().toDateString()).length };
  };
  const draw = () => {
    const st = stats(); const scopeName = scope === 'all' ? 'All chapters' : (G.get(scope)?.title || G.module(scope)?.label || scope);
    el.innerHTML = h`<div class="trainer">
      <div class="ph"><div><span class="eyebrow">Flashcards</span><h1>Spaced repetition</h1><p>Every card is a Q/A pair from a chapter's own Flashcards table. Grade honestly; the scheduler (SM-2) brings each card back right before you would forget it.</p></div></div>
      <div class="filterbar"><select id="scope"><option value="all">All chapters (${allCards().length} cards)</option>${CONTENT.modules.filter(m => m.n < 10).map(m => `<optgroup label="${esc(m.label)}"><option value="${m.key}" ${scope === m.key ? 'selected' : ''}>Whole module</option>${m.chapters.map(id => G.get(id)).filter(c => c?.flashcards?.length).map(c => `<option value="${c.id}" ${scope === c.id ? 'selected' : ''}>${c.id} · ${esc(c.title)}</option>`).join('')}</optgroup>`).join('')}</select>
        <div class="seg"><button type="button" data-mode="due" class="${mode === 'due' ? 'on' : ''}">Due</button><button type="button" data-mode="cram" class="${mode === 'cram' ? 'on' : ''}">Cram all</button></div></div>
      <div class="stats"><span><b class="num">${st.due}</b> due</span><span><b class="num">${st.today}</b> reviewed today</span><span><b class="num">${st.mastered}</b>/${st.total} mastered</span><span><b class="num">${st.seen}</b> seen</span><span>${esc(scopeName)}</span></div>
      <div id="stage"></div>
      <section class="sect"><h2>Decks</h2><div class="grid g2" id="decks">${CONTENT.chapters.filter(c => c.flashcards?.length).map(c => { const cs = store.state.cards; const n = c.flashcards.length; const due = c.flashcards.filter((f, i) => isDue(cs[`${c.id}:${i}`])).length; const m = c.flashcards.filter((f, i) => mastered(cs[`${c.id}:${i}`])).length; return `<button type="button" class="chapcard" data-scope="${c.id}" style="--mc:${modVar(c.module)};text-align:left"><span class="cid">${c.id}</span><span><span class="t">${esc(c.title)}</span><span class="bar" style="margin-top:8px;height:4px"><i style="width:${100 * m / n}%"></i></span></span><span class="mins">${due ? due + ' due' : m === n ? 'mastered' : n + ' cards'}</span></button>`; }).join('')}</div></section></div>`;
    $('#scope', el).onchange = e => { scope = e.target.value; build(); draw(); };
    $$('[data-mode]', el).forEach(b => b.onclick = () => { mode = b.dataset.mode; build(); draw(); });
    $$('[data-scope]', el).forEach(b => b.onclick = () => { scope = b.dataset.scope; build(); draw(); $('#main').scrollTo({ top: 0, behavior: 'smooth' }); });
    stage();
  };
  const stage = () => {
    const box = $('#stage', el); const card = store.state.cards[cur?.id];
    if (!cur) { box.innerHTML = `<div class="bigcard"><div class="in"><div class="f" style="align-items:center;justify-content:center;text-align:center"><span class="eyebrow">${mode === 'due' ? 'All caught up' : 'Deck finished'}</span><div class="txt">${reviewed ? `${reviewed} card${reviewed === 1 ? '' : 's'} reviewed.` : 'Nothing due right now.'}</div><div class="row" style="justify-content:center"><button class="btn" type="button" id="cram">Cram this scope</button><a class="btn ghost" href="#/">Back home</a></div></div></div></div>`; $('#cram', el).onclick = () => { mode = 'cram'; build(); draw(); }; return; }
    box.innerHTML = h`<div class="row spread" style="margin-top:8px"><span class="dim" style="font-size:13px">${queue.length + 1} left in this session${card ? ` · seen ${card.reps || 0}× · ease ${(card.ease || 2.5).toFixed(2)}` : ' · new card'}</span><a class="dim" style="font-size:13px" href="#/c/${cur.ch.id}">${cur.ch.id} →</a></div>
      <div class="bigcard ${flipped ? 'flip' : ''}" id="big" style="--mc:${modVar(cur.ch.module)}" tabindex="0"><div class="in">
        <div class="f"><span class="eyebrow">Question</span><div class="txt">${inline(cur.q, cur.ch.path)}</div><div class="foot"><span class="cid">${cur.ch.id}</span><span>${esc(cur.ch.title)}</span><span style="margin-left:auto">space to flip</span></div></div>
        <div class="b"><span class="eyebrow">Answer</span><div class="txt">${inline(cur.a, cur.ch.path)}</div><div class="foot"><span class="cid">${cur.ch.id}</span><span>${esc(cur.ch.title)}</span></div></div></div></div>
      ${flipped ? `<div class="grades">${[['again', 'Again', 0], ['hard', 'Hard', 1], ['good', 'Good', 2], ['easy', 'Easy', 3]].map(([k, l, g], i) => `<button type="button" class="${k}" data-g="${g}">${l}<small>${preview(card, g)}</small><kbd>${i + 1}</kbd></button>`).join('')}</div>` : `<div class="row" style="justify-content:center"><button class="btn primary" type="button" id="flip">Show answer</button></div>`}`;
    const big = $('#big', el); big.onclick = () => { flipped = true; stage(); };
    $('#flip', el) && ($('#flip', el).onclick = () => { flipped = true; stage(); });
    $$('.grades button', el).forEach(b => b.onclick = () => grade(+b.dataset.g));
  };
  const grade = g => {
    if (!cur || !flipped) return;
    const id = cur.id; const next = schedule(store.state.cards[id], g);
    store.update(s => { s.cards[id] = next; });
    if (g === 0) queue.push(cur);                     // "again": see it once more this session
    reviewed++; cur = queue.shift() || null; flipped = false; stage();
    $$('.stats', el)[0] && draw();
  };
  const keys = e => {
    if (/^(input|textarea|select)$/i.test(document.activeElement?.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); if (cur && !flipped) { flipped = true; stage(); } }
    if (/^[1-4]$/.test(e.key) && flipped) grade(+e.key - 1);
  };
  addEventListener('keydown', keys);
  build(); draw();
  return () => removeEventListener('keydown', keys);
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export default { cards };
