---
id: eng-09
title: "Security Guidelines for LLM Systems"
module: engineering
prerequisites: [api-03]
related_ids: [sec-01, sec-02, sec-03, eng-02, eng-05]
keywords:
  - llm security
  - prompt injection
  - least privilege
  - untrusted input
  - output handling
  - data governance
  - security review checklist
  - special tokens
summary: >-
  The security rules for LLM systems, organized around the field's central
  fact — instructions and data share one channel: the threat model, ten
  standing rules with mechanisms, the per-surface hardening table (RAG, agents,
  multimodal, self-hosted), the security-review checklist for LLM features,
  and what to log for incident response.
difficulty: 3
est_minutes: 45
status: evolving
volatility: mixed
last_reviewed: 2026-07-10
sources:
  - key: owasp-llm
    tier: 2
    title: "OWASP Top 10 for Large Language Model Applications"
    org: OWASP
    url: https://owasp.org/www-project-top-10-for-large-language-model-applications/
    accessed: 2026-07-10
  - key: greshake-2023
    tier: 2
    title: "Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection"
    org: arXiv
    url: https://arxiv.org/abs/2302.12173
    accessed: 2026-07-10
  - key: bagdasaryan-2023
    tier: 2
    title: "Abusing Images and Sounds for Indirect Instruction Injection in Multi-Modal LLMs"
    org: arXiv
    url: https://arxiv.org/abs/2307.10490
    accessed: 2026-07-10
---

# Security Guidelines for LLM Systems

The standing rules, review checklist, and per-surface hardening guidance — the operational companion to module 7's chapters ([sec-01](../modules/07-safety-security/sec-01-prompt-injection.md) explains the mechanisms; this doc tells you what to do about them this sprint). One fact organizes everything: **in an LLM, instructions and data travel in the same channel.** There is no reliable in-band separation — delimiters and "treat this as data" framing lower attack success rates but cannot guarantee them — so LLM security is achieved *around* the model (privileges, validation, isolation), never *inside* the prompt.[^owasp-llm][^greshake-2023]

## The threat model in one table

| Threat | Vector | Canonical scenario |
|---|---|---|
| Direct prompt injection | User input | User overrides instructions, extracts the system prompt, jailbreaks policy |
| Indirect prompt injection | Retrieved docs, tool results, emails, web pages, images[^greshake-2023][^bagdasaryan-2023] | A fetched page tells the agent to exfiltrate data via its next tool call |
| Data exfiltration | Model output channels (links, tool calls, rendered markdown) | Injected instructions encode secrets into a URL the client fetches |
| Excessive agency | Over-privileged tools | Injected or confused agent performs consequential actions |
| Sensitive-data exposure | Prompts, traces, vector stores | PII in logged contexts; embeddings inverted; secrets pasted into system prompts |
| Supply chain | Models, weights, tool servers, framework deps | Poisoned weights or a malicious MCP-style tool server |
| Denial of wallet | Unmetered access to expensive routes | Abuse loops burning token budget |

## The ten rules

1. **All model input beyond your own literals is untrusted** — user text, retrieved passages, tool results, file contents, image text. Design as if any of it may contain adversarial instructions, because any of it may.[^greshake-2023]
2. **All model output is unverified** — and when it drives actions (tool calls — [api-03](../modules/02-llm-apis/api-03-structured-outputs-tool-calling.md)) or rendering (markdown, links, HTML), it's an *attack vector*: validate before executing, sanitize before rendering, treat generated URLs as exfiltration channels.
3. **The system prompt is steering, not security.** It's neither secret (extractable) nor binding (overridable) — never put credentials in it, never rely on it for access control ([api-01](../modules/02-llm-apis/api-01-llm-api-fundamentals.md)).
4. **Authorization lives outside the model.** Permissions derive from the authenticated session and are enforced at retrieval (ACL-filtered search — [eng-01](eng-01-rag-pipeline-architecture.md)) and at execution (the authorizer — [eng-02](eng-02-agent-loop-architecture.md)), never by prompt instruction.
5. **Least privilege per tool, always:** separate credentials, minimal scopes, egress controls on anything that fetches. The blast radius of a fully-injected model is exactly the union of its tools' privileges — size that union deliberately.
6. **Human gates on consequential actions** (money, deletion, external communication, credential use) with the trajectory attached — the [eng-05](eng-05-design-patterns.md) #14 pattern; the tier table is a reviewed security artifact.
7. **Contain, don't just filter.** Input/output filters and injection classifiers ([sec-02](../modules/07-safety-security/sec-02-guardrails.md)) reduce rates; privileges and isolation bound *impact*. Budget accordingly — a 95%-effective filter on an unbounded-blast-radius agent is theater.
8. **Data governance is part of the design:** provider data-use terms verified ([sec-03](../modules/07-safety-security/sec-03-privacy-compliance.md)), trace redaction before storage, vector stores under source-document ACLs (embedding inversion — [fnd-03](../modules/01-foundations/fnd-03-embeddings.md)), secrets never in prompts or training data.
9. **Self-hosted inherits the provider's job:** special-token sanitization ([fnd-04](../modules/01-foundations/fnd-04-tokenization.md)), moderation, abuse detection — all yours the day the endpoint goes live ([api-07](../modules/02-llm-apis/api-07-local-inference.md)).
10. **Meter everything a stranger can reach:** per-user rate and token budgets on public routes; agent loop budgets ([eng-02](eng-02-agent-loop-architecture.md)) as a security control, not just a cost one.

## Per-surface hardening

| Surface | Additional requirements | Chapters |
|---|---|---|
| RAG | Provenance labels on every passage; ACL filter in the index query; injection-bearing docs in the red-team suite; citation-required output (auditability) | eng-01, [rag-05](../modules/03-retrieval/rag-05-rag-pipeline.md), sec-01 |
| Agents | The five control points (eng-02); idempotent side-effecting tools; egress allowlists on fetch tools; stall/budget termination; trajectory audit log | eng-02, [agt-09](../modules/04-agents/agt-09-agent-reliability.md) |
| Multimodal | Image-borne injection in the threat model and test suite;[^bagdasaryan-2023] moderation and PII scope extended to pixels | [api-04](../modules/02-llm-apis/api-04-multimodal.md) |
| Tool ecosystems (MCP-style) | Tool servers are supply chain: provenance-verify, pin versions, scope credentials per server, review tool descriptions (they're prompt-injection carriers too) | [agt-05](../modules/04-agents/agt-05-mcp.md) |
| Self-hosted | Special-token stripping on all untrusted input; your own moderation stack; weights provenance (checksums, trusted sources) | api-07, fnd-04 |
| Public/consumer routes | Denial-of-wallet metering; abuse-pattern detection; output rendering sanitization (no raw HTML/links from model output without a sanitizer) | sec-02 |

## Security review checklist for any LLM feature

- [ ] Data-flow diagram exists: every source entering the context, labeled by trust tier
- [ ] Injection assumption test: "if this input were adversarial, what's the worst the system does?" answered for *each* untrusted source — the answer must be bounded by privileges, not by hoped-for model behavior
- [ ] Tool privilege table written: per-tool credentials, scopes, tier (auto / scoped / human-gated), idempotency
- [ ] Output handling: validation before execution, sanitization before rendering, generated-URL policy decided
- [ ] Secrets audit: nothing sensitive in system prompts, few-shot examples, or eval cases
- [ ] Data governance: provider terms checked; trace redaction configured; vector-store ACLs match source ACLs
- [ ] Abuse economics: per-user budgets on externally reachable routes
- [ ] Red-team cases in the eval suite: direct injection, indirect injection via each content source, exfiltration attempts — run per config deploy, expanded per [sec-04](../modules/07-safety-security/sec-04-red-teaming.md)
- [ ] Incident logging sufficient to answer: what did the model see (full context + provenance), what did it do (tool calls + arguments), who approved what (gate decisions) — the [evl-04](../modules/05-evaluation/evl-04-tracing-observability.md) trace store, security edition
- [ ] For agents: termination taxonomy implemented; blast-radius statement written and reviewed

> **Volatile:** attack techniques and defense tooling evolve continuously — the OWASP LLM list is periodically revised,[^owasp-llm] and injection-defense research moves quarterly. The rules above are structural (they follow from the shared-channel fact, which no model release has changed); the specific filter/classifier layer is the volatile part — review per [fro-04](../modules/09-frontier/fro-04-staying-current.md) cadence and [sec-02](../modules/07-safety-security/sec-02-guardrails.md).

## Related chapters

| Chapter | What it explains |
|---|---|
| [sec-01](../modules/07-safety-security/sec-01-prompt-injection.md) | The injection threat model and why in-band defenses can't be complete |
| [sec-02](../modules/07-safety-security/sec-02-guardrails.md) | The filter/moderation layer (rule 7's "filter" half) |
| [sec-03](../modules/07-safety-security/sec-03-privacy-compliance.md) | Data governance behind rule 8 |
| [sec-04](../modules/07-safety-security/sec-04-red-teaming.md) | Building the adversarial suite the checklist requires |
| [eng-02](eng-02-agent-loop-architecture.md) | The control points that implement rules 4–6 for agents |
| [api-03](../modules/02-llm-apis/api-03-structured-outputs-tool-calling.md) | Validation/authorization at the tool boundary |
| [fnd-04](../modules/01-foundations/fnd-04-tokenization.md) / [fnd-03](../modules/01-foundations/fnd-03-embeddings.md) | Special-token and embedding-inversion mechanics |

## Sources

[^owasp-llm]: [T2] OWASP. "Top 10 for Large Language Model Applications." https://owasp.org/www-project-top-10-for-large-language-model-applications/ (accessed 2026-07-10)
[^greshake-2023]: [T2] Greshake et al. (2023). "Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection." arXiv:2302.12173. https://arxiv.org/abs/2302.12173 (accessed 2026-07-10)
[^bagdasaryan-2023]: [T2] Bagdasaryan et al. (2023). "Abusing Images and Sounds for Indirect Instruction Injection in Multi-Modal LLMs." arXiv:2307.10490. https://arxiv.org/abs/2307.10490 (accessed 2026-07-10)
