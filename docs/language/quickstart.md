# Ten-minute IncQL quickstart

This quickstart takes one included CSV from a typed source to a materialized result. You will register the source with a `Session`, describe deferred relational work in a SQL-familiar `query` block, collect the result through the current DataFusion adapter, and verify the rows you received.

## What you will prove

By the end, you will have evidence for four separate facts:

1. the IncQL package can be resolved from a local Incan project;
2. a logical source name can be bound to a CSV file;
3. a checked query can become a deferred `LazyFrame`;
4. `Session.collect(...)` can execute and materialize that plan.

This does not prove that IncQL is a database, SQL server, scheduler, or transaction manager. It proves the local typed relational path used throughout these docs.

## Before you begin

You need:

- an Incan toolchain compatible with this checkout;
- a working Rust and CMake build toolchain for the local IncQL dependency;
- a local IncQL checkout.

The example uses a path dependency because this documentation does not claim a registry release.

## Run the included project

From the IncQL repository root:

```bash
cd examples/quickstart
incan lock
incan run src/main.incn --locked
```

The complete program is deliberately small:

```incan
--8<-- "examples/quickstart/src/main.incn"
```

The source fixture contains four orders. Two have the status `paid`. The query keeps those rows, publishes a three-column result schema, and orders the rows by amount before `collect(...)` crosses the execution boundary.

## Expected result

The exact preview formatting is diagnostic text rather than a stable serialization contract, but the evidence should include:

```text
columns: ["order_id", "customer_id", "amount"]
rows: 2
IncQL quickstart completed
```

The preview should place order `1001` before order `1003`.

## Verify each boundary

- If `incan lock` succeeds, the local IncQL dependency resolved.
- If `read_csv(...)` succeeds, the logical name and CSV source were registered and a lazy carrier was returned.
- If the program reports the three resolved columns, the query projection reached the planned output schema.
- If it reports two rows, the filter and collection reached the adapter.

## One common failure

`Session.read_csv(...)` rejects duplicate logical names in the same Session. If you register another source as `"quickstart_orders"`, the result is a typed duplicate-registration error. Use a stable unique logical name for each source binding; changing the file path does not change that rule.

For other failure families, use [Troubleshoot an IncQL pipeline][troubleshooting].

## Choose what to learn next

- If you know SQL, continue with [IncQL for SQL users][from-sql] and then the query-block chapters in the Book.
- If you know Spark or DataFrame APIs, continue with [IncQL for Spark and DataFrame users][from-spark].
- If you build Incan applications, continue with [the IncQL Book][book].
- If you want exact signatures and current support, use [Execution context][execution-reference] and the [backend capability matrix][capabilities].

<!-- References -->

[book]: tutorials/book/index.md
[capabilities]: reference/capabilities.md
[execution-reference]: reference/execution_context.md
[from-spark]: explanation/from_spark.md
[from-sql]: explanation/from_sql.md
[troubleshooting]: how-to/troubleshooting.md
