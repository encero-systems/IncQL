# Prism: relational reasoning and shared-work optimization

**Status:** Research whitepaper

**Date:** 2026-07-26

**Audience:** InQL and Incan contributors, database-systems researchers, data-platform architects, and prospective execution-engine collaborators.

**Scope:** This document is non-normative. It frames a research direction for Prism and defines evidence required before any product or performance claim. Focused RFCs must later specify public APIs, relational semantics, optimizer invariants, and execution contracts.

## Thesis

Prism should evolve from an immutable logical-plan store into InQL's relational reasoning engine: a system that can recognize equivalent and shared relational work, preserve the reasons a rewrite is legal, and select a target-appropriate execution or SQL representation.

The goal is not to make SQL CTEs work, nor to replace DataFusion, PostgreSQL, or another execution engine. The goal is to give InQL an optimizer-owned semantic graph that can improve plans arriving from Incan APIs, SQL, protocol frontends, Delta-like sources, and future data-product interfaces.

This matters because data transformations are increasingly authored as long chains of models, views, CTEs, and reusable staging steps. Those structures are useful to authors but are not necessarily the best execution structure. A capable Prism can treat them as relational intent, discover reusable work, and choose whether to inline, share, materialize, push down, repartition, or emit a different target shape.

## The product opportunity

dbt's `ephemeral` materialization demonstrates the pressure clearly: an ephemeral model is emitted as a CTE rather than persisted as a database object. That is convenient authoring structure, but it leaves the target engine to infer all reuse and execution choices from one large SQL statement. [dbt CTE guidance][dbt-cte] [dbt-ephemeral]

IncQL can offer a different contract:

- authors retain composable, named data transformations;
- Prism retains a typed graph of the actual relational dependencies;
- optimizer decisions remain inspectable rather than being hidden in generated SQL;
- execution targets receive plans shaped for their capabilities;
- SQL egress is one target representation, not the semantic source of truth.

The commercial hypothesis is deliberately narrower than “IncQL makes dbt faster.” It is that InQL can make complex transformation graphs more inspectable and, where evidence supports it, cheaper to execute across heterogeneous sources and targets. That hypothesis must be tested against realistic workloads and target plans before it becomes a product claim.

## A north-star architecture

```text
Authoring frontends
Incan carriers · query blocks · SQL AST · protocol plans · source adapters
                              │
                              ▼
Authored Prism graph
immutable relational intent · schema · lineage · policy and source evidence
                              │
                              ▼
Optimization memo
equivalence groups · alternative expressions · required properties · legality
                              │
                              ▼
Reuse and target planner
inline · share · materialize · push down · repartition · join/order alternatives
                              │
                              ▼
Target-specific lowering
Substrait/DataFusion · PostgreSQL SQL · other adapters
```

The authored graph and optimization memo must be distinct. The authored graph records what the author or frontend meant, including source provenance. The memo records semantically equivalent alternatives. An optimizer may choose a different alternative, but it must preserve a lineage and evidence path explaining why the alternative is valid and why it was selected.

This separation fits Prism's existing immutable, structurally shared planning model. It also prevents an optimizer implementation detail from becoming author-visible semantics.

## Research foundations

### Cascades, Volcano, and memo-based optimization

The most relevant architectural foundation is the Volcano/Cascades family. Cascades represents equivalent relational expressions in a memo, applies transformation and implementation rules selectively, and uses properties and cost to choose a plan. It is a stronger model than a fixed sequence of rewrites because it can retain alternatives instead of committing to the first locally plausible one. [Volcano][volcano] [Cascades][cascades]

Apache Calcite's VolcanoPlanner is a useful implementation reference. It has equivalence sets, dynamic-programming optimization, relational traits, rule registration, and materialization substitution. Calcite is not an InQL dependency proposal; its concepts are the relevant part. [Calcite VolcanoPlanner][calcite-volcano] [Calcite materialized views][calcite-materialized-views]

The first Prism memo should be smaller than a full Cascades implementation. It should start with logical equivalence and required properties that InQL can substantiate: schema, nullability, ordering, partitioning or locality, source capability, policy constraints, and target dialect or adapter requirements. Physical implementation alternatives belong only after those facts are trustworthy.

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

### DataFusion as an experimental target

DataFusion is valuable because it offers structured logical and physical planning, extensible optimizer rules, common-subexpression elimination, and `EXPLAIN ANALYZE` metrics. It should be used to test Prism's reasoning and target-lowering decisions, without becoming the semantic owner of InQL plans. [DataFusion optimizer][datafusion-optimizer] [DataFusion logical plans][datafusion-logical-plans] [DataFusion EXPLAIN][datafusion-explain]

The `optd` research project is particularly relevant: it explored a Cascades-based optimizer integrated with DataFusion, including physical-property support. It merits code and design study as a research reference. It is not yet a dependency or adoption decision. [optd overview][optd]

### Cost models need humility and feedback

Join order, sharing, and materialization decisions are only as good as their cardinality and cost assumptions. The Join Order Benchmark research found large cardinality-estimation errors even in industrial systems. Prism should therefore record assumptions, compare them with observed target metrics where available, and improve conservatively rather than assert global optimality. [Join Order Benchmark][job]

This is also why target choice matters. A PostgreSQL CTE, a DataFusion physical plan, and a remote warehouse may assign very different costs to sharing, scanning, repartitioning, and temporary materialization.

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

### 2. How should shared work be represented and selected?

Prism needs to distinguish a shared authored subgraph from an optimizer-selected shared execution result. The first is immutable intent; the second is a target-specific choice. The planner must account for reference count, estimated rows and bytes, source cost, memory budget, target capabilities, determinism, freshness, policy, and the cost of losing downstream specialization.

### 3. Which properties belong in the first memo?

The initial property vocabulary should be evidence-driven:

- output schema, nullability, and key facts;
- ordering and partitioning;
- source location and supported pushdowns;
- data format and connector capabilities;
- policy and admissibility constraints;
- target dialect and execution requirements; and
- cardinality and size estimates with provenance.

The memo must not quietly turn guessed values into facts.

### 4. How do we make optimizer choices explainable?

For every selected plan, InQL should eventually explain:

- the authored relational path;
- equivalent alternatives considered;
- rules and evidence that made each alternative legal;
- required properties at each boundary;
- estimated and observed costs where available; and
- why an alternative was rejected or selected.

This is essential for governed data work and is a differentiator from opaque generated SQL.

## Evidence program

The research program should use three complementary workload families.

### dbt-like transformation graphs

Create a transparent corpus of dbt-style transformations, including chains of ephemeral models, repeated staging models, joins, aggregates, and incremental-model-adjacent patterns. The corpus should retain both model-graph provenance and compiled SQL, but it must not accidentally model dbt materialization semantics as ordinary relational equivalence.

The target test is:

```text
dbt-like SQL → Polyglot AST → Prism authored graph → Prism memo → Substrait → DataFusion
                                                       └─────────→ PostgreSQL SQL
```

The DataFusion path must not call DataFusion's SQL parser on the source SQL. The PostgreSQL path must generate a fresh Polyglot AST from Prism, testing both inline and factored-CTE egress where permitted.

### Analytical-query benchmarks

Use TPC-DS for controlled decision-support queries and the Join Order Benchmark for difficult multi-join cardinality and ordering cases. These benchmarks do not replace dbt-like models; they prevent the research from being tuned solely to a transformation syntax. [TPC-DS][tpc-ds] [Join Order Benchmark][job]

### Cross-target plan comparison

For each query, compare at least:

- authored Prism graph size and shared-subgraph structure;
- memo alternatives and optimization time;
- DataFusion logical and physical plans;
- PostgreSQL generated SQL and `EXPLAIN`/`EXPLAIN ANALYZE` output;
- result equivalence under controlled fixtures; and
- observed scans, bytes, shuffles, memory, elapsed time, and spill behavior where each target exposes them.

No aggregate benchmark score is meaningful unless semantic-equivalence checks, hardware, data scale, target versions, and configuration are recorded.

## Staged research direction

1. **Research harness and corpus.** Publish fixtures, semantic-equivalence checks, plan capture, and reproducible target configurations before making performance claims.
2. **Relational completeness.** Strengthen Prism's relation identity, aliases, subqueries, joins, aggregates, windows, scoped bindings, and schema/property derivation.
3. **Cascades-lite memo.** Add a separate memo over the authored graph, starting with a small audited rule set and explicit property requirements.
4. **Reuse planner.** Evaluate inline, target-local sharing, generated SQL CTEs, and explicitly bounded transient materialization.
5. **Cost feedback.** Connect target statistics and observed metrics to recorded estimates without making execution engines semantic authorities.
6. **Focused RFCs.** Promote stable contracts only after the research harness establishes them.

## Non-goals

This whitepaper does not propose:

- claiming that IncQL universally outperforms database optimizers;
- replacing DataFusion, PostgreSQL, dbt, Calcite, or another database engine;
- treating every CTE as materialized or every shared graph as beneficial to factor;
- introducing a general optimizer framework before relational semantics and evidence are ready;
- making a public compatibility claim from parser, AST, or plan-shape evidence alone; or
- collapsing policy, source locality, and target execution details into an untyped cost number.

## What success would look like

The research succeeds when InQL can show, with reproducible evidence, that it:

- understands a complex transformation graph independently of its source syntax;
- preserves semantic and policy constraints while exploring alternatives;
- explains why a target plan was selected;
- produces equivalent results across declared execution targets; and
- demonstrates target-specific improvements on defined workloads without overstating them.

RFC 066 records the north-star contract for authored intent, memo exploration, shared-work selection, and target planning. Focused follow-on RFCs can stabilize individual rule families, property and statistics transport, materialization lifecycle, target-plan contracts, and SQL ingress/egress profiles as the evidence program resolves them.

<!-- References -->

[cascades]: https://15721.courses.cs.cmu.edu/spring2018/papers/15-optimizer1/graefe-ieee1995.pdf
[calcite-materialized-views]: https://calcite.apache.org/docs/materialized_views.html
[calcite-volcano]: https://calcite.apache.org/javadocAggregate/org/apache/calcite/plan/volcano/VolcanoPlanner.html
[datafusion-explain]: https://datafusion.apache.org/user-guide/sql/explain.html
[datafusion-logical-plans]: https://datafusion.apache.org/library-user-guide/building-logical-plans.html
[datafusion-optimizer]: https://datafusion.apache.org/library-user-guide/query-optimizer.html
[dbt-cte]: https://www.getdbt.com/blog/getting-started-with-cte
[dbt-ephemeral]: https://materialize.com/docs/manage/dbt/get-started/
[egg]: https://arxiv.org/abs/2004.03082
[job]: https://15721.courses.cs.cmu.edu/spring2020/papers/22-costmodels/p204-leis.pdf
[optd]: https://15721.courses.cs.cmu.edu/spring2024/project-showcase.html
[provable-mqo]: https://arxiv.org/abs/1512.02568
[relational-eqsat]: https://inst.eecs.berkeley.edu/~cs294-260/sp24/projects/contextual-eqsat/contextual-eqsat.pdf
[sse-mvr]: https://link.springer.com/article/10.1007/s10796-024-10506-w
[tpc-ds]: https://www.tpc.org/tpc_documents_current_versions/pdf/tpc-ds_v2.6.0.pdf
[volcano]: https://15721.courses.cs.cmu.edu/spring2017/papers/14-optimizer1/graefe-icde1993.pdf
