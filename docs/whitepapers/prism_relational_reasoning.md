# Prism: relational reasoning and shared-work optimization

**Status:** Research whitepaper

**Date:** 2026-07-26

**Audience:** IncQL and Incan contributors, database-systems researchers, data-platform architects, and prospective execution-engine collaborators.

**Scope:** This document is non-normative. It frames a research direction for Prism and defines evidence required before any product or performance claim. RFC 066 records the normative north-star boundary; focused follow-on RFCs must specify stable public APIs, individual rewrite families, planning-context transport, materialization lifecycle, and adaptive execution contracts.

## Thesis

Prism should evolve from an immutable logical-plan store into IncQL's relational reasoning engine: one system operating in pre-execution and bounded adaptive re-entry modes across local, cluster, bounded, continuous, and explicitly modeled graph or recursive workloads, remaining tractable over large transformation graphs, recognizing equivalent and shared work, preserving the reasons a rewrite is legal, and selecting logical, sharing, placement, and exchange requirements before external target lowerers and execution engines choose their representations and physical plans. Both temporal modes use the same authored graph, semantic rules, memo, property model, and explanation contract.

The goal is not to make SQL CTEs work, nor to replace Catalyst, DataFusion, PostgreSQL, Spark, or another target optimizer or execution engine. The goal is to give IncQL an optimizer-owned semantic graph that can improve plans arriving from Incan APIs, SQL, protocol frontends, Delta-like sources, and future data-product interfaces before target-specific optimization begins.

This matters because data transformations are increasingly authored as long chains of models, views, CTEs, and reusable staging steps. Those structures are useful to authors but are not necessarily the best execution structure. A capable Prism can treat them as relational intent, discover reusable work across declared consumers and planning horizons, and select whether work should be inlined, shared, materialized, pushed down, repartitioned, or placed elsewhere. Target lowerers and engines then realize and refine that selection.

## Why this research matters

dbt's `ephemeral` materialization demonstrates the pressure clearly: an ephemeral model is emitted as a CTE rather than persisted as a database object. That is convenient authoring structure, but it limits the target optimizer to the relational structure and context visible in the submitted statement. [dbt CTE guidance][dbt-cte] [dbt-ephemeral]

IncQL can offer a different contract:

- authors retain composable, named data transformations;
- Prism retains a typed graph of the actual relational dependencies;
- optimizer decisions remain inspectable rather than being hidden in generated SQL;
- Prism can reason across declared outputs and heterogeneous candidate targets before committing to one engine's plan;
- target lowerers receive selected logical, placement, exchange, and sharing requirements;
- runtime observations can return as scoped evidence for bounded replanning and, when retained by an external provider, later executions; and
- SQL egress is one target representation, not the semantic source of truth.

The systems hypothesis is not merely that IncQL makes generated SQL faster. It is that IncQL can optimize relational intent before it collapses into one target's SQL or physical plan, across authoring frontends, transformation roots, executions, and heterogeneous targets, while retaining the evidence that makes equivalence, sharing, and placement decisions legal and explainable. No target-local optimizer can act on IncQL context that it never receives. Whether this wider decision surface produces cheaper or more reliable execution remains a measured hypothesis, not a performance claim.

## A north-star architecture

```text
Authoring frontends
Incan · query blocks · SQL AST · protocols
                 │
                 ▼
       Authored Prism graph
immutable relational intent · schema · lineage · policy
                 │
                 ▼
        Optimization memo ◄──────── Provider-neutral planning context
equivalence · alternatives          capabilities · estimates · observations
properties · legality                         ▲
                 │                            │
                 ▼                            │
        Selected Prism plan                   │
logical shape · placement · exchange          │
sharing requirements                          │
                 │                            │
                 ▼                            │
 Coordinator and target lowerers              │
Substrait · SQL AST · multi-fragment          │
                 │                            │
                 ▼                            │
        Execution targets                     │
DataFusion · PostgreSQL · Spark · others      │
                 │                            │
        scoped runtime observations ──────────┘
        at a bounded adaptive checkpoint or continuous frontier
```

The authored graph and optimization memo must be distinct. The authored graph records what the author or frontend meant, including source provenance. The memo records semantically equivalent alternatives. An optimizer may choose a different alternative, but it must preserve a lineage and evidence path explaining why the alternative is valid and why it was selected. Prism must also produce a valid target-independent logical result when the optional planning-evidence input is absent. Any caller may construct that immutable input through the same open contract; Prism does not require or recognize a privileged evidence provider.

Target realization and execution remain outside Prism. A target engine may refine or replace physical choices, and a coordinator may later invoke Prism again with an immutable observation snapshot at an explicit adaptive checkpoint. Replanning derives a new selection for unfinished bounded work or future continuous work; it does not mutate authored history, completed execution, committed stream progress, or target state without an explicit compatibility or migration contract.

This separation fits Prism's existing immutable, structurally shared planning model. It also prevents an optimizer implementation detail or runtime observation from becoming author-visible semantics.

## Research foundations

### Cascades, Volcano, and memo-based optimization

The most relevant architectural foundation is the Volcano/Cascades family. Cascades represents equivalent relational expressions in a memo, applies transformation and implementation rules selectively, and uses properties and cost to choose a plan. It is a stronger model than a fixed sequence of rewrites because it can retain alternatives instead of committing to the first locally plausible one. [Volcano][volcano] [Cascades][cascades]

Apache Calcite's VolcanoPlanner is a useful implementation reference. It has equivalence sets, dynamic-programming optimization, relational traits, rule registration, and materialization substitution. Calcite is not an IncQL dependency proposal; its concepts are the relevant part. [Calcite VolcanoPlanner][calcite-volcano] [Calcite materialized views][calcite-materialized-views]

The first Prism memo should be smaller than a full Cascades implementation. It should start with logical equivalence and required properties that IncQL can substantiate: schema, nullability, ordering, partitioning or locality, boundedness, update mode, temporal progress, bounded-state requirements, source capability, policy constraints, and target dialect or adapter requirements. Physical implementation alternatives belong only after those facts are trustworthy.

### Shared work is multi-query optimization, not syntax cleanup

Factoring repeated subplans is an instance of multi-query optimization (MQO). Its core problem is not detecting that two pieces of SQL look similar; it is deciding whether evaluating a common subexpression once and reusing it is preferable to inlining or independently optimizing its uses. Research treats common-subexpression reuse and materialized-view reuse as a combined optimization problem, precisely because sharing introduces storage, scheduling, freshness, and target-cost trade-offs. [shared-expression and materialized-view reuse][sse-mvr] [provable MQO][provable-mqo]

Prism therefore needs a reuse planner with explicit choices:

- inline a reusable relation at each consumer;
- share it inside one target plan;
- emit it as a target SQL CTE;
- materialize it transiently for one execution;
- reuse a durable materialized result when freshness and policy allow; or
- decline reuse when the target or semantic profile makes it unsafe.

An SQL CTE is only one encoding of the `share` choice. It must not be confused with a durable materialized view, and a high CTE count alone is not evidence that factoring will help.

### Production reuse and optimizer services

Microsoft's production research is especially relevant to the scale and lifecycle of shared work. BigSubs studies which common subexpressions to materialize across datacenter workloads, while CLOUDVIEWS studies computation reuse in an analytics job service with feedback from compilation and execution. These systems show that cross-job reuse is not an extension of CTE syntax: it requires workload identity, benefit estimation, storage and maintenance policy, and observed reuse over time. [BigSubs][bigsubs] [CLOUDVIEWS][cloudviews]

Oasis explores the optimizer-as-a-service boundary, separating reusable optimization capability from an individual engine deployment. QO-Advisor demonstrates that production steering also needs validation, regression control, and a safe path for declining a proposed change. Research on joint query and resource optimization further shows that a query plan cannot be ranked independently of the resources available to execute it. These are direct precedents for Prism's standalone boundary, multi-objective planning context, and evidence-governed rollout. [Oasis][oasis] [QO-Advisor][qo-advisor] [query and resource optimization][query-resource]

### Open evidence ingress without a required experience service

Prism's consideration of prior evidence should remain part of the open reasoning engine. A provider-neutral immutable planning context can carry target capabilities, policy facts, estimates, observations, and candidate placements with explicit authority, provenance, scope, freshness, confidence, and invalidation. `Session`, an adapter, an offline tool, a test harness, or a client-built history service should be able to supply the same contract.

Prism should receive an evidence snapshot rather than retrieve or persist history itself. Historical estimates and observations may rank or prune semantically legal alternatives, but they cannot establish rewrite legality or become authored truth. Current capability, authorization, and policy facts may constrain target realizability only when their authority and applicability are explicit. This separation leaves room for independently built longitudinal evidence systems without making Prism a thin client for any particular service. This paper does not define product packaging for such systems.

### DataFusion as an experimental target

DataFusion is valuable because it offers structured logical and physical planning, extensible optimizer rules, common-subexpression elimination, and `EXPLAIN ANALYZE` metrics. It should be used to test Prism's reasoning and external target-realization boundary, without becoming the semantic owner of IncQL plans. [DataFusion optimizer][datafusion-optimizer] [DataFusion logical plans][datafusion-logical-plans] [DataFusion EXPLAIN][datafusion-explain]

The `optd` research project is particularly relevant: it explored a Cascades-based optimizer integrated with DataFusion, including physical-property support. It merits code and design study as a research reference. It is not yet a dependency or adoption decision. [optd overview][optd]

### Spark Catalyst and adaptive execution

Spark is essential prior art, not merely another target. Spark SQL showed that SQL and typed DataFrame authoring can converge on a common logical plan before physical execution. Catalyst provides composable tree transformations and extensible rule batches; Spark also implements statistics-informed dynamic-programming join reordering, CTE inlining governed by reference count and determinism, and physical reuse of equivalent exchanges and subqueries. [Spark SQL and Catalyst][spark-sql-paper] [Spark join reordering][spark-join-reorder] [Spark CTE inlining][spark-inline-cte] [Spark exchange and subquery reuse][spark-reuse]

Adaptive Query Execution strengthens that design with runtime statistics. Spark can revise join strategies, partitioning, and skew handling after execution has produced better evidence. That is a direct precedent for treating optimization as a progression from inferred facts, through estimates, to observations rather than as a one-shot compile-time pass. [Spark adaptive query execution][spark-aqe]

Catalyst also sharpens Prism's differentiation. Building a typed relational graph before SQL or physical planning is not novel by itself. Catalyst is primarily responsible for producing and adapting Spark execution, whereas Prism's proposed responsibility spans declared transformation roots, workload-level reuse, heterogeneous candidate targets, policy and semantic evidence, and explicit placement or exchange before target-local optimization. When Spark is selected, Catalyst and AQE should remain authoritative for Spark-local physical decisions.

The research must not assert that Catalyst fails on complex plans merely from practitioner experience. It should test that hypothesis. CTE-heavy and deeply composed workloads must measure optimizer wall time, rule iterations where observable, logical and physical plan growth, driver memory, generated-plan size, plan stability, and runtime quality as graph complexity increases. Spark is both a design reference and an adversarial baseline.

### Distributed and continuous execution change the planning surface

Cluster execution does not require another Prism semantic model. It expands the target-aware decision surface: data and compute locality, partitioning, exchange, serialization, skew, resource envelopes, failure boundaries, and partial execution all affect whether a legal logical alternative is attractive. A local engine is the one-placement case. Schedulers and target engines still own task placement, shuffle implementation, retry, recovery, and worker lifecycle.

Streaming has a deeper effect because boundedness participates in legality. IncQL RFC 001 already distinguishes bounded and unbounded carriers, while RFC 048 keeps cluster and streaming lifecycle behind the `Session` backend boundary. Prism must connect those contracts by representing update or changelog mode, event time and processing time, watermark or other progress guarantees, late-data behavior, bounded state, replay, and sink requirements. A batch-equivalent rewrite is not necessarily trace-equivalent for an unbounded relation.

Shared streaming work may be one evolving operator and state store serving several consumers rather than a completed relation or SQL CTE. Adaptive re-entry also cannot wait for end-of-input. A coordinator needs a compatible checkpoint, epoch, or watermark frontier and evidence about state identity, schema, reuse, migration, or rebuild. Prism may then reconsider future processing while committed output and progress remain fixed. This preserves the one-engine, two-temporal-mode model without making Prism a streaming runtime.

### Graphs are not merely tables with unusual joins

Prism already contains graph-shaped structures: the authored plan DAG, memo relationships, semantic lineage, and evidence projections. Those structures must remain distinct from graph-query semantics over user data. A graph frontend needs explicit node and edge identity, direction, labels or types, property access, duplicate-edge behavior, path semantics, recursion or fixpoint behavior, termination, and result-shape rules. Treating an edge table as proof of those semantics would repeat the same category error as treating a SQL CTE name as proof of materialization.

Research nevertheless shows that relational and graph execution need not be separate worlds. GRainDB retains a relational core while adding graph-aware predefined joins and adjacency-like indexes; DuckPGQ adds SQL/PGQ property-graph queries to an analytical relational engine while identifying path finding, factorized execution, and graph-aware joins as distinct requirements. These are useful precedents for a Prism memo that may compare a relational realization with a graph-target realization without flattening their semantic contracts. [GRainDB][graindb] [DuckPGQ][duckpgq]

Dynamic graphs connect the graph and streaming problems. Differential dataflow demonstrates incremental nested iteration over changing inputs, including graph computations. For Prism, the lesson is architectural rather than an adoption decision: a continuous graph replan must reason about update traces, fixpoint or frontier state, and compatibility at a committed progress boundary. Cardinality alone is not enough. [Differential dataflow][differential-dataflow]

### Cost models need humility, runtime evidence, and bounded adaptation

Join order, sharing, and materialization decisions are only as good as their cardinality and cost assumptions. The Join Order Benchmark research found large cardinality-estimation errors even in industrial systems. Prism should therefore record assumptions, compare them with observed target metrics where available, and improve conservatively rather than assert global optimality. [Join Order Benchmark][job]

This is also why target choice matters. A PostgreSQL CTE, a DataFusion physical plan, and a remote warehouse may assign very different costs to sharing, scanning, repartitioning, and temporary materialization.

Planning evidence has at least three distinct classes:

- **declared or inferred facts**, such as schema, keys, constraints, policy, and logically derived bounds;
- **pre-execution estimates**, such as row count, distinct values, histograms, file sizes, partition metadata, and target costs; and
- **runtime observations**, such as actual rows and bytes, selectivity, skew, shuffle, spill, memory, latency, and realized target decisions.

An observation is not timeless truth. It is evidence about a particular plan identity, data snapshot, parameter shape, semantic profile, target configuration, and execution attempt. Reuse requires provenance, scope, freshness, confidence, and invalidation rules.

Target engines remain free to adapt their physical execution internally. In addition, a coordinator may establish an explicit adaptive checkpoint and invoke Prism again with an immutable observation snapshot. Prism may reconsider only unfinished logical, placement, exchange, sharing, or materialization choices. Completed work, authored intent, transaction and snapshot guarantees, and policy constraints remain fixed. Replanning must have a bounded cost and a legal fallback; an optimizer that spends more than the opportunity it can recover has failed.

### Optimization evidence is not operational interpretation

Prism can establish that actual cardinality diverged from an estimate, a join began spilling, an exchange became expensive, or a previously successful plan regressed. Those facts do not establish why the change happened or what an organization should do about it. Seasonality, a deployment, data-quality drift, infrastructure contention, a target-engine change, or an expected business event may produce similar optimizer evidence.

Operational-cause interpretation, alerting, incident classification, and automated response therefore belong outside Prism. A related system may combine Prism evidence with deployment events, policy, system dependencies, and other operational signals, but it must expose uncertainty and must not infer business meaning from cardinality alone.

The same separation applies to development-to-production impact analysis. IncQL RFC 037 defines local semantic plan diffs and blast-radius inputs. An external system may combine those artifacts with deployed workload identities, dependency indexes, and correctly scoped historical observations to estimate the probable production effect of in-flight development work. That counterfactual forecast must report assumptions, confidence, evidence coverage, and unknowns and should be backtested after promotion. Prism supplies reasoning and evidence; it does not own organization-wide blast radius or operational response.

### Equality saturation is a research branch, not the foundation

E-graphs and equality saturation are promising for retaining many equivalent expressions and reducing rewrite-order sensitivity. They are worth investigating for scalar-expression normalization and selected relational rewrite families. They should not be Prism's first optimizer substrate: unconstrained equality saturation can grow rapidly, while relational optimization also needs schemas, properties, cost, source capabilities, and explainable legality. [egg][egg] [relational contextual equality saturation][relational-eqsat]

## Research questions

### 1. What constitutes relational equivalence in Prism?

Prism needs an explicit answer for each rewrite family:

- projection and predicate movement;
- join associativity, commutativity, and reordering;
- aggregate rewrites and rollups;
- window and ordering constraints;
- subquery decorrelation;
- common-subexpression reuse;
- source pushdown and pull-up; and
- materialized-result substitution.

Each rule must declare its preconditions and the evidence it consumes. “The backend accepts it” is not a legality proof.

The semantic profile must cover more than schema compatibility. Relevant dimensions include bag semantics and duplicates, null three-valued logic, ordering and top-k behavior, decimal and temporal behavior, collation and time zone, overflow and error behavior, function and UDF identity, parameter bindings, volatility, transaction snapshot, and authorization context. Equal results on a fixture test one instance; they do not prove a rule.

### 2. How should shared work be represented and selected?

Prism needs to distinguish a shared authored subgraph from an optimizer-selected shared execution result. The first is immutable intent; the second is a target-specific choice. The planner must account for reference count, estimated rows and bytes, source cost, memory budget, target capabilities, determinism, freshness, policy, and the cost of losing downstream specialization.

It must also distinguish an optimization preference to reuse deterministic work from a semantic requirement to evaluate work once. Volatile, erroring, or snapshot-sensitive expressions may make evaluation multiplicity observable. A target representation such as a SQL CTE cannot satisfy a once-only requirement unless its selected profile provides that guarantee.

### 3. What is one optimization problem?

The planner must make its consumer set and time horizon explicit. One root query, several requested outputs, a complete transformation DAG, one scheduled execution, and a recurring workload have different identity, scheduling, freshness, and cost contracts. A planning invocation must not silently expand from one root into project-wide or cross-execution optimization.

### 4. Which properties belong in the first memo?

The property vocabulary should be evidence-driven:

- output schema, nullability, and key facts;
- semantic-profile dimensions that govern equivalence;
- ordering and partitioning;
- boundedness, update or changelog mode, temporal progress, and bounded-state requirements;
- graph identity, direction, path, recursion, fixpoint, termination, and result-shape requirements;
- source location and supported pushdowns;
- data format and connector capabilities;
- policy and admissibility constraints;
- target dialect and execution requirements;
- cardinality and size estimates with provenance; and
- observation scope, freshness, confidence, and invalidation state.

The memo must not quietly turn guessed values into facts.

### 5. How should runtime evidence trigger adaptation?

The coordinator needs explicit safe points at which completed work is fixed and the unfinished graph can be reconsidered. Research must determine which observations justify a new logical or placement selection, how much replanning may cost, how transaction and policy guarantees survive, and what fallback runs when replanning is unavailable or unhelpful. Target-local physical adaptation and Prism re-entry are related but distinct events.

### 6. How does the optimizer remain tractable?

Large transformation graphs can make rule exploration itself the bottleneck. Prism needs explicit search budgets, pruning, rule scheduling, required-property propagation, deterministic or fully recorded exploration, graceful timeout behavior, and plan-stability controls. Memo size, planning latency, and memory are optimizer outputs to measure, not incidental test diagnostics.

### 7. How do we make optimizer choices explainable?

For every selected plan, IncQL should eventually explain:

- the authored relational path;
- the declared roots, consumer set, planning horizon, and search budget;
- equivalent alternatives considered;
- rules and evidence that made each alternative legal;
- required properties at each boundary;
- declared, estimated, and observed inputs with provenance;
- why an alternative was rejected or selected;
- where exploration stopped or was pruned; and
- how the selected plan differed from the target's realized and adapted plan.

This is essential for governed data work and is a differentiator from opaque generated SQL.

### 8. How should independent evidence providers integrate?

Research must establish a stable planning-context contract that gives locally built, client-built, and future managed providers equal access to Prism's evidence consideration without coupling the optimizer to storage or network access. It must test provenance, authority, scope, invalidation, reproducibility, contradictory evidence, missing evidence, and the explanation of how each supplied fact affected ranking or pruning.

### 9. How can plan evidence support change-impact analysis without moving operations into Prism?

Research should connect semantic plan diffs to stable deployed workload identities and relevant historical execution evidence. The goal is to test whether a proposed development plan's probable effects can be forecast with calibrated uncertainty and later backtested, not to make Prism infer operational causes, discover every downstream consumer, or automate a response.

### 10. Which distributed and streaming properties affect legality and selection?

Research must separate portable semantic requirements from target execution mechanics. For distributed batch work, it should determine which placement, locality, partitioning, exchange, resource, and failure facts Prism needs to rank alternatives without becoming a scheduler. For continuous work, it must define trace equivalence across append, update, upsert, and retraction modes; time and watermark behavior; bounded-state proofs; compatible shared state; committed frontiers; and the state reuse or migration evidence required before adaptive re-entry may change future processing.

### 11. How should Prism represent graph and recursive work?

Research must distinguish graph-shaped metadata from graph-query semantics and determine which property-graph, recursive, and fixpoint operators belong in Prism. Each supported family needs explicit identity, direction, label or type, path, duplicate, cycle, termination, ordering, result-shape, and incremental-update semantics. The memo should test when relational joins and recursion, factorized or adjacency-aware execution, and graph-native targets are equivalent; the cost model should measure degree distribution, frontier growth, graph cuts, iterations, convergence, state, and communication without turning them into legality facts.

## Evidence program

The research program should combine semantic, optimizer-complexity, target-comparison, evidence-provider, adaptive-execution, distributed-execution, streaming, graph-query, recursive-query, and change-impact evidence.

### dbt-like transformation graphs

Create a transparent corpus of dbt-style transformations, including chains of ephemeral models, repeated staging models, joins, aggregates, and incremental-model-adjacent patterns. The corpus should retain both model-graph provenance and compiled SQL, but it must not accidentally model dbt materialization semantics as ordinary relational equivalence.

The target test is:

```text
dbt-like SQL ──→ Spark SQL ──→ Catalyst/AQE                         native baseline
      │
      └─→ Polyglot AST → Prism authored graph → Prism memo → selected plan
                                                           ├─→ Substrait → DataFusion
                                                           └─→ PostgreSQL AST → SQL
```

The DataFusion path must not call DataFusion's SQL parser on the source SQL. The PostgreSQL path must generate a fresh Polyglot AST from Prism, testing separately selected inline and factored-sharing alternatives where permitted. Native Spark must retain Catalyst, cost-based optimization, and AQE as configured baselines rather than being weakened to make Prism look better. A future Spark target path must preserve the selected Prism requirements while leaving Spark-local physical optimization to Catalyst and AQE.

### Analytical-query benchmarks

Use TPC-DS for controlled decision-support queries and the Join Order Benchmark for difficult multi-join cardinality and ordering cases. These benchmarks do not replace dbt-like models; they prevent the research from being tuned solely to a transformation syntax. [TPC-DS][tpc-ds] [Join Order Benchmark][job]

### Optimizer-complexity stress corpus

Build graph families whose depth, breadth, expression size, join count, repeated-subgraph count, and number of requested outputs can be increased independently. Compare native Catalyst, DataFusion, PostgreSQL, and Prism behavior where the comparison is meaningful. Record planning wall time, plan-node growth, memo or rule-state size, planner memory, explored and pruned alternatives, fallback behavior, and plan stability. A target optimizer's poor result or failure is evidence only when the corpus, configuration, threshold, and failure mode are reproducible.

### Adaptive-execution studies

Create controlled estimation errors, skew, changing selectivity, and partition distributions. Record the pre-execution estimate, runtime observation, target-local adaptation, any coordinator-requested Prism replan, and the resulting unfinished plan. Compare one-shot planning, target-local adaptation alone, Prism replanning without target observations, and Prism replanning with scoped observations. The study must include cases where replanning is correctly declined because its cost, freshness, snapshot, or policy preconditions are not met.

### Distributed and streaming studies

Run equivalent bounded workloads in local and cluster modes with controlled locality, partitioning, exchange cost, skew, worker loss, and resource envelopes. Compare target-native planning with Prism target-independent and target-aware selection while preserving the same relational semantics and recording planning overhead, network and serialization cost, retries, partial execution, and target realization.

For continuous workloads, construct append, update, upsert, and retraction traces with event-time disorder, late data, watermark progress, state growth, backpressure, checkpoint recovery, and sink commits. Test rewrite and sharing candidates by trace or committed-effect equivalence, not one finite snapshot. Compare target-local adaptation with coordinator-requested Prism re-entry at compatible frontiers, including cases where replanning is correctly declined because state cannot be reused or migrated safely.

### Graph and recursive-query studies

Build property-graph and recursive workloads covering fixed-length patterns, variable-length reachability, cyclic graphs, shortest-path variants, repeated traversals, multi-root graph projections, and dynamic edge updates. Compare relational recursive or fixpoint plans, graph-aware relational techniques, and graph-native targets under one declared semantic profile. Record path or trace equivalence, duplicate and cycle behavior, degree and frontier distributions, iterations, convergence, intermediate growth, graph partition cuts, communication, state, planning cost, and target-specific indexes. Include cases where Prism must decline an equivalence or reuse claim because path, termination, or incremental-state semantics are insufficient.

### Development-to-production impact studies

For controlled workload changes, compare the semantic before-and-after plan diff, affected deployed workload identities, relevant historical executions, and predicted target effects before promotion. Record confidence, evidence coverage, alternative explanations, and unknown dependencies. After promotion, compare the forecast with observed latency, rows, bytes, scans, shuffles, spill, memory, and target-plan changes. The study must include correctly uncertain or declined forecasts when identity, history, or operational context is insufficient.

### Cross-target plan comparison

For each query, compare at least:

- declared roots, consumer set, planning horizon, and data snapshot;
- authored Prism graph size and shared-subgraph structure;
- memo alternatives, pruning decisions, optimization time, and planner memory;
- DataFusion logical and physical plans;
- PostgreSQL generated SQL and `EXPLAIN`/`EXPLAIN ANALYZE` output;
- Spark analyzed, optimized, initial physical, and final adaptive plans where exposed;
- graph-native or graph-aware target plans where a graph profile makes the comparison meaningful;
- selected Prism requirements versus target-realized and target-adapted plans;
- result equivalence under controlled fixtures; and
- observed scans, bytes, shuffles, memory, elapsed time, and spill behavior where each target exposes them.

Every comparison needs unchanged target-native baselines and explicit ablations: Prism target-independent selection, Prism target-aware selection, sharing enabled or disabled, and runtime evidence present or absent. No aggregate benchmark score is meaningful unless semantic-equivalence checks, hardware, data scale, target versions, optimizer settings, statistics state, cache state, concurrency, and configuration are recorded.

## Exploratory experiments

The following experiments were run on 2026-07-26 to test specific architectural seams before this whitepaper was drafted. They used IncQL commit `9e642e5`, Incan `0.5.0-dev.29`, Polyglot `0.6.1` with its PostgreSQL parser and generator features, DataFusion `53.1.0`, and an isolated native PostgreSQL `16.14` instance on Apple silicon. The fixtures and bridge code were deliberately throwaway and are not part of this repository. The results are therefore preliminary observations with enough method and output recorded here to explain the research direction; they are not a substitute for the published harness required by the evidence program above.

### Experiment 1: narrow Polyglot AST to Prism bridge

The first probe tested one deliberately narrow bidirectional mapping:

```sql
SELECT id, amount FROM orders
```

Polyglot parsed the statement as a PostgreSQL AST. The experimental ingress mapper converted it into a two-node Prism graph: `ReadNamedTable("orders") → SelectProject(id, amount)`. The egress mapper inspected those Prism nodes, constructed a fresh Polyglot `Select` AST, and generated the same SQL text. Two focused tests passed: the round trip above and structured rejection of `SELECT id FROM orders WHERE amount > 100`, because no predicate mapping had been implemented. The generated SQL was also executed against PostgreSQL 16.14 and returned the seeded rows `1 | 12.50` and `2 | 25.00`.

This established that the typed boundary is technically viable for a read/projection subset. It did not establish aliases, expressions, filtering, joins, aggregation, CTE bindings, dialect breadth, or a general semantic-equivalence mechanism.

### Experiment 2: complex SQL carrying capacity

The second probe isolated Polyglot's ability to preserve a query substantially beyond the bridge subset. The PostgreSQL input contained two dependent CTEs, a three-table join, a paid-order predicate, grouped arithmetic aggregation, `RANK() OVER (PARTITION BY ... ORDER BY ...)`, a nested `IN` subquery with `HAVING`, final ordering, and a limit. The first CTE, `order_totals`, was referenced both by `customer_rollup` and by the nested eligibility subquery.

The synthetic fixture contained four customers, six orders, and six order items. Polyglot parsed the full query and generated normalized PostgreSQL SQL. The generated text was not byte-identical to the formatted input, but executing both forms against PostgreSQL 16.14 returned the same ordered result:

```text
customer_id | region | revenue | order_count | revenue_rank
1           | north  | 150.00  | 2           | 1
3           | south  | 220.00  | 1           | 1
```

The experimental Prism bridge rejected this query at `WITH`, as designed, because the bridge implemented only an unfiltered single-table projection. This result separates two facts that would otherwise be easy to conflate: Polyglot could carry the complex PostgreSQL AST faithfully, while IncQL did not yet have the scoped CTE-binding and relational mappings needed to turn that AST into Prism semantics.

### Experiment 3: shared Prism subgraph and generated CTE egress

The third probe started from a non-SQL, programmatically authored Prism graph:

```text
Read(delta_sales_orders)
  → Filter(status = 'paid')
      → Join(shared filter, shared filter)
```

A focused IncQL test asserted that the optimized view contained exactly three nodes and that both join input identifiers pointed to the same filter node. That test passed. Its reported `311.54 s` wall time was dominated by Incan provider preparation and generated-Rust compilation; it is not a query-performance measurement.

A separate Rust prototype then manually mirrored that graph shape with fresh Polyglot AST builders under two egress policies. `inline` generated two derived tables containing the paid-order filter. `factor_shared` generated one `__incql_shared_1` CTE and referenced it twice. This prototype was not connected to the Prism test by an automatic Prism-to-Polyglot mapper, so it tested target representation rather than an end-to-end egress implementation.

The PostgreSQL fixture was:

| id | customer_id | status  | amount |
| --- | ----------- | ------- | ------ |
| 1  | 1           | paid    | 50.00  |
| 2  | 1           | paid    | 70.00  |
| 3  | 2           | paid    | 30.00  |
| 4  | 2           | pending | 100.00 |

Both generated statements returned the same five-row multiset: the four pairings of customer `1`'s two paid orders and the self-pairing of customer `2`'s paid order. Their row order differed because neither statement specified `ORDER BY`; comparison was therefore order-independent.

`EXPLAIN (COSTS OFF)` showed materially different PostgreSQL plan shapes:

| Egress form | Join shape | Source access |
| ----------- | ---------- | ------------- |
| Factored CTE | `Hash Join` | one `Seq Scan` on `delta_sales_orders`, followed by two `CTE Scan`s |
| Inline derived tables | `Nested Loop` with `Materialize` | two `Seq Scan`s on `delta_sales_orders` |

This is evidence that a generated CTE can encode a shared Prism-shaped relation and can change target plan structure. It is not evidence that the factored form is faster: the experiment recorded no stable elapsed-time, I/O, memory, spill, or scale measurements, and PostgreSQL's choice may change with statistics and data distribution.

### Experiment 4: incomplete DataFusion execution lane

A fourth test was written to register a three-row CSV source through IncQL, filter it to two rows, reuse that subframe in a join, and collect the expected four rows through DataFusion. The focused test run did not produce a completed DataFusion result. It was terminated after more than eight minutes spent in the Incan test preparation path, so neither success nor failure of the intended DataFusion plan was established. The provider-preparation delay is tracked publicly in [Incan issue 957][incan-provider-prep].

No experiment completed the desired dbt-like path from CTE-heavy SQL through Polyglot AST, scoped Prism bindings, ordinary Substrait lowering, and DataFusion execution. No experiment implemented automatic Prism memo exploration or cost-based selection between inline and factored representations.

### Interpretation

The experiments support four bounded conclusions: Polyglot is capable of carrying the relevant complex SQL structure; a simple typed AST-to-Prism mapping is feasible; current Prism can represent one structurally shared authored subgraph; and Polyglot can encode the corresponding target relation as either inline SQL or a generated PostgreSQL CTE with observably different plan shapes. They do not establish a complete bidirectional bridge, CTE ingress, DataFusion execution, an optimizer, or a performance advantage. Those missing links are the reason this whitepaper proposes a reproducible corpus, explicit relational properties, memo-based alternatives, and target-specific cost evidence.

## Staged research direction

1. **Research harness and corpus.** Publish fixtures, semantic-equivalence checks, plan capture, and reproducible target configurations before making performance claims.
2. **Semantic and planning scope.** Define relational equivalence profiles, evaluation multiplicity, declared roots, consumer sets, planning horizons, and result lifetimes before comparing alternatives.
3. **Relational completeness.** Strengthen Prism's relation identity, aliases, subqueries, joins, aggregates, windows, scoped bindings, and schema/property derivation.
4. **Tractable memo exploration.** Add a separate memo over the authored graph with an audited rule set, explicit property requirements, search budgets, pruning, graceful fallback, and measured planning cost.
5. **Reuse and placement selection.** Evaluate inline, target-local sharing, generated SQL CTEs, transient or durable materialization, placement, and exchange across local and cluster targets without assigning representation-specific lowering to Prism.
6. **Provider-neutral evidence ingress.** Validate one immutable planning-context contract across session, adapter, offline, test, and independently built evidence providers without giving Prism storage or retrieval responsibilities.
7. **Runtime evidence loop.** Transport scoped target observations into immutable planning contexts, distinguish target-local adaptation from coordinator-owned replanning, and preserve completed work, committed stream progress, state identity, and authored history.
8. **Distributed and streaming semantics.** Establish local-versus-cluster placement evidence, bounded-versus-unbounded legality, update and time properties, bounded-state requirements, trace-equivalence tests, and compatible continuous frontiers before optimizing streaming plans.
9. **Graph and recursive semantics.** Separate plan, lineage, and evidence graphs from user graph semantics; establish identity, path, recursion, fixpoint, termination, graph-sharing, and dynamic-update contracts before comparing relational and graph-native realizations.
10. **Change-impact evidence.** Connect semantic plan diffs, deployed workload identity, and historical observations in controlled development-to-production forecasting and backtesting studies while keeping operational interpretation outside Prism.
11. **Catalyst and target baselines.** Stress native Spark Catalyst/AQE, DataFusion, PostgreSQL, and declared graph targets alongside Prism, including cases where target-local optimization is already sufficient.
12. **Focused RFCs.** Promote stable rule families, planning-context transport, adaptive checkpoints, stream-property and state-migration contracts, graph and recursion contracts, materialization lifecycle, and target-realization contracts only after the research harness establishes them.

## Non-goals

This whitepaper does not propose:

- claiming that IncQL universally outperforms database optimizers;
- replacing Catalyst, DataFusion, PostgreSQL, Spark, dbt, Calcite, or another database engine;
- treating every CTE as materialized or every shared graph as beneficial to factor;
- introducing a general optimizer framework before relational semantics and evidence are ready;
- building a cluster scheduler, streaming runtime, checkpoint store, state backend, backpressure controller, or sink-commit protocol inside Prism;
- defining a complete property-graph, RDF, or graph-query language, graph database, graph index family, or graph algorithm library;
- making a public compatibility claim from parser, AST, or plan-shape evidence alone;
- collapsing policy, source locality, and target execution details into an untyped cost number;
- defining a required longitudinal evidence service or product package;
- making Prism infer operational causes, own organization-wide blast radius, issue alerts, or automate incident response.

## What success would look like

The research succeeds when IncQL can show, with reproducible evidence, that it:

- understands a complex multi-root transformation graph independently of its source syntax;
- remains within declared planning-time and memory budgets as graph complexity grows;
- preserves semantic and policy constraints while exploring alternatives;
- preserves distributed placement requirements and bounded or continuous semantics without turning scheduler or streaming-runtime mechanics into Prism semantics;
- distinguishes graph-shaped plans and evidence from graph-query semantics and proves any relational-to-graph realization equivalence under an explicit profile;
- accepts equivalent immutable planning evidence from independent providers and explains how it influenced selection;
- explains why a logical, sharing, placement, or exchange plan was selected and how the target realized it;
- improves or safely retains unfinished bounded work or future continuous work when scoped runtime evidence and any required state-compatibility proof become available;
- emits plan-diff and execution evidence suitable for calibrated external change-impact studies without claiming operational cause;
- produces equivalent results across declared execution targets; and
- demonstrates workload-level or target-specific improvements over intact native baselines without overstating them.

RFC 066 records the north-star contract for authored intent, memo exploration, bounded search, shared-work and placement selection, distributed and continuous properties, explicit graph and recursion semantics, provider-neutral evidence ingress, evidence progression, and coordinator-owned adaptive replanning. Focused follow-on RFCs can stabilize individual rule families, planning-context transport, materialization lifecycle, continuous-frontier and state-migration contracts, graph and fixpoint contracts, adaptive checkpoints, target-plan contracts, and SQL ingress/egress profiles as the evidence program resolves them.

## Acknowledgements

IncQL's proposed SQL boundary builds directly on the typed parsing and generation work in [Polyglot][polyglot]. Particular credit belongs to Polyglot's creator, [`tobilg`][tobilg], whose work makes it possible to investigate broad SQL ingress and egress without making SQL text Prism's semantic core.

<!-- References -->

[bigsubs]: https://www.microsoft.com/en-us/research/publication/selecting-subexpressions-to-materialize-at-datacenter-scale/
[cascades]: https://15721.courses.cs.cmu.edu/spring2018/papers/15-optimizer1/graefe-ieee1995.pdf
[calcite-materialized-views]: https://calcite.apache.org/docs/materialized_views.html
[calcite-volcano]: https://calcite.apache.org/javadocAggregate/org/apache/calcite/plan/volcano/VolcanoPlanner.html
[cloudviews]: https://www.microsoft.com/en-us/research/publication/computation-reuse-in-analytics-job-service-at-microsoft/
[datafusion-explain]: https://datafusion.apache.org/user-guide/sql/explain.html
[datafusion-logical-plans]: https://datafusion.apache.org/library-user-guide/building-logical-plans.html
[datafusion-optimizer]: https://datafusion.apache.org/library-user-guide/query-optimizer.html
[dbt-cte]: https://www.getdbt.com/blog/getting-started-with-cte
[dbt-ephemeral]: https://docs.getdbt.com/docs/build/materializations#ephemeral
[differential-dataflow]: https://www.microsoft.com/en-us/research/publication/differential-dataflow/
[duckpgq]: https://vldb.org/cidrdb/papers/2023/p66-wolde.pdf
[egg]: https://arxiv.org/abs/2004.03082
[graindb]: https://www.cidrdb.org/cidr2022/papers/p57-jin.pdf
[incan-provider-prep]: https://github.com/encero-systems/incan/issues/957
[job]: https://15721.courses.cs.cmu.edu/spring2020/papers/22-costmodels/p204-leis.pdf
[oasis]: https://www.microsoft.com/en-us/research/publication/query-optimizer-as-a-service-an-idea-whose-time-has-come/
[optd]: https://github.com/cmu-db/optd-original
[polyglot]: https://github.com/tobilg/polyglot
[provable-mqo]: https://arxiv.org/abs/1512.02568
[qo-advisor]: https://www.microsoft.com/en-us/research/publication/deploying-a-steered-query-optimizer-in-production-at-microsoft/
[query-resource]: https://www.microsoft.com/en-us/research/publication/query-and-resource-optimization-bridging-the-gap/
[relational-eqsat]: https://inst.eecs.berkeley.edu/~cs294-260/sp24/projects/contextual-eqsat/contextual-eqsat.pdf
[spark-aqe]: https://spark.apache.org/docs/latest/sql-performance-tuning.html#adaptive-query-execution
[spark-inline-cte]: https://github.com/apache/spark/blob/master/sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/optimizer/InlineCTE.scala
[spark-join-reorder]: https://github.com/apache/spark/blob/master/sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/optimizer/CostBasedJoinReorder.scala
[spark-reuse]: https://github.com/apache/spark/blob/master/sql/core/src/main/scala/org/apache/spark/sql/execution/reuse/ReuseExchangeAndSubquery.scala
[spark-sql-paper]: https://people.csail.mit.edu/matei/papers/2015/sigmod_spark_sql.pdf
[sse-mvr]: https://link.springer.com/article/10.1007/s10796-024-10506-w
[tobilg]: https://github.com/tobilg
[tpc-ds]: https://www.tpc.org/tpc_documents_current_versions/pdf/tpc-ds_v2.6.0.pdf
[volcano]: https://15721.courses.cs.cmu.edu/spring2017/papers/14-optimizer1/graefe-icde1993.pdf
