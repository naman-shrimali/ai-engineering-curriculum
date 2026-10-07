# CHANGELOG

Repo-level change history. CalVer tags per CONVENTIONS §6.

## 2026-10-07 — interactive diagrams and explorables

- **Every diagram is now interactive.** `app/lib/diagrams.js` replaces the pan/zoom wrapper. Mermaid still draws each diagram from the chapter's source; the module then reads Mermaid's own parse of that source (nodes and shapes, edges and labels, state transitions, sequence messages, timeline tasks), maps it onto the rendered SVG and derives the interaction from it. Flows and state machines get *Explore* (hover or tap to trace upstream and downstream; pin a node to see its connections, linked chapters and the sentences in the page that discuss it) plus *Decide* for decision trees, *Step through* for flows, *Simulate* for state machines. Sequence diagrams play message by message and the continuous-batching timeline gets a playhead, both with autoplay and keyboard control. Decision diamonds, data stores and outcomes are tinted by role. Long left-to-right pipelines and very tall trees are re-laid out in the other direction when that makes them markedly more legible in a reading column; the toolbar restores the authored layout. Walk and play modes zoom to follow the current step on small screens.
- **Diagrams hub.** `#/diagrams` lists all 66 chapter diagrams, classified by kind from Mermaid's parse (12 decision trees, 6 state machines, 5 sequences, 1 timeline, 10 feedback loops, 32 flows), with filters, deep links and a live stage.
- **Five explorables**, each placed beside the section it illustrates: similarity metrics and normalization (fnd-03, including the chapter's exercise 2 vectors), a sampling lab (fnd-08; temperature then top-k / top-p / min-p, with the chapter's two exercise distributions as presets), IVF search on a toy corpus with live recall@k, the cell-boundary miss and an nprobe sweep (rag-02), a retrieval-metrics lab with graded labels and a rerank (rag-07), and LoRA's trainable-parameter footprint (ftn-02). Each implements only definitions its chapter states and shows them as quotes; `scripts/check-explorables.py`, now a CI step, fails if a quote stops appearing verbatim in its chapter. Illustrative data is labelled as such.
- **Accuracy checks run for this change:** all 67 diagrams map completely (every node, edge, edge label, message, participant, lifeline and task bound to its SVG element); all 617 labels the panels display were confirmed verbatim in their diagram sources; "in the text" excerpts were confirmed verbatim from the page; the explorables' outputs were hand-checked against the chapters' own exercises. No chapter text changed.
- Verified in-browser at 1440px and 390px, dark and light: every view renders with zero console errors and no horizontal overflow; keyboard selection, digit-key answers, Backspace, fullscreen and Escape, rotation with a walk in progress, sequence autoplay and theme switching all exercised.

## 2026-09-17 — live Firebase project wired in

- `app/config.js` now carries the web config for Firebase project `token0-67858`, so the deployed app runs in sign-in mode instead of local-only mode. The config values are public by design (they identify the project, not a credential); the access boundary remains `firestore.rules`.
- **Firebase SDK vendored.** `app/vendor/firebase.js` bundles `firebase/app`, `firebase/auth` and `firebase/firestore` into one module and `index.html` maps all three specifiers to it — they must share a bundle so `getAuth()` and `getFirestore()` see the same app registry. The site now has no third-party runtime dependency at all.
- **Sync error reporting fixed.** A project with no Firestore database answers `permission-denied`, which the old message misdiagnosed as "deploy firestore.rules"; that case now reports that Firestore is not enabled and that progress is still saved locally. Sync failures are also reported once per session rather than on every debounced write, and `unavailable` has its own message.
- Verified against the live project: the app enters sign-in mode, the vendored SDK loads, the sign-in dialog renders Google, GitHub and email, and an email/password probe with deliberately invalid credentials reached Google and returned `INVALID_LOGIN_CREDENTIALS`, confirming the key is valid and the password provider is enabled. All ten views render at 1440px and 390px with no console errors.
- **Known gap:** Cloud Firestore has not been created in `token0-67858` (`Cloud Firestore API has not been used in project token0-67858 before or it is disabled`), so sign-in works but nothing syncs yet. Progress continues to save in the browser until the database is created and `firestore.rules` is published.

## 2026-09-17 — interactive learning platform

- **The repo becomes an app.** `index.html` + `app/` replace the root redirect with an interactive learning platform, no build step: a dashboard (tracks, next-up from the prerequisite DAG, streaks, activity heatmap), a D3 curriculum map (by module or by prerequisite depth, hover-to-trace chains, completion unlocks dependents), a force-directed concept graph parsed from `tutor/knowledge-graph.md`, a chapter reader with reading progress, self-marking sections, pan/zoom/fullscreen Mermaid diagrams whose chapter-ID nodes are links, glossary hover cards and a heading-derived mind map, plus the derived sections turned into tools (self-graded quiz, attempt-then-reveal interview drill, flip flashcards, exercise checklist). A spaced-repetition trainer (SM-2) over all 576 flashcards, a practice view (self-test / interview / misconceptions / mixed drill), an interactive glossary, the reading list with a Read Later queue, and `⌘K` search.
- **Accuracy preserved by construction.** No chapter text was changed. `scripts/build-content.py` compiles `app/data/content.json` by parsing the Markdown (every string verbatim); chapters themselves are fetched and rendered live. `scripts/validate.py` implements the METADATA_SCHEMA validation rules; `.github/workflows/ci.yml` runs it and fails on a stale index. The validator's pre-existing findings (17 chapters using `volatility: high/medium/low` instead of the schema enum, ~20 cross-links to renamed chapter files, a handful of uppercase keywords and uncited `sources[]` keys in `eng-*`) are recorded as a warning baseline in `scripts/validate.py` for triage; the app resolves the renamed-file links by chapter ID so readers never hit a dead link.
- **Accounts and progress sync on Google Cloud.** `app/lib/auth.js` wires Firebase Authentication (Google, GitHub, email/password) and Cloud Firestore (one `users/{uid}` document, per-entry last-write-wins merge with local progress). Works in local-only mode until `app/config.js` carries a config; `docs/SETUP-GCP-AUTH.md` is the runbook, `firestore.rules` + `firebase.json` the deployable rules.
- **Self-contained runtime.** marked, mermaid, d3 and the Firebase SDK are bundled into `app/vendor/` (`scripts/vendor.sh`) with self-hosted OFL fonts (Bricolage Grotesque, Newsreader, JetBrains Mono), so the site has no third-party runtime dependency; the Firebase bundle is fetched only when `app/config.js` carries a config. `read.sh` now opens the app; the classic reader remains at `tutor/reader.html`.
- Verified in-browser at 1440px and 390px: every view renders with zero console errors and no horizontal overflow; section tracking, quiz grading, flashcard scheduling, completion/unlock, palette search and the map focus mode all exercised.

## 2026-07-10 — published to GitHub Pages

- Repo pushed to [https://github.com/naman-shrimali/ai-engineering-curriculum](https://github.com/naman-shrimali/ai-engineering-curriculum) (public) and Pages enabled on `main` / root; live at https://naman-shrimali.github.io/ai-engineering-curriculum/
- Verified on the deployed site: all assets 200, `.nojekyll` confirmed working (chapters serve as raw `text/markdown` with frontmatter intact rather than being converted by Jekyll), root redirect lands on the reader, 102 nav items, 42 correctly marked pending, Mermaid renders, 0 failed requests, 6 requests total on load.

## 2026-07-10 — reader made GitHub Pages deployable

- Added `.nojekyll` (critical — Jekyll would otherwise convert the frontmatter-carrying `.md` files to HTML and break every fetch), root `index.html` redirect, and `tutor/build-index.py` → `tutor/files.json` (one request replaces ~100 HEAD probes; load went from ~105 requests to 5).
- Mobile verified at 375px: no horizontal overflow, drawer nav, tables/diagrams scroll internally; topbar tightened and pager stacked on narrow screens.
- Verified against a simulated subpath deploy (`/repo-name/`): root redirect, 102 nav items, chapters and Mermaid render, 0 failed requests.
- Repo initialized and committed. Push + Pages enablement need GitHub credentials — see `DEPLOY.md`.

## 2026-07-10 — local reader UI

- Added `tutor/reader.html` (single self-contained file) + `read.sh` launcher: a zero-build local UI for reading the whole corpus without juggling `.md` files. Renders the existing Markdown live — **no content is duplicated or rewritten**; the reader is a view, the `.md` files remain the only source of truth.
- Driven by `manifest.yaml`, so the file list stays correct as chapters land. Probes each file's size over HTTP to mark written vs. pending (the <200-byte rule also correctly flags the `agt-01` stub, consistent with `tutor/rag/chunking.md`).
- Features: grouped sidebar with status dots, instant title filter + full-text search across all files, in-app resolution of `../module/id-*.md` cross-links, frontmatter rendered as badges, Mermaid diagrams, footnote linking, per-page TOC, build-order prev/next, dark/light, keyboard (`/`, `[`, `]`).
- Verified in-browser: renders README/fnd-05/eng-01, Mermaid → SVG, 42 chapters correctly marked pending, search returns fnd-05 top for "KV cache". Requires a local static server (CORS blocks `file://`) — `./read.sh` handles it.

## 2026-07-10 — repo review + tutor/RAG query layer (spec_version 3)

- **Review:** added `REVIEW.md` — a prioritized punch list from a Staff-engineer/educator/interview-coach pass. Headline: corpus is internally consistent (0 status drift, 0 broken links, napkin numbers agree across chapters). Key findings: **P0** `agt-01` is a 2-line phantom stub (not written — delete or generate); **P1** glossary cross-linking convention has 0% adoption; **P1** 134 forward-links to unwritten chapters (by design, but the tutor must handle). Plus a missing-topic recommendation (`evl-07` bias/fairness eval).
- **Structural change (spec_version 2 → 3):** added `tutor/` — the query layer that makes the corpus a queryable tool: `INDEX.md` (tut-01), `GLOSSARY.md` (tut-02, expanded superset of glossary.md), `ACRONYMS.md` (tut-03), `knowledge-graph.md` (tut-04, concept map), `rag/chunking.md` (tut-05, operationalizes METADATA_SCHEMA §Chunking), `rag/embedding-strategy.md` (tut-06, local-MPS-Chroma + hosted tiers), `prompts/` (5 reusable system prompts: tutor, quiz, interview-sim, architecture-reviewer, code-reviewer), and `tool/README.md` (FastAPI + Chroma + React/Vite scaffold for 8GB M1, no Docker). CONVENTIONS §1 amended; manifest `tutor_docs` section added. `prompts/` and `tool/` are supporting assets (no manifest IDs), mirroring `blueprints/`.

## 2026-07-10 — generation blueprints for the 42 unwritten chapters

- Added `blueprints/`: an AUTHORING_GUIDE.md (encoding the chapter-authoring standard — prime directives, invariant skeleton, calibration, voice, motifs, volatility/citation/diagram rules, validation script) plus seven per-module blueprint files covering every remaining chapter (rag-02…08, evl-02…06, agt-01…09, prd-01…06, sec-01…05, ftn-01…06, fro-01/02/03/05). Each chapter gets a thesis, section plan, must-land insights, exact sources with arXiv IDs, specified diagrams, and volatile fences. Purpose: enable any capable model to complete the curriculum at standard. Not curriculum content — a handoff/build artifact; excluded from the chapter count.

## 2026-07-10 — engineering repository complete (eng-06 … eng-12)

- Generated the remaining seven engineering docs: eng-06 (prompt library), eng-07 (eval checklists + debugging playbook), eng-08 (deployment & LLMOps guide), eng-09 (security guidelines), eng-10 (cost-optimization guide), eng-11 (benchmark comparison templates), eng-12 (interview-prep pack). All 12 engineering docs now exist; `engineering_docs` manifest section fully realized.

## 2026-07-10 — engineering repository added (spec_version 2)

- **Structural change:** added `engineering/` for practitioner reference docs (architectures, patterns, playbooks, templates). CONVENTIONS §1 amended; METADATA_SCHEMA id regex extended with the `eng-` prefix and `engineering` module value; manifest gains an `engineering_docs` section. spec_version 1 → 2.
- Generated this batch: eng-01 (RAG pipeline architecture), eng-02 (agent loop architecture), eng-03 (eval harness architecture), eng-04 (LLMOps stack), eng-05 (design patterns catalog). eng-06 through eng-12 are specified in the manifest and pending.
- Note: engineering docs cross-link chapter IDs whose files may not exist yet (Day 3–4 chapters); paths are manifest-fixed, so links resolve as chapters land.

## 2026-07-09 — Day 2 content batch complete (+ rag-01)

- All 18 Day-2 chapters written: fnd-01…fnd-09 (Module 1 complete), api-01…api-07 (Module 2 complete), evl-01, fro-04. Plus rag-01 from Day 3.
- glossary.md seeded and extended (20 terms).

## 2026-07-08 — repo created (spec_version 1)

- Design frozen: README, CONVENTIONS, METADATA_SCHEMA, manifest.yaml (61 chapters), curriculum/roadmap.md, curriculum/dependency-graph.md.
