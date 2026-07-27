# IncQL RFC 008: Optimizer boundary, statistics, cost-based optimization, and adaptive execution

- **Status:** Planned
- **Created:** 2026-04-07
- **Author(s):** Danny Meijer
- **Related:**
  - IncQL RFC 004 (execution context — `Session` remains the execution and backend boundary)
  - IncQL RFC 007 (Prism planning engine — this RFC narrows optimizer-boundary ownership without replacing Prism adoption)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 066 (Prism relational reasoning and shared-work optimization)
- **Issue:** [IncQL #18](https://github.com/encero-systems/IncQL/issues/18)
- **RFC PR:** [IncQL #105](https://github.com/encero-systems/IncQL/pull/105)
- **Written against:** Incan v0.2
- **Shipped in:** —

## Summary

This RFC defines the optimizer boundary between **Prism** and **`Session`** as IncQL grows beyond the first Prism adoption slice. Prism remains the owner of analyzed logical planning, semantic rewrites, canonicalization, schema-preserving logical optimization, and logical alternative ranking. `Session` remains the owner of backend capability discovery, physical planning, backend pushdown policy, runtime-observation collection, safe checkpoints, target-local adaptive execution, and execution metrics. Prism may consume provider-neutral immutable evidence before execution or when a coordinator explicitly re-invokes the same reasoning engine over unfinished work. External providers may retain applicable evidence across executions, but Prism does not retrieve, persist, or operationally interpret it. This RFC does not replace RFC 007's role in establishing Prism as the internal planning substrate; it settles the ownership boundary needed for RFC 004, while RFC 066 defines the stronger north-star memo and adaptive re-entry contract.

## Motivation

RFC 007 was intentionally written to get Prism named, scoped, and implemented as a real planning substrate. That was the right move for the first Prism adoption slice. However, once IncQL aims for stronger optimization, the remaining ambiguity becomes a liability:

- If Prism owns all optimization in the abstract, it will tend to absorb backend policy and runtime behavior.
- If `Session` owns all optimization in practice, Prism becomes a passive container rather than a serious optimizer substrate.
- If statistics, cost-based optimization, and adaptive re-planning are not assigned cleanly, explain output, reproducibility, and backend substitution all become muddled.

IncQL needs the same kind of separation that high-performance query engines converge on in practice:

- a semantic logical optimizer that can reason about equivalence and properties
- a backend boundary that can exploit concrete storage and runtime facts
- a runtime layer that can react when real cardinalities, partition sizes, or skew differ from pre-execution estimates

The goal is not to copy Spark literally. The goal is to adopt the useful split in spirit: logical optimization is not the same thing as physical optimization, and neither is the same thing as adaptive re-optimization during execution.

This RFC intentionally stops at the minimum boundary needed to keep the architecture coherent:

- ownership is clear enough that RFC 004 can proceed
- the boundary is explicit enough that deeper optimizer work has a stable home later
- detailed statistics transport, cost formulas, and AQE mechanics remain follow-on work

## Goals

- Define which optimizer responsibilities belong to Prism versus `Session`.
- Establish **statistics ownership** clearly enough to support cost-based optimization without collapsing the Prism / `Session` boundary.
- Define the minimum optimizer artifacts Prism should expose as IncQL moves past the initial identity-shaped optimized view.
- Reserve the adaptive execution lifecycle, safe checkpoints, runtime-observation collection, and target-local physical changes as `Session` or coordinator concerns while allowing bounded Prism re-entry over immutable inputs.
- Make precedence against RFC 007 explicit so future work does not rely on ambiguous wording.

## Non-Goals

- Replacing RFC 007 as the historical record of the first Prism adoption slice.
- Standardizing one exact memo structure, cost formula, or join enumeration algorithm.
- Requiring adaptive execution in the current implementation.
- Defining backend-specific tuning knobs for DataFusion or any other engine.
- Defining new author-facing query syntax.

## Guide-level explanation

Authors still think in the same broad pipeline:

```text
author intent
  -> Prism raw plan
  -> Prism analyzed / optimized logical plan
  -> Session physical planning and execution
  -> optional target-local adaptive execution
  -> optional coordinator-owned Prism re-entry over unfinished work
```

The important mental model is:

- Prism decides what logical transformations are valid and what alternatives are semantically equivalent.
- Prism can prefer one logical alternative over another using inferred properties and cost-model hooks.
- `Session` decides what the selected backend can actually do well.
- `Session` can change physical strategy when runtime facts prove the original assumptions wrong.
- At a safe checkpoint, `Session` or another coordinator can supply scoped observations through the same immutable planning-context contract and ask Prism to reconsider unfinished logical work.

Conceptual example; exact explain API names may differ:

```incan
from pub::incql import Session, LazyFrame, DataFrame
from pub::incql.functions import count
from models import Customer, Order, RegionalSummary

session = Session.default()

orders: LazyFrame[Order] = session.table("orders")?
customers: LazyFrame[Customer] = session.table("customers")?

summary: LazyFrame[RegionalSummary] = query {
    FROM orders
    JOIN customers ON .customer_id == .id
    WHERE .status == "completed"
    GROUP BY .region
    SELECT
        region,
        count() as order_count,
}

# Prism-owned logical surfaces
summary.raw_plan()
summary.analyzed_plan()
summary.plan_after_incql_rules()

# Session-owned execution and runtime behavior (current slice uses execute/write)
executed: LazyFrame[RegionalSummary] = session.execute(summary)?
session.write_csv(executed, "target/summary.csv")?
session.session_plan(summary)
session.executed_plan(summary)
```

For explain and tooling, IncQL should make the stages explicit instead of collapsing them into one vague “optimized plan” label. A future author or tool should be able to distinguish at least:

- authored Prism state
- analyzed Prism state
- Prism-owned logical rewrites
- session-owned planning / execution state
- executed runtime state when adaptive behavior exists

## Reference-level explanation (precise rules)

### 1. Boundary ownership

Prism **must** own:

- logical plan analysis and semantic validation beyond raw authored structure
- schema and expression-driven rewrites that are deterministic given rules version, plan, and available inputs
- derivation of logical properties and constraints from author intent and schema facts
- logical alternative exploration for equivalent plans
- cost-model interfaces used to compare logical alternatives
- provenance and explain mappings from rewritten logical artifacts back to authored intent

`Session` **must** own:

- backend capability discovery and backend-specific planning policy
- catalog or source statistics acquisition
- pushdown policy into concrete scans or remote engines
- physical operator selection
- runtime statistics gathered during execution
- safe-checkpoint and completed-work tracking
- the decision to request bounded Prism re-entry
- target-local adaptive planning and physical changes during execution

Prism **must not** own:

- backend-specific pushdown outcomes
- physical operator choice
- runtime observation collection
- safe-checkpoint detection or direct mutation of a running target plan
- direct catalog I/O for statistics discovery as a normative responsibility
- longitudinal evidence storage, operational-cause interpretation, alerting, or automated response

### 2. Statistics model

This RFC distinguishes three statistics families:

1. **Logical inferred facts** — bounds or properties Prism derives from schema, constraints, and expressions.
2. **Pre-execution source statistics** — row counts, NDV estimates, histograms, file sizes, partition metadata, or equivalent facts supplied through `Session` and its backend or catalog integrations.
3. **Runtime statistics** — observed row counts, partition sizes, skew signals, spill facts, and other execution-time measurements.

Ownership rules:

- Prism **may** consume all three evidence families through a provider-neutral immutable planning context when they are available and applicable to the planning request.
- Prism **must** be able to produce a valid logical result even when only logical inferred facts are available.
- `Session`, adapters, compilers, offline tools, test harnesses, and client-built evidence providers **may** supply the same planning-context contract.
- Runtime statistics **must** retain the provenance and authority of the session or execution system that collected them even when an external provider later retains and supplies them.
- External providers **may** retain estimates and observations across executions or sessions, but every supplied item **must** preserve producer, authority, plan or relation identity, target and configuration, parameter and data scope, freshness, confidence, and invalidation state.
- Prism **must not** retrieve or persist planning evidence, special-case a provider's identity, or reclassify estimates and observations as authored semantic truth.

### 3. Cost-based optimization

Cost-based optimization in IncQL is split across Prism and `Session`:

- Prism **should** compare logical alternatives using a stable cost interface over logical properties, available statistics, and backend capability hints.
- Any conforming planning-context provider **may** provide the statistics and capability inputs Prism needs to make better logical choices.
- The exact cost model is not standardized by this RFC, but the ownership boundary is.

Inference from this boundary: if IncQL later adds join reordering, memo-based exploration, or reuse/materialization decisions, those features belong primarily in Prism, but they rely on inputs that `Session` can provide.

### 4. Adaptive execution and Prism re-entry

The adaptive execution lifecycle is a `Session` or coordinator concern. Relational reasoning over newly supplied evidence remains a Prism concern.

That means:

- Prism may produce a preferred logical plan or ranked alternatives before execution.
- `Session` or a target engine may revise target-local physical strategy during execution based on runtime statistics.
- At an explicit safe checkpoint, `Session` or another coordinator may invoke the same Prism engine with an immutable snapshot of applicable observations, completed-work references, unfinished roots, a bounded planning budget, and a legal fallback.
- Prism may return a new logical or placement selection only for unfinished work; it does not monitor execution or mutate a running target plan.
- `Session` may record target-local adaptive decisions and coordinator-requested Prism selections in `executed_plan()` or equivalent explain surfaces.
- Adaptive behavior **must not** mutate Prism-authored history or turn observations into authored semantics.

### 5. Illustrative plan-stage vocabulary

Implementations **should** expose distinct names for plan stages rather than one ambiguous “optimized plan” API, but this RFC does **not** standardize one exact public explain surface yet.

Illustrative names:

- `raw_plan()`
- `analyzed_plan()`
- `plan_after_incql_rules()`
- `session_plan()`
- `executed_plan()`

Equivalent names are acceptable if they preserve the same separation. The exact public placement of these surfaces remains follow-on design work and is not a blocker for RFC 004.

### 6. Precedence against older RFCs

RFC 007 remains authoritative for:

- Prism as IncQL's internal planning substrate
- immutable authored state
- structural sharing
- lineage and optimized-to-authored provenance expectations

This RFC supersedes RFC 007 only where RFC 007's optimizer examples or broad wording would otherwise imply that Prism owns backend pushdown policy, physical planning, statistics ownership, or adaptive re-planning.

RFC 004 remains authoritative for:

- the existence and core shape of `Session`
- execution and collection entry points
- backend abstraction and DataFusion as the default reference backend

This RFC narrows RFC 004 by making the optimizer boundary more explicit; where optimizer ownership is discussed, this RFC governs.

RFC 066 is the follow-on north-star contract for one Prism reasoning engine operating in pre-execution and adaptive re-entry modes, provider-neutral planning evidence, bounded memo exploration, and coordinator-owned adaptive invocation. This RFC remains authoritative for the execution ownership split; RFC 066 governs the stronger Prism reasoning and evidence-ingress contract.

## Design details

### Syntax

This RFC introduces no new author-facing syntax.

### Semantics

As Prism evolves beyond the initial implementation slice, the intended logical stack is:

- raw authored DAG
- analyzed logical plan with resolved references and derived properties
- Prism-owned logical rewrite stages
- optional logical alternative exploration and cost comparison
- `Session` handoff for backend planning and execution

Prism's optimizer legality **must** continue to derive from IncQL semantics, schema facts, and expression rules rather than backend quirks.

Any conforming caller **may** pass backend capability hints, estimates, and applicable observations into Prism through an immutable planning context, but those inputs **must not** collapse the ownership boundary defined above.

### Interaction with other IncQL surfaces

- **`DataSet[T]` APIs:** carrier method chains continue to build Prism-managed authored state. Stronger optimization does not change carrier immutability rules.
- **`query {}`:** query-block lowering should target the same Prism analysis and rewrite pipeline as method chains.
- **Pipe-forward (`|>`):** if shipped, desugared forms must enter the same Prism optimizer boundary rather than defining a parallel optimizer path.
- **Substrait boundary:** Substrait remains the normative interchange contract. This RFC governs how Prism and `Session` arrive at plans around that boundary; it does not replace RFC 002.

### Compatibility / migration

This RFC is additive at the API and architecture level:

- It does not require authors to change query syntax.
- It does not require RFC 007 to be rewritten.
- It may require documentation and future implementation work to stop referring to all optimization as one undifferentiated Prism responsibility.

Existing prototype APIs that use vague names like `optimized_view` remain acceptable as transitional implementation details, but future public-facing documentation **should** migrate to more precise stage names.

## Alternatives considered

- **Keep RFC 007 as the only optimizer RFC** — rejected; RFC 007 already serves as the Prism adoption record for the first implementation slice, and retrofitting a more detailed optimizer boundary into it would mix historical adoption work with the follow-on architecture.
- **Move all optimization to `Session`** — rejected; that would reduce Prism to a plan container and make IncQL-owned semantic optimization too backend-dependent.
- **Move the adaptive execution lifecycle into Prism** — rejected; observation collection, safe checkpoints, completed work, failure handling, and physical mutation remain session-, coordinator-, or target-owned. Prism may be explicitly re-invoked as the logical reasoning engine over immutable unfinished work.
- **Treat statistics as purely backend-private** — rejected; Prism needs a clean way to consume statistics if it is going to perform serious cost-based logical optimization.

## Drawbacks

- Adds another foundational RFC and another precedence edge contributors must understand.
- Commits IncQL to a sharper optimizer vocabulary earlier than a minimal prototype would require.
- Memo-based exploration, property inference, and stats plumbing will increase implementation complexity once work begins.

## Layers affected

- **IncQL specification** — RFC 004 and RFC 007 references to optimization ownership **should** stay consistent with this boundary.
- **IncQL library package** — future Prism internals **should** separate authored, analyzed, and rewritten artifacts more explicitly than the current prototype does.
- **Execution / interchange** — `Session` and backend integration layers **must** own physical planning, runtime-observation collection, safe checkpoints, and target-local adaptation; Prism may consume provider-neutral immutable evidence when invoked.
- **Documentation** — explain surfaces and architecture notes **should** stop using “optimized plan” as an undifferentiated term.

## Design Decisions

- **Boundary-first scope:** RFC 008 settles Prism versus `Session` ownership first. It does not attempt to finish the statistics, CBO, or adaptive execution architecture before RFC 004 begins.
- **Statistics ownership split:** Prism may use logical inferred facts and estimates or observations supplied through the provider-neutral planning context. Runtime observations retain their execution producer's provenance and authority and must not become Prism-authored facts.
- **Explain/API scope:** Distinct authored, analyzed, rewritten, session, and executed stages are part of the intended mental model, but the exact public API names and attachment points remain illustrative in this RFC.
- **Cross-execution evidence boundary:** Runtime-derived information retains the collecting execution system's provenance and authority, while an external provider may retain and later supply it through the provider-neutral immutable planning-context contract. Prism does not own that storage, and retained evidence must not mutate authored history or be reclassified as semantic truth.
- **Deferred follow-on design:** A follow-on contract may define the concrete planning-context transport, cost interfaces, memo machinery, adaptive checkpoint mechanics, and public explain surfaces without changing the ownership boundary settled here.
