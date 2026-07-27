# Read, collect, and write data

Use this guide to bind local file sources to logical names, keep relational work deferred, materialize a local result, or write a bounded result through the selected adapter.

## When to use this

Use this workflow when application code already knows the source URI and needs one explicit `Session` to own registration and execution. Use the lower-level `register(...)` plus `table(...)` surface when another layer constructs source descriptors independently.

## Before you begin

You need:

- a `Session`;
- a cloneable intended row model;
- a non-empty logical name unique within that Session;
- a readable CSV, Parquet, or Arrow IPC URI;
- a writable local CSV or Parquet target if you will write.

The source path and logical name are different facts. The URI tells the adapter where to read. The logical name is the identity carried by the deferred plan.

## Register a file-backed source

```incan
from pub::incql import LazyFrame, Session
from models import Order

mut session = Session.default()
orders: LazyFrame[Order] = session.read_csv("orders", "data/orders.csv")?
```

Equivalent convenience methods exist for Parquet and Arrow IPC:

```incan
archived: LazyFrame[Order] = session.read_parquet("orders_archive", "data/orders.parquet")?
events: LazyFrame[Order] = session.read_arrow("orders_arrow", "data/orders.arrow")?
```

These calls register sources and return deferred named-table plans. They do not collect rows.

## Collect a local result

```incan
paid = orders.filter(eq(col("status"), "paid"))
result = session.collect(paid)?

println(f"columns={result.resolved_columns():?}")
println(f"rows={result.row_count()}")
```

`collect(...)` executes the plan and returns a materialized `DataFrame[T]`. If the attempt itself needs evidence, use `collect_observed(...)` and inspect its `observation`, `data`, and `error` fields.

## Write a bounded result

```incan
from pub::incql import csv_sink, parquet_sink

session.write(paid.clone(), csv_sink("target/paid_orders.csv"))?
session.write(paid, parquet_sink("target/paid_orders.parquet"))?
```

The convenience forms `write_csv(...)` and `write_parquet(...)` accept a URI directly. Writes remain Session-owned; constructing a sink does not perform I/O.

## Verify the result

- Print `resolved_columns()` and `row_count()` after collection.
- Check that the target artifact exists after a successful write.
- Use `collect_observed(...)` or `write_observed(...)` when you also need a typed success-or-failure record.
- Confirm that a logical name appears only once in the Session; a different URI does not make a duplicate name valid.

## Current support and failure boundaries

The current DataFusion adapter executes local CSV, Parquet, and Arrow IPC read paths and CSV or Parquet writes. IncQL does not claim transactional writes, database DDL, remote catalog discovery, object-store credential management, or streaming sinks.

CSV registration discovers header fields for the planned source schema. The generic row-model parameter records intended shape, but complete field-for-field and type compatibility validation between every physical source and annotated model is not implemented yet.

Registration errors happen before planning. Substrait lowering errors happen before adapter execution. Backend planning, execution, and sink failures are returned as typed `SessionError` values; use the [troubleshooting guide][troubleshooting] to keep those boundaries separate.

## Reference

Use [Execution context][execution] for exact read, collect, write, observation, sink, and error contracts. Use the [backend capability matrix][capabilities] before depending on a new source or sink family.

<!-- References -->

[capabilities]: ../reference/capabilities.md
[execution]: ../reference/execution_context.md
[troubleshooting]: troubleshooting.md
