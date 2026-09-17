# app/vendor

Self-hosted runtime dependencies, built by `scripts/vendor.sh` (pinned versions, bundled to single ES modules with esbuild, minified). Do not edit by hand.

| File | Package | Version | License |
|---|---|---|---|
| `marked.js` | marked | 12.0.2 | MIT |
| `mermaid.js` | mermaid | 10.9.1 | MIT |
| `d3.js` | d3 | 7.9.0 | ISC |
| `fonts/bricolage-grotesque-*.woff2` | Bricolage Grotesque (via @fontsource-variable) | 5.x | OFL 1.1 |
| `fonts/newsreader-*.woff2` | Newsreader (via @fontsource-variable) | 5.x | OFL 1.1 |
| `fonts/jetbrains-mono-*.woff2` | JetBrains Mono (via @fontsource-variable) | 5.x | OFL 1.1 |

Firebase (Authentication + Firestore) is the one runtime dependency that is not vendored: the official builds load from `www.gstatic.com` through the import map in `index.html`, and only when `app/config.js` carries a config.
