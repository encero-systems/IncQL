# InQL RFC 066: Prism relational reasoning and shared-work optimization

- **Status:** Draft
- **Created:** 2026-07-26
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - InQL RFC 004 (execution context)
  - InQL RFC 007 (Prism logical planning and optimization engine)
  - InQL RFC 008 (optimizer boundary, statistics, cost-based optimization, and adaptive execution)
  - InQL RFC 027 (relational evidence program)
  - InQL RFC 030 (Prism lineage graph)
  - InQL RFC 032 (execution observations)
  - InQL RFC 033 (adapter requirements and coverage)
  - InQL RFC 040 (interoperability semantic profiles)
  - InQL RFC 041 (Prism plan ingress and external client frontends)
  - InQL RFC 065 (Polyglot SQL AST ingress and dialect-aware egress)
- **Issue:** —
- **RFC PR:** [IncQL #105](https://github.com/encero-systems/IncQL/pull/105)
- **Written against:** Incan v0.5-era IncQL
- **Shipped in:** —

## Summary

This RFC makes Prism InQL's relational reasoning engine. Prism must preserve immutable authored relational intent while separately maintaining a memo of semantically legal alternatives, their required properties, and the evidence that makes each alternative legal. A target planner must then choose whether to inline, share, materialize, push down, repartition, or encode the selected relation in a target representation such as Substrait or SQL. This is a north-star optimizer contract: it applies to every supported frontend and target, rather than treating SQL CTEs, DataFusion plans, or a single execution engine as the optimizer's semantic core.

## Core model

1. **Authored Prism graph.** Immutable relational intent, source provenance, schema and lineage evidence, policy constraints, and author-visible names live here. This graph is never replaced by an optimizer choice.
2. **Optimization memo.** The memo groups semantically equivalent relational expressions. Each alternative records its derivation, legality conditions, and required properties; it does not overwrite authored intent.
3. **Reuse and target planner.** Given a target, profile, capabilities, budget, statistics, and policy facts, the planner selects a logical and physical realization. Reuse may mean inlining, target-local sharing, a generated CTE, transient materialization, durable reuse, or no sharing.
4. **Target-specific lowering.** Selected plans lower to an interchange or adapter contract. SQL is one possible target encoding; it is neither required at ingress nor privileged at egress.

## Motivation

The same relational work can arrive from Incan carriers, query blocks, SQL, protocol clients, Delta-like sources, or future data-product interfaces. It can then be executed by an embedded engine, emitted as remote SQL, or split across sources. A fixed sequence of local rewrites cannot reliably choose among join order, predicate movement, sharing, materialization, source pushdown, and target representation when these choices interact.

CTE-heavy transformation SQL makes the limitation visible. A CTE is an authoring and target-language construct, not proof that a relation should be materialized or even shared during execution. Conversely, an Incan-authored shared subframe may merit a generated CTE for PostgreSQL egress even though no SQL appeared at ingress. The optimizer needs to reason about relational equivalence and execution choices independently of either source or target syntax.

Prism already establishes immutable authored planning, structural sharing, and lineage as InQL responsibilities. RFC 008 establishes that Session supplies execution facts while Prism remains the logical owner. This RFC supplies the missing north-star contract: how Prism explores alternatives, retains legality and provenance, selects shared work, and explains its decision without making a backend optimizer the semantic authority.

## Goals

- Define a durable separation between authored relational intent, explored alternatives, and selected target plans.
- Require memo-based representation of equivalent relational expressions rather than irreversible rewrite sequencing as the sole optimization model.
- Make shared-work selection a first-class optimizer decision across all frontends and targets.
- Require rewrite legality to be backed by explicit semantic, profile, capability, policy, and property evidence.
- Support cost-informed target selection without treating estimates or backend behavior as semantic truth.
- Require an explainable path from the authored graph through considered alternatives to the selected target plan.
- Keep Substrait as interchange, Session and adapters as execution owners, and SQL AST tooling at frontend or egress boundaries.

## Non-Goals

- Defining a universal claim that InQL will outperform database optimizers or all generated SQL.
- Treating every SQL CTE, repeated subgraph, or named model as a mandatory materialization boundary.
- Making a generated CTE equivalent to a durable materialized view, cache entry, or authored relation name.
- Replacing a target's physical optimizer, transaction semantics, catalog, or runtime adaptive behavior.
- Adopting Apache Calcite, `optd`, an e-graph library, or any other optimizer implementation as a required dependency.
- Standardizing one complete cost formula, storage implementation, or public optimizer API in this RFC.
- Allowing a target parser, target execution result, or opaque backend rewrite to establish InQL relational semantics.

## Guide-level explanation (how authors think about it)

Authors continue to compose relations normally. They do not need to write a CTE or select a materialization mechanism merely to express reused relational work.

```incan
orders = session.table("orders")?
paid_orders = orders.filter(.status == "paid")
orders_with_customers = paid_orders.join(customers, on=.customer_id)
regional_summary = orders_with_customers.group_by(.region).aggregate(total=.amount.sum())
customer_detail = orders_with_customers.select(.customer_id, .region, .amount)
```

`regional_summary` and `customer_detail` share `orders_with_customers` as authored intent. Prism must keep that relationship visible. When the two relations are requested together, the selected target may inline the join in both consumers, share it inside a target plan, materialize it temporarily, or generate one SQL CTE referenced by two consumers. The right answer depends on the target and evidence; authored code does not silently acquire a materialization guarantee.

The same model applies to a SQL frontend. A dbt-like statement with many CTEs may be decoded into ordinary scoped Prism relations. Those names preserve provenance and lexical meaning, but the target planner may emit a plan with fewer, more, or no CTEs when that is semantically valid and better supported by the target profile. An emitted PostgreSQL CTE is therefore a rendering of a selected Prism sharing decision, not a requirement that the input was SQL.

An inspection surface should let an author ask why the plan differs from the authored graph: which equivalence rules were considered, what properties were required, why a shared candidate was rejected or selected, what cost facts were available, and what target-specific representation was finally emitted.

## Reference-level explanation (precise rules)

### Authored intent and the memo

Prism must retain an immutable authored graph as the source of InQL relational intent. The graph must preserve authoring and ingress provenance, semantic targets, lineage inputs, declared policy constraints, and all facts necessary to explain source-level bindings. An optimization decision must not mutate this graph or discard its relationship to the selected plan.

Prism must represent explored relational alternatives separately from the authored graph. A memo equivalence group must contain only expressions that are semantically interchangeable under the recorded semantic profile and required properties. An alternative must record the rule or derivation that introduced it and the evidence or conditions under which it is legal. A planner may stop exploration early, but it must not present unexplored alternatives as impossible or semantically invalid.

### Properties, requirements, and legality

Every alternative considered for selection must carry, derive, or reference the properties required to use it correctly. The property vocabulary must be able to express, where relevant: output schema and nullability; key and uniqueness facts; ordering; partitioning or locality; source and connector capabilities; determinism and volatility; policy and admissibility constraints; dialect or adapter requirements; cardinality and size estimates; and the provenance of each fact.

A rewrite must not rely on a property that is absent, unknown, contradicted, or valid only under a different semantic profile. Estimated facts may inform ranking, but they must not be reclassified as semantic facts. Session and adapters may provide statistics, capability facts, and execution observations as defined by RFC 008 and RFC 032; those facts must retain their provenance and must not mutate authored intent.

### Shared work and materialization

The planner must distinguish these choices:

- **Inline:** independently include an equivalent relation at each consumer.
- **Target-local share:** evaluate one relation once within a target plan and route it to multiple consumers.
- **Target SQL CTE:** express a target-local share as a generated SQL common table expression when the selected SQL profile permits it.
- **Transient materialization:** create an execution-scoped stored result subject to resource, lifetime, freshness, and cleanup rules.
- **Durable result reuse:** substitute a stored result only when identity, freshness, policy, authorization, and invalidation evidence permit it.

These choices have different semantics and operational effects. A target SQL CTE must not be represented as a durable materialization merely because it has a name. A shared authored subgraph must not imply that sharing is selected. Conversely, the planner may select sharing for equivalent work that arrived through separate frontends when identity and legality evidence establish equivalence.

Selection of sharing or materialization must consider consumer count, downstream specialization that may be lost by sharing, estimated rows and bytes, source cost, target capabilities, resource budget, determinism, freshness, policy, and target-specific cost. An automatic selection must be explainable with the considered alternatives and the facts that influenced the choice. An implementation may expose an explicit author request for a sharing mode, but it must diagnose or reject requests that the active profile cannot honor.

### Target planning and lowering

Target planning must start from Prism-owned relational semantics. It may select different legal alternatives for different targets. The same authored relation may lower to a Substrait plan for one adapter, a generated Polyglot SQL AST for PostgreSQL, or a multi-fragment plan with explicit exchange boundaries. Target-specific lowering must not use source SQL text, a target SQL parser, or backend execution success as a substitute for semantic mapping.

SQL CTE factorization is a target representation decision governed by RFC 065. A SQL egress implementation may construct a CTE from an eligible shared Prism subgraph even when the plan originated from an Incan carrier, protocol frontend, or non-SQL source. It may also inline a relation that originated as a SQL CTE. The generated form must remain within the selected dialect profile and preserve the selected Prism semantics.

Substrait remains the normative interchange contract where it is the chosen boundary. Session and adapters own physical execution, runtime adaptation, and backend-specific realization. Prism may provide ranked logical alternatives and required-property evidence, but it must not claim ownership of a target's unexposed physical choices.

### Explainability and evidence

For every selected target plan, InQL must be able to produce inspectable evidence linking the selected relation to authored intent. The evidence must identify the selected semantic profile and target, equivalence alternatives considered, rules and evidence used to establish legality, required properties, estimated cost inputs and their provenance, selected sharing or materialization mode, and applicable execution observations when available.

An implementation must distinguish semantic equivalence evidence from result-comparison evidence, plan-shape evidence, and performance evidence. Equal results on a fixture may support a test case but do not by themselves prove a general rewrite rule. A reduced source scan count in one target plan may support target-specific investigation but does not by itself establish a portable performance claim.

## Design details

### Syntax

This RFC introduces no required new author-facing syntax. Existing carriers, query blocks, and ingress frontends continue to express relational intent. Future author controls for materialization or optimization objectives must be specified separately and must not weaken the distinction between an author request and a planner-selected execution decision.

### Semantics

Prism has three conceptually distinct stages: authored intent, an optimization memo, and a selected target plan. They may share immutable storage, but the observable contract must preserve their different roles. An optimizer may normalize, reorder, factor, or otherwise transform a relation only when the memo records an alternative that satisfies the same semantic requirements under the active profile.

The memo may contain logical and target-realizable alternatives. Logical equivalence is independent of a particular backend. Target-realizable alternatives additionally satisfy the target's capabilities and required properties. A target that cannot realize a selected sharing mode must cause the planner to choose another legal alternative or report a structured unsupported diagnostic; it must not silently erase policy, profile, or semantic constraints.

Names and scoped bindings from a frontend are preserved as authored or ingress provenance. They are not, by themselves, target plan nodes. In particular, SQL CTE bindings may lower to ordinary lexical Prism subframes while the memo independently explores their inlining, sharing, or materialization. Recursive or data-modifying CTE semantics remain governed by their frontend profile and are not implied by this RFC.

### Interaction with other InQL surfaces

- **Prism and carriers:** RFC 007 remains authoritative for immutable carrier construction and structural sharing. This RFC specifies the stronger optimizer model over that authored state.
- **Statistics and execution:** RFC 008 remains authoritative for the Prism versus Session boundary. The memo consumes supplied statistics and observations as evidence; it does not own backend physical planning or runtime adaptation.
- **Ingress:** RFC 041 remains authoritative for unresolved external plans and ingress coverage. All supported frontends must converge on Prism-authored semantics before memo exploration.
- **SQL boundaries:** RFC 065 remains authoritative for Polyglot AST mapping, SQL profiles, and dialect coverage. This RFC governs the optimizer's decision to use a supported SQL representation, not SQL parsing or generator implementation.
- **Evidence and inspection:** RFCs 027, 030, 032, and 033 govern complementary relational evidence, lineage, execution observations, and adapter coverage. This RFC requires optimizer decisions to link to those records rather than duplicate or replace them.
- **Interchange:** RFC 002 remains authoritative for Substrait as the emitted contract. A memo choice must lower to a valid selected interchange or adapter contract.

### Compatibility / migration

This RFC is additive to existing authoring surfaces. Existing plans remain valid as authored graphs even before they participate in memo exploration. Implementations may initially offer fewer rewrite families or target choices, but they must represent unsupported exploration or target realization honestly rather than present a fixed rewrite sequence as the complete optimizer model.

Serialized artifacts and inspection surfaces may need versioned additions for memo alternatives, property evidence, and selected-sharing records. Readers that do not understand those additions must not infer that an omitted record means no optimization occurred.

## Alternatives considered

- **A fixed sequence of rewrites only.** Rejected as the north-star architecture because it commits too early, obscures alternative choices, and cannot adequately model interactions among join ordering, sharing, and target requirements. Rule pipelines may still be useful as bounded memo exploration strategies.
- **Backend-owned optimization.** Rejected because backends differ, may not expose their reasoning, and cannot establish InQL semantic or policy legality. Backends remain valuable execution targets and sources of observed evidence.
- **Optimize only SQL CTEs.** Rejected because it confuses a source-language binding form with relational identity and excludes Incan-native, protocol, and cross-source plans.
- **Always materialize repeated work.** Rejected because materialization adds storage, freshness, scheduling, and lost-specialization costs and can be invalid under policy or target constraints.
- **Adopt an existing optimizer wholesale.** Rejected because memo, property, and cost concepts are useful research foundations, but InQL must own its semantics, evidence, profiles, and adapter contracts.
- **Use equality saturation as the default substrate.** Rejected for the core architecture because unconstrained expansion can become intractable and relational alternatives require properties, target capabilities, and explainable cost selection. It remains a research option for bounded rewrite families.

## Drawbacks

- Memo exploration, property derivation, and explain evidence add substantial implementation and testing complexity.
- Incorrect or stale estimates can select poor plans even when all semantic rules are correct.
- Sharing and materialization require explicit resource, freshness, lifecycle, and cleanup policies that simple inlining avoids.
- A cross-target optimizer can expose meaningful behavior differences between engines that were previously hidden behind one adapter.
- Explainability records and reproducible benchmark harnesses impose storage and maintenance costs, but omitting them would make optimizer claims difficult to audit.

## Implementation architecture (non-normative)

An implementation should keep authored graph construction, semantic analysis, memo exploration, target selection, and target lowering as distinct responsibilities. The authored graph should remain persistent and structurally shared. The memo should retain equivalence groups, derivation evidence, required properties, and alternatives without turning target-specific physical details into authored nodes. Target planners should consume a selected memo alternative plus explicit target, capability, profile, statistics, and policy inputs, then produce a lowering request and an explain artifact.

Research and implementation should use a reproducible corpus that includes dbt-like CTE-heavy transformations, controlled analytical queries, and cross-target result checks. Evidence must compare semantically equivalent results, authored and selected graph shapes, target plans, observed target metrics, and the provenance of estimates. This architecture does not prescribe a single data structure or optimization algorithm.

## Layers affected

- **InQL specification** — Prism must define authored intent, memo alternatives, property requirements, sharing modes, selection evidence, and target-planning boundaries consistently with sibling RFCs.
- **InQL library package** — Prism-facing APIs and inspection artifacts must preserve immutable authored state and expose selected-plan explanations without forcing a backend-specific API into authoring surfaces.
- **Execution / interchange** — Session and adapters must supply capability, statistics, and observation evidence with provenance; Substrait and SQL lowering must receive selected Prism semantics rather than become optimizer inputs of record.
- **Frontend and egress integrations** — SQL, protocol, and other frontends must map to Prism before optimization; target emitters must realize selected plans only when their profile and coverage evidence permit it.
- **Documentation and research artifacts** — capability claims, benchmarks, and plan comparisons must distinguish semantic correctness, target-plan shape, and measured performance.

## Unresolved questions

- Which relational rewrite families have sufficiently precise semantic profiles, property requirements, and test or proof obligations to enter the first audited memo rule set?
- What is the minimum stable property vocabulary for ordering, partitioning, locality, keys, volatility, policy, and target capability without overcommitting to one engine's traits?
- Which statistics transport and invalidation rules allow Session-provided estimates to be reused safely across planning sessions and targets?
- What resource, freshness, identity, authorization, and cleanup contract is required before transient or durable materialization can be selected automatically?
- How should multi-fragment and cross-source sharing account for exchange cost, failure boundaries, and partial execution without importing orchestration semantics into Prism?
- Which explain artifact schema can remain stable while still exposing a growing memo and target-specific selection evidence?
- What reproducible workload scales, target versions, and success criteria are required before a target-specific sharing or CTE-factorization recommendation becomes a public performance claim?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->
