# Add window columns

This how-to shows how to add relation-aware window outputs to a deferred carrier.

## When to use this

Window helpers produce one output value per input row while reading related rows from a partition. Place them with `with_window_column(...)`.

Use windows for ranking, running totals, offsets, and value comparisons that must retain input-row cardinality.

## Before you begin

You need a deferred carrier, partition and ordering fields, and an explicit frame when the calculation depends on frame bounds. Ranking, distribution, offset, and value helpers require ordering.

## Rank and compare rows inside a partition

Build a window spec, call `.over(spec)` on each window helper, and attach the resulting applications as named columns.

```incan
from pub::incql import LazyFrame
from pub::incql.functions import col, current_row, desc, lag, rank, sum, unbounded_preceding, window
from models import Order

def ranked_orders(orders: LazyFrame[Order]) -> LazyFrame[Order]:
    spec = window().partition_by([col("customer_id")]).order_by([desc(col("amount"))])
    return (
        orders
            .with_window_column("customer_rank", rank().over(spec))
            .with_window_column("previous_amount", lag(col("amount")).over(spec))
            .with_window_column(
                "running_amount",
                sum(col("amount")).over(spec.rows_between(unbounded_preceding(), current_row())),
            )
)
```

## Verify the result

- Include at least two partitions and tied order values.
- Confirm row count is unchanged.
- Verify the first and last row behavior for offset functions.
- Check frame boundaries for running aggregates.

## Current support and failure boundaries

The current DataFusion adapter executes the documented registered window mappings. Unsupported scalar expressions inside a window, missing required ordering, invalid arguments, or unknown helper mappings return explicit authoring, lowering, or backend planning diagnostics rather than silently changing the window.

`DataStream[T]` does not yet provide streaming-specific window execution semantics.

## Reference

Use [Window functions][windows] for exact helpers, ordering requirements, and frame constructors. Use the [backend capability matrix][capabilities] for current adapter status.

<!-- References -->

[capabilities]: ../reference/capabilities.md
[windows]: ../reference/functions/windows.md
