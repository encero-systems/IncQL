# Estimate approximate metrics

This how-to shows how to opt in to approximate aggregate helpers when exact results are not required.

## When to use this

Use approximate helpers explicitly. IncQL does not silently replace exact aggregates with approximate implementations because a backend can do so.

Use this path for exploratory metrics or deliberately approximate reporting where the caller accepts the registered algorithm contract. Keep exact aggregates when approximation would change a governed or financial decision.

## Before you begin

You need a numeric or identifier-bearing carrier, the grouping fields for the output grain, and an explicit decision that approximation is acceptable. The current DataFusion adapter executes `approx_count_distinct(...)` and `approx_percentile(...)`; approximation remains visible in IncQL rather than being selected silently by the backend.

## Estimate distinct counts and percentiles

Group the relation normally, then use approximate aggregate measures inside `agg(...)`.

```incan
from pub::incql.functions import approx_count_distinct, approx_percentile, col

summary = (
    events
        .group_by([col("campaign_id")])
        .agg([
            approx_count_distinct(col("user_id")),
            approx_percentile(col("latency_ms"), 0.95),
        ])
)
```

`approx_percentile(...)` accepts a percentile from `0.0` through `1.0` and an optional positive accuracy value.

## Verify the result

- Confirm the output grain has one row per grouping key.
- Compare a small fixture with exact `count_distinct(...)` or a sorted exact percentile calculation so the approximation is understood.
- Keep the approximate helper name visible in output aliases or downstream metadata.
- Test the requested percentile and accuracy values at their allowed boundaries.

## Current support and failure boundaries

The DataFusion adapter maps `approx_count_distinct(...)` to its approximate-distinct implementation and `approx_percentile(...)` to its approximate-percentile implementation. The approximation algorithm and parameters remain part of the IncQL contract; an adapter must not silently substitute exact behavior or a different request shape.

Typed HyperLogLog sketch state is a separate surface. It is preserved in IncQL plans but is not executable on the current DataFusion adapter.

## Reference

Use [Approximate functions][approximate] for exact helper contracts and [Backend capability matrix][capabilities] for the current adapter boundary.

<!-- References -->

[approximate]: ../reference/functions/approximate.md
[capabilities]: ../reference/capabilities.md
