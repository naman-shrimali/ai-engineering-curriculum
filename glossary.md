# Glossary

Shared definitions for terms used across ≥3 chapters. One term per H3 heading (headings provide the link anchors, e.g. `glossary.md#gradient-descent`). Definitions ≤2 sentences; deeper treatment lives in the chapters listed after *See:*.

### activation

An intermediate value computed inside a network during the forward pass, cached during training so backpropagation can compute gradients. Activation memory is a dominant cost of training and of long-context inference. *See: fnd-02, fnd-05, prd-02.*

### base model

The direct artifact of pretraining: a text-distribution engine that continues prompts the way its corpus would, with no instruction-following or safety contract. Post-training converts it into an assistant. *See: fnd-06, fnd-07, ftn-01.*

### backpropagation

The algorithm that computes the gradient of the loss with respect to every parameter in one reverse sweep of the computation graph, via the chain rule. It makes gradient descent computationally affordable at billions of parameters. *See: fnd-02, fnd-05, ftn-02.*

### cross-entropy

A loss equal to the negative log-probability the model assigned to the correct answer; minimizing it is maximum-likelihood training. Next-token cross-entropy is the pretraining objective of every LLM. *See: fnd-02, fnd-06, fnd-08.*

### embedding

A learned vector representation of an object (token, sentence, document, image) positioned so that geometric closeness approximates semantic similarity. The foundation of vector search and retrieval. *See: fnd-03, rag-02, rag-05.*

### eval

A curated set of inputs with expected behaviors plus a scoring method, used to measure an LLM system's quality statistically. Evals are the LLM-era analogue of a test suite and the primary durable asset of an AI product team. *See: evl-01, evl-02, rag-07.*

### foundation model

A large model pretrained on broad data at scale and adaptable to many downstream tasks via prompting or fine-tuning, rather than trained per task. *See: fnd-01, fnd-06, api-06.*

### gradient descent

The optimization procedure that trains essentially all neural networks: repeatedly compute the loss's gradient on a minibatch and step every parameter a learning-rate-sized amount downhill. *See: fnd-02, fnd-06, ftn-02.*

### hallucination

Fluent, confident output that is factually false — a structural consequence of distribution-matching training, sparse-fact learnability limits, and guess-rewarding evaluation, not a patchable bug. Mitigated by grounding, verification, and abstention design. *See: fnd-06, fnd-09, rag-05, rag-07.*

### inference

Running a trained model's forward pass to produce outputs, as opposed to training it. Latency-bound, parameter-memory-dominated, and the cost center of production LLM systems. *See: fnd-02, api-07, prd-02.*

### kv cache

Stored key and value vectors for every processed token, reused across generation steps because causal masking makes them immutable. The dominant memory consumer of long-context inference and the mechanism behind prompt-caching discounts. *See: fnd-05, api-05, prd-02.*

### logit

A raw, unnormalized score the model outputs per class or vocabulary token before softmax converts scores to probabilities. Sampling controls operate on logits. *See: fnd-02, fnd-08, api-03.*

### loss function

A differentiable function scoring how wrong a model's outputs are against targets; the objective the optimizer actually minimizes, and therefore the system's true specification. *See: fnd-02, fnd-06, ftn-05.*

### overfitting

Reducing training loss by memorizing training-set specifics rather than learning generalizable structure, visible as validation loss rising while training loss falls. Its LLM-era descendants include benchmark contamination and eval-set overfitting. *See: fnd-02, fnd-09, evl-02, ftn-03.*

### parameter

One of the learned numeric weights that define a trained model's behavior; "7B model" counts them. Parameter count drives memory, cost, and (loosely) capability. *See: fnd-02, fnd-05, api-06.*

### pretraining

Self-supervised training of a model on next-token prediction over a curated multi-trillion-token corpus — the stage where essentially all raw capability originates. *See: fnd-02, fnd-06, fnd-07.*

### rlhf

Reinforcement learning from human feedback: training a reward model on pairwise human preferences, then optimizing the assistant against it under a KL penalty that prevents drift from the reference model. *See: fnd-02, fnd-07, ftn-05.*

### softmax

The function that converts a vector of logits into a probability distribution by exponentiating and normalizing. Every LLM's output layer ends in a softmax over the vocabulary. *See: fnd-02, fnd-05, fnd-08.*

### temperature

A sampling parameter that divides logits before softmax, sharpening (<1) or flattening (>1) the next-token distribution without reordering it. A variance dial, not a creativity or truthfulness dial. *See: fnd-08, api-01, api-02.*

### token

The unit a language model actually reads and writes — a subword chunk produced by a tokenizer, not a word or character. Tokens are the billing, context-length, and latency unit of the entire field. *See: fnd-04, api-01, rag-01.*
