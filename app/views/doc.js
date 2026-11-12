/* Renders non-chapter Markdown (README, roadmap, conventions…) live. */
import { $, esc, ico } from '../lib/ui.js';
import * as MD from '../lib/md.js';
import { BASE, CONTENT } from '../main.js';

const cache = new Map();
export async function fetchMd(path) {
  if (cache.has(path)) return cache.get(path);
  const r = await fetch(BASE + path, { cache: 'no-cache' }); if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
  const t = await r.text(); cache.set(path, t); return t;
}

async function doc(el, params, query) {
  const path = params.path;
  if (!path || !CONTENT.files[path]) { el.innerHTML = `<div class="page"><div class="empty">No such document: <code>${esc(path || '')}</code></div></div>`; return; }
  el.innerHTML = `<div class="page narrow"><div class="boot"><div class="spinner"></div></div></div>`;
  const raw = await fetchMd(path);
  const { meta, body } = MD.splitFrontmatter(raw);
  const h1 = body.match(/^# (.+)$/m);
  el.innerHTML = `<div class="page narrow"><div class="crumbs" style="margin-bottom:10px"><a href="#/">Home</a> ${ico('chev')} <span>${esc(path)}</span><a class="btn xs ghost" style="margin-left:auto" href="${BASE + path}" target="_blank" rel="noopener">raw</a></div>
    <h1 class="chap-h1" style="font-size:34px">${esc(meta.title || (h1 ? h1[1] : path))}</h1>
    <article class="prose sans" id="doc-body"></article></div>`;
  const art = $('#doc-body', el); art.innerHTML = MD.render(body, path);
  MD.decorate(art);
  document.title = (meta.title || (h1 ? h1[1] : path)) + ' — AI Engineering';
  if (query.s) requestAnimationFrame(() => art.querySelector('#' + CSS.escape(query.s))?.scrollIntoView({ block: 'start' }));
}
export default { doc };
