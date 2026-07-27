# IncQL RFC 066: Prism relational reasoning and shared-work optimization

- **Status:** Draft
- **Created:** 2026-07-26
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 001 (bounded and unbounded dataset carriers)
  - IncQL RFC 004 (execution context)
  - IncQL RFC 007 (Prism logical planning and optimization engine)
  - IncQL RFC 008 (optimizer boundary, statistics, cost-based optimization, and adaptive execution)
  - IncQL RFC 027 (relational evidence program)
  - IncQL RFC 030 (Prism lineage graph)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 037 (plan diff and blast-radius inputs)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 041 (Prism plan ingress and external client frontends)
  - IncQL RFC 047 (semantic evidence graph and agent query surface)
  - IncQL RFC 048 (cluster execution backend mode)
  - IncQL RFC 065 (Polyglot SQL AST ingress and dialect-aware egress)
- **Issue:** —
- **RFC PR:** [IncQL #105](https://github.com/encero-systems/IncQL/pull/105)
- **Written against:** Incan v0.5-era IncQL
- **Shipped in:** —

## Summary

This RFC makes Prism IncQL's standalone relational reasoning engine operating in two temporal modes: pre-execution planning and bounded adaptive re-entry. Both modes use the same authored graph, semantic rules, memo, property model, and explanation contract across local, cluster, bounded, and continuous execution. Prism must preserve immutable authored relational intent while separately maintaining a bounded memo of semantically legal alternatives, their required properties, and the evidence that makes each alternative legal. Prism must produce a valid logical result without a `Session`, adapter, target context, or evidence provider. When any caller supplies a provider-neutral immutable planning context, Prism may additionally select target-aware logical, placement, exchange, and sharing alternatives. A coordinator may later invoke that same Prism engine with scoped runtime observations to reconsider unfinished bounded work or future continuous work without mutating authored history, committed progress, or completed execution. Target lowerers, `Session`, adapters, and target optimizers remain responsible for representation-specific lowering, physical planning, runtime adaptation, state lifecycle, and execution. Graph-shaped data may enter this model only through explicit typed graph and recursion semantics; Prism's plan DAG, memo, lineage graph, and evidence graph must not be mistaken for a graph-query data model. This is a north-star optimizer contract across supported frontends, declared consumer sets, and heterogeneous targets; SQL CTEs, DataFusion plans, Spark plans, streaming operator graphs, graph-engine plans, and other target representations are not Prism's semantic core.

## Core model

1. **Authored Prism graph.** Immutable relational intent, source provenance, schema and lineage evidence, policy constraints, and author-visible names live here. This graph is never replaced by an optimizer choice.
2. **Optimization memo.** The memo groups semantically equivalent relational expressions. Each alternative records its derivation, legality conditions, and required properties; it does not overwrite authored intent.
3. **Planning scope.** Every optimization request declares its roots, consumer set, bounded or continuous horizon, semantic and policy profile, and applicable resource budget. One query, several outputs, one scheduled run, a continuous execution, and a recurring workload are distinct scopes.
4. **Planning evidence.** Declared or inferred facts, pre-execution estimates, and runtime observations remain distinct, immutable evidence classes with provenance, authority, scope, freshness, confidence, and invalidation state. Any caller may supply the provider-neutral context; Prism neither retrieves nor persists it.
5. **Standalone logical selection.** Without target facts, Prism selects only alternatives whose legality follows from authored semantics and target-independent evidence. Unknown target capabilities constrain selection; they do not prevent planning.
6. **Target-aware logical selection.** Given an optional immutable context containing target profiles, capabilities, budgets, statistics, policy facts, and candidate placements, Prism may select logical realization, placement, exchange, and sharing alternatives. Reuse may mean inlining, target-local sharing, transient materialization, durable reuse, or no sharing.
7. **Target realization.** A coordinating caller and target lowerer realize the selected logical and placement plan through an interchange or adapter contract. A generated SQL CTE is one possible realization of selected sharing; SQL is neither required at ingress nor privileged at egress.
8. **Bounded adaptive re-entry.** `Session` or another coordinator owns runtime observations and decides whether an explicit safe checkpoint permits replanning. It may invoke the same Prism engine over unfinished bounded work or the future portion of continuous work with a new immutable planning context. The new selection must preserve completed results or the committed stream frontier, compatible state, snapshot and policy guarantees, and a legal fallback.

## Motivation

The same relational work can arrive from Incan carriers, query blocks, SQL, protocol clients, Delta-like sources, or future data-product interfaces. It can then be executed by an embedded engine, emitted as remote SQL, or split across sources. A fixed sequence of local rewrites cannot reliably choose among join order, predicate movement, sharing, materialization, source pushdown, placement, and exchange when these choices interact. Unbounded exploration is not an acceptable answer either: sufficiently large transformation graphs can make optimizer time and memory the dominant cost.

Execution topology and data boundedness affect different parts of that problem. Local and cluster execution must preserve the same relational meaning, while distributed targets make placement, partitioning, exchange, locality, skew, and failure boundaries materially affect plan selection. Bounded and unbounded relations share one relational language, but an unbounded relation also carries temporal, update, state, and progress semantics that can make a batch-legal rewrite invalid for a stream.

Graph-shaped data introduces another distinction. A Prism plan, lineage artifact, or evidence projection is structurally a graph, but that does not define property-graph or recursive-query semantics over user data. Graph pattern matching, traversal, reachability, path selection, and iterative algorithms require explicit node and edge identity, direction, labels or types, path semantics, recursion or fixpoint behavior, termination, and result-shape rules. Some can lower to relational work; none should be assumed equivalent merely because vertices and edges can be stored in tables.

CTE-heavy transformation SQL makes the limitation visible. A CTE is an authoring and target-language construct, not proof that a relation should be materialized or even shared during execution. Conversely, an Incan-authored shared subframe may merit a generated CTE for PostgreSQL egress even though no SQL appeared at ingress. The optimizer needs to reason about relational equivalence and execution choices independently of either source or target syntax.

Spark Catalyst is important prior art. It demonstrates that SQL and typed APIs can converge on a logical plan, that reusable rule infrastructure can optimize that plan, and that runtime statistics can improve physical decisions through adaptive execution. The Prism opportunity is not to repeat that architecture for another engine. It is to reason across declared transformation roots and heterogeneous candidate targets before engine-local planning, and to accept scoped observations back without taking ownership of a target's physical optimizer.

Prism already establishes immutable authored planning, structural sharing, and lineage as IncQL responsibilities. RFC 008 establishes that `Session` owns runtime statistics and adaptive execution while Prism remains the logical owner. This RFC supplies the missing north-star contract: how Prism explores alternatives within explicit budgets, retains legality and provenance, selects shared work, accepts immutable evidence snapshots, and explains its decisions without making a backend optimizer the semantic authority.

## Goals

- Define a durable separation between authored relational intent, explored alternatives, selected logical or placement plans, and target realization.
- Require bounded memo-based representation of equivalent relational expressions rather than irreversible rewrite sequencing as the sole optimization model.
- Require every planning request to declare its roots, consumer set, planning horizon, semantic profile, and applicable resource budget.
- Require Prism to produce a valid target-independent logical result without a `Session`, adapter, or supplied target context.
- Make shared-work selection a first-class optimizer decision across all frontends and targets.
- Make local execution the one-placement case of the same target-aware model used for distributed placement and exchange.
- Require boundedness, update mode, temporal progress, and state requirements to participate in legality for continuous work rather than enter as backend-only costs.
- Preserve a deliberate boundary between graph-shaped Prism metadata and graph-query semantics, while allowing explicitly typed graph and recursive work to participate in the memo when its equivalence rules are proven.
- Require rewrite legality to be backed by explicit semantic, profile, capability, policy, and property evidence.
- Distinguish declared or inferred facts, pre-execution estimates, and scoped runtime observations without treating estimates or backend behavior as semantic truth.
- Require an open, provider-neutral evidence-ingress contract that clients and tools may implement without giving Prism a live storage or service dependency.
- Permit coordinator-owned adaptive replanning of unfinished bounded work or future continuous work through a new immutable Prism planning context.
- Require bounded search, inspectable pruning, graceful fallback, and planning-cost evidence as part of optimizer correctness.
- Require an explainable path from the authored graph through considered alternatives to the selected logical or placement plan, its target realization, and any later adaptive selection.
- Keep Substrait as interchange, Session and adapters as execution owners, and SQL AST tooling at frontend or egress boundaries.

## Non-Goals

- Defining a universal claim that IncQL will outperform database optimizers or all generated SQL.
- Claiming that Catalyst, DataFusion, PostgreSQL, or another optimizer fails on large plans without reproducible workload evidence.
- Treating every SQL CTE, repeated subgraph, or named model as a mandatory materialization boundary.
- Making a generated CTE equivalent to a durable materialized view, cache entry, or authored relation name.
- Replacing a target's physical optimizer, transaction semantics, catalog, or runtime adaptive behavior.
- Adopting Spark Catalyst, Apache Calcite, `optd`, an e-graph library, or any other optimizer implementation as a required dependency.
- Standardizing one complete cost formula, storage implementation, or public optimizer API in this RFC.
- Allowing a target parser, target execution result, or opaque backend rewrite to establish IncQL relational semantics.
- Requiring Prism to depend on a live `Session`, adapter instance, catalog connection, or execution environment.
- Giving Prism ownership of execution scheduling, safe-checkpoint detection, target-local physical adaptation, or completed execution state.
- Defining a cluster scheduler, streaming runtime, state store, checkpoint transport, trigger API, or sink-commit implementation.
- Defining a complete property-graph, RDF, or graph-query language; a graph storage engine; graph indexes; or a graph algorithm library.
- Giving Prism ownership of cross-execution evidence storage, operational-cause interpretation, alerting, incident classification, or automated response.

## Guide-level explanation (how authors think about it)

Authors continue to compose relations normally. They do not need to write a CTE or select a materialization mechanism merely to express reused relational work.

```incan
orders = session.table("orders")?
paid_orders = orders.filter(.status == "paid")
orders_with_customers = paid_orders.join(customers, on=.customer_id)
regional_summary = orders_with_customers.group_by(.region).aggregate(total=.amount.sum())
customer_detail = orders_with_customers.select(.customer_id, .region, .amount)
```

`regional_summary` and `customer_detail` share `orders_with_customers` as authored intent. Prism must keep that relationship visible. Without target facts, Prism can still reason about their equivalence and shared provenance while retaining a portable logical result. When a caller supplies target facts, Prism may select inlining, target-local sharing, or an eligible materialization requirement; a target lowerer may then realize selected sharing as one SQL CTE referenced by both consumers. The right answer depends on available evidence, and authored code does not silently acquire a materialization guarantee.

The same model applies to a SQL frontend. A dbt-like statement with many CTEs may be decoded into ordinary scoped Prism relations. Those names preserve provenance and lexical meaning, but Prism may select a logical plan with fewer, more, or no shared relations when that is semantically valid, and a SQL target lowerer may encode those choices with fewer, more, or no CTEs when the target profile supports that realization. An emitted PostgreSQL CTE is therefore a rendering of a selected Prism sharing decision, not a requirement that the input was SQL.

An inspection surface should let an author ask why the plan differs from the authored graph: which equivalence rules were considered, what properties were required, why a shared candidate was rejected or selected, what cost facts were available, and what target-specific representation was finally emitted.

Runtime evidence extends this explanation without rewriting it. Suppose a target reports at a safe execution checkpoint that a filtered relation produced far fewer rows than estimated. `Session` may retain the completed stage, construct an immutable observation snapshot, and ask Prism to reconsider the unfinished consumers. Prism may return a new legal join, placement, exchange, or sharing selection when the observation's plan target, data snapshot, parameter shape, semantic profile, and policy context apply. If those preconditions do not hold, or if the planning budget is exhausted, execution continues through the previously selected legal fallback.

The target may also adapt internally. Spark AQE, for example, may change a Spark-local join or shuffle strategy without invoking Prism. IncQL should record that realized and adapted plan when the adapter exposes it, but Prism does not claim authorship of the target's physical decision.

## Reference-level explanation (precise rules)

### One reasoning engine in two temporal modes

Prism must use one relational reasoning contract for pre-execution planning and bounded adaptive re-entry. Both modes must use the same authored graph, semantic-profile rules, equivalence and property model, evidence classification, search-budget contract, and explanation vocabulary. An adaptive invocation is a new planning event with additional scoped evidence and an explicitly limited unfinished-work surface; it is not a second optimizer and must not weaken rewrite legality.

### Authored intent and the memo

Prism must retain an immutable authored graph as the source of IncQL relational intent. The graph must preserve authoring and ingress provenance, semantic targets, lineage inputs, declared policy constraints, and all facts necessary to explain source-level bindings. An optimization decision must not mutate this graph or discard its relationship to the selected plan.

Prism must represent explored relational alternatives separately from the authored graph. A memo equivalence group must contain only expressions that are semantically interchangeable under the recorded semantic profile and required properties. An alternative must record the rule or derivation that introduced it and the evidence or conditions under which it is legal. A planner may stop exploration early, but it must not present unexplored alternatives as impossible or semantically invalid.

Each optimization request must declare the authored roots and consumers included in the decision, whether the horizon is one query, several outputs, one execution, or a recurring workload, and the lifetime for which a selected reuse or materialization decision may remain valid. Prism must not infer project-wide or cross-execution authority from structural reachability alone.

### Planning scope and tractability

Memo exploration must be bounded by an explicit planning budget. The budget may constrain elapsed work, alternatives, memory, rule applications, or another stable resource measure, but it must be inspectable and must not change relational legality. When exploration stops, Prism must return the best known legal alternative or a structured failure when no legal alternative exists. It must record which budget was exhausted, which alternatives were pruned or left unexplored, and which fallback was selected.

Prism must support reproducible planning for the same authored graph, planning context, rule set, and deterministic budget mode. When a nondeterministic wall-clock budget or concurrent exploration affects the result, the explain artifact must identify that condition. Optimizer wall time, memory, memo growth, and plan stability are first-class observations; planning cost must be considered when deciding whether further exploration or adaptive replanning is worthwhile.

### Properties, requirements, and legality

Every alternative considered for selection must carry, derive, or reference the properties required to use it correctly. The property vocabulary must be able to express, where relevant: output schema and nullability; key and uniqueness facts; ordering; partitioning or locality; boundedness; append, update, upsert, or retraction behavior; event-time and processing-time domains; watermark or other progress guarantees; bounded-state requirements; graph node and edge identity; direction, labels or types, path and recursion semantics; source and connector capabilities; determinism and volatility; policy and admissibility constraints; dialect or adapter requirements; cardinality, size, rate, degree, frontier, and iteration estimates; and the provenance of each fact.

A rewrite must not rely on a property that is absent, unknown, contradicted, or valid only under a different semantic profile. A semantic profile must express every dimension on which a rewrite depends, including where relevant bag semantics and duplicates, null behavior, ordering and top-k, decimal and temporal behavior, collation and time zone, overflow and error behavior, function identity, parameter shape, volatility, transaction snapshot, stream update mode, event-time and watermark behavior, late-data handling, replay and delivery guarantees, and authorization context.

Planning evidence must distinguish:

- **Declared or inferred facts:** authored declarations or properties derived logically from schemas, constraints, expressions, and policy.
- **Pre-execution estimates:** catalog, source, profile, or target estimates such as row counts, distinct values, histograms, file sizes, partition metadata, event rates, state growth, and expected costs.
- **Runtime observations:** actual execution evidence such as rows, bytes, rates, selectivity, skew, shuffle, spill, memory, state size, watermark progress, lag, backpressure, checkpoint behavior, failures, and realized target decisions.

Estimated and observed facts may inform ranking, but they must not be reclassified as authored semantics. Every estimate or observation must identify its producer, plan or relation target, data snapshot or freshness boundary, parameter shape when relevant, semantic profile, target configuration, collection time, confidence or exactness class, and invalidation state. Unknown or stale evidence must remain explicit.

Planning evidence is an optional input to Prism and must be supplied as an immutable, provider-neutral planning context rather than discovered through a live adapter, catalog, storage, or service dependency. `Session`, adapters, compilers, offline planning tools, static profiles, test harnesses, and client-built evidence providers may supply the same contract. Prism must interpret evidence according to its declared class, authority, provenance, scope, freshness, confidence, and invalidation state rather than special-case the identity of its provider. Supplied evidence must not mutate authored intent.

Historical estimates and observations may rank or prune semantically legal alternatives but must not establish rewrite legality. Current capability, authorization, and policy facts may constrain target realizability only when their authority and applicability are explicit. Prism must remain independently useful when no planning context is supplied.

### Shared work and materialization

Prism and the target realization boundary must preserve the distinction among these choices:

- **Inline:** independently include an equivalent relation at each consumer.
- **Target-local share:** evaluate one relation once within a target plan and route it to multiple consumers.
- **Target SQL CTE:** a SQL target lowerer expresses a selected target-local share as a common table expression when the selected SQL profile permits it.
- **Transient materialization:** create an execution-scoped stored result subject to resource, lifetime, freshness, and cleanup rules.
- **Durable result reuse:** substitute a stored result only when identity, freshness, policy, authorization, and invalidation evidence permit it.

These choices have different semantics and operational effects. A target SQL CTE must not be represented as a durable materialization merely because it has a name. A shared authored subgraph must not imply that sharing is selected. Conversely, the planner may select sharing for equivalent work that arrived through separate frontends when identity and legality evidence establish equivalence.

Prism must distinguish an optimization preference to reuse deterministic work from a semantic requirement to evaluate work no more than once. Volatile, nondeterministic, erroring, stateful, or snapshot-sensitive expressions may make evaluation multiplicity observable. A selected once-only requirement must be represented as a required property. A target lowerer must not claim that a SQL CTE, reused exchange, cache, or other representation satisfies that property unless the active target profile establishes the guarantee.

Target-aware selection of sharing or materialization must consider consumer count, downstream specialization that may be lost by sharing, estimated rows and bytes, source cost, target capabilities, resource budget, determinism, freshness, policy, and target-specific cost. In the absence of required target facts, Prism must retain a legal target-independent alternative rather than assume that a sharing or materialization mode is available. An automatic selection must be explainable with the considered alternatives and the facts that influenced the choice. An implementation may expose an explicit author request for a sharing mode, but it must diagnose or reject requests that the active profile cannot honor.

Transient or durable materialization must additionally identify result identity, data snapshot and freshness, authorization and tenancy scope, storage placement, maintenance responsibility, invalidation, failure recovery, cleanup or garbage collection, lineage, and the cost of maintaining the result. Prism may rank an eligible materialization alternative, but the coordinating caller and execution owners must establish and enforce its operational lifecycle.

### Target-aware planning and realization

Prism's target-aware planning must start from Prism-owned relational semantics. It may select different logical, placement, exchange, and sharing alternatives for different declarative target contexts. A target context is optional and may be supplied by `Session`, a compiler, an offline planning tool, a static profile, or a test harness. Prism must not require a `Session` or live adapter instance, discover capabilities or bindings through adapter calls, or own adapter lifecycle.

After Prism selects a logical or placement plan, a coordinating caller chooses the applicable realization boundary and invokes the target lowerer. The same authored relation may then lower to a Substrait plan for one adapter, a generated Polyglot SQL AST for PostgreSQL, or a multi-fragment plan with explicit exchange boundaries. Target-specific lowering must not use source SQL text, a target SQL parser, or backend execution success as a substitute for semantic mapping.

SQL CTE factorization is a target representation decision governed by RFC 065. A SQL egress implementation may construct a CTE from an eligible shared Prism subgraph even when the plan originated from an Incan carrier, protocol frontend, or non-SQL source. It may also inline a relation that originated as a SQL CTE. The generated form must remain within the selected dialect profile and preserve the selected Prism semantics.

Substrait remains the normative interchange contract where it is the chosen boundary. `Session`, target lowerers, adapters, and target optimizers own binding, representation-specific lowering, physical planning and execution, runtime adaptation, and backend-specific realization. Prism may provide ranked logical or placement alternatives, selected sharing requirements, and required-property evidence, but it must not claim ownership of a target's unexposed physical choices.

A target optimizer may revise the representation it receives. The execution evidence model must distinguish Prism's selected requirements, the lowered target input, the target's initial realized plan, and any later adapted plan when those surfaces are available. Binding semantic or policy requirements must remain enforceable constraints. Cost preferences may be advisory. If a target cannot realize a binding requirement, the realization layer must request another legal Prism alternative or return a structured unsupported diagnostic; it must not silently weaken the requirement.

Spark Catalyst and AQE are canonical examples of this boundary. Prism may select that a fragment execute on Spark and may require an exchange, ordering, partitioning, or sharing property. Catalyst remains responsible for Spark-local logical and physical refinement, and AQE remains responsible for Spark-local adaptive physical changes. IncQL may consume the resulting observations as later evidence without claiming that Prism selected those physical operators.

### Distributed and continuous execution

Cluster mode must not introduce a second Prism semantic model. A single-node target is the one-placement case: its planning context may establish that no network exchange is needed. A distributed target may expose eligible placements, locality, partitioning, exchange capabilities, resource envelopes, failure boundaries, and estimated network or serialization costs. Prism may use those facts to select logical placement and required exchanges, but scheduler topology, task assignment, shuffle realization, retries, recovery, and worker lifecycle remain target or coordinator responsibilities under RFC 048.

Bounded and unbounded carriers likewise share one relational core, but boundedness is a semantic property rather than a target hint. A continuous plan must preserve the RFC 001 capability boundary and must record any update or changelog mode, time domain, watermark or other progress contract, state bound, late-data policy, replay behavior, and sink requirements on which legality depends. Prism must reject or leave unexplored a rewrite whose state remains unbounded, whose output-update behavior cannot satisfy its consumers, or whose movement across a temporal boundary changes observable results.

Shared work over a stream may mean a shared target operator and evolving state, not a completed relation, SQL CTE, or reusable materialized result. Prism may select a logical sharing requirement only when consumer time, update, state, policy, and failure properties are compatible. The target runtime owns the physical operator, state store, checkpoint, backpressure, and recovery mechanisms and must report whether it can realize the selected requirements.

Continuous adaptive re-entry occurs only at a coordinator-established barrier such as a compatible checkpoint, epoch, or watermark frontier. The planning request must identify the committed input and output frontier, state identities and schemas, future roots, and whether state can be reused, migrated, rebuilt, or must remain attached to the existing target plan. Prism may change only future processing. It must not reinterpret already committed output, silently discard state, or claim that a target checkpoint is semantically compatible without supplied evidence.

### Graph-shaped data and recursive reasoning

Prism's authored plan graph, optimization memo, RFC 030 lineage graph, and RFC 047 evidence graph are different graph-shaped artifacts with different authority. None of them is automatically a user-queryable property graph, RDF graph, or graph execution plan. Implementations must keep those identities and semantics separate.

A graph frontend or API may map a graph view to typed vertex and edge relations plus explicit graph operators or recursion when its profile defines node and edge identity, direction, labels or types, property access, duplicate-edge behavior, null and missing-property behavior, path result shape, and the distinction among walks, trails, and simple paths. Reachability, shortest-path, pattern matching, and iterative algorithms must additionally define termination, cycle handling, ordering or tie behavior, and any approximate-result contract. If those facts are missing, Prism must report unsupported or unknown semantics rather than lower the request to ordinary joins and assume equivalence.

Graph-aware memo rules may use relational joins, recursive or fixpoint operators, factorized intermediates, adjacency-aware access requirements, or a graph-target alternative. Legality and cost remain separate: an encoding may be relationally correct yet perform poorly because repeated joins lose adjacency, path, or frontier structure. Target-aware ranking may therefore consume degree distributions, frontier sizes, graph partitioning and cut estimates, iteration or convergence evidence, available graph indexes, and target recursion capabilities without making those estimates semantic truth.

Shared graph work may mean reusing a graph projection, traversal frontier, reachability relation, iterative state, or target index. Each choice requires explicit identity, lifetime, update, freshness, policy, and failure semantics. For dynamic graphs, a continuous replan must preserve committed graph updates and any compatible fixpoint, frontier, visited-set, or path state; otherwise it must decline the replan or select an explicit rebuild.

### Runtime observations and bounded replanning

`Session` or another coordinating caller owns execution attempts, runtime observations, safe-checkpoint detection, and the decision to request replanning. Prism must not monitor a live execution or mutate a running target plan directly.

At a safe checkpoint, the coordinator may invoke Prism again with the original authored graph, the applicable unfinished roots and consumers or future continuous frontier, completed-work or committed-progress references, and a new immutable planning context containing runtime observations. The request must identify the plan and execution attempts from which observations came and must prove that their snapshot or stream frontier, freshness, parameter, semantic-profile, target, authorization, and policy scopes apply to the work being reconsidered.

Prism may select a new logical, placement, exchange, sharing, or materialization alternative only for unfinished bounded work or future continuous work. It must treat completed work as an immutable available result and committed streaming progress and compatible state as fixed inputs with explicit properties and lifecycle. It must preserve externally visible ordering, transaction, update, time, watermark, replay, and sink-commit guarantees and retain the provenance path from the new selection to both authored intent and prior execution.

Every adaptive request must have a planning budget and a previously established legal fallback. If evidence is stale, contradictory, out of scope, or insufficient; if no safe checkpoint exists; or if the expected opportunity does not justify replanning cost, the coordinator must continue with the fallback or fail according to its execution contract. Declining to replan is an inspectable decision, not an optimizer failure.

Runtime observations may also inform a later planning invocation when a caller supplies them through the same immutable planning-context contract. Collection, storage, retention, normalization, and retrieval remain outside Prism. An external provider may retain evidence across executions or sessions, but every supplied observation must still prove applicable identity, authorization, provenance, scope, freshness, confidence, and invalidation. Cross-execution reuse must not transform an observation into authored history, timeless statistics, or semantic truth. This provider-neutral consumption rule amends RFC 008's earlier session-scoped retention restriction while preserving `Session` ownership of observation collection and the adaptive execution lifecycle.

### Explainability and evidence

For every selected logical or placement plan, IncQL must be able to produce inspectable evidence linking the selected relation to authored intent. The evidence must identify the declared roots, consumers, planning horizon, rule set, search budget, and whether planning context was absent or supplied. When context was supplied, it must identify its semantic profile, target identities, evidence producers and authority, evidence classes, and freshness or invalidation state. It must also identify equivalence alternatives considered, rules and evidence used to establish legality, required properties, estimated cost inputs and their provenance, selected sharing or materialization mode, pruned or unexplored alternatives, planning cost, and applicable execution observations when available.

When a target realizes or adapts a plan, the evidence must distinguish the selected Prism requirements from the lowered target input, initial target plan, and adapted target plan where available. When Prism is invoked again, the evidence must identify the safe checkpoint or continuous or recursive frontier, completed or committed work, unfinished or future work, state disposition, observation snapshot, fallback, replan budget, and reason the new alternative was selected or replanning was declined.

An implementation must distinguish semantic equivalence evidence from result-comparison evidence, plan-shape evidence, and performance evidence. Equal results on a fixture may support a test case but do not by themselves prove a general rewrite rule. A reduced source scan count in one target plan may support target-specific investigation but does not by itself establish a portable performance claim.

## Design details

### Syntax

This RFC introduces no required new author-facing syntax. Existing carriers, query blocks, and ingress frontends continue to express relational intent. Future author controls for materialization or optimization objectives must be specified separately and must not weaken the distinction between an author request and a planner-selected execution decision.

### Semantics

Prism has three conceptually distinct artifacts: authored intent, an optimization memo, and a selected logical plan. A planning invocation additionally has an explicit scope, immutable context, search budget, and explain record. Target-aware logical or placement selection is an optional derived view over the authored graph and memo, not a prerequisite for them. These artifacts may share immutable storage, but the observable contract must preserve their different roles. An optimizer may normalize, reorder, factor, or otherwise transform a relation only when the memo records an alternative that satisfies the same semantic requirements under the active profile.

The memo may contain target-independent logical alternatives and, when a target context is supplied, target-realizable candidates. Logical equivalence is independent of a particular backend. Target-realizable candidates additionally satisfy the supplied capabilities and required properties. Missing target facts must constrain target-dependent selection rather than prevent standalone planning. If the realization layer cannot realize a selected sharing mode, it must request another legal alternative or report a structured unsupported diagnostic; it must not silently erase policy, profile, or semantic constraints.

An adaptive Prism invocation is a new planning event over the original authored graph and explicitly identified unfinished bounded work or future continuous work. It produces a new selected plan and explain record; it does not overwrite the authored graph, prior memo evidence, prior selection, completed-work or committed-progress record, target state identity, or target execution observation.

Names and scoped bindings from a frontend are preserved as authored or ingress provenance. They are not, by themselves, target plan nodes. In particular, SQL CTE bindings may lower to ordinary lexical Prism subframes while the memo independently explores their inlining, sharing, or materialization. Recursive or data-modifying CTE semantics remain governed by their frontend profile and are not implied by this RFC.

### Interaction with other IncQL surfaces

- **Prism and carriers:** RFC 007 remains authoritative for immutable carrier construction and structural sharing. This RFC specifies the stronger optimizer model over that authored state.
- **Statistics and execution:** RFC 008 remains authoritative for the Prism versus Session execution boundary as amended by this RFC's provider-neutral evidence-ingress and adaptive re-entry contract. `Session` owns runtime-observation collection, safe-checkpoint policy, and the adaptive lifecycle. The memo may consume optionally supplied statistics and observations from any conforming provider through an immutable planning context; Prism does not require `Session` and does not own evidence storage, backend binding, physical planning, runtime monitoring, or mutation of running plans.
- **Boundedness and cluster execution:** RFC 001 remains authoritative for bounded and unbounded carrier capability gating. RFC 048 remains authoritative for local and cluster backend lifecycle, scheduling, checkpoint, watermark, offset, recovery, and sink-commit responsibilities. This RFC makes the properties that affect relational legality and Prism selection explicit without moving those runtime responsibilities into Prism.
- **Ingress:** RFC 041 remains authoritative for unresolved external plans and ingress coverage. All supported frontends must converge on Prism-authored semantics before memo exploration.
- **SQL boundaries:** RFC 065 remains authoritative for Polyglot AST mapping, SQL profiles, and dialect coverage. This RFC governs selected logical sharing requirements; RFC 065 governs whether and how a SQL target lowerer can encode them, not Prism's semantic core.
- **Evidence and inspection:** RFCs 027, 030, 032, and 033 govern complementary relational evidence, lineage, execution observations, and adapter coverage. RFC 032 observations remain session-owned execution artifacts. This RFC requires optimizer decisions and adaptive requests to link to those records rather than duplicate or replace them.
- **Graph-shaped evidence:** RFC 030's lineage graph and RFC 047's semantic evidence graph are inspection and evidence artifacts, not graph-query semantics or target execution plans. A future graph frontend may consume or produce related identities only through an explicit mapping that preserves the authority of each artifact.
- **Plan diff and blast radius:** RFC 037 governs local semantic plan diffs and blast-radius input artifacts. Prism explain and selected-plan evidence may feed those diffs, but organization-wide dependency discovery, production-impact interpretation, alerting, and response remain outside Prism.
- **Interchange:** RFC 002 remains authoritative for Substrait as the emitted contract. A selected logical or placement choice must remain valid when a coordinating caller lowers it through the chosen interchange or adapter contract.

### Compatibility / migration

This RFC is additive to existing authoring surfaces. Existing plans remain valid as authored graphs even before they participate in memo exploration. Implementations may initially offer fewer rewrite families or target choices, but they must represent unsupported exploration or target realization honestly rather than present a fixed rewrite sequence as the complete optimizer model.

Serialized artifacts and inspection surfaces may need versioned additions for planning scope, memo alternatives, property evidence, search budgets, selected-sharing records, observation snapshots, selected-versus-realized plan links, adaptive requests, and completed-work references. Readers that do not understand those additions must not infer that an omitted record means no optimization or adaptation occurred.

## Alternatives considered

- **A fixed sequence of rewrites only.** Rejected as the north-star architecture because it commits too early, obscures alternative choices, and cannot adequately model interactions among join ordering, sharing, and target requirements. Rule pipelines may still be useful as bounded memo exploration strategies.
- **Backend-owned optimization.** Rejected because backends differ, may not expose their reasoning, and cannot establish IncQL semantic or policy legality. Backends remain valuable execution targets and sources of observed evidence.
- **Treat Catalyst-style logical optimization as the differentiator.** Rejected because Spark already demonstrates typed logical optimization across SQL and DataFrame authoring. Prism's distinct responsibility is evidence-governed reasoning across declared transformation roots and heterogeneous targets before engine-local optimization.
- **One-shot planning only.** Rejected because cardinality, selectivity, skew, spill, and target behavior may become trustworthy only during execution. Replanning remains coordinator-owned and bounded; this rejection does not move execution lifecycle into Prism.
- **Let Prism own adaptive execution.** Rejected because safe checkpoints, completed work, runtime observations, failure handling, and physical mutation belong to `Session`, coordinating callers, and target engines. Prism is re-invoked as a planner over immutable inputs.
- **Let Prism own a longitudinal experience store.** Rejected because durable collection, retention, retrieval, tenancy, and operational interpretation are different responsibilities from relational reasoning. Prism instead accepts provider-neutral immutable evidence snapshots and remains useful without them.
- **Optimize only SQL CTEs.** Rejected because it confuses a source-language binding form with relational identity and excludes Incan-native, protocol, and cross-source plans.
- **Always materialize repeated work.** Rejected because materialization adds storage, freshness, scheduling, and lost-specialization costs and can be invalid under policy or target constraints.
- **Adopt an existing optimizer wholesale.** Rejected because memo, property, and cost concepts are useful research foundations, but IncQL must own its semantics, evidence, profiles, and adapter contracts.
- **Use equality saturation as the default substrate.** Rejected for the core architecture because unconstrained expansion can become intractable and relational alternatives require properties, target capabilities, and explainable cost selection. It remains a research option for bounded rewrite families.

## Drawbacks

- Memo exploration, property derivation, and explain evidence add substantial implementation and testing complexity.
- Incorrect or stale estimates can select poor plans even when all semantic rules are correct.
- Runtime observations can be highly specific to one snapshot, parameter shape, target configuration, or transient load and can mislead later planning when invalidation is weak.
- Adaptive replanning can add latency, memory pressure, and plan churn; safe checkpoints and fallback plans constrain but do not eliminate those costs.
- Bounded exploration may return a legal but suboptimal plan, while less restrictive exploration may make planning itself the bottleneck.
- Sharing and materialization require explicit resource, freshness, lifecycle, and cleanup policies that simple inlining avoids.
- A cross-target optimizer can expose meaningful behavior differences between engines that were previously hidden behind one adapter.
- Explainability records and reproducible benchmark harnesses impose storage and maintenance costs, but omitting them would make optimizer claims difficult to audit.
- Distributed and continuous planning multiply the property combinations and make safe adaptation depend on target evidence about exchange, progress, state, recovery, and commit behavior.
- Graph recursion, path semantics, and dynamic frontiers add rewrite and termination obligations that ordinary acyclic relational alternatives do not carry.

## Implementation architecture (non-normative)

An implementation should keep authored graph construction, semantic analysis, bounded memo exploration, optional target-aware logical selection, external target realization, execution observation, evidence retention, and adaptive invocation as distinct responsibilities. The authored graph should remain persistent and structurally shared. The memo should retain equivalence groups, derivation evidence, required properties, alternatives, pruning decisions, and budget state without turning target-specific physical details into authored nodes. A planning context should be an immutable provider-neutral input value, not a live `Session`, adapter, catalog, or evidence-service dependency. Prism should consume that optional context to produce a selected logical or placement alternative, its required properties, planning-cost evidence, and an explain artifact; a coordinating caller and target lowerer should then realize it.

For adaptive planning, the coordinator should retain completed-work or committed-progress references and establish a safe checkpoint before constructing a new immutable context from applicable observations. Re-entering Prism should produce another selected plan and explain artifact for unfinished bounded work or future continuous work. For streams, the context should also carry the committed frontier and target-supplied state compatibility or migration evidence. The target engine may continue to make local physical changes independently, and IncQL should link those realized plans to the Prism selection when the target exposes them.

Research and implementation should use a reproducible corpus that includes dbt-like CTE-heavy transformations, controlled analytical queries, scalable optimizer-stress graphs, graph-pattern and recursive workloads, local and cluster target modes, bounded and unbounded sources, target-native Catalyst/AQE and graph-engine baselines, adaptive evidence studies, and cross-target result checks. Evidence must compare semantically equivalent results, stream traces, or graph paths under a declared profile; authored and selected plan shapes; planning cost; target-realized and adapted plans; observed target metrics; and the provenance and invalidation state of estimates and observations. This architecture does not prescribe a single data structure or optimization algorithm.

## Layers affected

- **IncQL specification** — Prism must define authored intent, planning scope, memo alternatives, search budgets, property requirements, sharing modes, evidence classes, adaptive re-entry, selection evidence, and target-planning boundaries consistently with sibling RFCs.
- **IncQL library package** — Prism-facing APIs and inspection artifacts must preserve immutable authored state, accept immutable planning contexts, and expose selected-plan and replanning explanations without forcing a backend-specific API into authoring surfaces.
- **Execution / interchange** — `Session`, adapters, and external evidence providers may supply capability, statistics, and observation evidence with authority and provenance; coordinating callers own safe checkpoints, fallbacks, completed work, committed progress, state lifecycle, and adaptive invocation; target lowerers must receive selected Prism requirements without turning lowering behavior into semantic truth.
- **Frontend and egress integrations** — SQL, protocol, and other frontends must map to Prism before optimization; target emitters must realize selected plans only when their profile and coverage evidence permit it.
- **Documentation and research artifacts** — capability claims, benchmarks, and plan comparisons must distinguish semantic correctness, target-plan shape, and measured performance.

## Design Decisions

### Standalone Prism

Prism must construct, analyze, explore, and select a valid target-independent logical result without a `Session`, adapter, or target context. Missing target facts constrain target-aware choices but do not prevent planning.

### One engine, two temporal modes

Pre-execution planning and bounded adaptive re-entry are two invocation modes of the same Prism reasoning engine. They share authored semantics, memo and property rules, evidence classification, bounded search, and explanation; adaptive re-entry differs only in its scoped observations, completed-work or committed-progress references, state compatibility evidence when applicable, and unfinished or future planning surface.

### Open planning-evidence ingress

Target awareness and other optional evidence enter Prism only through a provider-neutral immutable planning context. `Session`, adapters, compilers, offline tools, static profiles, test harnesses, and client-built providers may supply that contract. Prism must apply the same evidence rules regardless of provider, remain useful without the context, and must not depend on provider live objects or take ownership of evidence storage, target discovery, binding, lowering, physical planning, or execution.

### Evidence progression

Declared or inferred facts, pre-execution estimates, and runtime observations are distinct evidence classes. Estimates and observations may rank legal alternatives but never become authored semantics. Their provenance, scope, freshness, confidence, and invalidation state are part of the planning input and explanation.

### Bounded optimizer

Prism optimization must have an explicit, inspectable search budget and legal fallback behavior. Planning wall time, memory, memo growth, pruning, and plan stability are first-class evidence. The North Star is not exhaustive search at any cost.

### Coordinator-owned adaptive lifecycle

`Session` or another coordinator owns runtime observations, safe checkpoints, completed work, committed progress, state lifecycle, target-local adaptation, and the decision to request replanning. Prism may be re-invoked with an immutable context to select unfinished bounded or future continuous logical or placement work, but it does not monitor or mutate live execution.

### One semantic core across execution modes

Local and cluster execution use the same Prism semantics; cluster facts expand placement, exchange, and cost choices without making scheduler mechanics portable semantics. Bounded and unbounded carriers also share the relational core, while boundedness, update, temporal-progress, and state requirements remain explicit legality properties. Continuous re-entry may change only future work at a supplied compatible frontier.

### Graph semantics are explicit extensions

Graph-shaped plans, lineage, and evidence do not by themselves establish graph-query semantics. Typed graph or recursive work may participate in Prism only through explicit identity, path, fixpoint, termination, and result contracts. Prism may compare relational and graph-target realizations when they satisfy the same declared semantics, but it must not flatten graph meaning into ordinary joins by assumption.

## Unresolved questions

- Which relational rewrite families have sufficiently precise semantic profiles, property requirements, and test or proof obligations to enter the first audited memo rule set?
- What is the minimum stable property vocabulary for ordering, partitioning, locality, keys, boundedness, update mode, temporal progress, state, evaluation multiplicity, volatility, policy, and target capability without overcommitting to one engine's traits?
- Which planning-scope vocabulary cleanly distinguishes a query, requested output set, transformation DAG, scheduled execution, continuous execution, and recurring workload?
- Which deterministic resource budgets, pruning rules, and fallback contracts keep memo exploration tractable while preserving useful plan quality?
- Which statistics and observation transport, confidence, and invalidation rules allow context evidence to be reused safely across planning sessions and targets?
- Which safe-checkpoint, committed-frontier, state-compatibility, and completed-work contracts permit a coordinator to re-enter Prism without violating transaction, snapshot, ordering, temporal, update, sink-commit, policy, or failure semantics?
- How should IncQL compare selected Prism requirements, lowered target input, initial target plan, and target-adapted plan across Catalyst/AQE, DataFusion, PostgreSQL, and future engines?
- What resource, freshness, identity, authorization, and cleanup contract is required before transient or durable materialization can be selected automatically?
- How should multi-fragment and cross-source sharing account for exchange cost, failure boundaries, and partial execution without importing orchestration semantics into Prism?
- Which stream rewrite families and state-sharing choices can be proven legal across append, update, upsert, and retraction modes, and how should their trace equivalence be tested?
- Which property-graph, recursive, and fixpoint semantics belong in Prism; which should remain frontend or target extensions; and what result, path, termination, and incremental-update evidence establishes equivalence across relational and graph-native realizations?
- Which explain artifact schema can remain stable while still exposing a growing memo and target-specific selection evidence?
- What reproducible workload scales, graph-complexity thresholds, target versions, and success criteria are required before an optimizer-tractability, target-specific sharing, adaptive-replanning, or CTE-factorization recommendation becomes a public performance claim?

<!-- Rename this section to "Design Decisions" once all questions have been resolved. An RFC cannot move from Draft to Planned until no unresolved questions remain. -->
