import { $, $$, esc, h, ico, toast, modal } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import { CONTENT } from '../main.js';

async function profile(el) {
  const auth = await import('../lib/auth.js');
  const draw = () => {
    const u = auth.user(); const ov = G.overall(); const s = store.state;
    const reviewed = Object.keys(s.cards).length; const graded = Object.values(s.progress).reduce((n, p) => n + Object.keys(p.checks || {}).length + Object.keys(p.interview || {}).length, 0);
    el.innerHTML = h`<div class="page narrow">
      <div class="ph"><div><span class="eyebrow">Account</span><h1>${u ? esc(u.displayName || u.email || 'You') : 'Local profile'}</h1><p>${u ? `Signed in as ${esc(u.email || '')}. Progress syncs to your Google Cloud (Firestore) profile and stays available in this browser offline.` : 'Progress is saved in this browser only. Sign in to keep it across devices.'}</p></div>
        <div class="row">${u ? `<button class="btn" id="signout" type="button">Sign out</button>` : `<button class="btn primary" id="signin" type="button">${ico('user')} Sign in</button>`}</div></div>
      ${auth.configured() ? '' : `<div class="setup"><b>Sign-in is not configured on this deployment yet.</b> The owner enables it by creating a Firebase project on Google Cloud and pasting the web config into <code>app/config.js</code> — see <a href="https://github.com/naman-shrimali/ai-engineering-curriculum/blob/main/docs/SETUP-GCP-AUTH.md" target="_blank" rel="noopener">docs/SETUP-GCP-AUTH.md</a>. Until then everything works in local mode.</div>`}
      <div class="grid g4" style="margin-top:18px">
        <div class="tile"><span class="v num">${ov.done}</span><span class="k">chapters done</span></div>
        <div class="tile"><span class="v num">${store.streak()}</span><span class="k">day streak</span></div>
        <div class="tile"><span class="v num">${reviewed}</span><span class="k">cards reviewed</span></div>
        <div class="tile"><span class="v num">${graded}</span><span class="k">questions self-graded</span></div>
      </div>
      <section class="sect"><h2>Preferences</h2><div class="card stack">
        <label class="row spread"><span>Chapter prose typeface</span><div class="seg">${[['serif', 'Serif'], ['sans', 'Sans']].map(([k, l]) => `<button type="button" data-prose="${k}" class="${(s.settings.prose || 'serif') === k ? 'on' : ''}">${l}</button>`).join('')}</div></label>
        <label class="row spread"><span>Learning track</span><select id="trk"><option value="">None</option>${CONTENT.tracks.map(t => `<option value="${t.id}" ${s.track === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      </div></section>
      <section class="sect"><h2>Your data</h2><div class="card stack">
        <p class="dim" style="font-size:13.5px">Everything the app knows about you is one JSON document: chapter progress, section reads, self-grades, flashcard scheduling, your reading queue and activity days. Export it any time.</p>
        <div class="row"><button class="btn sm" id="exp" type="button">Export JSON</button><button class="btn sm" id="imp" type="button">Import & merge</button><button class="btn sm danger" id="reset" type="button">Reset all progress</button></div>
      </div></section>
    </div>`;
    $('#signin', el) && ($('#signin', el).onclick = () => auth.openSignIn());
    $('#signout', el) && ($('#signout', el).onclick = () => auth.signOut());
    $$('[data-prose]', el).forEach(b => b.onclick = () => store.setSetting('prose', b.dataset.prose));
    $('#trk', el).onchange = e => store.setTrack(e.target.value || null);
    $('#exp', el).onclick = () => { const blob = new Blob([store.exportJSON()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ai-engineering-progress.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
    $('#imp', el).onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.onchange = () => { const f = inp.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { try { store.importJSON(fr.result); toast('Merged'); } catch (e) { toast('Not a valid export'); } }; fr.readAsText(f); }; inp.click(); };
    $('#reset', el).onclick = () => { const m = modal(`<h2>Reset all progress?</h2><p>This clears chapter progress, self-grades, flashcard scheduling and your reading queue${u ? ', in this browser and in your cloud profile' : ''}. Export first if you might want it back.</p><div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" id="m-no" type="button">Keep it</button><button class="btn danger" id="m-yes" type="button">Reset everything</button></div>`); m.querySelector('#m-no').onclick = () => m.remove(); m.querySelector('#m-yes').onclick = () => { store.resetAll(); m.remove(); toast('Progress reset'); }; };
  };
  draw();
  const off = [store.subscribe(draw), auth.onChange(draw)];
  return () => off.forEach(f => f());
}
export default { profile };
