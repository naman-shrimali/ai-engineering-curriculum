/* Coding labs: implement the mechanisms the chapters teach, in Python, graded in the browser.
   Labs live in labs/ and compile to app/data/labs.json (scripts/build-labs.py), which also
   proves in CI that every reference solution passes and every quoted definition is verbatim. */
import { marked } from 'marked';
import { $, esc, h, ico, modVar, modal, diffDots, toast } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import { labsData, runLab, warm, onStatus } from '../lib/labrun.js';

const nn = n => String(n).padStart(2, '0');
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const RUNKEY = isMac ? '⌘↵' : 'Ctrl ↵';

function failPage(el, msg) {
  el.innerHTML = `<div class="page narrow"><div class="empty">${esc(msg)}</div></div>`;
}

/* ------------------------------------------------------------------ index */
async function labs(el) {
  let d;
  try { d = await labsData(); } catch (e) { return failPage(el, 'Could not load app/data/labs.json — run python3 scripts/build-labs.py.'); }
  const passed = d.labs.filter(l => store.lab(l.id)?.passedAt).length;
  const tests = d.labs.reduce((a, l) => a + l.test_count, 0);
  el.innerHTML = h`<div class="page labs-page">
    <div class="labs-hero">
      <div><span class="eyebrow">Hands-on</span><h1>Coding labs</h1>
        <p>Implement what the chapters teach — samplers, retrieval metrics, IVF search, an agent loop, a circuit breaker — in Python, right here. ${d.labs.length} labs, ${tests} tests, graded instantly in your browser against each chapter's own definitions and worked exercises.</p></div>
      <div class="labs-ring" style="--p:${(passed / d.labs.length) * 100}"><div><b>${passed}</b><span>of ${d.labs.length}<br>passed</span></div></div>
    </div>
    <div class="labgrid">${d.labs.map(l => labCard(l)).join('')}</div>
    <p class="labs-foot dim">Your first run downloads a Python runtime (about 13 MB), which your browser then caches. Code runs in an isolated worker on your machine; if you sign in, your latest code syncs with the rest of your progress.</p>
  </div>`;
  warm().catch(() => {});
}

function labCard(l) {
  const c = G.get(l.chapter), st = store.lab(l.id);
  const state = st?.passedAt ? 'passed' : st?.runs ? 'tried' : st?.code ? 'started' : 'new';
  const right = state === 'passed' ? `<span class="ls ok">${ico('check')} Passed</span>`
    : state === 'tried' ? `<span class="ls">${st.best}/${l.test_count} tests</span>`
      : state === 'started' ? '<span class="ls">In progress</span>' : '<span class="ls go">Start →</span>';
  return `<a class="labcard ${state}" href="#/lab/${l.id}" style="--mc:${modVar(c?.module)}">
    <span class="ln">${nn(l.order)}</span>
    <span class="lb"><span class="lt">${esc(l.title)}</span>
      <span class="lf">${l.functions.map(f => `<code>${esc(f)}</code>`).join('')}</span>
      <span class="lm"><span class="cid">${l.chapter}</span><span>${esc(c?.title || '')}</span></span></span>
    <span class="lr">${right}<span class="lx">${diffDots(l.difficulty)}<span>${l.minutes} min · ${l.test_count} tests</span></span></span>
  </a>`;
}

/* ------------------------------------------------------------------ one lab */
async function lab(el, params) {
  let d;
  try { d = await labsData(); } catch (e) { return failPage(el, 'Could not load app/data/labs.json.'); }
  const L = d.labs.find(x => x.id === params.id);
  if (!L) return failPage(el, `No lab called "${params.id}".`);
  const c = G.get(L.chapter), i = d.labs.indexOf(L), next = d.labs[i + 1];
  const saved = store.lab(L.id);
  const section = (c?.sections || []).find(s => s.anchor === L.anchor);
  const secHref = `#/c/${L.chapter}?s=${encodeURIComponent(L.anchor)}`;
  warm().catch(() => {});

  el.innerHTML = h`<div class="lab" style="--mc:${modVar(c?.module)}">
    <div class="lab-top">
      <a class="lab-back" href="#/labs">${ico('back')}<span>Labs</span></a>
      <span class="lab-name"><span class="ln">Lab ${nn(L.order)}</span><span class="lt">${esc(L.title)}</span></span>
      <span class="lab-rt" id="rt" aria-live="polite"><i></i><span>Python</span></span>
      <div class="lab-actions">
        <button type="button" class="btn sm ghost" id="lab-reset" title="Restore the starter code">Reset</button>
        <button type="button" class="btn sm ghost" id="lab-ref">Reference</button>
        <button type="button" class="btn sm primary" id="lab-run">${ico('play')} Run tests <kbd>${RUNKEY}</kbd></button>
      </div>
    </div>
    <div class="lab-main">
      <section class="lab-brief" aria-label="Brief">
        <div class="lab-meta"><a class="chip mod" href="${secHref}"><span class="dot"></span>${L.chapter} · ${esc(c?.title || '')}</a>${diffDots(L.difficulty)}<span class="dim">~${L.minutes} min · ${L.test_count} tests</span></div>
        <h1>${esc(L.title)}</h1>
        <button type="button" class="btn sm lab-jump" id="lab-jump">Jump to the editor ↓</button>
        <figure class="lab-basis"><figcaption><span>From the chapter${section ? ` · ${esc(section.h)}` : ''}</span><a href="${secHref}">Read the section →</a></figcaption>${L.basis.map(q => `<q>${esc(q)}</q>`).join('')}</figure>
        <div class="lab-md">${marked.parse(L.brief)}</div>
      </section>
      <section class="lab-work" aria-label="Your code and test results">
        <div class="lab-ed-head"><span class="tab">solution.py</span><span class="dim" id="lab-saved">${saved?.code ? 'restored your last code' : 'starter code'}</span></div>
        <div class="lab-ed" id="lab-ed"></div>
        <div class="lab-res" id="lab-res"></div>
      </section>
    </div>
  </div>`;

  const res = $('#lab-res', el), runBtn = $('#lab-run', el), savedEl = $('#lab-saved', el);
  let last = null, view = 'tests', running = false;

  /* runtime status pill */
  const rt = $('#rt', el);
  const unStatus = onStatus(s => {
    rt.dataset.state = s.state;
    rt.querySelector('span').textContent = s.state === 'loading' ? 'Loading Python…' : s.state === 'running' ? 'Running…'
      : s.state === 'ready' ? `Python ${s.version || ''}`.trim() : s.state === 'error' ? 'Python failed to load' : 'Python';
  });

  /* editor */
  const CM = await import('codemirror');
  if (!el.isConnected) { unStatus(); return; }
  const hl = CM.HighlightStyle.define([
    { tag: CM.tags.keyword, color: 'var(--cm-kw)' },
    { tag: [CM.tags.string, CM.tags.special(CM.tags.string)], color: 'var(--cm-str)' },
    { tag: CM.tags.comment, color: 'var(--cm-com)', fontStyle: 'italic' },
    { tag: [CM.tags.number, CM.tags.bool, CM.tags.null], color: 'var(--cm-num)' },
    { tag: [CM.tags.function(CM.tags.variableName), CM.tags.function(CM.tags.definition(CM.tags.variableName)), CM.tags.definition(CM.tags.function(CM.tags.variableName))], color: 'var(--cm-fn)' },
    { tag: [CM.tags.className, CM.tags.definition(CM.tags.className)], color: 'var(--cm-cls)' },
    { tag: [CM.tags.propertyName, CM.tags.attributeName], color: 'var(--cm-prop)' },
    { tag: [CM.tags.operator, CM.tags.punctuation], color: 'var(--fg-2)' },
    { tag: CM.tags.self, color: 'var(--cm-kw)', fontStyle: 'italic' },
  ]);
  const theme = CM.EditorView.theme({
    '&': { height: '100%', fontSize: '13.5px', color: 'var(--fg)', backgroundColor: 'transparent' },
    '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.6' },
    '.cm-content': { caretColor: 'var(--accent)', padding: '12px 0' },
    '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--fg-4)', border: 'none', paddingLeft: '6px' },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--fg) 4%, transparent)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--fg-2)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--mark) !important' },
    '.cm-matchingBracket': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)', outline: 'none' },
    '.cm-foldPlaceholder': { backgroundColor: 'var(--bg-3)', border: 'none', color: 'var(--fg-3)' },
    '.cm-tooltip': { backgroundColor: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: '8px' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--fg)' },
    '&.cm-focused': { outline: 'none' },
  });
  let saveT = 0;
  const editor = new CM.EditorView({
    parent: $('#lab-ed', el),
    state: CM.EditorState.create({
      doc: saved?.code ?? L.starter,
      extensions: [
        CM.keymap.of([{ key: 'Mod-Enter', run: () => { run(); return true; } }, CM.indentWithTab]),
        CM.basicSetup, CM.python(), CM.indentUnit.of('    '), theme, CM.syntaxHighlighting(hl),
        CM.EditorView.updateListener.of(u => {
          if (!u.docChanged) return;
          savedEl.textContent = 'editing…';
          clearTimeout(saveT);
          saveT = setTimeout(() => { store.labSave(L.id, editor.state.doc.toString()); savedEl.textContent = 'saved'; }, 700);
        }),
      ],
    }),
  });
  const setCode = code => editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: code } });

  /* results panel */
  function drawResults() {
    const r = last, total = L.test_count;
    const ok = r?.results?.filter(x => x.ok).length || 0;
    const allPass = r && !r.error && ok === total && r.results.length === total;
    const names = r?.results?.length ? r.results : L.test_names.map(doc => ({ doc, ok: null }));
    const out = (r?.stdout || '').trimEnd();
    res.className = 'lab-res' + (allPass ? ' pass' : r ? (r.error ? ' err' : ' fail') : '');
    res.innerHTML = `
      <div class="lr-head">
        <div class="lr-sum">${running ? '<span class="spin"></span> Running tests…'
          : !r ? `<b>${total} tests</b><span class="dim">press Run tests (${RUNKEY})</span>`
            : r.error ? `<b>${r.timedOut ? 'Stopped' : 'Your code did not run'}</b>`
              : `<b>${ok} of ${total} tests pass</b>${r.ms != null ? `<span class="dim">${r.ms} ms</span>` : ''}`}</div>
        <div class="lr-tabs" role="tablist"><button type="button" role="tab" data-v="tests" aria-selected="${view === 'tests'}">Tests</button><button type="button" role="tab" data-v="out" aria-selected="${view === 'out'}">Output${out ? ` <i>${out.split('\n').length}</i>` : ''}</button></div>
      </div>
      <div class="lr-bar"><i style="width:${(ok / total) * 100}%"></i></div>
      ${allPass ? `<div class="lr-win"><div><b>Lab passed</b><span>Every test passes. ${store.lab(L.id)?.runs > 1 ? `It took ${store.lab(L.id).runs} runs.` : 'First try.'}</span></div>
        <div class="row">${next ? `<a class="btn sm primary" href="#/lab/${next.id}">Next lab: ${esc(next.title)} →</a>` : '<a class="btn sm primary" href="#/labs">All labs</a>'}<button type="button" class="btn sm" data-ref>Compare with the reference</button><a class="btn sm ghost" href="${secHref}">Back to ${L.chapter}</a></div></div>` : ''}
      ${r?.error ? `<pre class="lr-err">${esc(r.error)}</pre>` : ''}
      <div class="lr-body" ${view === 'out' ? 'hidden' : ''}><ol class="lr-tests">${names.map(t => `<li class="${t.ok === true ? 'ok' : t.ok === false ? 'no' : 'idle'}"><span class="ic" aria-hidden="true">${t.ok === true ? '✓' : t.ok === false ? '✗' : '○'}</span><span class="tx"><span class="d">${esc(t.doc)}</span>${t.ok === false && t.msg ? `<code class="m">${esc(t.msg)}</code>` : ''}</span></li>`).join('')}</ol></div>
      <pre class="lr-out" ${view === 'tests' ? 'hidden' : ''}>${out ? esc(out) : '<span class="dim">Nothing printed. Use print() in your code to see values here.</span>'}</pre>`;
  }
  res.addEventListener('click', e => {
    const t = e.target.closest('[data-v]'); if (t) { view = t.dataset.v; drawResults(); return; }
    if (e.target.closest('[data-ref]')) showReference(true);
  });

  async function run() {
    if (running) return;
    running = true; runBtn.disabled = true; drawResults();
    const code = editor.state.doc.toString();
    clearTimeout(saveT);
    const r = await runLab(code, L.tests);
    if (!el.isConnected) return;
    running = false; runBtn.disabled = false;
    const ok = r.results.filter(x => x.ok).length, wasPassed = !!store.lab(L.id)?.passedAt;
    store.labResult(L.id, r.error ? 0 : ok, L.test_count, code);
    savedEl.textContent = 'saved';
    last = r;
    if (r.error) view = 'tests';
    drawResults();
    if (!r.error && ok === L.test_count && !wasPassed) celebrate(res);
  }
  runBtn.onclick = run;

  function showReference(free) {
    const tried = store.lab(L.id)?.runs;
    const m = modal(`<button class="close" type="button" aria-label="Close">×</button><span class="eyebrow">Reference solution</span><h2>${esc(L.title)}</h2>
      ${free || tried ? '' : '<div class="lab-gate"><p>You haven\'t run your own code yet. Struggling with it for a few minutes is most of the learning — the reference will still be here.</p><div class="row" style="margin-top:14px"><button type="button" class="btn sm" data-show>Show it anyway</button></div></div>'}
      <div class="lab-refcode" ${free || tried ? '' : 'hidden'}></div>
      <div class="row lab-refact" ${free || tried ? '' : 'hidden'}><button type="button" class="btn sm" data-load>Load into the editor</button><span class="dim">replaces your code (it stays in your undo history)</span></div>`);
    m.querySelector('.box').classList.add('wide');
    const box = m.querySelector('.lab-refcode');
    new CM.EditorView({ parent: box, state: CM.EditorState.create({ doc: L.solution, extensions: [CM.basicSetup, CM.python(), theme, CM.syntaxHighlighting(hl), CM.EditorState.readOnly.of(true), CM.EditorView.editable.of(false)] }) });
    m.querySelector('.close').onclick = () => m.remove();
    m.querySelector('[data-show]')?.addEventListener('click', () => { box.hidden = false; m.querySelector('.lab-refact').hidden = false; m.querySelector('.lab-gate').remove(); });
    m.querySelector('[data-load]').onclick = () => { setCode(L.solution); m.remove(); toast('Reference loaded — run it to see every test pass'); };
  }
  $('#lab-ref', el).onclick = () => showReference(false);
  $('#lab-jump', el).onclick = () => { $('.lab-work', el).scrollIntoView({ block: 'start', behavior: 'smooth' }); editor.focus(); };

  $('#lab-reset', el).onclick = () => {
    const m = modal(`<span class="eyebrow">Reset</span><h2>Restore the starter code?</h2><p>Your current code is replaced. You can still undo with ${isMac ? '⌘Z' : 'Ctrl+Z'} in the editor.</p><div class="row" style="margin-top:16px;gap:8px"><button type="button" class="btn sm primary" data-yes>Restore starter</button><button type="button" class="btn sm ghost" data-no>Cancel</button></div>`);
    m.querySelector('[data-no]').onclick = () => m.remove();
    m.querySelector('[data-yes]').onclick = () => { setCode(L.starter); last = null; drawResults(); m.remove(); editor.focus(); };
  };

  const keys = e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); } };
  addEventListener('keydown', keys);
  drawResults();
  return () => { unStatus(); removeEventListener('keydown', keys); clearTimeout(saveT); if (editor.state.doc.toString() !== (store.lab(L.id)?.code ?? L.starter)) store.labSave(L.id, editor.state.doc.toString()); editor.destroy(); };
}

function celebrate(host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const burst = document.createElement('div'); burst.className = 'lab-burst'; burst.setAttribute('aria-hidden', 'true');
  const colors = ['var(--mc)', 'var(--accent)', 'var(--ok)', 'var(--m-llm-apis)', 'var(--m-agents)', 'var(--m-retrieval)'];
  burst.innerHTML = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2 + Math.random() * .3, dist = 70 + Math.random() * 120;
    return `<i style="--x:${Math.cos(a) * dist}px;--y:${Math.sin(a) * dist - 40}px;--r:${Math.random() * 540 - 270}deg;background:${colors[i % colors.length]};animation-delay:${Math.random() * 80}ms"></i>`;
  }).join('');
  host.appendChild(burst);
  setTimeout(() => burst.remove(), 1600);
}

/* ------------------------------------------------------------------ chapter cards */
/** Put a "Hands-on lab" card at the end of each lab's section in a chapter. */
export async function mountLabCards(art, chapterId) {
  let d;
  try { d = await labsData(); } catch (e) { return; }
  for (const L of d.labs.filter(l => l.chapter === chapterId)) {
    const h2 = art.querySelector('h2#' + CSS.escape(L.anchor)); if (!h2) continue;
    let last = h2;
    for (let n = h2.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) last = n;
    const st = store.lab(L.id);
    const card = document.createElement('aside');
    card.className = 'labcta' + (st?.passedAt ? ' passed' : '');
    card.innerHTML = `<span class="lc-ico">${ico('code')}</span>
      <span class="lc-b"><span class="eyebrow">Hands-on lab ${nn(L.order)}${st?.passedAt ? ' · passed' : st?.runs ? ` · ${st.best}/${L.test_count} tests` : ''}</span><b>${esc(L.title)}</b>
        <span class="lc-f">Implement ${L.functions.map(f => `<code>${esc(f)}</code>`).join(', ')} · ${L.test_count} tests · ~${L.minutes} min</span></span>
      <a class="btn sm ${st?.passedAt ? '' : 'primary'}" href="#/lab/${L.id}">${st?.passedAt ? 'Revisit' : st?.code ? 'Continue' : 'Open lab'} →</a>`;
    last.after(card);
  }
}

export default { labs, lab };
