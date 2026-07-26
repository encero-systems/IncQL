# IncQL RFC 066: Prism relational reasoning and shared-work optimization

- **Status:** Draft
- **Created:** 2026-07-26
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 004 (execution context)
  - IncQL RFC 007 (Prism logical planning and optimization engine)
  - IncQL RFC 008 (optimizer boundary, statistics, cost-based optimization, and adaptive execution)
  - IncQL RFC 027 (relational evidence program)
  - IncQL RFC 030 (Prism lineage graph)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 041 (Prism plan ingress and external client frontends)
  - IncQL RFC 065 (Polyglot SQL AST ingress and dialect-aware egress)
- **Issue:** —
- **RFC PR:** [IncQL #105](https://github.com/encero-systems/IncQL/pull/105)
- **Written against:** Incan v0.5-era IncQL
- **Shipped in:** —

## Summary

This RFC makes Prism IncQL's standalone relational reasoning engine. Prism must preserve immutable authored relational intent while separately maintaining a memo of semantically legal alternatives, their required properties, and the evidence that makes each alternative legal. Prism must produce a valid logical result without a `Session`, adapter, or target context. When a caller supplies immutable target facts, Prism may additionally select target-aware logical, placement, exchange, and sharing alternatives; target lowerers, `Session`, and adapters remain responsible for representation-specific lowering, physical planning, and execution. This is a north-star optimizer contract: it applies to every supported frontend and target, rather than treating SQL CTEs, DataFusion plans, or a single execution engine as the optimizer's semantic core.

## Core model

1. **Authored Prism graph.** Immutable relational intent, source provenance, schema and lineage evidence, policy constraints, and author-visible names live here. This graph is never replaced by an optimizer choice.
2. **Optimization memo.** The memo groups semantically equivalent relational expressions. Each alternative records its derivation, legality conditions, and required properties; it does not overwrite authored intent.
3. **Standalone logical selection.** Without target facts, Prism selects only alternatives whose legality follows from authored semantics and target-independent evidence. Unknown target capabilities constrain selection; they do not prevent planning.
4. **Target-aware logical selection.** Given an optional immutable context containing target profiles, capabilities, budgets, statistics, policy facts, and candidate placements, Prism may select logical realization, placement, exchange, and sharing alternatives. Reuse may mean inlining, target-local sharing, transient materialization, durable reuse, or no sharing.
5. **Target realization.** A coordinating caller and target lowerer realize the selected logical and placement plan through an interchange or adapter contract. A generated SQL CTE is one possible realization of selected sharing; SQL is neither required at ingress nor privileged at egress.

## Motivation

The same relational work can arrive from Incan carriers, query blocks, SQL, protocol clients, Delta-like sources, or future data-product interfaces. It can then be executed by an embedded engine, emitted as remote SQL, or split across sources. A fixed sequence of local rewrites cannot reliably choose among join order, predicate movement, sharing, materialization, source pushdown, and target representation when these choices interact.

CTE-heavy transformation SQL makes the limitation visible. A CTE is an authoring and target-language construct, not proof that a relation should be materialized or even shared during execution. Conversely, an Incan-authored shared subframe may merit a generated CTE for PostgreSQL egress even though no SQL appeared at ingress. The optimizer needs to reason about relational equivalence and execution choices independently of either source or target syntax.

Prism already establishes immutable authored planning, structural sharing, and lineage as IncQL responsibilities. RFC 008 establishes that Session supplies execution facts while Prism remains the logical owner. This RFC supplies the missing north-star contract: how Prism explores alternatives, retains legality and provenance, selects shared work, and explains its decision without making a backend optimizer the semantic authority.

## Goals

- Define a durable separation between authored relational intent, explored alternatives, selected logical or placement plans, and target realization.
- Require memo-based representation of equivalent relational expressions rather than irreversible rewrite sequencing as the sole optimization model.
- Require Prism to produce a valid target-independent logical result without a `Session`, adapter, or supplied target context.
- Make shared-work selection a first-class optimizer decision across all frontends and targets.
- Require rewrite legality to be backed by explicit semantic, profile, capability, policy, and property evidence.
- Support cost-informed target-aware selection without treating estimates or backend behavior as semantic truth.
- Require an explainable path from the authored graph through considered alternatives to the selected logical or placement plan and its eventual target realization.
- Keep Substrait as interchange, Session and adapters as execution owners, and SQL AST tooling at frontend or egress boundaries.

## Non-Goals

- Defining a universal claim that IncQL will outperform database optimizers or all generated SQL.
- Treating every SQL CTE, repeated subgraph, or named model as a mandatory materialization boundary.
- Making a generated CTE equivalent to a durable materialized view, cache entry, or authored relation name.
- Replacing a target's physical optimizer, transaction semantics, catalog, or runtime adaptive behavior.
- Adopting Apache Calcite, `optd`, an e-graph library, or any other optimizer implementation as a required dependency.
- Standardizing one complete cost formula, storage implementation, or public optimizer API in this RFC.
- Allowing a target parser, target execution result, or opaque backend rewrite to establish IncQL relational semantics.
- Requiring Prism to depend on a live `Session`, adapter instance, catalog connection, or execution environment.

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

## Reference-level explanation (precise rules)

### Authored intent and the memo

Prism must retain an immutable authored graph as the source of IncQL relational intent. The graph must preserve authoring and ingress provenance, semantic targets, lineage inputs, declared policy constraints, and all facts necessary to explain source-level bindings. An optimization decision must not mutate this graph or discard its relationship to the selected plan.

Prism must represent explored relational alternatives separately from the authored graph. A memo equivalence group must contain only expressions that are semantically interchangeable under the recorded semantic profile and required properties. An alternative must record the rule or derivation that introduced it and the evidence or conditions under which it is legal. A planner may stop exploration early, but it must not present unexplored alternatives as impossible or semantically invalid.

### Properties, requirements, and legality

Every alternative considered for selection must carry, derive, or reference the properties required to use it correctly. The property vocabulary must be able to express, where relevant: output schema and nullability; key and uniqueness facts; ordering; partitioning or locality; source and connector capabilities; determinism and volatility; policy and admissibility constraints; dialect or adapter requirements; cardinality and size estimates; and the provenance of each fact.

A rewrite must not rely on a property that is absent, unknown, contradicted, or valid only under a different semantic profile. Estimated facts may inform ranking, but they must not be reclassified as semantic facts. Target facts are optional inputs to Prism and must be supplied as an immutable planning context rather than discovered through a live adapter dependency. `Session` and adapters may provide statistics, capability facts, and execution observations as defined by RFC 008 and RFC 032, but a compiler, offline planning tool, static profile, or test harness may supply the same contract. Supplied facts must retain their provenance and must not mutate authored intent.

### Shared work and materialization

Prism and the target realization boundary must preserve the distinction among these choices:

- **Inline:** independently include an equivalent relation at each consumer.
- **Target-local share:** evaluate one relation once within a target plan and route it to multiple consumers.
- **Target SQL CTE:** a SQL target lowerer expresses a selected target-local share as a common table expression when the selected SQL profile permits it.
- **Transient materialization:** create an execution-scoped stored result subject to resource, lifetime, freshness, and cleanup rules.
- **Durable result reuse:** substitute a stored result only when identity, freshness, policy, authorization, and invalidation evidence permit it.

These choices have different semantics and operational effects. A target SQL CTE must not be represented as a durable materialization merely because it has a name. A shared authored subgraph must not imply that sharing is selected. Conversely, the planner may select sharing for equivalent work that arrived through separate frontends when identity and legality evidence establish equivalence.

Target-aware selection of sharing or materialization must consider consumer count, downstream specialization that may be lost by sharing, estimated rows and bytes, source cost, target capabilities, resource budget, determinism, freshness, policy, and target-specific cost. In the absence of required target facts, Prism must retain a legal target-independent alternative rather than assume that a sharing or materialization mode is available. An automatic selection must be explainable with the considered alternatives and the facts that influenced the choice. An implementation may expose an explicit author request for a sharing mode, but it must diagnose or reject requests that the active profile cannot honor.

### Target-aware planning and realization

Prism's target-aware planning must start from Prism-owned relational semantics. It may select different logical, placement, exchange, and sharing alternatives for different declarative target contexts. A target context is optional and may be supplied by `Session`, a compiler, an offline planning tool, a static profile, or a test harness. Prism must not require a `Session` or live adapter instance, discover capabilities or bindings through adapter calls, or own adapter lifecycle.

After Prism selects a logical or placement plan, a coordinating caller chooses the applicable realization boundary and invokes the target lowerer. The same authored relation may then lower to a Substrait plan for one adapter, a generated Polyglot SQL AST for PostgreSQL, or a multi-fragment plan with explicit exchange boundaries. Target-specific lowering must not use source SQL text, a target SQL parser, or backend execution success as a substitute for semantic mapping.

SQL CTE factorization is a target representation decision governed by RFC 065. A SQL egress implementation may construct a CTE from an eligible shared Prism subgraph even when the plan originated from an Incan carrier, protocol frontend, or non-SQL source. It may also inline a relation that originated as a SQL CTE. The generated form must remain within the selected dialect profile and preserve the selected Prism semantics.

Substrait remains the normative interchange contract where it is the chosen boundary. `Session`, target lowerers, and adapters own binding, representation-specific lowering, physical planning and execution, runtime adaptation, and backend-specific realization. Prism may provide ranked logical or placement alternatives, selected sharing requirements, and required-property evidence, but it must not claim ownership of a target's unexposed physical choices.

### Explainability and evidence

For every selected logical or placement plan, IncQL must be able to produce inspectable evidence linking the selected relation to authored intent. The evidence must identify whether target context was absent or supplied and, when supplied, its semantic profile and target identities. It must also identify equivalence alternatives considered, rules and evidence used to establish legality, required properties, estimated cost inputs and their provenance, selected sharing or materialization mode, and applicable execution observations when available.

An implementation must distinguish semantic equivalence evidence from result-comparison evidence, plan-shape evidence, and performance evidence. Equal results on a fixture may support a test case but do not by themselves prove a general rewrite rule. A reduced source scan count in one target plan may support target-specific investigation but does not by itself establish a portable performance claim.

## Design details

### Syntax

This RFC introduces no required new author-facing syntax. Existing carriers, query blocks, and ingress frontends continue to express relational intent. Future author controls for materialization or optimization objectives must be specified separately and must not weaken the distinction between an author request and a planner-selected execution decision.

### Semantics

Prism has three conceptually distinct stages: authored intent, an optimization memo, and a selected logical plan. Target-aware logical or placement selection is an optional derived view over those stages, not a prerequisite for them. The stages may share immutable storage, but the observable contract must preserve their different roles. An optimizer may normalize, reorder, factor, or otherwise transform a relation only when the memo records an alternative that satisfies the same semantic requirements under the active profile.

The memo may contain target-independent logical alternatives and, when a target context is supplied, target-realizable candidates. Logical equivalence is independent of a particular backend. Target-realizable candidates additionally satisfy the supplied capabilities and required properties. Missing target facts must constrain target-dependent selection rather than prevent standalone planning. If the realization layer cannot realize a selected sharing mode, it must request another legal alternative or report a structured unsupported diagnostic; it must not silently erase policy, profile, or semantic constraints.

Names and scoped bindings from a frontend are preserved as authored or ingress provenance. They are not, by themselves, target plan nodes. In particular, SQL CTE bindings may lower to ordinary lexical Prism subframes while the memo independently explores their inlining, sharing, or materialization. Recursive or data-modifying CTE semantics remain governed by their frontend profile and are not implied by this RFC.

### Interaction with other IncQL surfaces

- **Prism and carriers:** RFC 007 remains authoritative for immutable carrier construction and structural sharing. This RFC specifies the stronger optimizer model over that authored state.
- **Statistics and execution:** RFC 008 remains authoritative for the Prism versus Session boundary. The memo may consume optionally supplied statistics and observations as evidence; Prism does not require `Session` and does not own backend binding, physical planning, or runtime adaptation.
- **Ingress:** RFC 041 remains authoritative for unresolved external plans and ingress coverage. All supported frontends must converge on Prism-authored semantics before memo exploration.
- **SQL boundaries:** RFC 065 remains authoritative for Polyglot AST mapping, SQL profiles, and dialect coverage. This RFC governs selected logical sharing requirements; RFC 065 governs whether and how a SQL target lowerer can encode them, not Prism's semantic core.
- **Evidence and inspection:** RFCs 027, 030, 032, and 033 govern complementary relational evidence, lineage, execution observations, and adapter coverage. This RFC requires optimizer decisions to link to those records rather than duplicate or replace them.
- **Interchange:** RFC 002 remains authoritative for Substrait as the emitted contract. A selected logical or placement choice must remain valid when a coordinating caller lowers it through the chosen interchange or adapter contract.

### Compatibility / migration

This RFC is additive to existing authoring surfaces. Existing plans remain valid as authored graphs even before they participate in memo exploration. Implementations may initially offer fewer rewrite families or target choices, but they must represent unsupported exploration or target realization honestly rather than present a fixed rewrite sequence as the complete optimizer model.

Serialized artifacts and inspection surfaces may need versioned additions for memo alternatives, property evidence, and selected-sharing records. Readers that do not understand those additions must not infer that an omitted record means no optimization occurred.

## Alternatives considered

- **A fixed sequence of rewrites only.** Rejected as the north-star architecture because it commits too early, obscures alternative choices, and cannot adequately model interactions among join ordering, sharing, and target requirements. Rule pipelines may still be useful as bounded memo exploration strategies.
- **Backend-owned optimization.** Rejected because backends differ, may not expose their reasoning, and cannot establish IncQL semantic or policy legality. Backends remain valuable execution targets and sources of observed evidence.
- **Optimize only SQL CTEs.** Rejected because it confuses a source-language binding form with relational identity and excludes Incan-native, protocol, and cross-source plans.
- **Always materialize repeated work.** Rejected because materialization adds storage, freshness, scheduling, and lost-specialization costs and can be invalid under policy or target constraints.
- **Adopt an existing optimizer wholesale.** Rejected because memo, property, and cost concepts are useful research foundations, but IncQL must own its semantics, evidence, profiles, and adapter contracts.
- **Use equality saturation as the default substrate.** Rejected for the core architecture because unconstrained expansion can become intractable and relational alternatives require properties, target capabilities, and explainable cost selection. It remains a research option for bounded rewrite families.

## Drawbacks

- Memo exploration, property derivation, and explain evidence add substantial implementation and testing complexity.
- Incorrect or stale estimates can select poor plans even when all semantic rules are correct.
- Sharing and materialization require explicit resource, freshness, lifecycle, and cleanup policies that simple inlining avoids.
- A cross-target optimizer can expose meaningful behavior differences between engines that were previously hidden behind one adapter.
- Explainability records and reproducible benchmark harnesses impose storage and maintenance costs, but omitting them would make optimizer claims difficult to audit.

## Implementation architecture (non-normative)

An implementation should keep authored graph construction, semantic analysis, memo exploration, optional target-aware logical selection, and external target realization as distinct responsibilities. The authored graph should remain persistent and structurally shared. The memo should retain equivalence groups, derivation evidence, required properties, and alternatives without turning target-specific physical details into authored nodes. A planning context should be an immutable input value, not a live `Session` or adapter dependency. Prism should consume that optional context to produce a selected logical or placement alternative, its required properties, and an explain artifact; a coordinating caller and target lowerer should then realize it.

Research and implementation should use a reproducible corpus that includes dbt-like CTE-heavy transformations, controlled analytical queries, and cross-target result checks. Evidence must compare semantically equivalent results, authored and selected graph shapes, target plans, observed target metrics, and the provenance of estimates. This architecture does not prescribe a single data structure or optimization algorithm.

## Layers affected

- **IncQL specification** — Prism must define authored intent, memo alternatives, property requirements, sharing modes, selection evidence, and target-planning boundaries consistently with sibling RFCs.
- **IncQL library package** — Prism-facing APIs and inspection artifacts must preserve immutable authored state and expose selected-plan explanations without forcing a backend-specific API into authoring surfaces.
- **Execution / interchange** — `Session` and adapters may supply capability, statistics, and observation evidence with provenance; coordinating callers and target lowerers must receive selected Prism semantics as their input without turning lowering behavior into semantic truth.
- **Frontend and egress integrations** — SQL, protocol, and other frontends must map to Prism before optimization; target emitters must realize selected plans only when their profile and coverage evidence permit it.
- **Documentation and research artifacts** — capability claims, benchmarks, and plan comparisons must distinguish semantic correctness, target-plan shape, and measured performance.

## Design Decisions

### Standalone Prism

Prism must construct, analyze, explore, and select a valid target-independent logical result without a `Session`, adapter, or target context. Missing target facts constrain target-aware choices but do not prevent planning.

### Declarative target context

Target awareness enters Prism only through an optional immutable planning context. `Session`, adapters, compilers, offline tools, static profiles, and test harnesses may supply that contract, but Prism must not depend on their live objects or take ownership of target discovery, binding, lowering, physical planning, or execution.

## Unresolved questions

- Which relational rewrite families have sufficiently precise semantic profiles, property requirements, and test or proof obligations to enter the first audited memo rule set?
- What is the minimum stable property vocabulary for ordering, partitioning, locality, keys, volatility, policy, and target capability without overcommitting to one engine's traits?
- Which statistics transport and invalidation rules allow Session-provided estimates to be reused safely across planning sessions and targets?
- What resource, freshness, identity, authorization, and cleanup contract is required before transient or durable materialization can be selected automatically?
- How should multi-fragment and cross-source sharing account for exchange cost, failure boundaries, and partial execution without importing orchestration semantics into Prism?
- Which explain artifact schema can remain stable while still exposing a growing memo and target-specific selection evidence?
- What reproducible workload scales, target versions, and success criteria are required before a target-specific sharing or CTE-factorization recommendation becomes a public performance claim?

<!-- Rename this section to "Design Decisions" once all questions have been resolved. An RFC cannot move from Draft to Planned until no unresolved questions remain. -->
