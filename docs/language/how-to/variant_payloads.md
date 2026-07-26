# Inspect typed variant payloads

This how-to shows how to parse JSON text into typed variant values and inspect their shape.

## When to use this

Use variant helpers when the plan needs kind-aware semi-structured inspection. Use the documented
[format functions][format] when normalized JSON text is enough.

## Before you begin

You need a string-producing payload expression and an explicit choice between strict and recoverable parsing. The current DataFusion adapter does not execute typed variant values: IncQL preserves their logical meaning and DataFusion returns a backend planning diagnostic. Use this guide for typed plan construction, inspection, and adapter work unless another adapter implements the runtime.

## Parse and inspect a payload

Parse once, then apply `typeof(...)`, `variant_get(...)`, and variant predicates to the typed value.

```incan
from pub::incql.functions import col, is_array, is_null_value, parse_variant_json, typeof, variant_get

payload = parse_variant_json(col("payload"))
literal_payload = parse_variant_json("{\"status\":\"paid\"}")

projected = (
    events
        .with_column("payload_kind", typeof(payload))
        .with_column("items_are_array", is_array(variant_get(payload, "$.items")))
        .with_column("dynamic_value", variant_get(literal_payload, col("json_path")))
        .with_column("deleted_was_variant_null", is_null_value(variant_get(payload, "$.deleted_at")))
)
```

Variant predicates accept `VariantExpr` values. They do not parse strings directly.

## Verify the result

- Inspect the plan and confirm the variant kind, encoding, parse mode, and path metadata.
- Include JSON null separately from SQL null in fixture expectations.
- Validate literal paths as `$`-rooted.
- On DataFusion, expect a typed backend planning diagnostic naming variant execution rather than materialized rows.

## Current support and failure boundaries

IncQL implements typed variant plan construction, strict and recoverable JSON parsing expressions, path access, kind predicates, and Substrait metadata. Typed variant execution is rejected by the current DataFusion adapter because it has no variant runtime implementation.

Use normalized JSON text helpers when current DataFusion execution is required and kind-aware typed variant semantics are not.

## Reference

Use [Variant functions][variants] for exact helper contracts, [Format functions][format] for executable text normalization, and the [backend capability matrix][capabilities] for current adapter status.

<!-- References -->

[capabilities]: ../reference/capabilities.md
[format]: ../reference/functions/format.md
[variants]: ../reference/functions/variants.md
