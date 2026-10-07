/* Chapter reader. The Markdown renders live; the derived sections
   (Check your understanding, Interview questions, Flashcards, Exercises)
   are transformed in the DOM into interactive blocks — the text is verbatim. */
import { $, $$, esc, h, ico, fmtMins, modVar, toast, modal, fmtDate } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import * as MD from '../lib/md.js';
import { fetchMd } from './doc.js';
import { mountExplorables } from '../lib/explorables.js';
import { BASE, CONTENT, go } from '../main.js';
import { mindmapSmall, mindmapModal } from '../lib/mindmap.js';

const VOL = { high: 'volatile', medium: 'mixed', low: 'evergreen' };
const DERIVED = /^(check your understanding|interview questions|flashcards|exercises and mini-project|revision summary|sources|further reading)$/i;

async function chapter(el, params, query) {
  const c = G.get(params.id);
  if (!c) { el.innerHTML = `<div class="page"><div class="empty">Unknown chapter <code>${esc(params.id || '')}</code>. <a href="#/chapters">Browse chapters</a></div></div>`; return; }
  if (!c.exists) { el.innerHTML = `<div class="page"><div class="empty">${c.id} is reserved in the manifest but not written yet.</div></div>`; return; }
  el.innerHTML = `<div class="page"><div class="boot"><div class="spinner"></div></div></div>`;
  const raw = await fetchMd(c.path);
  const { meta, body } = MD.splitFrontmatter(raw);
  const mod = G.module(c.module); const mc = modVar(c.module);
  const vol = VOL[c.volatility] || c.volatility;
  store.touch(c.id);
  document.title = `${c.title} — AI Engineering`;

  const header = () => {
    const st = G.nodeState(c.id); const done = st === 'done';
    return h`<div class="chap-top"><div class="crumbs"><a href="#/chapters">Chapters</a>${ico('chev')}<a class="mod" href="#/chapters#${c.module}">${esc(mod?.label || c.module)}</a>${ico('chev')}<span class="mono">${c.id}</span></div>
      <div class="row" style="gap:6px"><button class="btn xs ghost" id="prose-toggle" type="button" title="Toggle prose typeface">Aa</button><a class="btn xs ghost" href="${BASE + c.path}" target="_blank" rel="noopener">raw .md</a></div></div>
    <div class="chap-meta">${c.status ? `<span class="chip ${esc(c.status)}"><span class="dot"></span>${esc(c.status)}</span>` : ''}${vol ? `<span class="chip ${esc(vol)}" title="volatility: drives review cadence">${esc(vol)}</span>` : ''}${c.difficulty ? `<span class="chip" title="difficulty">difficulty ${c.difficulty}/5</span>` : ''}${c.est_minutes ? `<span class="chip">${fmtMins(c.est_minutes)}</span>` : ''}${c.last_reviewed ? `<span class="chip" title="last human review">reviewed ${esc(c.last_reviewed)}</span>` : ''}${c.sources ? `<span class="chip">${c.sources} sources</span>` : ''}</div>
    <h1 class="chap-h1">${esc(c.title)}</h1>
    ${c.objective ? `<p class="chap-obj">${esc(c.objective)}</p>` : ''}
    <div class="chap-actions" id="chap-actions">
      <button class="btn ${done ? 'ok' : 'primary'} sm" id="btn-done" type="button">${done ? '✓ Completed' + (c.completedAt ? '' : '') : 'Mark complete'}</button>
      <a class="btn sm" href="#/practice?c=${c.id}">${ico('practice')} Practice</a>
      <a class="btn sm ghost" href="#/cards?c=${c.id}">${ico('cards')} ${(c.flashcards || []).length} cards</a>
      <span class="prq">${c.prereqs.length ? 'Needs: ' + c.prereqs.map(p => { const pc = G.get(p); return `<a href="#/c/${p}" class="${store.isDone(p) ? 'done' : ''}" style="--mc:${modVar(pc?.module)}" title="${esc(pc?.title || p)}">${p}${store.isDone(p) ? ' ✓' : ''}</a>`; }).join('') : 'No prerequisites'}</span>
      ${c.dependents?.length ? `<span class="prq">Unlocks: ${c.dependents.map(d => { const dc = G.get(d); return `<a href="#/c/${d}" style="--mc:${modVar(dc?.module)}" title="${esc(dc?.title || d)}">${d}</a>`; }).join('')}</span>` : ''}
    </div>`;
  };

  el.innerHTML = h`<div class="chapter" style="--mc:${mc}">
    <div class="chap-body"><div class="readbar"><i id="readbar"></i></div><div id="chap-head">${header()}</div>
      <article class="prose ${store.state.settings.prose === 'sans' ? 'sans' : ''}" id="prose"></article>
      <div id="pager" class="row spread" style="margin-top:40px;gap:12px"></div></div>
    <aside class="chap-side"><div><h5>On this page</h5><nav class="toc" id="toc"></nav></div>
      <div><div class="row spread" style="margin-bottom:8px"><h5 style="margin:0">Mind map</h5><button class="btn xs ghost" id="mm-full" type="button">${ico('expand')} expand</button></div><div class="mindmap" id="mm"></div></div>
      <div class="side-progress" id="side-prog"></div>
      <div class="dim" style="font-size:11.5px;line-height:1.5">Sections mark themselves read as you scroll past them. <kbd>[</kbd> <kbd>]</kbd> previous / next chapter.</div></aside></div>`;

  const art = $('#prose', el);
  art.innerHTML = MD.render(body, c.path);
  transformDerived(art, c);
  MD.decorate(art, { onNavigate: id => go('#/c/' + id) });
  mountExplorables(art, c.id);

  /* ----- section tracking ----- */
  const h2s = $$('h2', art).filter(x => x.id !== 'sources-list');
  const secs = h2s.map((hh, i) => ({ el: hh, anchor: hh.id, h: hh.textContent.replace(/read$/, '').trim(), derived: DERIVED.test(hh.textContent.replace(/read$/, '').trim()) }));
  const tracked = secs.filter(s => !s.derived);
  const drawToc = () => {
    const p = store.prog(c.id);
    $('#toc', el).innerHTML = secs.map((s, i) => `<a href="#${s.anchor}" data-i="${i}" class="${p?.sections?.[s.anchor] ? 'read' : ''}">${esc(s.h)}</a>`).join('');
    $$('#toc a', el).forEach(a => a.onclick = e => { e.preventDefault(); secs[+a.dataset.i].el.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    h2s.forEach(hh => { const has = p?.sections?.[hh.id]; let m = hh.querySelector('.sec-done'); if (has && !m) { m = document.createElement('span'); m.className = 'sec-done'; m.textContent = '✓ read'; hh.appendChild(m); } });
  };
  const drawSide = () => {
    const p = store.prog(c.id); const read = tracked.filter(s => p?.sections?.[s.anchor]).length;
    const checks = Object.keys(p?.checks || {}).length, iv = Object.keys(p?.interview || {}).length, ex = Object.keys(p?.exercises || {}).length;
    $('#side-prog', el).innerHTML = `<div class="row spread"><span>Sections read</span><b class="num">${read}/${tracked.length}</b></div><div class="bar"><i style="width:${tracked.length ? 100 * read / tracked.length : 0}%"></i></div>
      <div class="row spread" style="margin-top:4px"><span>Self-test graded</span><b class="num">${checks}/${(c.check || []).length}</b></div>
      <div class="row spread"><span>Interview graded</span><b class="num">${iv}/${(c.interview || []).length}</b></div>
      <div class="row spread"><span>Exercises done</span><b class="num">${ex}/${(c.exercises || []).length}</b></div>`;
    $('#chap-head', el).innerHTML = header(); wireHeader();
    $('#mm', el).innerHTML = ''; mindmapSmall($('#mm', el), c, secs, store.prog(c.id), a => art.querySelector('#' + CSS.escape(a))?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const wireHeader = () => {
    $('#btn-done', el).onclick = () => {
      const done = store.isDone(c.id);
      if (done) { store.setDone(c.id, false); toast('Marked as in progress'); return; }
      store.setDone(c.id, true);
      const unlocked = (c.dependents || []).filter(d => G.nodeState(d) === 'available');
      toast(unlocked.length ? `Completed · unlocked ${unlocked.join(', ')}` : 'Chapter completed', 2600);
    };
    $('#prose-toggle', el).onclick = () => { const next = store.state.settings.prose === 'sans' ? 'serif' : 'sans'; store.setSetting('prose', next); art.classList.toggle('sans', next === 'sans'); };
  };
  drawToc(); drawSide();
  $('#mm-full', el).onclick = () => mindmapModal(c, secs, store.prog(c.id), a => { art.querySelector('#' + CSS.escape(a))?.scrollIntoView({ block: 'start' }); });

  /* ----- pager ----- */
  const { prev, next } = G.neighbours(c.id);
  const mk = (d, k) => d ? `<a class="chapcard" href="#/c/${d.id}" style="--mc:${modVar(d.module)};flex:1"><span class="cid">${d.id}</span><span><span class="s" style="margin:0 0 2px">${k}</span><span class="t">${esc(d.title)}</span></span><span class="mins">${fmtMins(d.est_minutes)}</span></a>` : '<span style="flex:1"></span>';
  $('#pager', el).innerHTML = mk(prev, '← Previous') + mk(next, 'Next →');

  /* ----- scroll: read bar, toc highlight, section read marks ----- */
  const main = $('#main');
  let raf = 0;
  const onScroll = () => {
    if (raf) return; raf = requestAnimationFrame(() => {
      raf = 0;
      const total = main.scrollHeight - main.clientHeight; $('#readbar').style.width = (total > 0 ? Math.min(100, 100 * main.scrollTop / total) : 0) + '%';
      const top = main.getBoundingClientRect().top; let act = 0;
      secs.forEach((s, i) => { if (s.el.getBoundingClientRect().top - top < 140) act = i; });
      $$('#toc a', el).forEach((a, i) => a.classList.toggle('on', i === act));
      // a section counts as read once its end has scrolled past 70% of the viewport
      const limit = top + main.clientHeight * 0.7;
      for (let i = 0; i < secs.length; i++) {
        const s = secs[i]; if (s.derived) continue;
        const endEl = secs[i + 1]?.el || $('#pager', el);
        if (endEl.getBoundingClientRect().top < limit && !store.prog(c.id)?.sections?.[s.anchor]) { store.markSection(c.id, s.anchor); }
      }
    });
  };
  main.addEventListener('scroll', onScroll, { passive: true });
  const unsub = store.subscribe(() => { drawToc(); drawSide(); });
  const keys = e => {
    if (/^(input|textarea|select)$/i.test(document.activeElement?.tagName)) return;
    if (e.key === ']' && next) go('#/c/' + next.id); if (e.key === '[' && prev) go('#/c/' + prev.id);
  };
  addEventListener('keydown', keys);
  if (query.s) requestAnimationFrame(() => { const t = art.querySelector('#' + CSS.escape(query.s)); if (t) t.scrollIntoView({ block: 'start' }); });
  else if (store.state.lastOpened?.id === c.id && false) { /* reserved: resume scroll position */ }
  return () => { main.removeEventListener('scroll', onScroll); unsub(); removeEventListener('keydown', keys); $$('.diagram.full').forEach(d => d.classList.remove('full')); document.body.style.overflow = ''; };
}

/* ---------------- derived-section transforms ---------------- */
function nextUntilH2(hh) { const out = []; let n = hh.nextElementSibling; while (n && n.tagName !== 'H2') { out.push(n); n = n.nextElementSibling; } return out; }
function block(title, meta, inner) { const d = document.createElement('div'); d.className = 'block'; d.innerHTML = `<div class="bh"><b>${title}</b><span class="dim">${meta}</span></div>${inner}`; return d; }

function transformDerived(art, c) {
  for (const hh of $$('h2', art)) {
    const t = hh.textContent.trim().toLowerCase(); const els = nextUntilH2(hh);
    if (t === 'check your understanding') {
      const ol = els.find(e => e.tagName === 'OL'); if (!ol) continue;
      const lis = $$(':scope > li', ol);
      const b = block('Self-test', `${lis.length} questions · grade yourself honestly`, `<div class="qas">${lis.map((li, i) => {
        const g = store.prog(c.id)?.checks?.[i]?.g;
        return `<div class="qa" data-i="${i}"><div class="q"><span class="n">${i + 1}</span><span>${li.innerHTML}</span><span class="gmark ${g != null ? 'g' + g : ''}"></span><span class="car">${ico('chev')}</span></div><div class="a"><div class="dim" style="font-size:13px">Answer it out loud or on paper, then grade yourself. The chapter above holds the answer — the revision summary is a quick check.</div><div class="grade"><small>How did it go?</small>${gradeBtns(g)}</div></div></div>`;
      }).join('')}</div>`);
      ol.replaceWith(b); wireQa(b, (i, g) => store.setCheck(c.id, i, g));
    } else if (t === 'interview questions') {
      const ol = els.find(e => e.tagName === 'OL'); if (!ol) continue;
      const lis = $$(':scope > li', ol);
      const b = block('Interview practice', `${lis.length} questions · attempt before you reveal`, `<div class="qas">${lis.map((li, i) => {
        const strong = li.querySelector('strong'); const q = strong ? strong.innerHTML : li.innerHTML;
        let rest = li.innerHTML; if (strong) { rest = rest.slice(rest.indexOf(strong.outerHTML) + strong.outerHTML.length).replace(/^\s*(—|–|-)\s*/, '').replace(/^\s*(<em>)?Model answer:?(<\/em>)?\s*/i, ''); }
        const g = store.prog(c.id)?.interview?.[i]?.g;
        return `<div class="qa" data-i="${i}"><div class="q"><span class="n">${i + 1}</span><span>${q}</span><span class="gmark ${g != null ? 'g' + g : ''}"></span><span class="car">${ico('chev')}</span></div><div class="a"><textarea placeholder="Sketch your answer first — key points, trade-offs, numbers…" id="iv-${c.id}-${i}"></textarea><button class="btn sm reveal" type="button">Reveal model answer</button><div class="model" hidden><span class="eyebrow" style="display:block;margin-bottom:6px">Model answer</span>${rest}</div><div class="grade" hidden><small>Compared to the model answer</small>${gradeBtns(g)}</div></div></div>`;
      }).join('')}</div>`);
      ol.replaceWith(b); wireQa(b, (i, g) => store.setInterview(c.id, i, g), true);
    } else if (t === 'flashcards') {
      const tbl = els.find(e => e.classList?.contains('tablewrap')); if (!tbl) continue;
      const rows = $$('tbody tr', tbl);
      const b = block('Flashcards', `${rows.length} cards · click to flip · <a href="#/cards?c=${c.id}">train with spaced repetition →</a>`, `<div class="deck">${rows.map(r => { const [q, a] = $$('td', r); return `<div class="fc" tabindex="0"><div class="in"><div class="f"><span class="lbl">Q</span><span>${q?.innerHTML || ''}</span></div><div class="b"><span class="lbl">A</span><span>${a?.innerHTML || ''}</span></div></div></div>`; }).join('')}</div>`);
      tbl.replaceWith(b); $$('.fc', b).forEach(f => { f.onclick = () => f.classList.toggle('flip'); f.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); f.classList.toggle('flip'); } }; });
    } else if (t === 'exercises and mini-project') {
      const ol = els.find(e => e.tagName === 'OL'); if (!ol) continue;
      const lis = $$(':scope > li', ol); const p = store.prog(c.id);
      const b = block('Exercises', `${lis.length} exercises · tick what you have done`, `<div class="checklist">${lis.map((li, i) => `<label class="${p?.exercises?.[i] ? 'on' : ''}"><input type="checkbox" data-i="${i}" ${p?.exercises?.[i] ? 'checked' : ''}><span>${li.innerHTML}</span></label>`).join('')}</div>`);
      ol.replaceWith(b);
      const lead = els.find(e => e.tagName === 'P' && /^Exercises$/i.test(e.textContent.trim())); if (lead) lead.remove();
      $$('input', b).forEach(cb => cb.onchange = () => { store.toggleExercise(c.id, +cb.dataset.i); cb.closest('label').classList.toggle('on', cb.checked); });
      // mini-project paragraphs → project box
      const projPs = els.filter(e => e.tagName === 'P' && /^(Mini-project|Capstone|Project)/i.test(e.textContent.trim()));
      if (projPs.length) { const pb = document.createElement('div'); pb.className = 'block'; pb.innerHTML = `<div class="bh"><b>Mini-project</b><span class="dim">portfolio-grade</span></div><div class="project"></div>`; projPs[0].before(pb); projPs.forEach(pp => pb.querySelector('.project').appendChild(pp)); }
    } else if (t === 'revision summary') {
      const ul = els.find(e => e.tagName === 'UL'); if (!ul) continue;
      const b = block('Key takeaways', `${ul.children.length} points`, `<div class="checklist" style="padding:10px 14px">${$$(':scope > li', ul).map(li => `<div style="display:flex;gap:10px;padding:6px 0;font-size:14.5px;line-height:1.5"><span style="color:var(--mc);flex:none">◆</span><span>${li.innerHTML}</span></div>`).join('')}</div>`);
      ul.replaceWith(b);
    }
  }
}
const gradeBtns = g => [['0', 'Couldn’t'], ['1', 'Partly'], ['2', 'Nailed it']].map(([v, l]) => `<button type="button" data-g="${v}" class="g${v} ${g == +v ? 'on' : ''}">${l}</button>`).join('');
function wireQa(b, onGrade, reveal = false) {
  $$('.qa', b).forEach(qa => {
    qa.querySelector('.q').onclick = () => qa.classList.toggle('open');
    const r = qa.querySelector('.reveal'); if (r) r.onclick = () => { r.hidden = true; qa.querySelector('.model').hidden = false; qa.querySelector('.grade').hidden = false; };
    if (reveal) { const ta = qa.querySelector('textarea'); try { ta.value = sessionStorage.getItem(ta.id) || ''; } catch (e) { /* */ } ta.oninput = () => { try { sessionStorage.setItem(ta.id, ta.value); } catch (e) { /* */ } }; }
    $$('.grade button', qa).forEach(btn => btn.onclick = () => { const g = +btn.dataset.g; onGrade(+qa.dataset.i, g); $$('.grade button', qa).forEach(x => x.classList.toggle('on', x === btn)); const m = qa.querySelector('.gmark'); m.className = 'gmark g' + g; });
  });
}

export default { chapter };
