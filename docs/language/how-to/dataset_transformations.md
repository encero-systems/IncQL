# Build deferred dataset transformations

This how-to shows how to combine common carrier methods while keeping work deferred until a Session executes it.

## When to use this

Use this guide when you already have a `LazyFrame[T]` and want to compose projection, filtering, grouping, ordering, or limiting without executing the plan yet.

## Before you begin

Start with a typed lazy relation such as one returned by `Session.read_csv(...)`. If you need to create that relation first, follow [Read and write data](read_write_data.md).

## Add computed columns

Use `with_column(...)` to append a new computed column or replace an existing column by name.

```incan
from pub::incql import LazyFrame
from pub::incql.functions import add, col, mul
from models import Order

def enrich(orders: LazyFrame[Order]) -> LazyFrame[Order]:
    return (
        orders
            .with_column("amount_x2", mul(col("amount"), 2))
            .with_column("amount_plus_one", add(col("amount"), 1))
    )
```

## Filter, group, and aggregate

Use scalar helpers for row predicates and aggregate helpers for grouped measures.

```incan
from pub::incql import LazyFrame
from pub::incql.functions import avg, col, count, eq, sum
from models import Order

def paid_spend_by_customer(orders: LazyFrame[Order]) -> LazyFrame[Order]:
    return (
        orders
            .filter(eq(col("status"), "paid"))
            .group_by([col("customer_id")])
            .agg([
                sum(col("amount")),
                avg(col("amount")),
                count(),
            ])
    )
```

## Sort and limit

Use ordering helpers inside `order_by(...)`, then cap rows with `limit(...)`.

```incan
from pub::incql.functions import col, desc

top_orders = (
    orders
        .order_by([desc(col("amount"))])
        .limit(10)
)
```

These transforms stay deferred for `LazyFrame[T]`. Use a `Session` to execute, collect, or write the result. For exact method signatures and schema behavior, see [Dataset methods (Reference)](../reference/dataset_methods.md).

## Verify the result

Inspect the plan before execution when you want to confirm the authored transformations, then collect a bounded fixture and check its resolved columns, row count, and preview:

```incan
inspection = inspect_plan(top_orders)
println(inspection.output_fields)

result = session.collect(top_orders)?
println(result.columns)
println(result.row_count())
println(result.preview_text())
```

## Current support and failure boundaries

- These methods build deferred plan state; they do not execute work until a `Session` operation runs it.
- Column resolution is schema-aware. Unknown or ambiguous fields are rejected rather than guessed.
- Backend execution depends on the selected adapter. The bundled DataFusion adapter covers the core transforms shown here; consult the capability matrix before relying on a specialized function.

## Reference

- [Dataset methods](../reference/dataset_methods.md)
- [Function catalog](../reference/functions/index.md)
- [Backend capability matrix](../reference/capabilities.md)
- [Inspect a plan and lineage graph](inspect_plan_lineage.md)
