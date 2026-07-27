# Join two typed sources

Use this guide to combine two registered carrier values with an inner or left join while keeping source binding and execution explicit.

## When to use this

Use a method-chain join when the surrounding pipeline is already written with carrier methods. Use query-block `JOIN` or `LEFT JOIN` when clause-oriented authoring is clearer. Both routes build relational intent; neither one performs I/O by itself.

## Before you begin

You need:

- one `Session`;
- two uniquely named registered sources;
- same-family carriers, such as two `LazyFrame` values;
- a boolean join predicate;
- explicit right-side qualification when a field name is ambiguous.

The current method signature accepts another `Self`, so a `LazyFrame[T]` joins another compatible `LazyFrame`, a `DataFrame[T]` joins another `DataFrame`, and a `DataStream[T]` remains subject to the current non-executable streaming boundary.

## Method-chain form

Pass a right-side relation name when you need qualified right output fields:

```incan
from pub::incql import LazyFrame, Session, inspect_plan
from pub::incql.functions import col, eq
from models import Order

mut session = Session.default()
orders: LazyFrame[Order] = session.read_csv("orders", "data/orders.csv")?
order_archive: LazyFrame[Order] = session.read_csv("order_archive", "data/order_archive.csv")?

joined = orders.join(
    order_archive,
    eq(col("customer_id"), col("order_archive.customer_id")),
    "order_archive",
)
```

Use `left_join(...)` with the same predicate shape when all left rows must remain present.

The two carriers deliberately share `Order` as their row type. The current method signature accepts another `Self`, so
joining differently parameterized carriers is outside this method surface.

## Query-block form

Query blocks name the joined carrier directly and qualify its fields with that relation name:

```incan
import pub::incql

joined = query {
    FROM orders
    LEFT JOIN order_archive ON .customer_id == order_archive.customer_id
    SELECT
        .id as order_id,
        .amount as amount,
        order_archive.status as archived_status,
}
```

Inside `JOIN ... ON`, `.customer_id` refers to the primary `FROM` relation and
`order_archive.customer_id` refers to the joined relation. The selected aliases publish the output schema for later
clauses.

## Collect or inspect

```incan
inspection = inspect_plan(joined.clone())
println(f"join nodes={len(inspection.prism_nodes)}")

result = session.collect(joined)?
println(f"rows={result.row_count()}")
```

Inspection reads local Prism-backed plan evidence without backend binding. Collection crosses the Session and adapter boundary.

## Verify the result

- Inspect the planned output fields before execution.
- For an inner join, confirm unmatched rows are absent.
- For a left join, include at least one unmatched left row and confirm it remains.
- Check for duplicate or qualified field names before a downstream projection.
- Use lineage inspection when you need to prove that the predicate references both relations.

## Current support and failure boundaries

The documented v0.1 query-block surface includes inner `JOIN` and `LEFT JOIN`. Right and full outer joins are not part of the minimum query-block clause surface. Method joins are constrained to same-carrier inputs and the documented `ColumnExpr` predicate surface.

Join planning is typed and backend-neutral. The current DataFusion path executes supported inner and left plans. Ambiguous or missing fields should fail during authoring or lowering; a backend inability should remain an adapter diagnostic rather than changing the join's IncQL meaning.

`DataStream[T]` has carrier-level join shape but streaming-specific execution semantics remain future work.

## Reference

Use [Dataset methods][methods] for method signatures, [Query blocks][queries] for join resolution rules, and [Operator catalog][operators] for the advanced Substrait relation mapping.

<!-- References -->

[methods]: ../reference/dataset_methods.md
[operators]: ../reference/substrait/operator_catalog.md
[queries]: ../reference/query_blocks.md
