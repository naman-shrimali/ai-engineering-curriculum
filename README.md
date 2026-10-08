# AI Engineering: A Production-Grade Curriculum

**Read it online → [https://naman-shrimali.github.io/ai-engineering-curriculum/](https://naman-shrimali.github.io/ai-engineering-curriculum/)**

An open-source knowledge repository for software engineers moving into AI engineering. It is built to rival a top university course in rigor, and to exceed one in practicality: every chapter is written for someone who will ship LLM systems to production, not pass an exam.

## Who this is for

An experienced software engineer — strong full-stack skills, moderate ML background — targeting AI engineering roles at leading startups and big tech. We assume you can read Python fluently, reason about distributed systems, and have seen `model.fit()` before. We do not assume you can derive backpropagation, and you will never need to here beyond intuition.

If you are a researcher, this repo is not for you. The center of gravity is the **application layer**: APIs, retrieval, agents, evals, and production systems — with just enough model internals (transformers, training, inference mechanics) to make good engineering decisions.

## How the repo is organized

```
README.md               ← you are here
index.html, app/        ← the interactive learning app (renders the Markdown live; no build step)
labs/                   ← coding labs: one folder per lab (brief, starter, solution, tests) + harness.py
scripts/                ← build-content.py (content index), validate.py (schema checks), check-explorables.py, build-labs.py, vendor.sh
docs/                   ← SETUP-GCP-AUTH.md: enabling sign-in + progress sync on Google Cloud
CONVENTIONS.md          ← authoring rules: structure, naming, citations, versioning
METADATA_SCHEMA.md      ← YAML frontmatter spec (designed for RAG ingestion)
manifest.yaml           ← machine-readable build spec: every chapter, in build order
curriculum/
  roadmap.md            ← the full learning path, module by module
  dependency-graph.md   ← Mermaid graph of chapter prerequisites
modules/
  01-foundations/       ← how models actually work (evergreen)
  02-llm-apis/          ← working with models via APIs
  03-retrieval/         ← context engineering & RAG
  04-agents/            ← tool use, MCP, multi-agent systems
  05-evaluation/        ← evals, LLM-as-judge, observability
  06-production/        ← serving, optimization, reliability, cost
  07-safety-security/   ← prompt injection, guardrails, compliance
  08-fine-tuning/       ← when and how to customize models
  09-frontier/          ← voice, media, edge, career
engineering/            ← practitioner reference: architectures, patterns, playbooks (eng-*)
blueprints/             ← generation specs for unwritten chapters (build artifact, not content)
tutor/                  ← query layer: index, glossary, knowledge graph, RAG config, prompts, classic reader
glossary.md             ← single shared glossary (see CONVENTIONS.md)
CHANGELOG.md            ← repo-level change history
REVIEW.md               ← current prioritized punch list of fixes
```

`modules/` teaches; `engineering/` specifies. Chapters build understanding from intuition to production perspective; engineering docs are the reference artifacts (system architectures, pattern catalogs, checklists, templates) a working engineer copies from — each cross-linked to the chapters that explain its mechanisms.

Every content file is one **chapter** with a stable ID (e.g. `rag-05`), YAML frontmatter per [METADATA_SCHEMA.md](METADATA_SCHEMA.md), and self-contained sections designed for both human reading and RAG ingestion.

## The interactive app

The repository *is* the app. `index.html` at the root (served by GitHub Pages) is an interactive learning platform that renders these same Markdown files live — nothing is duplicated or paraphrased, so the `.md` files stay the single source of truth and every chapter, diagram, flashcard and question you see on the site is a verbatim slice of a file in this repo.

What it adds on top of reading:

- **Curriculum map** — every chapter as a node, prerequisites as edges, laid out by module or by prerequisite depth. Hover to trace a chain, click for detail; completed chapters unlock what depends on them.
- **Concept graph** — the force-directed knowledge graph from [tutor/knowledge-graph.md](tutor/knowledge-graph.md): which idea underwrites which.
- **Chapter reader** — reading-progress bar, sections that mark themselves read, interactive diagrams (below), glossary hover cards, a mind map built from the chapter's own headings, and the derived sections turned into tools: *Check your understanding* becomes a self-graded quiz, *Interview questions* an attempt-then-reveal drill, *Flashcards* flip cards, *Exercises* a checklist.
- **Interactive diagrams** — every Mermaid diagram becomes something you operate, not just look at. Hover or tap a node to trace what feeds it and what it feeds, and pin it to see its connections and the sentences in the chapter that discuss it. *Decide* walks a decision tree question by question to its outcome; *Step through* follows a flow branch by branch; *Simulate* runs a state machine transition by transition; sequence diagrams *play* message by message; the continuous-batching timeline gets a playhead. Long pipelines are re-laid out to fit a reading column (one click restores the authored layout). The **Diagrams** hub (`#/diagrams`) lists all 66 by kind.
- **Explorables** — five small simulations placed beside the text they illustrate: vector similarity and normalization (fnd-03), a temperature/top-k/top-p/min-p sampling lab (fnd-08), IVF search with live recall@k and the cell-boundary miss (rag-02), a retrieval-metrics lab with reranking (rag-07), and LoRA's trainable-parameter footprint (ftn-02).
- **Coding labs** — ten hands-on labs (`#/labs`) where you implement what the chapters teach, in Python, in the browser: similarity metrics, temperature, top-k/top-p/min-p, IVF search with recall@k, retrieval metrics, tool-call validation and authorization, the minimal agent loop, a circuit breaker with a fallback chain, a routing cascade, and LoRA. A real code editor, 89 tests graded instantly by CPython compiled to WebAssembly (Pyodide) in a background worker, a time limit that stops runaway loops, your code saved and synced with your progress, and a card in each chapter's section linking to its lab.
- **Mastery** — a skill map of the curriculum built from your own evidence (`#/mastery`): self-test and interview grades, estimated flashcard recall and lab results become a per-chapter mastery score and an evidence level, reading counts as exposure but never as mastery, and a ranked list of next moves says exactly what would help (review these due cards, retry these questions, finish this lab). The same levels can colour the curriculum map and the concept graph, chapters warn when a prerequisite looks shaky in your practice, and the dashboard shows your top three moves. The model (`app/lib/mastery.js`) is pure, unit-tested (`node --test tests/*.test.mjs`, also in CI) and explained on the page with its actual constants.
- **Spaced repetition** — all 576 chapter flashcards in one SM-2 scheduler, filterable by module or chapter.
- **Practice** — self-tests, interview drills and misconception checks per chapter, or a mixed drill across everything you have started.
- **Dashboard** — track choice (fast / full / systems / product), what to read next computed from the prerequisite DAG, streaks and an activity heatmap.
- **Accounts and sync** — optional sign-in (Google, GitHub, email) backed by Firebase Authentication and Cloud Firestore on Google Cloud, so progress follows you across devices. Without it the app runs in local-only mode with progress in the browser; see [docs/SETUP-GCP-AUTH.md](docs/SETUP-GCP-AUTH.md) to enable it on your own deployment.
- **Search** — `⌘K` over chapters, sections and glossary terms. Reading list with a personal Read Later queue.

Run it locally:

```bash
./read.sh          # serves the repo root on :8123 and opens the app
```

Browsers block `file://` fetches, so it needs the local server. The classic single-file reader is still available at `tutor/reader.html`.

### How it stays accurate

`scripts/build-content.py` compiles `app/data/content.json` — the *structure* of the corpus (frontmatter, section outline, flashcards, questions, diagram sources, glossary, concept graph, tracks) — by parsing the Markdown; every string in it is copied, never rewritten. CI (`.github/workflows/ci.yml`) fails if that index is stale or if any chapter violates [METADATA_SCHEMA.md](METADATA_SCHEMA.md) (`scripts/validate.py`).

Diagrams are still drawn by Mermaid from each chapter's own source; `app/lib/diagrams.js` asks Mermaid's parser for its model of that same source and builds every interaction from it, so node labels, branch answers, transitions, messages and tasks are verbatim, structure is computed, and "in the text" excerpts are quoted sentences from the page. Each coding lab (`labs/NN-name/`: brief, starter, reference solution, tests) is graded against its chapter's own definitions and worked exercises, and quotes the definitions it implements. `scripts/build-labs.py` compiles them into `app/data/labs.json` and, in CI, runs every reference solution through the same harness the browser uses (`labs/harness.py`), requires every starter to fail, and requires every quote to appear verbatim in its chapter. Explorables (`app/lib/explorables.js`) implement only definitions their chapter states and quote them; `scripts/check-explorables.py` (also in CI) fails if a quoted definition no longer appears verbatim in its chapter, so an edited chapter forces the simulation to be revisited. After editing content:

```bash
python3 scripts/build-content.py   # refresh the index (read.sh does this too)
python3 scripts/validate.py        # frontmatter, prerequisite DAG, footnotes, links
python3 scripts/check-explorables.py  # explorables still quote their chapters verbatim
python3 scripts/build-labs.py      # rebuild app/data/labs.json after editing a lab (CI runs --check)
node --test tests/*.test.mjs       # unit tests for the mastery model
```

### Reading queue

Two places to park things you want to read:

- **[reading-list.md](reading-list.md)** — curated primary sources (mostly papers), grouped by the chapter each one reinforces. Version-controlled, so it's shared and reviewable. In the app, every link has a **+** to push it into your queue.
- **Read Later** — your personal queue on the Reading list page. Paste any URL, mark things read, filter. It lives in your browser (and in your cloud profile when signed in); export/import from the profile page.

## How to navigate

1. **Start at [curriculum/roadmap.md](curriculum/roadmap.md).** It lists every chapter with objectives, prerequisites, hours, and difficulty.
2. **Check the [dependency graph](curriculum/dependency-graph.md)** to plan a path. Prerequisites are a DAG, not a straight line — modules 3–5 (retrieval, agents, evals) can be interleaved once you finish modules 1–2.
3. **Already know something? Skip it.** Each chapter opens with its objective and prerequisites; if you can state the objective's answer confidently, move on.
4. **Tooling programs, not tooling faith.** Chapters tagged `volatile` describe today's tools; chapters tagged `evergreen` describe concepts that will outlive them. Learn the evergreen material deeply and treat volatile chapters as maps to re-check.

Suggested tracks:

- **Fast track to productive (~40h):** fnd-01 → api-01…03 → rag-01…05 → agt-01, agt-02 → evl-01…03.
- **Full course (~200h):** everything in roadmap order.
- **Systems specialization:** modules 1, 2, 6, plus ftn-02/ftn-06.
- **Product/agents specialization:** modules 2, 3, 4, 5, 7.

## Status legend

Every chapter carries a `status` in its frontmatter and in `manifest.yaml`:

| Status | Meaning | Trust level |
|---|---|---|
| **stable** | Reviewed, mature, concepts unlikely to change | Cite it, build on it |
| **evolving** | Accurate as of `last_reviewed`, but the field is moving; expect revisions | Verify volatile specifics (model names, prices, API params) against official docs |
| **experimental** | Frontier territory; describes emerging practice that may not consolidate | Treat as informed opinion, not settled knowledge |

Status is orthogonal to `volatility` (evergreen / mixed / volatile), which describes the *subject matter*; status describes the *document's* maturity. A stable chapter about a volatile topic is possible (e.g. a mature survey of vector databases) — its volatility tag tells maintainers to re-review it more often. See [CONVENTIONS.md](CONVENTIONS.md) for review cadences.

## Contributing & maintenance

All authoring rules live in [CONVENTIONS.md](CONVENTIONS.md); the frontmatter contract lives in [METADATA_SCHEMA.md](METADATA_SCHEMA.md). The build pipeline consumes [manifest.yaml](manifest.yaml) — a chapter does not exist until it is listed there. When a major model or tooling release lands, follow the model-release playbook in CONVENTIONS.md to find and refresh affected content.
