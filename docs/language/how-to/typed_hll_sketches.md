# Build typed HyperLogLog sketches

This how-to shows how to create, merge, and estimate typed HyperLogLog sketch state.

## When to use this

Use sketch helpers when approximate state itself needs to flow through a plan. Use `approx_count_distinct(...)` when the plan only needs one aggregate estimate.

## Before you begin

You need a defined sketch value domain, precision, serialization format, and merge-compatibility policy. The current DataFusion adapter does not execute typed sketch state: IncQL preserves the typed plan and DataFusion returns a backend planning diagnostic. Use this guide for plan construction, inspection, portability, and adapter work—not for a successful DataFusion materialization.

## Build daily sketches

Aggregate source values into typed sketch state with `hll_sketch(...)`.

```incan
from pub::incql.functions import col, hll_sketch

daily = events.group_by([col("event_date")]).agg([
    hll_sketch(col("user_id"), precision=14),
])

literal_seed = events.group_by([col("event_date")]).agg([
    hll_sketch("anonymous-user", precision=14),
])
```

## Merge and estimate sketches

Reference sketch columns with matching logical type metadata, then merge and estimate them.

```incan
from pub::incql.sketches import hll_estimate, hll_merge, hll_type, sketch_col

monthly = daily.group_by([col("month")]).agg([
    hll_merge(sketch_col("hll_sketch_user_id", hll_type(precision=14))),
])

reported = monthly.with_column(
    "estimated_users",
    hll_estimate(sketch_col("hll_merge_hll_sketch_user_id", hll_type(precision=14))),
)
```

Sketches can merge only when family, value domain, precision, and serialization format match.

## Verify the result

- Inspect the plan and confirm sketch family, value domain, precision, and format metadata.
- Test that incompatible sketch types are rejected before merge.
- Check adapter coverage before execution.
- On DataFusion, expect a typed backend planning diagnostic naming typed sketch execution rather than a materialized estimate.

## Current support and failure boundaries

IncQL implements typed HyperLogLog plan construction, merge compatibility, estimate, serialization, deserialization, and Substrait extension metadata. The current DataFusion adapter deliberately rejects typed sketch execution because it has no sketch runtime implementation.

For an estimate that DataFusion can execute today without carrying sketch state, use `approx_count_distinct(...)`.

## Reference

Use [Sketch functions][sketches] for exact helper contracts, [Approximate functions][approximate] for executable aggregate estimates, and the [backend capability matrix][capabilities] for the adapter boundary.

<!-- References -->

[approximate]: ../reference/functions/approximate.md
[capabilities]: ../reference/capabilities.md
[sketches]: ../reference/functions/sketches.md
