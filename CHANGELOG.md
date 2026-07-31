# CHANGELOG

Repo-level change history. CalVer tags per CONVENTIONS §6.

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
