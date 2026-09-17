/* Sign-in (Firebase Authentication on Google Cloud) and progress sync
   (Cloud Firestore, one document per user). Loads lazily and only when
   app/config.js carries a config; otherwise the app stays local-only. */
import { firebaseConfig } from '../config.js';
import { $, esc, ico, toast, modal } from './ui.js';
import * as store from './store.js';

let auth = null, db = null, fs = null, fa = null, u = null, sync = 'off';
const listeners = new Set();
export const configured = () => !!firebaseConfig;
export const user = () => u;
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => { for (const fn of listeners) { try { fn(u); } catch (e) { console.error(e); } } widget(); };

export async function init() {
  widget();
  if (!configured()) return;
  try {
    const [{ initializeApp }, A, F] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    fa = A; fs = F;
    const app = initializeApp(firebaseConfig);
    auth = A.getAuth(app); db = F.getFirestore(app);
    A.getRedirectResult(auth).catch(e => { if (e.code !== 'auth/no-auth-event') toast(friendly(e)); });
    A.onAuthStateChanged(auth, async usr => {
      u = usr;
      if (usr) { await pull(usr); store.attachCloud({ push }); } else { store.detachCloud(); sync = 'off'; }
      emit();
    });
  } catch (e) { console.warn('Firebase failed to load', e); sync = 'off'; widget(); }
}

function ref(uid) { return fs.doc(db, 'users', uid); }
async function pull(usr) {
  sync = 'busy'; widget();
  try {
    const snap = await fs.getDoc(ref(usr.uid));
    const remote = snap.exists() ? snap.data() : null;
    const merged = store.merge(store.state, remote);
    store.replace(merged);
    await push(merged, usr);
    sync = 'ok'; toast(remote ? 'Progress synced' : 'Cloud profile created');
  } catch (e) { sync = 'err'; toast(friendly(e), 3000); }
  widget();
}
async function push(state, usr = u) {
  if (!usr || !db) return;
  sync = 'busy'; widget();
  try {
    await fs.setDoc(ref(usr.uid), {
      v: 1, profile: { displayName: usr.displayName || '', email: usr.email || '', photoURL: usr.photoURL || '' },
      progress: state.progress, cards: state.cards, readlater: state.readlater, track: state.track || null,
      settings: state.settings, activity: state.activity, lastOpened: state.lastOpened || null, updatedAt: fs.serverTimestamp(),
    });
    sync = 'ok';
  } catch (e) { sync = 'err'; console.error(e); toast(friendly(e), 3000); }
  widget();
}

function friendly(e) {
  const c = e?.code || '';
  if (c.includes('unauthorized-domain')) return 'This domain is not authorized for sign-in yet (Firebase console → Authentication → Settings → Authorized domains).';
  if (c.includes('permission-denied')) return 'Firestore denied the write: deploy firestore.rules to your project.';
  if (c.includes('popup-closed')) return 'Sign-in window closed.';
  if (c.includes('wrong-password') || c.includes('invalid-credential')) return 'Wrong email or password.';
  if (c.includes('user-not-found')) return 'No account with that email — create one instead.';
  if (c.includes('email-already-in-use')) return 'That email already has an account — sign in instead.';
  if (c.includes('weak-password')) return 'Use a password of at least 6 characters.';
  if (c.includes('network')) return 'Network error — you are still saving locally.';
  return e?.message || 'Something went wrong.';
}

export async function signInWith(provider) {
  const P = provider === 'google' ? new fa.GoogleAuthProvider() : new fa.GithubAuthProvider();
  try { await fa.signInWithPopup(auth, P); }
  catch (e) { if (/popup-blocked|operation-not-supported|cancelled-popup/.test(e.code || '')) await fa.signInWithRedirect(auth, P); else throw e; }
}
export async function signOut() { if (auth) await fa.signOut(auth); toast('Signed out — progress stays in this browser'); }

export function openSignIn() {
  if (!configured()) { location.hash = '#/profile'; return; }
  let mode = 'in';
  const m = modal('');
  const draw = () => {
    m.querySelector('.box').innerHTML = `<button class="close" type="button">×</button><span class="eyebrow">Account</span><h2>${mode === 'in' ? 'Sign in' : 'Create an account'}</h2><p>Keep your progress, flashcard schedule and reading queue across devices. Your local progress merges in.</p>
      <div class="providers"><button class="btn" type="button" data-p="google"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.4 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.8 38 46.5 31.8 46.5 24.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-3.9-13.5-9.3l-7.9 6C6.6 42.6 14.6 48 24 48z"/></svg> Continue with Google</button>
      <button class="btn" type="button" data-p="github"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z"/></svg> Continue with GitHub</button></div>
      <div class="dim" style="text-align:center;font-size:12px;margin:2px 0 10px">or with email</div>
      <form id="ef"><input type="email" id="e-mail" placeholder="Email" required autocomplete="email"><input type="password" id="e-pass" placeholder="Password" required autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}" minlength="6"><div class="err" id="e-err"></div><button class="btn primary" type="submit" style="justify-content:center">${mode === 'in' ? 'Sign in' : 'Create account'}</button></form>
      <p class="foot">${mode === 'in' ? 'New here? <a href="#" id="sw">Create an account</a>.' : 'Already have an account? <a href="#" id="sw">Sign in</a>.'} Progress is stored in your own Google Cloud Firestore profile; no third parties.</p>`;
    m.querySelector('.close').onclick = () => m.remove();
    m.querySelector('#sw').onclick = e => { e.preventDefault(); mode = mode === 'in' ? 'up' : 'in'; draw(); };
    m.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { try { await signInWith(b.dataset.p); m.remove(); } catch (e) { m.querySelector('#e-err').textContent = friendly(e); } });
    m.querySelector('#ef').onsubmit = async e => {
      e.preventDefault(); const em = m.querySelector('#e-mail').value, pw = m.querySelector('#e-pass').value;
      try { if (mode === 'in') await fa.signInWithEmailAndPassword(auth, em, pw); else await fa.createUserWithEmailAndPassword(auth, em, pw); m.remove(); }
      catch (err) { m.querySelector('#e-err').textContent = friendly(err); }
    };
  };
  draw();
}

function widget() {
  const el = $('#account'); if (!el) return;
  if (!configured()) { el.innerHTML = `<a class="acct-card" href="#/profile" style="text-decoration:none;color:inherit"><span class="avatar">${ico('user')}</span><span class="who"><b>Local mode</b><small>progress saved in this browser</small></span></a>`; return; }
  if (!u) { el.innerHTML = `<button class="btn primary" style="width:100%;justify-content:center" id="acct-in" type="button">${ico('user')} Sign in</button>`; $('#acct-in').onclick = openSignIn; return; }
  const initials = (u.displayName || u.email || '?').split(/[\s@]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  el.innerHTML = `<a class="acct-card" href="#/profile" style="text-decoration:none;color:inherit" title="${sync === 'ok' ? 'Synced' : sync === 'busy' ? 'Syncing…' : sync === 'err' ? 'Sync error' : ''}">${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(initials)}</span>`}<span class="who"><b>${esc(u.displayName || u.email)}</b><small>${sync === 'busy' ? 'syncing…' : sync === 'err' ? 'sync error' : 'synced to cloud'}</small></span><span class="sync ${sync === 'ok' ? '' : sync === 'busy' ? 'busy' : 'off'}"></span></a>`;
}
