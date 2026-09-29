/* Firebase web-app config for this deployment.

   These values are public by design: they identify which Firebase project the
   browser should talk to, not a credential. Anyone can read them from the
   shipped JavaScript, and that is expected — the access boundary is
   firestore.rules, which checks request.auth.uid server-side. See
   docs/SETUP-GCP-AUTH.md.

   Set this back to `null` to run the app in local-only mode, where progress
   stays in the browser's localStorage and no account is involved. */
export const firebaseConfig = {
  apiKey: "AIzaSyAaDQ16SKEM81r3FZ4MLNpxIp5FCUkTGmI",
  authDomain: "token0-67858.firebaseapp.com",
  projectId: "token0-67858",
  storageBucket: "token0-67858.firebasestorage.app",
  messagingSenderId: "303229841487",
  appId: "1:303229841487:web:d13c5707d891160d87fa3a",
};
