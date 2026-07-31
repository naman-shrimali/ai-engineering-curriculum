---
id: fnd-04
title: "Tokenization"
module: foundations
prerequisites: [fnd-02]
related_ids: [fnd-05, api-01, rag-01]
keywords:
  - tokenization
  - tokens
  - bpe
  - byte pair encoding
  - subword
  - vocabulary
  - tiktoken
  - context window
  - token counting
summary: >-
  Why language models read subword tokens instead of words or characters, how
  byte-pair encoding builds a vocabulary, and the engineering consequences:
  billing, context limits, multilingual cost inequity, arithmetic and
  string-manipulation weaknesses, and the token-counting discipline production
  systems need.
difficulty: 2
est_minutes: 120
status: stable
volatility: evergreen
last_reviewed: 2026-07-09
sources:
  - key: sennrich-2016
    tier: 2
    title: "Neural Machine Translation of Rare Words with Subword Units"
    org: arXiv
    url: https://arxiv.org/abs/1508.07909
    accessed: 2026-07-09
  - key: kudo-2018
    tier: 2
    title: "SentencePiece: A simple and language independent subword tokenizer"
    org: arXiv
    url: https://arxiv.org/abs/1808.06226
    accessed: 2026-07-09
  - key: radford-gpt2
    tier: 2
    title: "Language Models are Unsupervised Multitask Learners (GPT-2)"
    org: OpenAI
    url: https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf
    accessed: 2026-07-09
  - key: tiktoken-repo
    tier: 1
    title: "tiktoken — fast BPE tokenizer"
    org: OpenAI
    url: https://github.com/openai/tiktoken
    accessed: 2026-07-09
  - key: hf-tokenizers
    tier: 1
    title: "Tokenizers documentation"
    org: Hugging Face
    url: https://huggingface.co/docs/tokenizers/index
    accessed: 2026-07-09
  - key: anthropic-token-counting
    tier: 1
    title: "Token counting"
    org: Anthropic
    url: https://docs.anthropic.com/en/docs/build-with-claude/token-counting
    accessed: 2026-07-09
  - key: petrov-2023
    tier: 2
    title: "Language Model Tokenizers Introduce Unfairness Between Languages"
    org: arXiv
    url: https://arxiv.org/abs/2305.15425
    accessed: 2026-07-09
---

# Tokenization

Language models do not read words, characters, or bytes — they read *tokens*: chunks from a fixed vocabulary, typically fragments of words, produced by a deterministic preprocessing algorithm that runs before any neural network sees your text. Tokenization looks like a boring implementation detail and is anything but: it is the unit of **billing**, the unit of **context limits**, the unit of **latency**, and the hidden cause of a whole family of famous model failures — miscounting letters, botching arithmetic, costing 3× more in Hindi than English. This short chapter covers how byte-pair encoding builds a vocabulary, why the words-vs-characters trade-off forces subwords, and the practical consequences an AI engineer handles weekly. It is evergreen: BPE-family tokenizers have fronted every mainstream LLM for years, and the trade-offs are structural.

## Intuition: the model's alphabet is learned, not given

A tokenizer is a compression codec co-designed with the model. Before training, the model's builders run a frequency analysis over a huge corpus and ask: *what chunk vocabulary of size N (typically 30k–250k entries) lets us write typical text in the fewest chunks?* Common words earn their own token (`" the"` — one chunk). Rarer words get assembled from pieces (`"tokenization"` → `"token"` + `"ization"`). Anything, including binary garbage, can be spelled out byte-by-byte as a fallback. The model then learns embeddings (fnd-03) for exactly these vocabulary entries — the tokenizer's chunk inventory *is* the model's alphabet.

Two immediate consequences of "learned from a corpus." First, **the tokenizer mirrors its training data's biases**: English is cheap (≈1.3 tokens per word) because English dominated the corpus; other scripts can cost 2–4× more tokens for the same meaning.[^petrov-2023] Second, **every model family has its own tokenizer** — token counts, token boundaries, and vocabulary all differ across providers, which is why "how many tokens is this?" has no model-independent answer.[^anthropic-token-counting]

The mental model to keep: the model lives entirely downstream of the tokenizer and *perceives text only as token IDs*. When a model does something bizarre with spelling, counting, or numbers, your first hypothesis should be: what did this look like *as tokens*?

## Why not words, why not characters

Subword tokenization is the resolution of a forced trade-off; seeing both failed extremes makes the design obvious.

**Word-level vocabularies fail on openness.** Language coins words freely — names, typos, hashtags, code identifiers, "unfollowable". A word vocabulary is always incomplete, and every miss becomes an unknown-token hole where information dies. Worse, vocabularies balloon into the millions (every inflection is a new entry), and the model's embedding table and output softmax (fnd-02) scale with vocabulary size.

**Character/byte-level vocabularies fail on sequence length.** A ~256-entry byte alphabet has no coverage problem, but now "The quick brown fox" is 19 steps instead of 4, and every downstream cost follows: attention in the transformer scales quadratically with sequence length (fnd-05), effective context shrinks, and the model burns capacity learning to reassemble words before it can learn anything about meaning.

**Subwords take both ends' virtues:** a fixed, modest vocabulary with byte-level fallback (no text is unrepresentable) whose *frequent* entries are long chunks (sequence stays short — near word-level compression on typical text). The cost is a new set of quirks, catalogued below — but they're quirks, not failures of coverage or scale.

## How byte-pair encoding works

BPE, adapted from a 1994 compression algorithm for neural translation in 2016, builds the vocabulary bottom-up by greedy merging.[^sennrich-2016] Training: start with single bytes as the alphabet; count all adjacent pairs in the corpus; merge the most frequent pair into a new vocabulary entry; repeat until the vocabulary hits its size budget. The merge list — an ordered set of rules — *is* the tokenizer.

A miniature run on a corpus rich in "low", "lower", "lowest":

```text
Start (bytes):     l o w   l o w e r   l o w e s t
Merge 1  (l,o):    lo w    lo w e r    lo w e s t
Merge 2  (lo,w):   low     low e r     low e s t
Merge 3  (e,s):    low     low e r     low es t
Merge 4  (es,t):   low     low e r     low est
...vocabulary now contains: low, est, er, ...
"lowest" tokenizes as [low][est]  — 2 tokens
```

Encoding new text replays the learned merges in order. Note what the example shows: the pieces often align with morphemes ("est") purely as a side effect of frequency — no linguistics was consulted. That is BPE's charm and its limitation: statistically convenient boundaries, not meaningful ones.

Production tokenizers wrap this core with engineering: **byte-level BPE** (introduced with GPT-2) operates on UTF-8 bytes so any string — any language, emoji, binary — tokenizes without an unknown-token escape hatch;[^radford-gpt2] pre-tokenization regexes split text (on spaces, punctuation, digit runs) before merging, which is why leading spaces belong to tokens (`" the"` vs `"the"` are *different tokens*); SentencePiece made the pipeline language-agnostic for scripts without spaces;[^kudo-2018] and **special tokens** (message boundaries, end-of-sequence) are reserved entries injected by the chat API layer — they structure the conversation format you'll meet in api-01, and user text must never be able to smuggle them in (a real injection surface: see failure modes).

There is no heavier math worth carrying here; the one number to know is the **compression ratio** (tokens per word ≈ 1.3 for English on modern tokenizers), because every cost and capacity estimate starts from it.

## Consequences: the weirdness budget

Tokenization explains a family of LLM behaviors that otherwise look like inexplicable stupidity. This section is the chapter's payoff — the debugging checklist.

- **Counting and spelling failures.** "How many r's in strawberry?" fails because the model sees `[str][awberry]` or similar — the letters aren't individually represented at input. Same root cause: reversing strings, acrostics, rhyme by spelling. The model reasons about *tokens* while the task is about *characters*.
- **Arithmetic quirks.** Numbers tokenize inconsistently — `1234` might be `[12][34]`, `12345` might be `[123][45]` — so digit alignment, carrying, and place value are obscured at the input encoding. Modern tokenizers mitigate (e.g. splitting digits into fixed groups), and modern models improve via training, but the encoding headwind is structural.
- **Whitespace and case sensitivity.** `"hello"`, `" hello"`, `"Hello"` are three unrelated token IDs. This is why trailing spaces in prompts can shift behavior, and why code models are sensitive to indentation style — a tab and four spaces are different token sequences with different learned statistics.
- **Multilingual cost inequity.** The same product feature can cost 2–4× more per request, and fit 2–4× less content per context window, in languages underrepresented in tokenizer training.[^petrov-2023] For a global product this is a pricing, latency, *and* fairness issue — budget per-language, not per-word.
- **Token-boundary sensitivity in prompts.** Concatenating strings without a separator can fuse into unexpected tokens across the seam; templates that inject user text mid-word produce token sequences the model has rarely seen. Keep clean boundaries (spaces/newlines) around injected content.
- **Glitch tokens.** Vocabulary entries that were frequent in tokenizer training data but nearly absent from *model* training data end up with untrained embeddings; feeding them produces erratic output. Rare, but a reminder that tokenizer and model are separate artifacts that can disagree.

> **Note:** the right frame is a *weirdness budget*, not a bug list — every subword tokenizer buys its compression with some quirk set. Model releases shrink individual items; the category is structural until tokenizer-free architectures mature (an active research direction worth watching, not building on).

## Production engineering perspective

Tokens are the metering unit of the entire LLM economy: API pricing is per token (input and output priced separately), context windows are token-denominated, streaming latency is per token, and rate limits are tokens-per-minute. That makes token counting a production discipline:

- **Count with the right tokenizer.** Each provider documents its own counting method — a library for local counting (tiktoken for OpenAI models,[^tiktoken-repo] Hugging Face `tokenizers` for open-weight models[^hf-tokenizers]) or a counting endpoint (Anthropic[^anthropic-token-counting]). Counting with the wrong tokenizer produces estimates that are confidently wrong by tens of percent.
- **The chars/4 heuristic is for napkins only.** "~4 characters per token" holds for typical English and collapses for code, non-Latin scripts, and JSON-heavy payloads. Anything that *enforces* a budget — truncation, chunk sizing (rag-04), context packing (rag-01) — must count real tokens.
- **Truncate on token boundaries, by design.** Naive character-based truncation mid-token (or mid-word, mid-sentence) degrades quality at the exact moment the context is fullest. Budget top-down: reserve output tokens first, then system prompt, then pack variable content to the remainder.
- **Overhead is real.** Chat formatting (special tokens, role markers) adds per-message overhead; tool/function schemas (api-03) are tokenized into the prompt too. Measured costs come from counting the *final assembled request*, not the user-visible text.
- **Cache your counts.** Tokenization is cheap but not free; at pipeline scale (millions of chunks), memoize counts alongside the text like any derived attribute.

## Historical evolution

Word-level vocabularies with unknown-token escape hatches dominated neural NLP until **2016**, when BPE was imported from compression to solve rare words in machine translation.[^sennrich-2016] **2018:** SentencePiece removed the whitespace assumption, making one pipeline serve any script.[^kudo-2018] **2019:** GPT-2 moved BPE to raw UTF-8 bytes — universal coverage, no preprocessing losses — which became the mainstream template.[^radford-gpt2] **Since then:** the changes are parametric, not structural — vocabularies grew (30k → 100k–250k+) to improve compression, especially multilingual; digit handling improved; but every mainstream LLM still fronts a byte-level BPE-family tokenizer. Tokenizer-free byte-level architectures remain research. The stability is why this chapter is evergreen: unusually for this field, the 2019 design is still the design.

## Common misconceptions

- **"A token is a word."** ≈1.3 tokens per English word on average, with huge variance: common words are one token, rare words several, and the ratio can double or worse in other languages. Estimates built on "words" drift 30%+.
- **"Token counts are model-independent."** Every model family ships its own tokenizer. Migrating providers changes the token count — and therefore cost and context fit — of *identical* text.
- **"The model sees characters and can reason about them."** It sees token IDs. Character-level tasks succeed only insofar as the model memorized token spellings during training — an approximation that fails on exactly the cute test cases people love.
- **"Tokenization is linguistic analysis."** BPE boundaries are frequency artifacts. When "unhappiness" splits as `[unh][appiness]`, no morphology was harmed — none was consulted.
- **"Whitespace is insignificant."** To a tokenizer, whitespace is content: it changes token identity, count, and downstream behavior. Prompt templates should treat every space and newline as deliberate.

## Failure modes and trade-offs

- **Silent budget overflows.** Character-heuristic counting under-estimates on code/multilingual content → context overflows → the API truncates or errors at peak load. *Prevention:* exact counting at every enforcement point.
- **Cross-model migration drift.** Swapping providers shifts token counts by double-digit percentages; budgets, chunk sizes, and price models calibrated to the old tokenizer silently misbehave. *Prevention:* re-measure counts as part of any model migration checklist (api-06).
- **Special-token injection.** If raw user text can express control tokens (or the strings your API layer maps to them), an attacker can forge message boundaries — a tokenizer-level cousin of prompt injection. Providers sanitize this at the API boundary; self-hosted stacks (api-07) must sanitize explicitly. *Trade-off:* none — always sanitize.
- **The vocabulary-size dial.** Bigger vocabularies compress better (cheaper, longer effective context) but grow the embedding table and softmax, and thin out training signal per rare token. You'll feel this as a *consumer* through cost and multilingual quality differences between model families.
- **Boundary-fusion bugs in templates.** String-concatenation seams produce unintended merges and rare token sequences. *Prevention:* explicit delimiters around all injected content — which also helps injection defenses (sec-01).

## Best practices

- **Debug at the token level.** When a model behaves oddly around spelling, numbers, formatting, or a template seam, run the actual text through the actual tokenizer and look at the IDs.[^tiktoken-repo][^hf-tokenizers] Ten seconds, frequently decisive.
- **Centralize token counting** in one utility, keyed by model, used by every component that enforces a budget — never let three services count three different ways.
- **Budget top-down:** output reservation → fixed prompt scaffolding → variable content packed to fit, truncating on token boundaries at semantically clean cuts.
- **Test prompts and budgets per language** if you serve a multilingual product; measure the tokens-per-character ratio on your real traffic distribution, not on English samples.[^petrov-2023]
- **Keep injected content on clean token boundaries** (surrounding whitespace/newlines), and strip or escape anything that could map to special tokens before it reaches a self-hosted model.
- **Re-verify all token-derived calibrations on model migration:** counts, chunk sizes, truncation limits, cost models.

## Real-world examples

**The multilingual pricing surprise.** A team prices a summarization feature from English test traffic at ~1.3 tokens/word. Launch in a market whose script tokenizes at 3× the density and the same feature's unit cost triples while its effective context (and thus max document size) drops by two-thirds — discovered in the cloud bill, not in testing. The fix was per-language token measurement and language-aware document limits; the lesson was that tokenizer economics are part of i18n.[^petrov-2023]

**The chunker that lied.** A RAG pipeline (rag-04 territory) sized chunks by `len(text) // 4`. On a corpus of code-heavy docs the heuristic under-counted ~40%; chunks overflowed the embedding model's input limit and were silently tail-truncated at index time — retrieval then missed anything discussed in the lost tails. Symptom: mysteriously bad recall on long documents. Diagnosis: one afternoon of token-level inspection. Fix: exact counting in the chunker.

**The strawberry defense.** A stakeholder loses confidence because the model can't count letters. The engineer who has read this chapter explains: the model reads compressed chunks, not characters — like judging a person's arithmetic by asking them to count pixels in a font. The capability question that matters is whether the model performs on *your* task distribution (evl-01), not on tokenizer stunts.

## Interview questions

1. **"Why do LLMs use subword tokenization instead of words or characters?"** — Model answer: word vocabularies can't cover open vocabulary (names, typos, code) and balloon the embedding/softmax layers; character sequences are universally covered but 5× longer, which quadratically inflates attention cost and wastes model capacity on reassembling words. Subword BPE keeps a modest fixed vocabulary whose frequent entries are long chunks: near-word compression on common text, byte-level fallback for everything else. The cost is a set of structural quirks — character blindness, digit fragmentation, whitespace sensitivity.

2. **"Walk me through BPE training in 60 seconds."** — Model answer: initialize the vocabulary as raw bytes; count adjacent pair frequencies over the corpus; merge the most frequent pair into a new symbol; repeat until the vocabulary budget is reached. The ordered merge list is the tokenizer; encoding replays those merges on new text. Boundaries fall where frequency puts them — often morpheme-like, but by statistics, not linguistics.

3. **"Why does the same prompt cost different amounts on different providers?"** — Model answer: each model family ships its own tokenizer, so identical text encodes to different token counts — differences of tens of percent are normal, larger for non-English or code. Cross-provider cost comparison therefore requires re-tokenizing your actual traffic with each provider's counter, not comparing per-token prices alone.

4. **"A model that writes elegant proofs can't count the letters in a word. Reconcile that."** — Model answer: the input encoding hides characters — the model receives token IDs like `[str][awberry]`, and letter-level facts exist only insofar as spellings were memorized in training. Proof-writing operates over token-level patterns, which is what the architecture natively supports. It's an encoding artifact, not an intelligence measure — and a reason product evals should test the task distribution, not trivia orthogonal to it.

5. **"Where does tokenization show up as a security surface?"** — Model answer: special tokens. Chat structure (roles, message boundaries) is encoded with reserved tokens; if untrusted text can express them — or the strings an API layer maps to them — an attacker can forge conversation structure, a low-level prompt-injection vector. Hosted APIs sanitize at the boundary; self-hosted inference must explicitly escape or strip special-token patterns from all untrusted input. Template seams without clean delimiters add a subtler surface: token fusion producing unintended sequences.

6. **"Your RAG chunks are sized by character count. Sell me on changing it."** — Model answer: character heuristics diverge from real token counts by up to ~40% on code and non-English content, so chunks silently overflow embedding-model limits and get tail-truncated at indexing — losing exactly the content retrieval later needs, with no error raised. Exact token counting in the chunker, using the embedding model's own tokenizer, costs microseconds and removes the entire failure class. Budget enforcement anywhere (truncation, packing, pricing) deserves the same treatment.

## Exercises and mini-project

**Exercises**

1. Run BPE training by hand for four merges on the corpus `"hug hugs hugging huggable"` (start from characters). Write the final tokenization of `"huggable"`.
2. Using any tokenizer playground or library,[^tiktoken-repo][^hf-tokenizers] tokenize: your full name, `"hello"` vs `" hello"` vs `"Hello"`, a 10-digit number, and one sentence in a non-Latin script. Record token counts and explain each surprise using this chapter.
3. A prompt template is `f"Summarize:{user_text}"`. Identify the token-boundary problem and write the fixed version.
4. Your product processes 10M English words/month at $3 per million input tokens. Estimate monthly cost; then re-estimate if half the traffic shifts to a language with 2.5× token density. What limit besides cost also degrades?
5. List three product features (from any modules you've previewed) whose correctness depends on exact token counting, and the failure each suffers under the chars/4 heuristic.

**Mini-project: tokenizer forensics.** In a notebook, take 200+ documents you have handy (mix English, code, and one other language if possible): (a) tokenize the corpus with two different tokenizers (e.g. tiktoken and an open-weight model's via Hugging Face);[^tiktoken-repo][^hf-tokenizers] (b) compute tokens-per-word and tokens-per-character by content type and language; (c) find the 20 longest single tokens and the 5 most fragmented words in your corpus; (d) quantify the chars/4 heuristic's worst-case error on your data; (e) write a one-page memo: which tokenizer compresses *your* content better, and what that means for cost and context fit. Target: 2 hours. Success criterion: you can predict, before calling an API, roughly what any given text will cost — and know when your prediction can't be trusted.

**Capstone extension:** the token-counting utility you build here becomes the budget enforcement layer of your capstone's context assembly (rag-01) and chunking pipeline (rag-04).

## Revision summary

- Tokens are learned subword chunks — a compression codec co-trained with the corpus; the tokenizer's vocabulary is the model's alphabet, and the model perceives *only* token IDs.
- Subwords resolve the forced trade-off: word vocabularies can't cover language, character sequences are too long. BPE builds the vocabulary by greedy frequency merges with byte-level fallback; the design has been stable since 2019.
- The weirdness budget: character blindness (spelling/counting), digit fragmentation (arithmetic), whitespace/case sensitivity, multilingual cost inequity (2–4×), boundary fusion, glitch tokens. Debug odd behavior at the token level first.
- Tokens are the metering unit — pricing, context, latency, rate limits — so exact counting with the correct per-model tokenizer, centralized, at every enforcement point, is a production discipline. The chars/4 heuristic is for napkins.
- Special tokens structure the chat format and are a sanitization requirement on self-hosted stacks; token counts, and everything calibrated to them, change on every model migration.

## Flashcards

| Q | A |
|---|---|
| What does an LLM actually receive as input? | A sequence of token IDs from a fixed learned vocabulary — never characters or words. |
| BPE training in one sentence? | Repeatedly merge the corpus's most frequent adjacent symbol pair into a new vocabulary entry until the size budget is hit. |
| Why byte-level BPE? | UTF-8 byte fallback makes every possible string representable — no unknown-token holes. |
| Typical English compression ratio? | ≈1.3 tokens per word (≈4 chars/token) — napkin math only; collapses on code and non-Latin scripts. |
| Why can't models count letters in a word? | Characters aren't individually represented in the input; words arrive as opaque multi-character chunks. |
| Are `"the"`, `" the"`, `"The"` the same token? | No — three distinct vocabulary entries with independently learned statistics. |
| Why do costs change when switching model providers? | Each family's tokenizer encodes identical text to different token counts. |
| The tokenizer-level security concern? | Special-token injection: untrusted text expressing reserved structure tokens can forge message boundaries — sanitize on self-hosted stacks. |
| What must be recalibrated after a model migration? | Everything token-denominated: counts, budgets, chunk sizes, truncation limits, cost models. |

## Further reading

- **Official docs:** tiktoken README and cookbook[^tiktoken-repo]; Hugging Face Tokenizers docs[^hf-tokenizers]; Anthropic token counting[^anthropic-token-counting].
- **Papers:** Sennrich et al. (2016), BPE for NMT[^sennrich-2016] — short and readable; Kudo & Richardson (2018), SentencePiece[^kudo-2018]; Petrov et al. (2023), tokenizer language unfairness[^petrov-2023].
- **Books:** Jurafsky & Martin, *Speech and Language Processing* (3rd ed. draft), §2 covers tokenization formally — optional here.
- **Talks:** Karpathy, "Let's build the GPT Tokenizer" (YouTube, 2024) — builds byte-level BPE from scratch in code; the definitive deep companion to this chapter.
- **Tutorials:** the GPT-2 paper's §2.2 for byte-level BPE rationale in the designers' own words.[^radford-gpt2]

## Check your understanding

1. Reconstruct the words-vs-characters trade-off table from memory and state which cost of each extreme subwords escape.
2. A model mangles a task involving a 12-digit account number. Give the tokenizer-level hypothesis and the 10-second experiment that tests it.
3. Your team is migrating providers to save 20% on per-token price. Name three token-denominated things that must be re-measured before the saving is real.
4. Explain to a security reviewer why special tokens matter on your self-hosted inference stack and what the sanitization requirement is.
5. Why is this chapter `volatility: evergreen` when models change monthly? What specifically would have to change to invalidate it?

## Sources

[^sennrich-2016]: [T2] Sennrich, Haddow & Birch (2016). "Neural Machine Translation of Rare Words with Subword Units." arXiv:1508.07909. https://arxiv.org/abs/1508.07909 (accessed 2026-07-09)
[^kudo-2018]: [T2] Kudo & Richardson (2018). "SentencePiece: A simple and language independent subword tokenizer and detokenizer for Neural Text Processing." arXiv:1808.06226. https://arxiv.org/abs/1808.06226 (accessed 2026-07-09)
[^radford-gpt2]: [T2] Radford et al. (2019). "Language Models are Unsupervised Multitask Learners." OpenAI. https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf (accessed 2026-07-09)
[^tiktoken-repo]: [T1] OpenAI. "tiktoken — fast BPE tokenizer." https://github.com/openai/tiktoken (accessed 2026-07-09)
[^hf-tokenizers]: [T1] Hugging Face. "Tokenizers documentation." https://huggingface.co/docs/tokenizers/index (accessed 2026-07-09)
[^anthropic-token-counting]: [T1] Anthropic. "Token counting." Anthropic API Docs. https://docs.anthropic.com/en/docs/build-with-claude/token-counting (accessed 2026-07-09)
[^petrov-2023]: [T2] Petrov et al. (2023). "Language Model Tokenizers Introduce Unfairness Between Languages." arXiv:2305.15425. https://arxiv.org/abs/2305.15425 (accessed 2026-07-09)
