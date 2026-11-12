import { $, $$, esc, h, ico, fmtMins, modVar, rel } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import { isDue } from '../lib/srs.js';
import { CONTENT, go } from '../main.js';

function dueCards() {
  let n = 0; const at = Date.now();
  for (const c of CONTENT.chapters) for (let i = 0; i < (c.flashcards || []).length; i++) if (isDue(store.state.cards[`${c.id}:${i}`], at)) n++;
  return n;
}

export function chapCard(c, extra = '') {
  const st = G.nodeState(c.id); const p = Math.round(G.sectionProgress(c.id) * 100);
  return h`<a class="chapcard ${st}" href="#/c/${c.id}" style="--mc:${modVar(c.module)}">
    <span class="cid">${c.id}</span>
    <span><span class="t">${esc(c.title)}</span><span class="s">${esc(c.objective || c.summary || '')}</span>
      ${st === 'reading' && p ? `<span class="bar" style="margin-top:8px;height:4px"><i style="width:${p}%"></i></span>` : ''}
      ${st === 'locked' ? `<span class="s dim">Needs ${G.unmetPrereqs(c.id).join(', ')}</span>` : ''}</span>
    <span class="mins">${st === 'done' ? '✓ done' : fmtMins(c.est_minutes)}</span>${extra}</a>`;
}

function heatmap() {
  const days = 26 * 7; const cells = []; const d = new Date(); d.setDate(d.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const k = d.toISOString().slice(0, 10); const n = store.state.activity[k] || 0;
    cells.push(`<i class="${n > 12 ? 'l3' : n > 5 ? 'l2' : n > 0 ? 'l1' : ''}" title="${k}: ${n} actions"></i>`);
    d.setDate(d.getDate() + 1);
  }
  return `<div class="heat">${cells.join('')}</div>`;
}

async function home(el) {
  const draw = () => {
    const s = store.state; const ov = G.overall(); const streak = store.streak(); const due = dueCards();
    const track = CONTENT.tracks.find(t => t.id === s.track);
    const last = s.lastOpened && G.get(s.lastOpened.id);
    const next = G.nextUp(s.track, 4);
    const lead = last && !store.isDone(last.id) ? last : next[0];
    const trackDone = track ? track.ids.filter(store.isDone).length : 0;

    el.innerHTML = h`<div class="page">
      <section class="hero">
        <div class="hero-main" style="--mc:${modVar(lead?.module)}">
          <span class="eyebrow">${last && !store.isDone(last.id) ? 'Continue where you left off' : ov.done ? 'Up next on your path' : 'Start here'}</span>
          <h1>${lead ? esc(lead.title) : 'Every chapter complete.'}</h1>
          <p class="lede">${lead ? esc(lead.objective || lead.summary || '') : 'Keep the flashcards in rotation and revisit volatile chapters as the field moves.'}</p>
          ${lead ? `<div class="row" style="gap:8px"><span class="chip mod" style="--mc:${modVar(lead.module)}"><span class="dot"></span>${esc(G.module(lead.module)?.short || lead.module)}</span><span class="chip">${lead.id}</span><span class="chip">${fmtMins(lead.est_minutes)}</span>${last && last.id === lead.id && s.lastOpened ? `<span class="chip">opened ${rel(s.lastOpened.at)}</span>` : ''}</div>` : ''}
          <div class="cta">
            ${lead ? `<a class="btn primary" href="#/c/${lead.id}">${ico('play')} ${G.sectionProgress(lead.id) > 0 ? 'Continue reading' : 'Start chapter'}</a>` : ''}
            <a class="btn" href="#/map">${ico('map')} View the map</a>
            ${due ? `<a class="btn ghost" href="#/cards">${due} cards due</a>` : ''}
          </div>
        </div>
        <div class="stat-tiles">
          <div class="tile accent"><span class="v num">${ov.done}<span class="dim" style="font-size:16px;font-weight:500">/${ov.total}</span></span><span class="k">chapters completed</span><span class="bar" style="margin-top:4px"><i style="width:${ov.pct}%"></i></span></div>
          <div class="tile"><span class="v num">${ov.hoursDone}<span class="dim" style="font-size:16px;font-weight:500">/${ov.hoursTotal}h</span></span><span class="k">study hours earned</span><span class="sub">by chapter estimates</span></div>
          <div class="tile"><span class="v num">${streak}</span><span class="k">day streak</span><span class="sub">${streak ? 'keep it going' : 'read a section today'}</span></div>
          <div class="tile"><span class="v num">${due}</span><span class="k">flashcards due</span><span class="sub">${CONTENT.stats.flashcards} in the deck</span></div>
        </div>
      </section>

      <section class="sect">
        <div class="row spread"><h2>Up next</h2><span class="dim" style="font-size:13px">${track ? `${esc(track.name)} · ${trackDone}/${track.ids.length} done` : 'Choose a track below to focus this list'}</span></div>
        <div class="nextlist">${next.length ? next.map(c => chapCard(c)).join('') : '<div class="empty">Nothing unlocked on this track — pick another, or explore the map.</div>'}</div>
      </section>

      <section class="sect">
        <h2>Your track</h2>
        <div class="tracks">${CONTENT.tracks.map(t => {
          const done = t.ids.filter(store.isDone).length; const hrs = t.ids.reduce((a, i) => a + (G.get(i)?.est_minutes || 0), 0) / 60;
          return `<button type="button" class="track ${s.track === t.id ? 'on' : ''}" data-track="${t.id}"><b>${esc(t.name)}</b><small>${esc(t.blurb)}</small><span class="meta">${t.ids.length} chapters · ~${Math.round(hrs)}h · ${done} done</span><span class="bar"><i style="width:${Math.round(100 * done / t.ids.length)}%"></i></span></button>`;
        }).join('')}</div>
      </section>

      <section class="sect">
        <div class="row spread"><h2>Modules</h2><a class="dim" style="font-size:13px" href="#/chapters">Browse all chapters →</a></div>
        <div class="modlist">${CONTENT.modules.map(m => {
          const mp = G.moduleProgress(m.key);
          return `<a class="modcard" href="#/chapters#${m.key}" style="--mc:${modVar(m.key)}"><span class="n">${m.n < 10 ? 'MODULE ' + m.n : 'REFERENCE'}</span><h3>${esc(m.label)}</h3><span class="meta"><span>${mp.total} ${m.key === 'engineering' ? 'docs' : 'chapters'}</span>${m.hours ? `<span>~${m.hours}h</span>` : ''}<span>${mp.done} done</span></span><span class="bar"><i style="width:${mp.pct}%"></i></span></a>`;
        }).join('')}</div>
      </section>

      <section class="sect">
        <div class="row spread"><h2>Activity</h2><span class="dim" style="font-size:13px">last 26 weeks · ${Object.values(s.activity).reduce((a, b) => a + b, 0)} learning actions</span></div>
        ${heatmap()}
      </section>

      <section class="sect" style="color:var(--fg-3);font-size:13px;line-height:1.6">
        <div class="hr"></div>
        ${CONTENT.stats.chapters} chapters · ${CONTENT.stats.engineering} engineering references · ${Math.round(CONTENT.stats.words / 1000)}k words · ${CONTENT.stats.diagrams} diagrams · ${CONTENT.stats.flashcards} flashcards · ${CONTENT.stats.questions} practice questions.
        Everything on this site renders live from the open-source Markdown in <a href="https://github.com/naman-shrimali/ai-engineering-curriculum" target="_blank" rel="noopener">the repository</a>; nothing is paraphrased. Prefer the plain reader? <a href="tutor/reader.html">Classic reader</a>.
      </section>
    </div>`;
    $$('[data-track]', el).forEach(b => b.onclick = () => { store.setTrack(b.dataset.track === store.state.track ? null : b.dataset.track); });
  };
  draw();
  return store.subscribe(draw);
}

export default { home };
