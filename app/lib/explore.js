/* Session-only exploration path for references, glossary words, and card hops. */
import { $, $$, esc } from './ui.js';

let path = [];
let pending = false;
let originSeq = 0;

const readerRoute = hash => /^#\/(c|doc|glossary)(\/|\?|#|$)/.test(hash || '');
const targetRoute = hash => /^#\/(c|doc|glossary|cards)(\/|\?|#|$)/.test(hash || '');

function canonical(hash) {
  if (!hash) return '#/';
  let h = hash.startsWith('#') ? hash : '#' + hash;
  const raw = h.slice(1);
  const [route, frag] = raw.split('#', 2);
  const [pathname, query] = route.split('?', 2);
  const params = new URLSearchParams(query || '');
  // The exploration payload is transport-only; it must not affect route matching.
  params.delete('explore');
  if (frag && !params.has('s')) params.set('s', frag);
  const qs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  return '#' + pathname + (qs.length ? '?' + new URLSearchParams(qs).toString() : '');
}

function base(hash) { return canonical(hash).split('?')[0]; }

function withSection(hash, section) {
  const h = canonical(hash);
  if (!section) return h;
  const [route, query] = h.slice(1).split('?', 2);
  const params = new URLSearchParams(query || '');
  params.set('s', section);
  return '#' + route + '?' + params.toString();
}

function currentLabel() {
  const heading = $('#view .chap-h1, #view .page > h1');
  if (heading?.textContent.trim()) return heading.textContent.trim();
  return document.title.replace(/\s+—\s+AI Engineering$/, '').trim() || 'Current source';
}

function labelFor(link, target) {
  const text = link.textContent.trim().replace(/\s+/g, ' ');
  if (link.classList.contains('glos') || target.startsWith('#/glossary')) {
    return text || link.dataset.term || 'Glossary';
  }
  return text || target.replace(/^#\/(?:c|doc)\//, '').split(/[?#]/)[0] || 'Reference';
}

function anchorFor(link) {
  const host = link.closest('p, li, blockquote, .gterm, .project, .qa, .fc, .block') || link;
  if (!host.id) host.id = `explore-origin-${++originSeq}`;
  return host.id;
}

function viewportAnchor() {
  const main = $('#main');
  const candidates = $$('#view .prose [id^="explore-origin-"], #view .gterm[id]');
  const y = (main?.getBoundingClientRect().top || 0) + innerHeight * .28;
  return candidates.filter(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })
    .sort((a, b) => Math.abs(a.getBoundingClientRect().top - y) - Math.abs(b.getBoundingClientRect().top - y))[0]?.id;
}

function isNewTabReference(link) {
  return link.classList.contains('xref') || link.classList.contains('in');
}

function isSameTabExplore(link, target) {
  return link.classList.contains('glos') || link.classList.contains('glos-link') || !!link.closest('.gterm') ||
    (target.startsWith('#/cards') && !!link.closest('.prose'));
}

function buildNextPath(target, label, anchor) {
  const from = canonical(location.hash);
  const origin = withSection(from, anchor || viewportAnchor());
  const destination = { label, href: canonical(target), route: canonical(target), kind: target.startsWith('#/glossary') ? 'term' : target.startsWith('#/cards') ? 'cards' : 'reference' };
  const at = path.findIndex(item => item.route === from || base(item.route) === base(from));
  const nextPath = at >= 0 ? path.slice(0, at + 1) : [];
  if (!nextPath.length) nextPath.push({ label: currentLabel(), href: origin, route: origin, kind: 'source' });
  if (nextPath[nextPath.length - 1]?.route !== destination.route) nextPath.push(destination);
  return nextPath;
}

function recordSameTab(target, label, anchor) {
  const nextPath = buildNextPath(target, label, anchor);
  path = nextPath;
  pending = true;
  render();
}

function render() {
  const el = $('#explore-path');
  if (!el) return;
  const visible = path.length > 1;
  el.hidden = !visible;
  if (!visible) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="explore-inner" role="navigation" aria-label="Exploration path">
    <span class="explore-kicker"><span class="explore-pulse"></span>Path</span>
    <div class="explore-steps">${path.map((item, i) => `<button type="button" class="explore-step ${i === path.length - 1 ? 'current' : ''}" data-i="${i}" title="${esc(item.label)}"><span class="explore-dot">${i + 1}</span><span>${esc(item.label)}</span></button>${i < path.length - 1 ? '<span class="explore-arrow" aria-hidden="true">›</span>' : ''}`).join('')}</div>
    <button type="button" class="explore-close" id="explore-clear" aria-label="Close exploration path" title="Close path">×</button>
  </div>`;
  $$('.explore-step', el).forEach(button => button.onclick = () => {
    const item = path[+button.dataset.i];
    if (!item) return;
    path = path.slice(0, +button.dataset.i + 1);
    pending = true;
    render();
    if (canonical(location.hash) !== item.route) location.hash = item.route;
    else { pending = false; sync(location.hash); }
  });
  $('#explore-clear', el).onclick = () => { path = []; pending = false; render(); };
}

function sync(hash) {
  if (!path.length) return render();
  const route = canonical(hash);
  if (base(route) === base(path[0].route)) {
    path = []; pending = false; return render();
  }
  const at = path.findIndex(item => item.route === route || base(item.route) === base(route));
  if (at >= 0) path = path.slice(0, at + 1);
  else if (!pending) path = [];
  pending = false;
  render();
}

export function init() {
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || link.closest('#explore-path')) return;
    const target = link.getAttribute('href');
    if (!target || !targetRoute(target) || !readerRoute(location.hash)) return;
    if (isNewTabReference(link)) {
      // References open cleanly in a separate tab. The originating tab owns the
      // exploration path; the new tab deliberately receives no history payload.
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('href', canonical(target));
    } else if (isSameTabExplore(link, target)) {
      recordSameTab(target, labelFor(link, target), anchorFor(link));
    }
  }, true);
  render();
}

export { recordSameTab };
export function onRoute(hash) { sync(hash); }
