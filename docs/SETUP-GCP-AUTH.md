# Setting up sign-in and cloud progress storage

> This is optional. The app works fully without it — see "Local-only mode" below. This guide is for turning on account sign-in and cross-device progress sync, backed by Firebase Authentication and Cloud Firestore (both part of Google Cloud).

Live site: [https://naman-shrimali.github.io/ai-engineering-curriculum/](https://naman-shrimali.github.io/ai-engineering-curriculum/)
Local dev: `http://localhost:8123`

Both need to be registered as authorized domains (step 4 below) for sign-in to work.

## What you're setting up, in one paragraph

The Firebase SDK itself is vendored into `app/vendor/firebase.js` (built by `scripts/vendor.sh`), so no third-party CDN is involved; the browser still talks to Google's own API endpoints at runtime, as any Firebase client must.

The site is static — it's served from GitHub Pages with no backend server. To let people sign in and keep their progress across devices, we use two free Google Cloud services directly from the browser: **Firebase Authentication** handles sign-in (Google, GitHub, email/password), and **Cloud Firestore** stores each signed-in user's progress as one document. There is no server code anywhere — the browser talks to Firebase/Firestore directly, and Firestore's security rules (in `firestore.rules`) are what stop one user from reading or writing another user's data.

## Status of this deployment

The live site is wired to Firebase project `token0-67858`. What is done and what is not:

| Step | State |
|---|---|
| Project created, web app registered, config in `app/config.js` | done |
| Authorized domains (`localhost`, `naman-shrimali.github.io`) | done |
| Email/password provider | enabled (verified against the live API) |
| Google / GitHub providers | enable and verify in the console |
| **Cloud Firestore database** | **not created — sign-in works, but nothing syncs yet** |
| `firestore.rules` published | blocked on the database existing |

Until Firestore is created (step 4 below), signed-in users still accumulate progress in their own browser; it simply does not follow them across devices. The app says so rather than failing silently.

> **Warning:** `token0-67858` appears to be an existing project used by another app — it carries a Realtime Database URL and `token0-67858.web.app` hosting domains. Publishing `firestore.rules` **replaces that project's current Firestore rules**, and signed-in users share one user pool across every app in the project. Confirm nothing else depends on those rules before publishing, or create a dedicated project for this site.

## Local-only mode (no setup required)

Before you do any of this: if `app/config.js` exports `firebaseConfig = null` (the default), the app runs in local-only mode automatically. Progress is saved in the browser's `localStorage`, works offline, and never leaves the device. This is a legitimate way to use the app forever — the setup below only adds sign-in and cross-device sync on top of it.

When someone signs in for the first time, the app merges whatever local progress exists in that browser into their new cloud profile, so nothing already tracked locally is lost.

## Step 1 — Create the Firebase project

A Firebase project **is** a GCP project — Firebase is Google Cloud's product surface for app developers, and every Firebase project shows up in the regular Google Cloud Console too. You don't need to touch the GCP Console at all for this setup; the Firebase Console does everything you need.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with the Google account that should own this project.
2. Click **Add project**.
3. Name it something recognizable, e.g. `ai-engineering-curriculum`. Firebase will suggest a project ID — you can accept the default or edit it; note it down, you won't need it directly but it's useful for support/debugging.
4. You'll be asked about Google Analytics. It's not needed for auth or Firestore — turn it off unless you want it for other reasons.
5. Click **Create project** and wait for it to finish provisioning (10-30 seconds).

You now have a GCP project. Everything below happens inside it.

## Step 2 — Enable Authentication providers

1. In the Firebase Console, open your project, then go to **Build → Authentication** in the left sidebar.
2. Click **Get started**.
3. You'll see a list of sign-in providers. Enable these three:

### Google

1. Click **Google** in the provider list.
2. Toggle **Enable**.
3. Pick a project support email (your own email is fine).
4. Click **Save**. No extra setup needed — Firebase manages the OAuth client for you.

### Email/Password

1. Click **Email/Password** in the provider list.
2. Toggle **Enable** on the first option (Email/Password). Leave "Email link (passwordless sign-in)" off unless you want it.
3. Click **Save**.

### GitHub

GitHub isn't a Google product, so this one needs a GitHub OAuth App first.

1. Still in the Firebase Console, click **GitHub** in the provider list and toggle **Enable**. Firebase will show you a **callback URL**, something like:

   ```
   https://<your-project-id>.firebaseapp.com/__/auth/handler
   ```

   Copy this — you'll paste it into GitHub in the next step. Leave this Firebase tab open.

2. In a new tab, go to GitHub → your account **Settings → Developer settings → OAuth Apps → New OAuth App** (or go directly to [github.com/settings/applications/new](https://github.com/settings/applications/new)).

3. Fill in the form:
   - **Application name**: anything, e.g. "AI Engineering Curriculum"
   - **Homepage URL**: `https://naman-shrimali.github.io/ai-engineering-curriculum/`
   - **Authorization callback URL**: paste the callback URL Firebase gave you in step 1.

4. Click **Register application**.

5. On the resulting app page, copy the **Client ID**. Click **Generate a new client secret** and copy that too — GitHub only shows the secret once.

6. Back in the Firebase Console's GitHub provider dialog, paste the **Client ID** and **Client Secret** into the matching fields, then click **Save**.

## Step 3 — Add authorized domains

Firebase Authentication only allows sign-in flows to complete on domains you've explicitly allowed. This is separate from the GitHub OAuth app's callback URL above.

1. In the Firebase Console, go to **Authentication → Settings → Authorized domains**.
2. `localhost` is usually there by default — if not, add it.
3. Click **Add domain** and add:

   ```
   naman-shrimali.github.io
   ```

   Do not include `https://` or the `/ai-engineering-curriculum/` path — just the bare domain.

Without this step, sign-in will fail on the live site with an `auth/unauthorized-domain` error (see Troubleshooting).

## Step 4 — Create the Firestore database

1. In the Firebase Console, go to **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Native mode** (not Datastore mode — Native mode is what the security rules and client SDKs here assume).
4. Pick a region close to your expected users. This can't be changed later without recreating the database, but it doesn't otherwise matter much for this app — a single-digit-milliseconds difference per request. `us-central` or a multi-region option close to you is fine.
5. Under starting rules mode, choose **Start in production mode** (deny-all by default). We're about to deploy explicit rules anyway, so this just avoids a window where the database is wide open.
6. Click **Create**.

## Step 5 — Register a web app and get the config object

1. In the Firebase Console, click the gear icon next to **Project Overview → Project settings**.
2. Scroll to **Your apps** and click the **</>** (web) icon to add a web app.
3. Give it a nickname, e.g. "curriculum-web". You don't need Firebase Hosting — leave that box unchecked, since the site is served from GitHub Pages.
4. Click **Register app**. Firebase will show you a config object that looks like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890"
   };
   ```

5. Copy this object. You can always find it again later under **Project settings → Your apps**.

### Paste it into `app/config.js`

Open `app/config.js` in the repo. By default it contains:

```js
export const firebaseConfig = null;
```

Replace `null` with the object Firebase gave you:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

That's it — the app detects a non-null config on load and switches from local-only mode to sign-in mode automatically.

**This is safe to commit.** Unlike a typical API key, the Firebase web config is meant to be public — it identifies which Firebase project a client should talk to, not a secret credential. Firebase's own docs are explicit about this. The actual security boundary is the Firestore rules in the next step, not the config object.

## Step 6 — Deploy the Firestore security rules

The rules live in `firestore.rules` at the repo root. They restrict every document under `users/{uid}` to being read and written only by the signed-in user whose UID matches `{uid}`, and reject everything else. Read `firestore.rules` itself for the exact logic and comments.

You have two ways to deploy them — pick whichever is less friction for you.

### Option A — paste into the console (no tooling)

1. In the Firebase Console, go to **Build → Firestore Database → Rules** tab.
2. Select all the existing text and delete it.
3. Open `firestore.rules` from this repo, copy its entire contents, and paste it into the console editor.
4. Click **Publish**.

### Option B — Firebase CLI (`firebase.json` is already set up for this)

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

`firebase login` opens a browser to authenticate with the same Google account you used to create the project. The CLI reads `firebase.json` (already in the repo root, pointing at `firestore.rules`) and needs to know which project to target — the first time, run `firebase use --add` and pick your project, or pass it inline:

```bash
firebase deploy --only firestore:rules --project your-project-id
```

Either option produces the same result. Re-run whichever one you used any time `firestore.rules` changes.

## The data model

Each signed-in user gets exactly one Firestore document, at:

```
users/{uid}
```

where `{uid}` is the Firebase Auth user ID (stable across sign-in providers if the same email is used, in most configurations). The document has these top-level fields:

| Field | Type | Contents |
|---|---|---|
| `v` | number | schema version of the document (currently 1) |
| `profile` | map | `displayName`, `email`, `photoURL` — pulled from the sign-in provider on first login |
| `progress` | map | chapter ID → `{ status, startedAt, completedAt, lastAt, sections, checks, exercises, interview }` — per-chapter reading state, section reads and self-grades |
| `cards` | map | flashcard ID (`chapterId:index`) → spaced-repetition state (`ease`, `interval`, `due`, `reps`, `lapses`, `last`) |
| `readlater` | array | personal reading queue: `{ id, url, title, note, added, read, readAt }` |
| `track` | string | the learning track the user selected, if any |
| `settings` | map | UI preferences (prose typeface, etc.) |
| `activity` | map | `YYYY-MM-DD` → count of learning actions that day (drives streaks and the activity heatmap) |
| `lastOpened` | map | `{ id, at }` — the chapter to resume from |
| `updatedAt` | timestamp | last write time, for conflict/staleness checks |

`firestore.rules` enforces that a write can only ever contain these keys (via `hasOnly`), as a guard against a bug or a compromised client writing something unexpected into a user's document.

When someone signs in, the app reads their `users/{uid}` document (creating it if it doesn't exist yet) and merges in whatever progress is currently sitting in that browser's `localStorage`, so switching from local-only to signed-in mode never loses work.

## Cost

The **Spark plan** (Firebase's free tier) is enough for this app and does not require a credit card:

- Firestore: 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, 1 GiB stored, all free.
- Authentication: unlimited sign-ins on the Google, GitHub, and Email/Password providers used here — these are always free regardless of plan.

Each session of using the app touches at most a handful of documents — essentially one read (load progress on sign-in) and occasional writes (saving progress as chapters/cards/quizzes update) against a single `users/{uid}` document. You would need a very large number of daily active users before this becomes something to think about, and Firestore does not auto-charge past the free tier unless you explicitly upgrade to the Blaze (pay-as-you-go) plan.

## Security

- There is no server. The browser talks directly to Firebase Authentication and Firestore using the public config in `app/config.js`.
- The entire access-control boundary is `firestore.rules`: a signed-in user can read and write only their own `users/{uid}` document, identified by their Firebase Auth UID. Every other path is denied.
- The config values in `app/config.js` are not secrets — they identify the project, not a credential. Nobody can read or write data using them alone; they'd still need to pass Firestore's rules, which check `request.auth.uid`, a value Firebase itself verifies server-side and that a client cannot forge.
- Rules only take effect once deployed (Step 6). Until then, whatever rules are already live in the console apply — production-mode rules deny everything by default, which is why sign-in works but reads/writes fail with `permission-denied` until you deploy `firestore.rules`.

## Troubleshooting

**`auth/unauthorized-domain`**
The domain you're testing from isn't in Authentication → Settings → Authorized domains. Add it (Step 3) — remember `localhost` for local dev and `naman-shrimali.github.io` for the live site, with no scheme or path.

**Sign-in popup gets blocked, or nothing happens on click**
Some browsers and browser settings block popups from static sites. The app detects this and falls back to a full-page redirect flow automatically — if you see the page navigate away and come back instead of a popup, that's expected and sign-in still completes.

**`permission-denied` on reads or writes**
The Firestore rules haven't been deployed yet, or an older version is live. Re-run Step 6. You can double check what's live in the Firebase Console under Firestore Database → Rules — the editor there shows the currently published version.

**Safari / iOS: signed out unexpectedly, or sign-in doesn't stick**
Safari's Intelligent Tracking Prevention (ITP) aggressively limits storage for third-party or cross-site contexts, which can affect Firebase Auth's persistence in some embedding scenarios. For a top-level site like this one (not embedded in an iframe), this is rarely an issue, but if you see repeated sign-outs on Safari, check that cross-site tracking prevention isn't unusually aggressive in that browser's settings, and that the site isn't being loaded inside an iframe anywhere.

**Nothing happens, but no error either**
Confirm `app/config.js` doesn't still export `firebaseConfig = null`. Open the browser devtools console for any Firebase initialization errors — a copy-paste mistake in the config object is the most common cause.
