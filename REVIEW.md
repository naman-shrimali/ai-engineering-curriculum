# REVIEW — repository punch list

Staff-engineer / educator / interview-coach review of the written corpus as of 2026-07-10. Scope: the **19 complete chapters** + **12 engineering docs** actually on disk (not the 42 blueprint specs, which are generation inputs, not content). Grounded in automated checks (frontmatter, cross-refs, diagrams, citation tiers, napkin-number consistency) plus editorial reading.

**Headline:** the corpus is in strong shape. Frontmatter/manifest status is clean (0 drift), cross-references are valid (0 broken links), citation tiers are healthy (T1 62 / T2 75 / T3 3 / T4 8 / T5 5), and — notably — the load-bearing "napkin numbers" (KV-cache 128 KB/token, 7B→14 GB inference / 112 GB train, 8B→16 GB, ~1.3 tokens/word) are **internally consistent across every chapter that repeats them**. No factual contradictions surfaced. The fixes below are structural and polish, not corrections — with one exception (P0).

Priorities: **P0** ship-blocker · **P1** should-fix-before-scaling · **P2** quality polish · **P3** nice-to-have.

---

## P0 — Ship blocker

### P0-1 · `agt-01` is a 2-line phantom stub
**File:** `modules/04-agents/agt-01-agent-fundamentals.md` (2 lines: a title, no frontmatter, no body).
**Why it matters:** it occupies the canonical `agt-01` path, so the repo *looks* 20/61 written when it is **19/61 + 1 empty stub**. Consequences: (a) fails the METADATA_SCHEMA validation script (no frontmatter → parse error, already reproduced); (b) will poison RAG ingestion (a titled-but-empty doc becomes a garbage chunk); (c) misleads completeness accounting and the `agt-01` prerequisite (six agent chapters + sec-01 + fro-05 depend on it). `agt-01` is the widest-fan-out node in module 4 and is still *blueprinted, not written*.
**Fix:** delete the stub so on-disk state honestly reflects "agt-01 pending" (its blueprint in `blueprints/day3-agt.md` is intact), **or** generate the full chapter from that blueprint. Do one; do not leave the stub. Until then, exclude it from any ingestion/count.

---

## P1 — Fix before the corpus scales

### P1-1 · Glossary cross-linking convention has 0% adoption
**Scope:** 0 of 31 chapter/eng files contain a single `glossary.md#anchor` link; CONVENTIONS §5 mandates "first use of a glossary term in a chapter links to it."
**Why it matters:** it's a documented, frozen convention that is entirely unfollowed — either the rule or the corpus is wrong. For the RAG/tutor layer this is also a navigation gap (no term→definition jumps). 20 glossary terms exist and are well-formed.
**Fix (pick one, record in CHANGELOG):** (a) **Recommended** — run a mechanical link pass: for each of the 20 terms, link its *first* occurrence per file to `glossary.md#<anchor>` (scriptable; ~1 pass, low risk). (b) Downgrade §5 to "recommended, not required" and stop claiming it. Don't leave the contradiction standing.

### P1-2 · 134 forward-links resolve to unwritten chapters
**Scope:** 134 cross-references point at manifest-known but not-yet-written files (e.g. every `[rag-05](...)`, `[agt-09](...)`). This is **by design** (manifest paths are fixed so links pre-resolve) — but nothing machine-readable distinguishes "written" from "pending," so a reader or the tutor hits dead links with no signal.
**Fix:** the Part-B `INDEX.md` marks each ID written/pending (done in this batch). Additionally, add a lightweight CI assertion: every `../<module>/<id>-*.md` link must be either an existing file **or** a manifest-listed path — this catches genuinely-broken links (currently 0) without flagging the intentional 134. Keep the count visible; when it drops to 0 the corpus is complete.

---

## P2 — Quality polish

### P2-1 · The memory/KV napkin math is restated in 4 places (drift risk)
**Files:** `fnd-05` (canonical home, 29 mentions), `fnd-02` (8), `api-07` (12), `eng-12` (3).
**Assessment:** this is *intentional layering* (fnd-02 introduces train-vs-inference memory; fnd-05 owns the KV formula; api-07 applies it to sizing; eng-12 drills it) and the numbers currently agree. But four independent statements of the same derivation are four places to update if precision/hardware assumptions shift.
**Fix:** designate `fnd-05` explicitly as the canonical derivation (it already is de facto); ensure the other three *cite* it rather than re-derive (api-07 and eng-12 already cross-link — good; verify fnd-02's training-memory block points forward to fnd-05 for the KV portion). No number changes needed today.

### P2-2 · T3 (university course material) is under-cited
**Scope:** 3 T3 citations repo-wide vs 62 T1 / 75 T2. The source hierarchy ranks T3 **above** T4/T5, and the evergreen foundations chapters (fnd-02/05/06/08) are exactly where course material (CS336, CS224n, MIT 6.S965) is the ideal citation class.
**Fix:** in the next evergreen-chapter review, add 1–2 T3 anchors where claims currently lean on a T2 preprint or T4 blog for settled material (e.g. attention/backprop/decoding). Low urgency; strengthens the "rival a university course" positioning.

### P2-3 · fnd-05 "larger than weights" reads as "equal to weights"
**File:** `fnd-05` §"KV cache arithmetic" (line ~168): "128k-token context holds ≈16 GB of cache — larger than the model's own weights (~16 GB)." Rounding both to ~16 GB makes "larger than" read as "equal." (Exact: ~17.2 GB cache vs 16 GB weights — the claim is *true*, just obscured by rounding.)
**Fix:** one-word tighten — "comparable to, and at full context slightly exceeds, the model's own weights." Trivial.

### P2-4 · Dense passages that would benefit from a worked example (enhance, not fix)
These are correct but compressed for the stated audience (strong SWE, moderate ML):
- `fnd-02` — **double descent** gets one paragraph; a 2-sentence concrete example (or an explicit "you can skip this" flag) would prevent it reading as hand-wave.
- `fnd-07` — **DPO vs RLHF vs GRPO** is dense; a single worked "same preference pair, three methods" contrast would earn its length.
- `fnd-05` — the **RoPE** paragraph asserts rotation-encodes-relative-position without a minimal intuition; half a sentence of "why rotation" would help.
**Fix:** additive only, during normal review cadence. None are wrong.

---

## P3 — Nice to have

### P3-1 · Verify all 5 T5 citations carry the required justification flag
CONVENTIONS §5 requires `[T5 — <why no higher tier>]`. 5 T5 citations exist (e.g. swyx "Rise of the AI Engineer" in fnd-01, Husain evals in evl-01/eng-07). Spot-check each carries the bracketed justification; add where missing.

### P3-2 · Diagram captions sit one blank line above the fence
All 14 Mermaid diagrams *have* proper italic captions, but a blank line separates caption from ```` ```mermaid ````; §4 says "immediately preceded." This is standard Markdown and harmless (same chunk); either accept it or soften §4's wording to "in the paragraph immediately above." Non-issue — listed for completeness so a future reviewer doesn't re-flag it.

### P3-3 · `curriculum/dependency-graph.md` not machine-verified against manifest prereqs
The hand-drawn dependency graph should be diffed against `manifest.yaml` prerequisites to guarantee they agree. Not checked this pass; recommend a small script (parse both, assert edge-set equality) added to CI.

---

## Missing topics (with manifest slots)

The 61-chapter manifest is comprehensive. Three genuine gaps for a course positioned to "rival a top university":

1. **Bias, fairness & toxicity evaluation** — currently no first-class treatment. `sec-05` is alignment *concepts*; `evl-*` is quality/correctness; `sec-04` is adversarial security. Fairness/bias/toxicity measurement (disparate performance across groups, toxicity benchmarks, fairness-vs-utility trade-offs) is absent. **Slot:** new **`evl-07` — Bias, Fairness & Safety Evaluation** (prereqs `evl-02`, `sec-05`), or a dedicated section folded into `sec-04`. Recommend the standalone chapter — it's interview-relevant and ethically load-bearing.
2. **Multi-turn / conversational evaluation** — the `evl-*` blueprints lean single-turn; evaluating dialogue (state tracking, coherence over turns, goal completion) is thin. **Slot:** extend `evl-05` (online eval) or add a section to `rag-07`/`evl-02` blueprints before generation. Low-cost to fold in.
3. **Internationalization / multilingual as a cross-cutting concern** — only `fnd-04` (tokenizer cost inequity) touches it. Non-English retrieval, eval, and prompting deserve consolidation. **Slot:** an `eng-` reference doc (`eng-13 — Multilingual & i18n for LLM Apps`) rather than a chapter — it's practitioner-reference-shaped.

Do **not** expand the manifest reflexively; items 2–3 are foldable. Item 1 (`evl-07`) is the one worth a new ID.

---

## What's genuinely strong (keep doing)

Stated so the next author preserves it: the cross-chapter motif discipline (the "eval decides," "jagged frontier," "napkin math," "convert recall to transformation" vocabulary is used consistently and correctly); the incident-shaped Real-world examples; the honest volatility fencing; and the tight prerequisite chaining. The corpus reads as one system, which is the hard part and it's done well. The fixes above are a half-day of work, not a rewrite.
