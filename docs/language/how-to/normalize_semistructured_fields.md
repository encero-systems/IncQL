# Normalize semi-structured fields

This how-to shows how to derive stable string, JSON, CSV, and URL fields from scalar payload columns.

## When to use this

Use format helpers when the payload should stay a scalar expression in the current row. Use typed variant helpers when the plan needs kind-aware semi-structured inspection rather than normalized text.

## Before you begin

You need a carrier with string-bearing source expressions, an Incan model for schema-bearing JSON or CSV parsing, and explicit error expectations for malformed input. Decide whether you need normalized text or typed variant state before choosing the helper family.

## Derive normalized fields

Hash identifiers, extract URL and JSON fields, and validate schema-bearing payloads with model type parameters.

```incan
from pub::incql.functions import col, from_csv, from_json, get_json_object, parse_url, sha2, to_json

model EventPayload:
    type_ as "type": str

model CsvRow:
    id: int
    status: str

projected = (
    events
        .with_column("user_hash", sha2(col("user_id"), 256))
        .with_column("campaign", parse_url(col("landing_page"), "utm_campaign"))
        .with_column("event_type", get_json_object(col("payload"), "$.type"))
        .with_column("payload_obj", from_json[EventPayload](col("payload")))
        .with_column("row_fields", from_csv[CsvRow](col("csv_line")))
        .with_column("payload_out", to_json(col("event_type")))
)
```

`from_json[Model](...)` and `from_csv[Model](...)` derive their validation schema from the Incan model type argument.

## Verify the result

- Test one valid and one malformed payload.
- Confirm the model-derived schema matches the intended field names and types.
- Verify hashes and URL/JSON paths against stable fixture values.
- Check that row count remains unchanged.

## Current support and failure boundaries

Formatting helpers use registered scalar mappings and execute through the current DataFusion bridge where documented. A parsing or schema error is not evidence that typed variant execution is available. Typed variant plans preserve distinct semi-structured null and kind semantics, but the current DataFusion adapter rejects typed variant execution.

## Reference

Use [Format functions][format] for the complete helper catalog and [Variant functions][variants] when the plan needs typed kind-aware payload semantics.

<!-- References -->

[format]: ../reference/functions/format.md
[variants]: ../reference/functions/variants.md
