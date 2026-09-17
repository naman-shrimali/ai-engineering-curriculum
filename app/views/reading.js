/* Curated reading list (reading-list.md, rendered live) + the personal Read Later queue. */
import { $, $$, esc, h, ico, toast } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as MD from '../lib/md.js';
import { fetchMd } from './doc.js';
import { BASE } from '../main.js';

let rlFilter = 'unread';
function queueHtml() {
  const items = store.state.readlater;
  const q = ($('#rl-q')?.value || '').toLowerCase().trim();
  const list = items.filter(i => (rlFilter === 'all' || (rlFilter === 'read' ? i.read : !i.read)) && (!q || (i.title + ' ' + i.url).toLowerCase().includes(q)));
  return list.length ? list.map(i => `<div class="rl-card ${i.read ? 'done' : ''}" data-id="${i.id}"><button class="tick" type="button" title="${i.read ? 'Mark unread' : 'Mark read'}">${i.read ? '✓' : ''}</button><div><a class="t" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${esc(i.title)}</a><div class="m">${esc(host(i.url))} · ${esc((i.added || '').slice(0, 10))}</div></div><button class="x" type="button" title="Remove">×</button></div>`).join('')
    : `<div class="empty" style="margin-top:8px">${rlFilter === 'read' ? 'Nothing marked read yet.' : 'Your queue is empty. Paste a URL above, or press + next to any paper below.'}</div>`;
}
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }

async function reading(el) {
  el.innerHTML = `<div class="page narrow"><div class="boot"><div class="spinner"></div></div></div>`;
  const raw = await fetchMd('reading-list.md');
  const { body } = MD.splitFrontmatter(raw);
  const unread = store.state.readlater.filter(i => !i.read).length;
  el.innerHTML = h`<div class="page narrow">
    <div class="ph"><div><span class="eyebrow">Reading</span><h1>Papers, blogs & your queue</h1><p>A curated list of primary sources grouped by the chapter each one reinforces, plus a personal Read Later queue. Signed in, the queue follows you across devices.</p></div></div>
    <section class="card" id="rl">
      <div class="row spread"><h3>Read Later <span class="dim" style="font-weight:500">· ${unread} unread</span></h3><div class="seg">${[['unread', 'Unread'], ['read', 'Read'], ['all', 'All']].map(([k, l]) => `<button type="button" data-f="${k}" class="${rlFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="rl-row"><input id="rl-url" type="url" placeholder="Paste a URL…" autocomplete="off"><input id="rl-title" placeholder="Title (optional)" autocomplete="off"><button class="btn primary sm" id="rl-go" type="button">Add</button></div>
      <div class="rl-row"><input id="rl-q" placeholder="Filter queue…" autocomplete="off"></div>
      <div id="rl-list">${queueHtml()}</div>
      <p class="dim" style="font-size:12px;margin-top:12px">Bookmarklet — drag to your bookmarks bar, click on any article: <a class="rl-plus" style="width:auto;padding:0 8px" id="rl-bmk">+ Read Later</a></p>
    </section>
    <article class="prose sans" id="rl-body" style="margin-top:28px"></article></div>`;
  const art = $('#rl-body', el); art.innerHTML = MD.render(body.replace(/^# .+\n/m, ''), 'reading-list.md');
  MD.decorate(art);
  $$('a[href^="http"]', art).forEach(a => {
    const b = document.createElement('a'); b.className = 'rl-plus'; b.textContent = '+'; b.title = 'Save to Read Later';
    b.onclick = e => { e.preventDefault(); const r = store.rlAdd(a.href, a.textContent); b.classList.add('added'); b.textContent = '✓'; toast(r === 'dup' ? 'Already in your queue' : 'Saved to Read Later'); redraw(); };
    a.insertAdjacentElement('afterend', b);
  });
  $('#rl-bmk', el).setAttribute('href', "javascript:(function(){window.open(" + JSON.stringify(location.origin + location.pathname + '#/reading?add=') + "+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank');})()");
  const redraw = () => { $('#rl-list', el).innerHTML = queueHtml(); wire(); };
  const wire = () => {
    $$('.rl-card', el).forEach(c => { c.querySelector('.tick').onclick = () => { store.rlToggle(c.dataset.id); redraw(); }; c.querySelector('.x').onclick = () => { store.rlRemove(c.dataset.id); redraw(); }; });
  };
  const add = () => { const u = $('#rl-url', el), t = $('#rl-title', el); const r = store.rlAdd(u.value, t.value); if (r === 'empty') return u.focus(); toast(r === 'dup' ? 'Already saved' : 'Saved'); u.value = ''; t.value = ''; redraw(); };
  $('#rl-go', el).onclick = add; $('#rl-url', el).onkeydown = e => { if (e.key === 'Enter') add(); }; $('#rl-title', el).onkeydown = e => { if (e.key === 'Enter') add(); };
  $('#rl-q', el).oninput = redraw;
  $$('[data-f]', el).forEach(b => b.onclick = () => { rlFilter = b.dataset.f; $$('[data-f]', el).forEach(x => x.classList.toggle('on', x === b)); redraw(); });
  wire();
  // bookmarklet capture: #/reading?add=URL&title=T
  const qs = new URLSearchParams((location.hash.split('?')[1] || ''));
  if (qs.get('add')) { const r = store.rlAdd(qs.get('add'), qs.get('title') || ''); history.replaceState(null, '', location.pathname + '#/reading'); toast(r === 'dup' ? 'Already in your queue' : 'Saved to Read Later'); redraw(); }
}
export default { reading };
