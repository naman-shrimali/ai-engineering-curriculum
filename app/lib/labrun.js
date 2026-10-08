/* Main-thread side of the coding labs: loads app/data/labs.json, owns the Python worker,
   and enforces a time limit per run by terminating the worker (the only reliable way to
   stop an infinite loop in a learner's code without freezing the page). */

const RUN_LIMIT = 8000, BOOT_LIMIT = 120000;
let data = null, worker = null, pending = null, seq = 0, status = { state: 'cold' };
const listeners = new Set();

export function labsData() {
  return (data ||= fetch(new URL('../data/labs.json', import.meta.url), { cache: 'no-cache' }).then(r => {
    if (!r.ok) throw new Error('labs.json ' + r.status);
    return r.json();
  }).catch(e => { data = null; throw e; }));
}

/** Subscribe to runtime status: {state: 'cold'|'loading'|'ready'|'running'|'error', version?, ms?}. */
export function onStatus(fn) { listeners.add(fn); fn(status); return () => listeners.delete(fn); }
function setStatus(s) { status = { ...status, ...s }; for (const fn of listeners) fn(status); }

function spawn() {
  worker = new Worker(new URL('../lab-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = e => {
    const m = e.data;
    if (m.type === 'status') setStatus({ state: 'loading' });
    else if (m.type === 'ready') setStatus({ state: 'ready', version: m.version, ms: m.ms });
    else if (m.type === 'running' && pending?.id === m.id) {
      clearTimeout(pending.boot);
      setStatus({ state: 'running' });
      pending.timer = setTimeout(() => finish({ error: `Stopped after ${RUN_LIMIT / 1000} seconds — is there an infinite loop?`, timedOut: true }, true), RUN_LIMIT);
    } else if (m.type === 'result' && pending?.id === m.id) {
      setStatus({ state: 'ready' });
      finish(m);
    }
  };
  worker.onerror = e => {
    e.preventDefault?.();
    setStatus({ state: 'error' });
    finish({ error: 'The Python runtime failed to start' + (e.message ? `: ${e.message}` : '.') }, true);
  };
}

function finish(result, kill) {
  const p = pending; pending = null;
  if (kill) { worker?.terminate(); worker = null; if (status.state !== 'error') setStatus({ state: 'cold' }); }
  if (p) { clearTimeout(p.timer); clearTimeout(p.boot); p.resolve({ results: [], stdout: '', ...result }); }
}

/** Start loading Python in the background so the first run is fast. */
export async function warm() {
  const d = await labsData();
  if (worker) return;
  spawn();
  setStatus({ state: 'loading' });
  worker.postMessage({ type: 'warm', harness: d.harness });
}

/** Run a lab's tests against code. Resolves {error, results:[{name, doc, ok, msg}], stdout, ms, timedOut}. */
export async function runLab(code, tests) {
  const d = await labsData();
  if (pending) finish({ error: 'Superseded by a newer run.' }, true);
  if (!worker) spawn();
  return new Promise(resolve => {
    const id = ++seq;
    pending = { id, resolve, timer: 0, boot: setTimeout(() => finish({ error: 'Python took too long to load. Check your connection and try again.' }, true), BOOT_LIMIT) };
    worker.postMessage({ type: 'run', id, harness: d.harness, code, tests });
  });
}

/** chapter id → [{id, title, test_count}] for the chapter's labs, for the mastery model. Empty if labs fail to load. */
export async function labsByChapter() {
  try {
    const d = await labsData(), out = {};
    for (const l of d.labs) (out[l.chapter] ||= []).push({ id: l.id, title: l.title, test_count: l.test_count });
    return out;
  } catch (e) { return {}; }
}
