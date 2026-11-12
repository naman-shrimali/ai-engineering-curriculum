/* Reactive learner state. Persists to localStorage immediately; a cloud
   adapter (lib/auth.js) can attach to mirror the same state to Firestore.
   Every leaf that can change carries its own timestamp so merges are
   per-entry last-write-wins instead of whole-document clobbering. */

const KEY = 'aiec.v1';
const listeners = new Set();
let cloud = null;            // {push(state)} attached by auth.js when signed in
let pushTimer = null;

export const today = () => new Date().toISOString().slice(0, 10);
export const now = () => Date.now();

function blank() {
  return {
    v: 1, updatedAt: 0,
    track: null,
    progress: {},      // id -> {status:'reading'|'done', startedAt, completedAt, lastAt, sections:{anchor:ts}, checks:{i:grade}, exercises:{i:1}, interview:{i:grade}}
    cards: {},         // cardId -> {ease, interval, due, reps, lapses, last}
    readlater: [],     // [{id,url,title,note,added,read,readAt}]
    activity: {},      // 'YYYY-MM-DD' -> count of learning actions
    settings: { prose: 'serif' },
    lastOpened: null,  // {id, at}
  };
}

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch (e) { /* storage blocked: run in memory */ }
  return blank();
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what) { for (const fn of listeners) { try { fn(what); } catch (e) { console.error(e); } } }

/** Apply a mutation to state; bumps updatedAt, records activity, persists, notifies, syncs. */
export function update(mutator, { activity = true, sync = true } = {}) {
  mutator(state);
  state.updatedAt = now();
  if (activity) state.activity[today()] = (state.activity[today()] || 0) + 1;
  persist();
  emit(state);
  if (sync && cloud) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => cloud.push(state), 1200);
  }
}

/** Replace state wholesale (used after a cloud merge). */
export function replace(next, { sync = false } = {}) {
  state = { ...blank(), ...next };
  persist(); emit(state);
  if (sync && cloud) cloud.push(state);
}

export function attachCloud(adapter) { cloud = adapter; }
export function detachCloud() { cloud = null; }

/* ---------------- chapter progress helpers ---------------- */

export function prog(id) { return state.progress[id] || null; }
export function status(id) { return state.progress[id]?.status || null; }
export function isDone(id) { return status(id) === 'done'; }

function ensure(s, id) {
  if (!s.progress[id]) s.progress[id] = { status: 'reading', startedAt: now(), sections: {}, checks: {}, exercises: {}, interview: {} };
  const p = s.progress[id];
  p.sections ||= {}; p.checks ||= {}; p.exercises ||= {}; p.interview ||= {};
  p.lastAt = now();
  return p;
}

export function touch(id) {
  update(s => { const p = ensure(s, id); s.lastOpened = { id, at: now() }; return p; }, { activity: false });
}
export function markSection(id, anchor) {
  if (state.progress[id]?.sections?.[anchor]) return;
  update(s => { ensure(s, id).sections[anchor] = now(); });
}
export function setDone(id, done = true) {
  update(s => { const p = ensure(s, id); p.status = done ? 'done' : 'reading'; p.completedAt = done ? now() : null; });
}
export function setCheck(id, i, grade) { update(s => { ensure(s, id).checks[i] = { g: grade, at: now() }; }); }
export function setInterview(id, i, grade) { update(s => { ensure(s, id).interview[i] = { g: grade, at: now() }; }); }
export function toggleExercise(id, i) {
  update(s => { const p = ensure(s, id); if (p.exercises[i]) delete p.exercises[i]; else p.exercises[i] = now(); });
}
export function setTrack(t) { update(s => { s.track = t; }, { activity: false }); }
export function setSetting(k, v) { update(s => { s.settings[k] = v; }, { activity: false }); }

/* ---------------- read later ---------------- */
export function rlAdd(url, title = '', note = '') {
  url = (url || '').trim(); if (!url) return 'empty';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  if (state.readlater.some(i => i.url === url)) return 'dup';
  update(s => { s.readlater.unshift({ id: now().toString(36) + Math.random().toString(36).slice(2, 6), url, title: title.trim() || nameFromUrl(url), note, added: new Date().toISOString(), read: false, at: now() }); }, { activity: false });
  return 'ok';
}
export function rlToggle(id) { update(s => { const it = s.readlater.find(x => x.id === id); if (it) { it.read = !it.read; it.readAt = it.read ? new Date().toISOString() : null; it.at = now(); } }); }
export function rlRemove(id) { update(s => { s.readlater = s.readlater.filter(x => x.id !== id); }, { activity: false }); }
export function nameFromUrl(u) {
  try {
    const x = new URL(u), host = x.hostname.replace(/^www\./, '');
    const last = x.pathname.split('/').filter(Boolean).pop() || '';
    if (!last) return host;
    const name = last.replace(/\.(pdf|html?|php)$/i, '').replace(/[-_]+/g, ' ').slice(0, 140);
    return /[a-z]{3}/i.test(name) ? name : `${host} ${name}`;
  } catch (e) { return u; }
}

/* ---------------- merge (local ⇄ cloud) ---------------- */
function ts(x) { return (x && (x.at || x.lastAt || x.last || x.completedAt || x.startedAt)) || 0; }
function mergeMaps(a = {}, b = {}, deep = false) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!(k in out)) { out[k] = v; continue; }
    if (deep && v && typeof v === 'object' && out[k] && typeof out[k] === 'object') {
      const A = out[k], B = v;
      const newer = ts(B) >= ts(A) ? B : A, older = newer === B ? A : B;
      out[k] = { ...older, ...newer,
        sections: mergeMaps(A.sections, B.sections), checks: mergeMaps(A.checks, B.checks, true),
        exercises: mergeMaps(A.exercises, B.exercises), interview: mergeMaps(A.interview, B.interview, true),
        status: (A.status === 'done' || B.status === 'done') ? 'done' : (newer.status || 'reading'),
        completedAt: A.completedAt || B.completedAt || null };
    } else if (typeof v === 'number' && typeof out[k] === 'number') {
      out[k] = Math.max(out[k], v);
    } else {
      out[k] = ts(v) >= ts(out[k]) ? v : out[k];
    }
  }
  return out;
}
export function merge(local, remote) {
  if (!remote) return { ...local };
  const rl = [...(local.readlater || [])];
  for (const r of remote.readlater || []) { if (!rl.some(x => x.url === r.url)) rl.push(r); }
  return {
    ...blank(),
    v: 1, updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
    track: (remote.updatedAt || 0) > (local.updatedAt || 0) ? (remote.track ?? local.track) : (local.track ?? remote.track),
    progress: mergeMaps(local.progress, remote.progress, true),
    cards: mergeMaps(local.cards, remote.cards),
    readlater: rl,
    activity: mergeMaps(local.activity, remote.activity),
    settings: { ...(remote.settings || {}), ...(local.settings || {}) },
    lastOpened: ts(remote.lastOpened) > ts(local.lastOpened) ? remote.lastOpened : local.lastOpened,
  };
}

/* ---------------- derived stats ---------------- */
export function streak() {
  const days = new Set(Object.keys(state.activity).filter(d => state.activity[d] > 0));
  let n = 0; const d = new Date();
  // today counts if active; otherwise start from yesterday
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function exportJSON() { return JSON.stringify(state, null, 2); }
export function importJSON(txt) {
  const inc = JSON.parse(txt);
  replace(merge(state, inc), { sync: true });
}
export function resetAll() { replace(blank(), { sync: true }); }
