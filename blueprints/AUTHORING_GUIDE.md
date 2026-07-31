# AUTHORING GUIDE — how to generate the remaining chapters

This guide encodes the authoring standard of the 19 existing chapters so that any capable model can generate the remaining 42 at the same quality. It is the *mindset* document; the per-chapter content plans live in the `dayN-*.md` blueprint files beside it. **Read this fully before generating anything; follow the blueprint file for the chapter you're writing; run the validation script after every chapter.**

## The prime directives

1. **Mechanism first, always.** Every claim carries its *why*, traced to a foundations-chapter mechanism. Never write "output tokens cost more" — write "output tokens cost more because decode is memory-bandwidth-bound (fnd-05)." If you can't name the mechanism, either find it in the existing chapters or don't make the claim.
2. **The eval decides.** Every quality claim, tool choice, threshold, and parameter in this repo terminates in "measured on your eval, n-run, against a baseline" — never in vibes, leaderboards, or authority. This is the repo's epistemics; violating it is the biggest possible style break.
3. **Teach the reader to outlive the content.** Volatile facts are fenced (see §Volatility); durable *procedures* for re-deriving them (bake-offs, probes, arithmetic) are the real payload. When in doubt, teach the decision procedure, not the current answer.
4. **Anti-folklore stance.** Where the industry has popular beliefs that don't replicate (magic prompt words, "temperature 0 = deterministic", "bigger context kills RAG"), name them in Misconceptions and rebut with mechanism. The existing chapters maintain a running war on cargo cult; continue it.
5. **The repo is one system.** Chapters cross-reference obsessively: backward links to mechanisms, forward links to consequences (manifest paths are fixed, so forward links to unwritten chapters are legal). Reuse the running motifs (§Motifs) rather than inventing parallel vocabulary. Mini-projects extend the *same* artifacts (gateway → assembler → harness → capstone).

## The invariant chapter skeleton

Every chapter has exactly these parts, in order. H2s in sentence case, no numbering. The lede (before the first H2) is 150–250 words stating what the chapter covers, why it matters to an AI engineer, and its volatility posture.

1. `## Intuition: <specific framing>` — ONE governing mental model/metaphor, developed properly (working memory not filing cabinet; casting the actor; model proposes sampler disposes). The rest of the chapter should keep paying into this metaphor.
2. **2–5 content sections** — per the chapter's blueprint. First-principles derivation before mechanics; mechanics before practice. Include `## The math that earns its place` ONLY if the blueprint lists formulas (test: does the formula explain a behavior the engineer will observe? If not, cut it and say so).
3. `## Production engineering perspective` — mandatory. What this means for systems: costs, latencies, failure surfaces, security posture, and which eng-* doc it feeds.
4. `## Historical evolution` — brief: 4–6 dated turns, each one sentence of what changed and why it mattered; end with the through-line lesson.
5. `## Common misconceptions` — 4–6 bold-claim bullets, each rebutted *with mechanism*, not assertion.
6. `## Failure modes and trade-offs` — 4–6 items: symptom → mechanism → fix/mitigation → the trade-off the fix costs. Failure maps in tables are good when items are enumerable.
7. `## Best practices` — imperative bullets, each traceable to a mechanism or an earlier chapter's doctrine; include one security-posture item and one scaling-posture item where applicable.
8. `## Real-world examples` — 2–3 incident-shaped narratives (bold one-line title, then the story): concrete numbers, a diagnosis using the chapter's concepts, a fix, and the lesson. Model them on "The 68% bill cut that was a reorder" (api-05) — the incident *is* the thesis.
9. `## Interview questions` — count per calibration table; format: **"Question?"** — Model answer: 3–6 sentences written as a strong candidate speaks — mechanism-grounded, trade-off-aware, ending with the operational takeaway.
10. `## Exercises and mini-project` — 4–5 exercises (computable/checkable, escalating); one mini-project with parts (a)–(e), a target-hours line, a **success criterion** phrased as evidence ("you have personally produced and measured X"); a **capstone extension** sentence linking the artifact into the capstone thread.
11. `## Revision summary` — 4–6 dense bullets compressing the whole chapter.
12. `## Flashcards` — 8–11 Q/A table rows.
13. `## Further reading` — the five fixed categories: **Official docs / Papers / Books / Talks / Tutorials**, with honest "none" entries where nothing is worth listing (say why: "the format is too slow for this layer").
14. `## Check your understanding` — 3–5 questions; make one of them a meta-question (which claims here are volatile? / trace this chapter's mechanisms to their foundations chapters).
15. `## Sources` — the footnote list (see §Citations).

Engineering docs (eng-*) differ: no skeleton items 4–14; they end with `## Related chapters` (table) + `## Sources`. All twelve already exist — you will only write chapters.

## Calibration: size follows est_minutes

| est_minutes | Words | Content sections | Interview Qs | Flashcards |
|---|---|---|---|---|
| 120 | 3,800–4,500 | 2–3 | 4–6 | 8–9 |
| 180 | 4,300–5,000 | 3–4 | 5–6 | 9–10 |
| 240 | 5,000–6,200 | 4–5 | 6–7 | 10–11 |
| 300+ | 6,200–7,000 | 5–6 | 7–8 | 10–11 |

Depth allocation: spend words on mechanisms and incidents, not on padding lists. Volatile chapters run *leaner* than evergreen ones at equal minutes (don't over-invest in perishable detail — say so explicitly in the lede).

## Voice

Direct, confident, occasionally wry; second person for the reader's actions; no hedging filler ("it could be argued"); no marketing adjectives. Sentences carry information density — the model for tone is fnd-09 and api-05. Bold sparingly for load-bearing phrases. Analogies must be *developed* (the database-engine analogy in fnd-01), never drive-by. One paragraph per line (no hard wraps). Humor budget: ~2 dry asides per chapter, never in security or failure content.

## Motifs — reuse, don't reinvent

These phrases/concepts are established vocabulary; use them exactly: **the eval decides** · **jagged frontier** (+ inlets/shallows, capability map) · **the spec is the dataset** · **stable→volatile ordering** (one ordering, three payoffs) · **judging is easier than producing** · **convert recall to transformation** · **verify where cheap** · **correctness-free levers first** · **survival contract** (compaction) · **the model plans, your runtime acts** · **weather, not bugs** (provider failures) · **behavior deploy** (prompt/config changes) · **napkin math** (KV cache ≈ 2·L·n_kv·d_head·2B/token; training ≈16 B/param vs inference ≈2 B/param; ~1.3 tokens/word English) · **demo-quality trap** · **eval theater** · **fluent misreading** · **context rot** · **flip-count arithmetic**.

## Volatility discipline

- Frontmatter `volatility` + `status` come from the manifest; `last_reviewed` = generation date.
- Model names, prices, context sizes, tool/product leaders: ONLY in volatile chapters or inside `> **Volatile:**` callouts. Historical model names (GPT-2/3, BERT, AlexNet, LLaMA-as-event, DeepSeek-R1-as-event) are evergreen historical facts and legal anywhere.
- Every volatile chapter's lede acknowledges its perishability and points to the stable layer it teaches. Each `Volatile:` callout says what churns AND what the durable knowledge is.
- Product/tool landscapes: describe *categories with exemplars*, never rankings; selection always routes through the api-06 bake-off procedure.

## Citations

- 4–8 sources per chapter; tiers per CONVENTIONS §5 (T1 official docs — mandatory for any API/pricing/limit claim; T2 papers — for mechanisms; T4 lab engineering blogs; T5 only flagged: `[T5 — <justification>]`).
- Footnote keys are slugs; **inline refs, footnote defs, and frontmatter `sources` must match exactly, all three ways** — the validation script checks this and it is the most common generation error.
- `accessed:` dates = generation date. The blueprint files give you the exact source lists with arXiv IDs; verify the IDs look plausible and keep them — do not invent new arXiv numbers.

## Diagrams

Per CONVENTIONS §4: Mermaid default; every block preceded by ONE italic caption sentence; <20 nodes; `graph LR` pipelines, `graph TD` hierarchies/decisions, `sequenceDiagram` request flows, `stateDiagram-v2` loops/lifecycles. The blueprints specify each chapter's diagrams — build those, not others. Mermaid limits: no Voronoi/geometric layouts (describe in prose + tiny ` ```text ` illustration if token-level), timelines of interleaved work may use `gantt` (prd-02's continuous-batching diagram does). Avoid parentheses and special chars inside node labels (renderer breakage); keep labels short.

## Frontmatter + validation

Copy the frontmatter shape from any existing chapter. Rules the script enforces: id matches filename and manifest; title == H1; summary ≤60 words; keywords 5–12 lowercase; prerequisites/related_ids exist in manifest; footnote parity; last two H2s exactly `Check your understanding`, `Sources`. Run after EVERY chapter:

```python
import re, sys
p = sys.argv[1]
t = open(p).read()
fm, body = t.split("---\n", 2)[1], t.split("---\n", 2)[2]
errs = []
h1s = re.findall(r'(?m)^# (.+)$', body)
title = re.search(r'title: "(.+)"', fm).group(1)
if len(h1s) != 1 or h1s[0] != title: errs.append(f"H1: {h1s}")
s = re.search(r'summary: >-\n((?:  .+\n)+)', fm).group(1)
if len(s.split()) > 60: errs.append(f"summary {len(s.split())}w")
kw = re.findall(r'(?m)^  - (.+)$', fm.split("summary:")[0].split("keywords:")[1])
if not 5 <= len(kw) <= 12: errs.append(f"{len(kw)} keywords")
inline = set(re.findall(r'\[\^([\w-]+)\]', re.sub(r'(?m)^\[\^[\w-]+\]:.*$', '', body)))
defs = set(re.findall(r'(?m)^\[\^([\w-]+)\]:', body))
src = set(re.findall(r'- key: ([\w-]+)', fm))
if inline != defs: errs.append(f"inline^defs: {inline ^ defs}")
if defs != src: errs.append(f"defs^src: {defs ^ src}")
h2s = re.findall(r'(?m)^## (.+)$', body)
if h2s[-2:] != ["Check your understanding", "Sources"]: errs.append(f"ending: {h2s[-2:]}")
weird = {c for c in set(re.findall(r'[^\x00-\x7F]', t)) if ord(c) > 0x2500 or (0x0400 <= ord(c) <= 0x04FF) or (0x4E00 <= ord(c) <= 0x9FFF) or (0x0370 <= ord(c) <= 0x03FF)}
if weird: errs.append(f"stray chars: {weird}")
print(p.split('/')[-1], "->", errs or "OK", f"({len(h2s)} H2s)")
```

**Known generation failure modes (all have occurred; check for them):** stray non-Latin characters mid-word (Cyrillic/CJK/Greek lookalikes — the script's last check); footnote defined but missing from frontmatter (or vice versa); forward-link paths that don't match the manifest; a `## Sources` entry whose slug differs from the inline ref; summaries drifting past 60 words; single-run eval claims (violates directive 2 — n-run everything).

## Process per generation session

1. Take chapters in **manifest build order** (prerequisites are then always written; their content is available to cross-reference and must be treated as canon — do not contradict or re-teach it, link it).
2. One chapter per generation unit; validate; fix; only then proceed.
3. After each batch: update `glossary.md` for any term now used in ≥3 chapters (H3 anchor format, ≤2-sentence definition, *See:* list); append a `CHANGELOG.md` entry; keep `manifest.yaml` statuses in sync if any changed.
4. End every session by reporting: chapter IDs completed + exact next IDs.
5. When a blueprint conflicts with something an existing chapter established, **the existing chapter wins** — flag the conflict in the session report rather than silently diverging.

## The capstone thread (do not drop it)

Mini-projects accumulate into one system: api-01 client → api-05 instrumented gateway → rag-01 context assembler → evl-01 harness (eng-03) → rag-05 RAG pipeline (the capstone core) → agt-01 loop → evl-06 CI gates → prd-01 hardening. Each remaining chapter's blueprint names its capstone extension; preserve the continuity — the thread is what makes the curriculum a portfolio (eng-12/fro-05 depend on it).
