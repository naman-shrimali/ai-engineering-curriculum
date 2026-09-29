# app/vendor

Self-hosted runtime dependencies, built by `scripts/vendor.sh` (pinned versions, bundled to single ES modules with esbuild, minified). Do not edit by hand.

| File | Package | Version | License |
|---|---|---|---|
| `marked.js` | marked | 12.0.2 | MIT |
| `mermaid.js` | mermaid | 10.9.1 | MIT |
| `d3.js` | d3 | 7.9.0 | ISC |
| `firebase.js` | firebase (app + auth + firestore, one bundle) | 10.12.2 | Apache-2.0 |
| `fonts/bricolage-grotesque-*.woff2` | Bricolage Grotesque (via @fontsource-variable) | 5.x | OFL 1.1 |
| `fonts/newsreader-*.woff2` | Newsreader (via @fontsource-variable) | 5.x | OFL 1.1 |
| `fonts/jetbrains-mono-*.woff2` | JetBrains Mono (via @fontsource-variable) | 5.x | OFL 1.1 |

`firebase.js` bundles `firebase/app`, `firebase/auth` and `firebase/firestore` into a single module, and `index.html` maps all three bare specifiers to it. They must stay in one bundle: separate bundles would each embed their own copy of `firebase-app`, so `getAuth()` and `getFirestore()` would consult different app registries and fail at runtime. The bundle is only fetched when `app/config.js` carries a config — in local-only mode the app never imports it.

With Firebase vendored, the site has no third-party runtime dependency at all. Sign-in still talks to Google's own API endpoints (`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firestore.googleapis.com`) at runtime, as any Firebase client must.
