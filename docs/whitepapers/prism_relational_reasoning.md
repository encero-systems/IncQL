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
[incan-provider-prep]: https://github.com/encero-systems/incan/issues/957
[job]: https://15721.courses.cs.cmu.edu/spring2020/papers/22-costmodels/p204-leis.pdf
[optd]: https://15721.courses.cs.cmu.edu/spring2024/project-showcase.html
[provable-mqo]: https://arxiv.org/abs/1512.02568
[relational-eqsat]: https://inst.eecs.berkeley.edu/~cs294-260/sp24/projects/contextual-eqsat/contextual-eqsat.pdf
[sse-mvr]: https://link.springer.com/article/10.1007/s10796-024-10506-w
[tpc-ds]: https://www.tpc.org/tpc_documents_current_versions/pdf/tpc-ds_v2.6.0.pdf
[volcano]: https://15721.courses.cs.cmu.edu/spring2017/papers/14-optimizer1/graefe-icde1993.pdf
