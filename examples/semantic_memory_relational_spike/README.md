# Semantic Memory Brain Relational Spike

This is an in-memory, Incan-authored research spike for the logical core of IncQL-DB. It exercises the contract that matters to AI Workbench, Hees.ai, and HyperQuant without claiming an IncQL-DB implementation. The original 17 behavioral tests are retained unchanged as the control; three focused adapter tests examine the IncQL relational read layer. [FINDING.md](FINDING.md) records the result, including the present Incan 0.6 Oven-closure boundary.

The spike records typed revisions, provenance links, explicit review decisions, exact bindings, and bounded retrieval traces. It can hot-swap compatible in-memory Quants inside one active brain: each persisted profile names its corpus, model, vector space, index, and candidate family. A profile may use a different vector space only through its own named index.

`hyperquant_adapter.incn` defines the narrow integration boundary. It accepts an immutable HyperQuant run of exact revision references, ranks, relevance basis points, and a provider-run fingerprint; checks it against the intended Quant profile and resolved record family; and joins each nomination to a policy-owned screening. Only then does it create a live Quant. The adapter rejects incomplete or ambiguous input rather than treating retrieval as an approval. The resulting trace retains the active profile, each score, the provider-run fingerprint, the policy identity, and the bounded outcome for every candidate.

The executable is a local-agent demo. It observes one ranked HyperQuant run through a product-checkpoint focus, switches to a Minutary meeting focus, and then restores the product focus. The approved artifact binding remains pinned throughout. The agent exposes only selected immutable references and the trace; it does not return record payloads or make approval decisions.

It also writes two explicit interaction memories: one caller-supplied user detail and one Minutary-style meeting recall with its meeting identity and action items. Both become `ConversationMemoryRevision` entries and are recalled only through a named conversation, a supplied snapshot, and a bound. The agent does not infer memories or ingest raw transcripts implicitly.

The fixture now records three additional typed records needed for progressive, debuggable context retrieval:

- `ContextProjection` is a caller-authored abstract, overview, or evidence excerpt tied to one immutable source revision and its content digest. It has a declared tier budget; this spike does not pretend to tokenize or generate summaries itself.
- `MemoryScope` is a typed stored hierarchy, not a path convention. The Northbridge product path is `conversation -> memory atom`; its Minutary recall path is `conversation -> meeting -> decision -> memory atom`.
- `RetrievalRun` is a receipt over an existing `RetrievalTrace`: it names the query, input snapshot, projection tier, typed scope hops, selected source projections, active atom references, candidate treatment, and a caller-supplied result receipt. Recording a run never reruns HyperQuant or changes the active memory handle.

Minutary supplies a compact, precomputed list of exact memory-atom revisions with a meeting recall. The conversation-bound agent can turn that list into an ephemeral `MemoryActivation`, which pins the source memory, snapshot, policy, Quant profile, and atom references. Changing focus only replaces that activation; it neither copies the atoms nor advances the Brain snapshot. Subsequent retrieval is constrained to the focused atom set and emits the activation in its trace. A focus fails closed for a future memory, another conversation, an empty atom set, or a changed Quant profile.

The executable uses a fictional but operationally credible Northbridge local-pilot fixture. It contains concrete minutes, a local-only data boundary, a release gate, a memory-activation decision, a performance budget, and an unrelated finance risk. The same ranked HyperQuant run is observed under a product-checkpoint focus, an imported Minutary architecture recall, and the restored product focus. The application resolves the selected immutable reference through its governed fact collection; HyperQuant still owns only ranks and references.

## Interactive Trace Explorer

Run the small local browser explorer from `demo/`:

```text
./demo/start-demo.sh
```

Open <http://127.0.0.1:8794>. It lets you switch between the product checkpoint, the Minutary architecture recall, and the restored product focus while inspecting the active atom set, typed scope trajectory, retrieval receipt, and candidate treatment. The projection controls inspect the source-pinned abstract, overview, and evidence excerpt for the selected atom. They do not execute retrieval in the browser. The explorer is a visual rendering of the verified Northbridge fixture; it does not replace or reimplement the Incan semantic path.

It deliberately does not implement disk persistence, ACID, vectors, approximate search, a query engine, or graph syntax. Those belong to IncQL-DB proper.

Run the demonstration from this directory:

```text
make demo
```

The target bakes the current Incan source and runs the Northbridge fixture. To use a non-default Incan binary, run `make demo INCAN=/path/to/incan`.

Run its behavioral contract:

```text
make test
```
