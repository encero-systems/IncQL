# Work with nested row values

This how-to shows how to create and inspect nested scalar values without changing relation cardinality.

## When to use this

Use nested scalar helpers when each input row should remain one output row. Use generator helpers such as `explode(...)` only when an array or struct should reshape the relation.

## Before you begin

You need a carrier, the nested input expressions, and the expected index or key semantics. Confirm whether positions are one-based before translating code from another DataFrame library.

## Add array-derived columns

Build arrays with `array(...)`, then inspect them with row-level helpers such as `cardinality(...)`, `array_contains(...)`, and `element_at(...)`.

```incan
from pub::incql.functions import array, array_contains, cardinality, col, element_at, lit

projected = (
    events
        .with_column("tags", array([lit("paid"), col("source")]))
        .with_column("tag_count", cardinality(col("tags")))
        .with_column("has_paid_tag", array_contains(col("tags"), "paid"))
        .with_column("first_tag", element_at(col("tags"), 1))
)
```

`element_at(...)`, `array_position(...)`, and `array_slice(...)` use one-based array positions.

## Verify the result

- Include empty, singleton, multi-value, and null-bearing nested values.
- Confirm that row count is unchanged for scalar nested helpers.
- Check one-based positions explicitly.
- Use a generator guide instead if the required output has more rows than the input.

## Current support and failure boundaries

Registered nested helpers preserve one expression result per input row and execute through the current DataFusion mappings where documented. Schema/type mismatches should remain authoring, lowering, or adapter diagnostics. These helpers do not imply typed variant execution; variant logical values have a separate current adapter boundary.

## Reference

Use [Nested data functions][nested] for exact helper contracts and [Expand rows with generators][generators] for cardinality-changing operations.

<!-- References -->

[generators]: generator_rows.md
[nested]: ../reference/functions/nested.md
