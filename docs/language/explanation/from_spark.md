# IncQL for Spark and DataFrame users

IncQL will feel familiar if you already build lazy DataFrame pipelines, but the ownership boundaries are different. IncQL is a typed relational layer inside Incan. It records semantic intent, can inspect that intent locally, lowers through portable Substrait, and asks a selected adapter to execute it. It is not a Spark compatibility layer or a distributed runtime.

!!! warning "Streaming is a type-level boundary, not an executable promise"
    `DataStream[T]` exists in the carrier hierarchy and preserves the distinction between bounded and unbounded data. Streaming-specific execution semantics remain future work. Do not read the familiar name as current structured-streaming support.

## Translate the mental model

| Spark or DataFrame idea | IncQL concept | Important difference |
| --- | --- | --- |
| `SparkSession` | `Session` | IncQL's Session owns logical source registration, adapter selection, binding, execution, collection, writes, and observations; it is not a cluster runtime |
| `DataFrame` | `DataFrame[T]` | materialized/eager bounded carrier with an intended row model |
| lazy DataFrame or logical plan | `LazyFrame[T]` | Prism-backed deferred carrier; local inspection is available before backend binding |
| transformation | carrier method or `query { ... }` clause | remains deferred on `LazyFrame[T]` |
| action such as `collect` or `write` | `Session.collect(...)`, `execute(...)`, or `write(...)` | the action crosses the explicit adapter boundary |
| schema | authored model intent, discovered source fields, and planned output schema | these facts are kept distinct instead of collapsed into one schema claim |
| query execution listener | execution observation | a typed evidence record returned by observed Session methods, not hidden telemetry |
| physical plan/runtime | adapter-owned planning and execution | DataFusion is the current reference adapter; IncQL does not make it the semantic owner |

## Compare one pipeline

A Spark-style chain might filter paid rows, group by customer, aggregate amounts, and order the result. The IncQL method-chain form keeps the same recognizable stages:

```incan
from pub::incql.functions import col, desc, eq, sum

summary = (
    orders
        .filter(eq(col("status"), "paid"))
        .group_by([col("customer_id")])
        .agg([sum(col("amount"))])
        .order_by([desc(col("sum_amount"))])
)
```

On a `LazyFrame`, this is still a plan. `session.collect(summary)?` asks the selected adapter to execute and materialize it. `inspect_plan(summary.clone())` can inspect Prism's local plan without executing it, while `session.collect_observed(summary)` returns the materialized result together with a structured success-or-failure observation.

## Where the analogy stops

- IncQL does not currently offer Spark's distributed scheduling, caching, shuffle management, cluster resource management, checkpointing, or streaming engine.
- `Session` is not a global process context. It is an explicit local owner for source registrations and adapter operations.
- IncQL row models describe intended typed shape. Source discovery and complete physical compatibility are separate evidence.
- DataFusion is the first concrete backend, not an instruction to write backend-specific semantics into IncQL plans.
- Quality and governance surfaces produce evidence. They do not silently quarantine, mask, or block work unless caller code makes that decision.

## A practical learning route

1. Run the [ten-minute quickstart][quickstart].
2. Read [Dataset carriers][carriers] to distinguish eager, deferred, bounded, and unbounded state.
3. Use [Build deferred dataset transformations][transformations] for familiar relational operations.
4. Use [Inspect a plan and lineage graph][inspection] before execution.
5. Use [Capture execution observations][observations] when the attempt itself needs evidence.
6. Check the [backend capability matrix][capabilities] before depending on an advanced function family.

<!-- References -->

[capabilities]: ../reference/capabilities.md
[carriers]: dataset_carriers.md
[inspection]: ../how-to/inspect_plan_lineage.md
[observations]: ../how-to/execution_observations.md
[quickstart]: ../quickstart.md
[transformations]: ../how-to/dataset_transformations.md
