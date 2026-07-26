# Prism: relational reasoning and shared-work optimization

**Status:** Research whitepaper

**Date:** 2026-07-26

**Audience:** IncQL and Incan contributors, database-systems researchers, data-platform architects, and prospective execution-engine collaborators.

**Scope:** This document is non-normative. It frames a research direction for Prism and defines evidence required before any product or performance claim. RFC 066 records the normative north-star boundary; focused follow-on RFCs must specify stable public APIs, individual rewrite families, statistics transport, materialization lifecycle, and adaptive execution contracts.

## Thesis

Prism should evolve from an immutable logical-plan store into IncQL's relational reasoning engine: a system that remains tractable over large transformation graphs, recognizes equivalent and shared relational work, preserves the reasons a rewrite is legal, and selects logical, sharing, placement, and exchange requirements before external target lowerers and execution engines choose their representations and physical plans.

The goal is not to make SQL CTEs work, nor to replace Catalyst, DataFusion, PostgreSQL, Spark, or another target optimizer or execution engine. The goal is to give IncQL an optimizer-owned semantic graph that can improve plans arriving from Incan APIs, SQL, protocol frontends, Delta-like sources, and future data-product interfaces before target-specific optimization begins.

This matters because data transformations are increasingly authored as long chains of models, views, CTEs, and reusable staging steps. Those structures are useful to authors but are not necessarily the best execution structure. A capable Prism can treat them as relational intent, discover reusable work across declared consumers and planning horizons, and select whether work should be inlined, shared, materialized, pushed down, repartitioned, or placed elsewhere. Target lowerers and engines then realize and refine that selection.

## The product opportunity

dbt's `ephemeral` materialization demonstrates the pressure clearly: an ephemeral model is emitted as a CTE rather than persisted as a database object. That is convenient authoring structure, but it limits the target optimizer to the relational structure and context visible in the submitted statement. [dbt CTE guidance][dbt-cte] [dbt-ephemeral]

IncQL can offer a different contract:

- authors retain composable, named data transformations;
- Prism retains a typed graph of the actual relational dependencies;
- optimizer decisions remain inspectable rather than being hidden in generated SQL;
- Prism can reason across declared outputs and heterogeneous candidate targets before committing to one engine's plan;
- target lowerers receive selected logical, placement, exchange, and sharing requirements;
- runtime observations can return as scoped evidence for bounded replanning and later executions; and
- SQL egress is one target representation, not the semantic source of truth.

The commercial hypothesis is not merely that IncQL makes generated SQL faster. It is that IncQL can optimize relational intent before it collapses into one target's SQL or physical plan, across authoring frontends, transformation roots, executions, and heterogeneous targets, while retaining the evidence that makes equivalence, sharing, and placement decisions legal and explainable. No target-local optimizer can act on IncQL context that it never receives. Whether this wider decision surface produces cheaper or more reliable execution remains a measured hypothesis, not a performance claim.

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
        Optimization memo ◄──────── Optional planning context
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
        at a bounded adaptive checkpoint
```

The authored graph and optimization memo must be distinct. The authored graph records what the author or frontend meant, including source provenance. The memo records semantically equivalent alternatives. An optimizer may choose a different alternative, but it must preserve a lineage and evidence path explaining why the alternative is valid and why it was selected. Prism must also produce a valid target-independent logical result when the optional planning-evidence input is absent.

Target realization and execution remain outside Prism. A target engine may refine or replace physical choices, and a coordinator may later invoke Prism again with an immutable observation snapshot at an explicit adaptive checkpoint. Replanning derives a new selection for unfinished work; it does not mutate authored history or completed execution.

This separation fits Prism's existing immutable, structurally shared planning model. It also prevents an optimizer implementation detail or runtime observation from becoming author-visible semantics.

## Research foundations

### Cascades, Volcano, and memo-based optimization

The most relevant architectural foundation is the Volcano/Cascades family. Cascades represents equivalent relational expressions in a memo, applies transformation and implementation rules selectively, and uses properties and cost to choose a plan. It is a stronger model than a fixed sequence of rewrites because it can retain alternatives instead of committing to the first locally plausible one. [Volcano][volcano] [Cascades][cascades]

Apache Calcite's VolcanoPlanner is a useful implementation reference. It has equivalence sets, dynamic-programming optimization, relational traits, rule registration, and materialization substitution. Calcite is not an IncQL dependency proposal; its concepts are the relevant part. [Calcite VolcanoPlanner][calcite-volcano] [Calcite materialized views][calcite-materialized-views]

The first Prism memo should be smaller than a full Cascades implementation. It should start with logical equivalence and required properties that IncQL can substantiate: schema, nullability, ordering, partitioning or locality, source capability, policy constraints, and target dialect or adapter requirements. Physical implementation alternatives belong only after those facts are trustworthy.

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

### DataFusion as an experimental target

DataFusion is valuable because it offers structured logical and physical planning, extensible optimizer rules, common-subexpression elimination, and `EXPLAIN ANALYZE` metrics. It should be used to test Prism's reasoning and external target-realization boundary, without becoming the semantic owner of IncQL plans. [DataFusion optimizer][datafusion-optimizer] [DataFusion logical plans][datafusion-logical-plans] [DataFusion EXPLAIN][datafusion-explain]

The `optd` research project is particularly relevant: it explored a Cascades-based optimizer integrated with DataFusion, including physical-property support. It merits code and design study as a research reference. It is not yet a dependency or adoption decision. [optd overview][optd]

### Spark Catalyst and adaptive execution

Spark is essential prior art, not merely another target. Spark SQL showed that SQL and typed DataFrame authoring can converge on a common logical plan before physical execution. Catalyst provides composable tree transformations and extensible rule batches; Spark also implements statistics-informed dynamic-programming join reordering, CTE inlining governed by reference count and determinism, and physical reuse of equivalent exchanges and subqueries. [Spark SQL and Catalyst][spark-sql-paper] [Spark join reordering][spark-join-reorder] [Spark CTE inlining][spark-inline-cte] [Spark exchange and subquery reuse][spark-reuse]

Adaptive Query Execution strengthens that design with runtime statistics. Spark can revise join strategies, partitioning, and skew handling after execution has produced better evidence. That is a direct precedent for treating optimization as a progression from inferred facts, through estimates, to observations rather than as a one-shot compile-time pass. [Spark adaptive query execution][spark-aqe]

Catalyst also sharpens Prism's differentiation. Building a typed relational graph before SQL or physical planning is not novel by itself. Catalyst is primarily responsible for producing and adapting Spark execution, whereas Prism's proposed responsibility spans declared transformation roots, workload-level reuse, heterogeneous candidate targets, policy and semantic evidence, and explicit placement or exchange before target-local optimization. When Spark is selected, Catalyst and AQE should remain authoritative for Spark-local physical decisions.

The research must not assert that Catalyst fails on complex plans merely from practitioner experience. It should test that hypothesis. CTE-heavy and deeply composed workloads must measure optimizer wall time, rule iterations where observable, logical and physical plan growth, driver memory, generated-plan size, plan stability, and runtime quality as graph complexity increases. Spark is both a design reference and an adversarial baseline.

### Cost models need humility, runtime evidence, and bounded adaptation

Join order, sharing, and materialization decisions are only as good as their cardinality and cost assumptions. The Join Order Benchmark research found large cardinality-estimation errors even in industrial systems. Prism should therefore record assumptions, compare them with observed target metrics where available, and improve conservatively rather than assert global optimality. [Join Order Benchmark][job]

This is also why target choice matters. A PostgreSQL CTE, a DataFusion physical plan, and a remote warehouse may assign very different costs to sharing, scanning, repartitioning, and temporary materialization.

Planning evidence has at least three distinct classes:

- **declared or inferred facts**, such as schema, keys, constraints, policy, and logically derived bounds;
- **pre-execution estimates**, such as row count, distinct values, histograms, file sizes, partition metadata, and target costs; and
- **runtime observations**, such as actual rows and bytes, selectivity, skew, shuffle, spill, memory, latency, and realized target decisions.

An observation is not timeless truth. It is evidence about a particular plan identity, data snapshot, parameter shape, semantic profile, target configuration, and execution attempt. Reuse requires provenance, scope, freshness, confidence, and invalidation rules.

Target engines remain free to adapt their physical execution internally. In addition, a coordinator may establish an explicit adaptive checkpoint and invoke Prism again with an immutable observation snapshot. Prism may reconsider only unfinished logical, placement, exchange, sharing, or materialization choices. Completed work, authored intent, transaction and snapshot guarantees, and policy constraints remain fixed. Replanning must have a bounded cost and a legal fallback; an optimizer that spends more than the opportunity it can recover has failed.

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

## Evidence program

The research program should combine semantic, optimizer-complexity, target-comparison, and adaptive-execution evidence.

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

### Cross-target plan comparison

For each query, compare at least:

- declared roots, consumer set, planning horizon, and data snapshot;
- authored Prism graph size and shared-subgraph structure;
- memo alternatives, pruning decisions, optimization time, and planner memory;
- DataFusion logical and physical plans;
- PostgreSQL generated SQL and `EXPLAIN`/`EXPLAIN ANALYZE` output;
- Spark analyzed, optimized, initial physical, and final adaptive plans where exposed;
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
5. **Reuse and placement selection.** Evaluate inline, target-local sharing, generated SQL CTEs, transient or durable materialization, placement, and exchange without assigning representation-specific lowering to Prism.
6. **Runtime evidence loop.** Transport scoped target observations into immutable planning contexts, distinguish target-local adaptation from coordinator-owned replanning, and preserve completed work and authored history.
7. **Catalyst and target baselines.** Stress native Spark Catalyst/AQE, DataFusion, and PostgreSQL alongside Prism, including cases where target-local optimization is already sufficient.
8. **Focused RFCs.** Promote stable rule families, observation transport, adaptive checkpoints, materialization lifecycle, and target-realization contracts only after the research harness establishes them.

## Non-goals

This whitepaper does not propose:

- claiming that IncQL universally outperforms database optimizers;
- replacing Catalyst, DataFusion, PostgreSQL, Spark, dbt, Calcite, or another database engine;
- treating every CTE as materialized or every shared graph as beneficial to factor;
- introducing a general optimizer framework before relational semantics and evidence are ready;
- making a public compatibility claim from parser, AST, or plan-shape evidence alone; or
- collapsing policy, source locality, and target execution details into an untyped cost number.

## What success would look like

The research succeeds when IncQL can show, with reproducible evidence, that it:

- understands a complex multi-root transformation graph independently of its source syntax;
- remains within declared planning-time and memory budgets as graph complexity grows;
- preserves semantic and policy constraints while exploring alternatives;
- explains why a logical, sharing, placement, or exchange plan was selected and how the target realized it;
- improves or safely retains unfinished work when scoped runtime evidence becomes available;
- produces equivalent results across declared execution targets; and
- demonstrates workload-level or target-specific improvements over intact native baselines without overstating them.

RFC 066 records the north-star contract for authored intent, memo exploration, bounded search, shared-work and placement selection, evidence progression, and coordinator-owned adaptive replanning. Focused follow-on RFCs can stabilize individual rule families, statistics and observation transport, materialization lifecycle, adaptive checkpoints, target-plan contracts, and SQL ingress/egress profiles as the evidence program resolves them.

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
[egg]: https://arxiv.org/abs/2004.03082
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
