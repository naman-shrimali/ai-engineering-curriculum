/* Prerequisite DAG helpers over the content index. */
import { isDone, status, prog } from './store.js';

let C = null, byId = new Map();
export function init(content) {
  C = content; byId = new Map();
  for (const c of [...content.chapters, ...content.engineering, ...content.tutor]) byId.set(c.id, c);
}
export const get = id => byId.get(id);
export const all = () => [...C.chapters, ...C.engineering];
export const chapters = () => C.chapters;
export const modules = () => C.modules;
export const module = key => C.modules.find(m => m.key === key);

/** Every transitive prerequisite. */
export function ancestors(id, acc = new Set()) {
  for (const p of (get(id)?.prereqs || [])) if (!acc.has(p)) { acc.add(p); ancestors(p, acc); }
  return acc;
}
export function descendants(id, acc = new Set()) {
  for (const d of (get(id)?.dependents || [])) if (!acc.has(d)) { acc.add(d); descendants(d, acc); }
  return acc;
}
/** Longest path from a root — used for depth-layered layout. */
const depthMemo = new Map();
export function depth(id) {
  if (depthMemo.has(id)) return depthMemo.get(id);
  const ps = get(id)?.prereqs || [];
  const d = ps.length ? 1 + Math.max(...ps.map(depth)) : 0;
  depthMemo.set(id, d); return d;
}

/** Learner-facing state of a node. */
export function nodeState(id) {
  const c = get(id); if (!c) return 'locked';
  if (isDone(id)) return 'done';
  if (status(id) === 'reading') return 'reading';
  return (c.prereqs || []).every(isDone) ? 'available' : 'locked';
}
export function unmetPrereqs(id) { return (get(id)?.prereqs || []).filter(p => !isDone(p)); }

/** Fraction of a chapter's H2 sections marked read. */
export function sectionProgress(id) {
  const c = get(id); const p = prog(id);
  if (!c?.sections?.length) return 0;
  const tracked = c.sections.filter(s => !/^(sources|check your understanding|flashcards|further reading)$/i.test(s.h));
  const n = tracked.filter(s => p?.sections?.[s.anchor]).length;
  return tracked.length ? n / tracked.length : 0;
}

export function moduleProgress(key) {
  const ids = module(key)?.chapters || [];
  const done = ids.filter(isDone).length;
  const partial = ids.filter(i => !isDone(i) && status(i) === 'reading').length;
  return { total: ids.length, done, partial, pct: ids.length ? Math.round(100 * done / ids.length) : 0 };
}

export function trackIds(trackId) { return (C.tracks.find(t => t.id === trackId) || C.tracks[1]).ids; }

/** Recommended next chapters: available, not done, ordered by track/roadmap position;
    a chapter already 'reading' comes first. */
export function nextUp(trackId, n = 4) {
  const ids = trackIds(trackId);
  const reading = ids.filter(i => status(i) === 'reading' && !isDone(i));
  const avail = ids.filter(i => nodeState(i) === 'available');
  const out = [];
  for (const i of [...reading, ...avail]) if (!out.includes(i)) out.push(i);
  return out.slice(0, n).map(get);
}

/** Roadmap-order neighbours for prev/next paging. */
export function neighbours(id) {
  const list = all();
  const i = list.findIndex(c => c.id === id);
  return { prev: list[i - 1] || null, next: list[i + 1] || null };
}

export function overall() {
  const ids = C.chapters.map(c => c.id);
  const done = ids.filter(isDone).length;
  const mins = C.chapters.filter(c => isDone(c.id)).reduce((s, c) => s + (c.est_minutes || 0), 0);
  const total = C.chapters.reduce((s, c) => s + (c.est_minutes || 0), 0);
  return { done, total: ids.length, pct: Math.round(100 * done / ids.length), hoursDone: Math.round(mins / 60), hoursTotal: Math.round(total / 60) };
}
