/* Runs lab code in Python (Pyodide, vendored in app/vendor/pyodide) off the main thread.
   The main thread terminates this worker if a run exceeds its time limit, which is how an
   infinite loop in a learner's code is stopped without freezing the page. */
import { loadPyodide } from './vendor/pyodide/pyodide.mjs';

let py = null, booting = null;

function boot(harness) {
  if (!booting) {
    booting = (async () => {
      postMessage({ type: 'status', msg: 'Loading Python…' });
      const t0 = performance.now();
      py = await loadPyodide({ indexURL: new URL('./vendor/pyodide/', import.meta.url).href });
      py.runPython(harness);
      postMessage({ type: 'ready', ms: Math.round(performance.now() - t0), version: py.version });
    })();
  }
  return booting;
}

onmessage = async e => {
  const { id, type, harness, code, tests } = e.data;
  try {
    await boot(harness);
    if (type === 'warm') return;
    let out = '';
    const sink = s => { if (out.length < 20000) out += s + '\n'; };
    py.setStdout({ batched: sink }); py.setStderr({ batched: sink });
    postMessage({ type: 'running', id });
    py.globals.set('__lab_code', code); py.globals.set('__lab_tests', tests);
    const t0 = performance.now();
    const res = JSON.parse(py.runPython('import json as __j\n__j.dumps(run(__lab_code, __lab_tests))'));
    postMessage({ type: 'result', id, ...res, stdout: out, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    postMessage({ type: 'result', id, error: String(err?.message || err).split('\n').slice(-3).join('\n'), results: [], stdout: '' });
  }
};
