/* Mastery: a skill map of the curriculum built from your own evidence, and the next moves
   that would help most. The model lives in lib/mastery.js; this view only presents it. */
import { $, $$, esc, h, modVar, rel } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import { CONTENT } from '../main.js';
import { assess, actions, plan, LEVELS, LEVEL_INFO, WEIGHTS, HALF_LIFE_DAYS, MIN_EVIDENCE } from '../lib/mastery.js';
import { labsByChapter } from '../lib/labrun.js';

const ORDER = ['strong', 'solid', 'shaky', 'weak', 'early', 'read', 'none'];
const pct = x => Math.round(x * 100) + '%';
const KIND_ICON = { due: '↻', missed: '✗', lab: '⌨', stale: '⏳', untested: '?', 'lab-new': '⌨', 'new-cards': '+', read: '¶' };

/** Action cards, shared with the dashboard. */
export function movesHtml(moves, { compact = false } = {}) {
  return moves.map(m => {
    const c = G.get(m.chapter);
    return `<a class="move ${compact ? 'compact' : ''}" href="${m.href}" style="--mc:${modVar(c?.module)}">
      <span class="mv-i" aria-hidden="true">${KIND_ICON[m.kind] || '•'}</span>
      <span class="mv-b"><span class="mv-c"><b>${m.chapter}</b> ${esc(c?.title || '')}</span><span class="mv-l">${esc(m.label)}</span>${compact ? '' : `<span class="mv-r">${esc(m.reason)}</span>`}</span>
      <span class="mv-t">~${m.minutes} min</span></a>`;
  }).join('');
}

async function mastery(el, params, query) {
  const labs = await labsByChapter();
  const now = Date.now(), S = store.state;
  const chapters = CONTENT.chapters.filter(c => c.exists);
  const A = new Map(chapters.map(c => [c.id, assess(c, S, labs[c.id], now)]));
  const moves = plan(chapters, S, labs, now, { limit: 6 });
  const counts = Object.fromEntries(ORDER.map(k => [k, 0]));
  for (const a of A.values()) counts[a.level]++;
  const scored = [...A.values()].filter(a => a.scored && a.level !== 'early');
  const avg = scored.length ? scored.reduce((x, a) => x + a.mastery, 0) / scored.length : null;
  const due = [...A.values()].reduce((x, a) => x + (a.parts.cards?.due || 0), 0);
  let sel = query.c && A.has(query.c) ? query.c : (moves[0]?.chapter || scored[0]?.id || chapters[0].id);

  el.innerHTML = h`<div class="page mastery">
    <div class="ph"><div><span class="eyebrow">Your evidence</span><h1>Mastery</h1>
      <p>What your own practice says about each chapter — your self-tests, flashcard reviews and labs — and the moves that would help most next. Reading counts as exposure, never as mastery.</p></div></div>

    <section class="mx-sum">
      <div class="mx-bar" role="img" aria-label="${ORDER.map(k => `${counts[k]} ${LEVEL_INFO[k].label}`).join(', ')}">${ORDER.filter(k => counts[k]).map(k => `<i class="lv-${k}" style="flex:${counts[k]}" title="${counts[k]} · ${LEVEL_INFO[k].label}"></i>`).join('')}</div>
      <div class="mx-legend">${ORDER.map(k => `<span class="${counts[k] ? '' : 'zero'}"><i class="lv-${k}"></i>${LEVEL_INFO[k].label} <b>${counts[k]}</b></span>`).join('')}</div>
      <div class="mx-stats">
        <div><b>${scored.length}</b><span>chapters with a score</span></div>
        <div><b>${avg == null ? '—' : pct(avg)}</b><span>average mastery where scored</span></div>
        <div><b>${due}</b><span>flashcards due now</span></div>
        <div><b>${Object.values(S.labs || {}).filter(l => l.passedAt).length}</b><span>labs passed</span></div>
      </div>
    </section>

    <section class="sect">
      <div class="row spread"><h2>Next moves</h2><span class="dim" style="font-size:13px">ranked by how much each would help, at most two per chapter</span></div>
      ${moves.length ? `<div class="moves">${movesHtml(moves)}</div>` : '<div class="empty">Read a chapter, then take its self-test or review its flashcards — your next moves will appear here.</div>'}
    </section>

    <section class="sect mx-mapsec">
      <div class="row spread"><h2>Skill map</h2><span class="dim" style="font-size:13px">colour is mastery · the bar under each tile is how much evidence there is</span></div>
      <div class="mx-layout">
        <div class="mx-mods">${CONTENT.modules.filter(m => m.n < 10).map(m => {
          const ids = m.chapters.filter(id => A.has(id));
          const sc = ids.filter(id => A.get(id).scored).length;
          return `<div class="mx-mod" style="--mc:${modVar(m.key)}"><div class="mx-mh"><span class="n">${m.n}</span><b>${esc(m.short)}</b><span class="dim">${sc}/${ids.length} scored</span></div>
            <div class="mx-tiles">${ids.map(id => tile(A.get(id))).join('')}</div></div>`;
        }).join('')}</div>
        <aside class="mx-detail" id="mxd" aria-live="polite"></aside>
      </div>
    </section>

    <details class="sect mx-how"><summary>How mastery is computed</summary>
      <div class="mx-howb">
        <p><b>Two numbers per chapter.</b> <em>Mastery</em> is how well you did on what you have demonstrated. <em>Evidence</em> is how much you have done, relative to what the chapter offers. A chapter needs ${pct(MIN_EVIDENCE)} evidence before it gets a level; until then it is “${LEVEL_INFO.early.label}”.</p>
        <table class="mx-tab"><thead><tr><th>Evidence</th><th>Weight</th><th>Score</th><th>Amount</th></tr></thead><tbody>
          <tr><td>Reading</td><td>${WEIGHTS.reading}</td><td>—  (exposure, never mastery)</td><td>share of sections read</td></tr>
          <tr><td>Self-test &amp; interview</td><td>${WEIGHTS.recall}</td><td>mean of your grades (Couldn’t 0, Partly ½, Nailed it 1)</td><td>share of questions graded; each grade’s weight halves every ${HALF_LIFE_DAYS} days</td></tr>
          <tr><td>Flashcards</td><td>${WEIGHTS.cards}</td><td>estimated recall now, R = 1 / (1 + t / 9S), with S the card’s interval: 90% when a card falls due, 0 after “Again”</td><td>share of cards reviewed</td></tr>
          <tr><td>Labs</td><td>${WEIGHTS.lab}</td><td>1 when every test passes, otherwise best tests passed ÷ total</td><td>share of the chapter’s labs attempted</td></tr>
        </tbody></table>
        <p>Mastery is the weighted average of the scores, each weighted by its weight × amount. Levels: ${LEVELS.map(l => `${l.label} ≥ ${pct(l.min)}`).join(' · ')}.</p>
        <p class="dim">Self-grades are only as honest as you are, and recall is a model estimate, not a measurement. Treat this as a map of where your practice has been, not a verdict.</p>
      </div>
    </details>
  </div>`;

  const detail = id => {
    sel = id;
    const c = G.get(id), a = A.get(id), P = a.parts, acts = actions(a, CONTENT.chapters.find(x => x.id === id), now);
    $$('.mx-tile', el).forEach(t => t.classList.toggle('on', t.dataset.id === id));
    history.replaceState(null, '', '#/mastery?c=' + id);
    $('#mxd', el).style.setProperty('--mc', modVar(c.module));
    const row = (name, part, text, bar) => `<div class="mx-part ${part ? '' : 'na'}"><div class="mx-pn"><span>${name}</span><span class="dim">${text}</span></div>${bar == null ? '' : `<div class="mx-pb"><i style="width:${Math.round(bar * 100)}%"></i></div>`}</div>`;
    $('#mxd', el).innerHTML = `
      <a class="chip mod" style="--mc:${modVar(c.module)}" href="#/c/${id}">${id}</a>
      <h3><a href="#/c/${id}">${esc(c.title)}</a></h3>
      <div class="mx-lv lv-${a.level}"><i></i>${LEVEL_INFO[a.level].label}${a.scored ? `<b>${pct(a.mastery)}</b>` : ''}</div>
      <div class="mx-ev"><span>Evidence</span><div class="mx-pb"><i style="width:${Math.round(a.evidence * 100)}%"></i></div><span class="dim">${pct(a.evidence)}</span></div>
      <div class="mx-parts">
        ${row('Reading', true, `${P.reading.read} of ${P.reading.total} sections`, P.reading.evidence)}
        ${P.recall ? row('Self-test & interview', true, P.recall.graded ? `${P.recall.graded} of ${P.recall.total} graded · ${pct(P.recall.score)}${P.recall.lastAt ? ` · ${rel(P.recall.lastAt)}` : ''}` : `none of ${P.recall.total} graded yet`, P.recall.graded ? P.recall.score : null) : ''}
        ${P.cards ? row('Flashcards', true, P.cards.reviewed ? `${P.cards.reviewed} of ${P.cards.total} reviewed · recall ≈ ${pct(P.cards.score)}${P.cards.due ? ` · ${P.cards.due} due` : ''}` : `none of ${P.cards.total} reviewed yet`, P.cards.reviewed ? P.cards.score : null) : ''}
        ${P.lab ? row(P.lab.total > 1 ? 'Labs' : 'Lab', true, P.lab.labs.map(l => l.passed ? `${esc(l.title)}: passed` : l.tried ? `${esc(l.title)}: ${l.best}/${l.total} tests` : `${esc(l.title)}: not tried`).join(' · '), P.lab.tried ? P.lab.score : null) : ''}
      </div>
      ${acts.length ? `<div class="mx-acts"><span class="eyebrow">What would help</span>${acts.map(m => `<a class="btn sm" href="${m.href}">${esc(m.label)}</a>`).join('')}</div>` : `<p class="dim" style="font-size:13px;margin-top:12px">${a.level === 'none' ? 'Nothing recorded yet for this chapter.' : 'Nothing pressing here — keep its flashcards in rotation.'}</p>`}`;
  };
  el.querySelector('.mx-mods').addEventListener('click', e => { const t = e.target.closest('.mx-tile'); if (t) detail(t.dataset.id); });
  detail(sel);
}

function tile(a) {
  const c = G.get(a.id);
  return `<button type="button" class="mx-tile lv-${a.level}" data-id="${a.id}" title="${esc(c.title)} — ${LEVEL_INFO[a.level].label}${a.scored ? ' ' + pct(a.mastery) : ''}">
    <span class="t-id">${a.id.slice(4)}</span><span class="t-v">${a.scored && a.level !== 'early' ? Math.round(a.mastery * 100) : a.level === 'read' ? '¶' : a.level === 'early' ? '…' : ''}</span>
    <span class="t-ev"><i style="width:${Math.round(a.evidence * 100)}%"></i></span></button>`;
}

export default { mastery };
