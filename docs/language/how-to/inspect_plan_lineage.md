# Inspect a plan and lineage graph

This how-to shows how to inspect a Prism-backed lazy plan without executing it.

## When to use this

Use `inspect_plan(...)` when you need the full inspection record. Use `inspect_lineage(...)` when you only need the lineage graph.

Inspect before execution when a review, test, catalog, or diagnostic needs authored and rewritten plan evidence without binding a backend.

## Before you begin

You need a Prism-backed `LazyFrame[T]`. Build the plan far enough to include the transformations you want to inspect, and clone the carrier if later code also needs to consume it.

## Build a lazy plan

```incan
from pub::incql import LazyFrame
from pub::incql.functions import col, eq, str_lit, sum
from models import Order

def paid_spend_summary(orders: LazyFrame[Order]) -> LazyFrame[Order]:
    return (
        orders
            .filter(eq(col("status"), str_lit("paid")))
            .group_by([col("customer_id")])
            .agg([sum(col("amount"))])
    )
```

## Inspect the plan

```incan
from pub::incql import inspect_plan

summary = paid_spend_summary(orders)
inspection = inspect_plan(summary)

println(inspection.plan_id)
println(inspection.output_fields[0].name)
```

`inspect_plan(...)` does not execute the plan. It reads the local Prism state behind the lazy carrier and returns plan targets, output fields, Prism nodes, lineage, artifacts, diagnostics, and unsupported-evidence markers.

## Read lineage directly

```incan
from pub::incql import inspect_lineage

lineage = inspect_lineage(summary)

for edge in lineage.edges:
    println(edge.relationship.value())
```

Lineage is plan-local evidence. It explains how the authored plan relates fields and relations before backend binding or execution.

## Verify the result

- Match output fields to the plan shape you authored.
- Trace at least one filter, projection, aggregate, or join dependency back to its input.
- Read confidence and unsupported-evidence markers; do not treat a missing edge as proof that no relationship exists.
- Confirm that inspection did not require Session activation or backend execution.

## Current support and failure boundaries

Local inspection currently covers Prism-backed `LazyFrame[T]` plans. `DataFrame[T]` and `DataStream[T]` do not expose the same Prism-owned local inspection path. Evidence is plan-local and does not claim global catalog lineage, backend physical-plan lineage, or complete external metadata.

## Reference

Use [Local inspection][inspection] for exact record fields, confidence meanings, supported artifact families, and current limits.

<!-- References -->

[inspection]: ../reference/inspection.md
