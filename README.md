# AI Engineering: A Production-Grade Curriculum

**Read it online → [https://naman-shrimali.github.io/ai-engineering-curriculum/](https://naman-shrimali.github.io/ai-engineering-curriculum/)**

An open-source knowledge repository for software engineers moving into AI engineering. It is built to rival a top university course in rigor, and to exceed one in practicality: every chapter is written for someone who will ship LLM systems to production, not pass an exam.

## Who this is for

An experienced software engineer — strong full-stack skills, moderate ML background — targeting AI engineering roles at leading startups and big tech. We assume you can read Python fluently, reason about distributed systems, and have seen `model.fit()` before. We do not assume you can derive backpropagation, and you will never need to here beyond intuition.

If you are a researcher, this repo is not for you. The center of gravity is the **application layer**: APIs, retrieval, agents, evals, and production systems — with just enough model internals (transformers, training, inference mechanics) to make good engineering decisions.

## How the repo is organized

```
README.md               ← you are here
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
tutor/                  ← query layer: index, glossary, knowledge graph, RAG config, prompts, local tool
glossary.md             ← single shared glossary (see CONVENTIONS.md)
CHANGELOG.md            ← repo-level change history
REVIEW.md               ← current prioritized punch list of fixes
```

`modules/` teaches; `engineering/` specifies. Chapters build understanding from intuition to production perspective; engineering docs are the reference artifacts (system architectures, pattern catalogs, checklists, templates) a working engineer copies from — each cross-linked to the chapters that explain its mechanisms.

Every content file is one **chapter** with a stable ID (e.g. `rag-05`), YAML frontmatter per [METADATA_SCHEMA.md](METADATA_SCHEMA.md), and self-contained sections designed for both human reading and RAG ingestion.

## Reading it without juggling files

```bash
./read.sh
```

Opens a local reader UI (`tutor/reader.html`) with a grouped sidebar, full-text search across every file, working cross-links, rendered Mermaid diagrams, and a per-page table of contents. It renders the same `.md` files you see in the repo — nothing is duplicated, so the Markdown stays the single source of truth. Needs a local server (browsers block `file://` fetches); `read.sh` starts one on `:8123` and opens the page.

The same reader is published at [https://naman-shrimali.github.io/ai-engineering-curriculum/](https://naman-shrimali.github.io/ai-engineering-curriculum/); see [DEPLOY.md](DEPLOY.md) to redeploy.

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
