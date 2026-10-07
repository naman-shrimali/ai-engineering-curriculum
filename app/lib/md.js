/* Markdown → HTML for chapters, plus glossary and diagram decoration.
   The .md files stay the single source of truth: this renders them live. */
import { marked } from 'marked';
import mermaid from 'mermaid';
import { esc, $$, toast } from './ui.js';
import { mountDiagrams } from './diagrams.js';

let CONTENT = null, byPath = new Map(), byId = new Map();
export function init(content) {
  CONTENT = content;
  for (const c of [...content.chapters, ...content.engineering, ...content.tutor]) { byPath.set(c.path, c); byId.set(c.id, c); }
  initMermaid();
}

export const chapterById = id => byId.get(id);

/** Heading → anchor id. Mirrors scripts/build-content.py slug() exactly. */
export function slug(s) {
  return String(s).replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

export function splitFrontmatter(raw) {
  const meta = {}; let body = raw;
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end > 0) {
      const fm = raw.slice(3, end); body = raw.slice(end + 4);
      fm.replace(/^(\w+):\s*(.*)$/gm, (_, k, v) => { if (v && !v.startsWith('>')) meta[k] = v.replace(/^["']|["']$/g, ''); });
    }
  }
  return { meta, body };
}

/* ---------------- renderer ---------------- */
function makeRenderer(docPath) {
  const r = new marked.Renderer();
  const ids = new Map();
  r.heading = (text, level) => {
    let id = slug(text); if (ids.has(id)) { ids.set(id, ids.get(id) + 1); id += '-' + ids.get(id); } else ids.set(id, 0);
    return `<h${level} id="${id}">${text}</h${level}>`;
  };
  r.code = (code, lang) => {
    if (lang === 'mermaid') return `<div class="mermaid-src" data-src="${esc(code)}"></div>`;
    return `<pre><code class="language-${esc(lang || 'text')}">${esc(code)}</code><button class="copy" type="button">copy</button></pre>`;
  };
  r.link = (href, title, text) => {
    const t = title ? ` title="${esc(title)}"` : '';
    if (/^(https?:|mailto:)/.test(href)) return `<a href="${esc(href)}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`;
    if (href.startsWith('#')) return `<a href="${esc(href)}" data-frag="${esc(href.slice(1))}"${t}>${text}</a>`;
    const [file, frag] = href.split('#');
    const abs = resolve(file, docPath);
    if (/glossary\.md$/.test(abs)) return `<a href="#/glossary${frag ? '#' + esc(frag) : ''}" class="glos-link"${t}>${text}</a>`;
    let doc = byPath.get(abs);
    if (!doc) {
      // tolerate links to renamed chapter files: resolve by the id in the link text or filename
      const plain = text.replace(/<[^>]+>/g, '').trim();
      const idm = plain.match(/^([a-z]{3}-\d\d)$/) || abs.match(/\/([a-z]{3}-\d\d)-[^/]+\.md$/);
      if (idm && byId.has(idm[1])) doc = byId.get(idm[1]);
    }
    if (doc) {
      const cls = 'xref' + (doc.exists ? '' : ' pending');
      const isId = /^[a-z]{3}-\d\d$/.test(text.replace(/<[^>]+>/g, ''));
      return `<a href="#/c/${doc.id}${frag ? '?s=' + esc(frag) : ''}" class="${isId ? cls : 'in'}" data-mod="${doc.module}"${t}>${text}</a>`;
    }
    if (abs.endsWith('.md')) return `<a href="#/doc/${esc(abs)}${frag ? '?s=' + esc(frag) : ''}" class="in"${t}>${text}</a>`;
    return `<a href="${esc(href)}"${t}>${text}</a>`;
  };
  r.blockquote = q => {
    const m = q.match(/<strong>(Note|Warning|Volatile|Deep dive):<\/strong>/i);
    const cls = m ? ' class="' + m[1].toLowerCase().replace(/\s+/g, '-') + '"' : '';
    return `<blockquote${cls}>${q}</blockquote>`;
  };
  r.table = (head, body) => `<div class="tablewrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  return r;
}

function resolve(file, from) {
  const base = new URL(from, 'file:///'); const u = new URL(file, base);
  return u.pathname.slice(1);
}

/** Render a chapter body. Returns HTML with footnotes appended. */
export function render(md, docPath) {
  const defs = new Map();
  md = md.replace(/^\[\^([\w-]+)\]:\s*(.+)$/gm, (_, k, v) => { defs.set(k, v); return ''; });
  let n = 0; const num = new Map();
  md = md.replace(/\[\^([\w-]+)\]/g, (_, k) => { if (!num.has(k)) num.set(k, ++n); return `<sup class="fn" id="fnref-${k}"><a href="#fn-${k}" data-frag="fn-${k}">[${num.get(k)}]</a></sup>`; });
  // drop the H1 (the view renders its own title block)
  md = md.replace(/^# .+\n/m, '');
  let html = marked.parse(md, { renderer: makeRenderer(docPath), mangle: false, headerIds: false, breaks: false, gfm: true });
  if (defs.size) {
    html += `<h2 id="sources-list" class="eyebrow" style="border:0;margin-top:2.5em">Sources</h2><ol class="footnotes">` +
      [...defs].sort((a, b) => (num.get(a[0]) || 99) - (num.get(b[0]) || 99))
        .map(([k, v]) => `<li id="fn-${k}">${marked.parseInline(v.replace(/^\[T(\d)([^\]]*)\]\s*/, '<span class="tier" title="source tier">T$1$2</span>'))}</li>`).join('') + '</ol>';
  }
  return html;
}

/* ---------------- post-render decoration ---------------- */
export function decorate(root, { onNavigate } = {}) {
  // captions: italic-only paragraph directly before a diagram/table/pre
  $$('p > em:only-child', root).forEach(em => {
    const p = em.parentElement, nx = p.nextElementSibling;
    if (nx && (nx.classList.contains('mermaid-src') || nx.classList.contains('tablewrap') || nx.tagName === 'PRE')) { p.classList.add('capwrap'); em.classList.add('cap'); }
  });
  // copy buttons
  $$('pre .copy', root).forEach(b => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.previousElementSibling.textContent); toast('Copied'); } catch (e) { toast('Copy failed'); }
  });
  // in-page fragment links
  $$('a[data-frag]', root).forEach(a => a.onclick = e => {
    e.preventDefault(); const el = root.querySelector('#' + CSS.escape(a.dataset.frag)); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  // module colour on cross-refs
  $$('a.xref[data-mod]', root).forEach(a => a.style.setProperty('--mc', `var(--m-${a.dataset.mod})`));
  // glossary hover cards
  glossaryHover(root);
  // diagrams: rendered by Mermaid, made interactive from Mermaid's own parse of the same source
  return mountDiagrams(root, { onNavigate, lookup: id => byId.get(id), article: root });
}

/* ---------------- glossary popovers ---------------- */
let pop = null;
function glossaryHover(root) {
  if (!CONTENT) return;
  const terms = CONTENT.glossary;
  if (!terms.length) return;
  const rx = new RegExp('\\b(' + terms.map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|') + ')s?\\b', 'i');
  const byTerm = new Map(terms.map(t => [t.term.toLowerCase(), t]));
  // one link per term per H2 section, prose paragraphs only
  let seen = new Set();
  for (const el of $$('h2, p, li', root)) {
    if (el.tagName === 'H2') { seen = new Set(); continue; }
    if (el.closest('blockquote, pre, table, .footnotes, a')) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; let t; while ((t = walker.nextNode())) nodes.push(t);
    for (const tn of nodes) {
      if (tn.parentElement.closest('a, code, strong, em, sup')) continue;
      const m = tn.textContent.match(rx); if (!m) continue;
      const key = m[1].toLowerCase(); if (seen.has(key)) continue;
      const term = byTerm.get(key); if (!term) continue;
      seen.add(key);
      const i = m.index, span = document.createElement('a');
      span.className = 'glos'; span.href = '#/glossary#' + term.anchor; span.textContent = m[0]; span.dataset.term = term.term;
      const after = tn.splitText(i); after.textContent = after.textContent.slice(m[0].length);
      tn.parentNode.insertBefore(span, after);
      span.addEventListener('mouseenter', () => showPop(span, term)); span.addEventListener('mouseleave', hidePop);
      span.addEventListener('focus', () => showPop(span, term)); span.addEventListener('blur', hidePop);
    }
  }
}
function showPop(el, term) {
  hidePop();
  pop = document.createElement('div'); pop.className = 'popover';
  pop.innerHTML = `<b>${esc(term.term)}</b>${esc(term.def)}${term.see.length ? `<div class="dim" style="margin-top:6px;font-size:12px">See ${term.see.map(esc).join(', ')}</div>` : ''}`;
  document.body.appendChild(pop);
  const r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = Math.min(Math.max(12, r.left), innerWidth - pw - 12), y = r.bottom + 8;
  if (y + ph > innerHeight - 12) y = r.top - ph - 8;
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
function hidePop() { if (pop) { pop.remove(); pop = null; } }

/* ---------------- mermaid ---------------- */
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
export function initMermaid() {
  const dark = isDark();
  mermaid.initialize({
    startOnLoad: false, securityLevel: 'loose', theme: 'base', fontFamily: cssVar('--sans') || 'sans-serif',
    themeVariables: {
      darkMode: dark, background: cssVar('--bg-2'),
      primaryColor: dark ? '#1f2732' : '#eef1f5', primaryTextColor: cssVar('--fg'), primaryBorderColor: cssVar('--line-2'),
      secondaryColor: dark ? '#26303d' : '#e4e8ee', tertiaryColor: dark ? '#141920' : '#f7f8fa',
      lineColor: cssVar('--fg-3'), textColor: cssVar('--fg'), fontSize: '13px',
      clusterBkg: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.025)', clusterBorder: cssVar('--line-2'),
      edgeLabelBackground: cssVar('--bg-2'), nodeBorder: cssVar('--line-2'), mainBkg: dark ? '#1f2732' : '#eef1f5',
      actorBkg: dark ? '#1f2732' : '#eef1f5', actorBorder: cssVar('--line-2'), actorTextColor: cssVar('--fg'), actorLineColor: cssVar('--line-2'),
      signalColor: cssVar('--fg-2'), signalTextColor: cssVar('--fg'), labelBoxBkgColor: dark ? '#26303d' : '#e4e8ee',
      noteBkgColor: dark ? '#2a2418' : '#fff6e8', noteTextColor: cssVar('--fg'), noteBorderColor: cssVar('--warn'),
      activationBkgColor: cssVar('--accent-soft'), activationBorderColor: cssVar('--accent'),
      titleColor: cssVar('--fg'), sectionBkgColor: dark ? '#1a2029' : '#f0f2f5', altSectionBkgColor: dark ? '#141920' : '#ffffff',
      taskBkgColor: cssVar('--accent'), taskTextColor: '#fff', taskBorderColor: cssVar('--accent'),
      gridColor: cssVar('--line'), todayLineColor: cssVar('--danger'),
      labelColor: cssVar('--fg'), compositeBackground: dark ? '#1a2029' : '#f0f2f5', compositeBorder: cssVar('--line-2'),
      transitionColor: cssVar('--fg-3'), transitionLabelColor: cssVar('--fg'),
    },
    flowchart: { htmlLabels: true, curve: 'basis', padding: 12, nodeSpacing: 34, rankSpacing: 44, useMaxWidth: false },
    sequence: { useMaxWidth: false, mirrorActors: false, actorMargin: 40 },
    gantt: { useMaxWidth: false },
    state: { useMaxWidth: false },
  });
}
export function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches;
}

/** Inline markdown (flashcards, questions) with the same link resolution as chapters. */
export function inline(md, docPath = 'modules/x.md') {
  return marked.parseInline(String(md || ''), { renderer: makeRenderer(docPath), mangle: false });
}
