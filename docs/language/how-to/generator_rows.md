# Expand rows with generators

This how-to shows how to use generator helpers when nested values should reshape a relation.

## When to use this

Generators return `GeneratorApplication` values. Apply them through `generate(...)` so the relation keeps its input columns and appends the generated output aliases.

Use a generator when one input row can produce zero, one, or many output rows. Use nested scalar helpers instead when each input row must remain exactly one output row.

## Before you begin

You need a carrier with an array or struct-bearing expression, explicit output aliases, and a decision about ordinary versus outer generator behavior. The examples assume a deferred `LazyFrame`; collection still happens through `Session`.

## Explode array values

Use `explode(...)` when each array element should become a generated row.

```incan
from pub::incql import LazyFrame
from pub::incql.functions import col, explode
from models import Order

def order_lines(orders: LazyFrame[Order]) -> LazyFrame[Order]:
    return orders.generate(explode(col("line_items"), "line_item"))
```

## Inline struct arrays

Use `inline(...)` when the generated rows should expose one output column per struct field.

```incan
from pub::incql import LazyFrame
from pub::incql.functions import array, inline, lit, named_struct
from models import Order

def fixed_items(orders: LazyFrame[Order]) -> LazyFrame[Order]:
    rows = array([
        named_struct(["sku", "quantity"], [lit("A"), lit(1)]),
        named_struct(["sku", "quantity"], [lit("B"), lit(2)]),
    ])
    return orders.generate(inline(rows, ["sku", "quantity"]))
```

## Verify the result

- Count how many rows each representative input produces.
- Confirm generated aliases appear after the retained input columns.
- Include empty and null nested values when choosing between ordinary and outer variants.
- Inspect the plan if downstream lineage depends on the generated fields.

## Current support and failure boundaries

Registered generator helpers lower through IncQL's generator relation boundary and execute through the current DataFusion adapter where the listed mapping is implemented. Alias-count and input-shape errors belong to authoring or lowering; unsupported generator mappings belong to the adapter boundary.

`DataStream[T]` exposes carrier shape, but streaming-specific execution semantics remain future work.

## Reference

Use [Generator and table-valued functions][generators] for the full catalog, alias rules, and outer variants. Check [Backend capability matrix][capabilities] before relying on a new adapter.

<!-- References -->

[capabilities]: ../reference/capabilities.md
[generators]: ../reference/functions/generators.md
