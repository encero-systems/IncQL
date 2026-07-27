# Backend capability matrix

This page summarizes current IncQL v0.1 package behavior and the first DataFusion adapter. It is a decision aid, not a promise that every combination of operation, input type, and backend version has been certified.

Use three status meanings:

- **Executable** — covered by the current DataFusion implementation and repository tests for the listed path.
- **Plan/evidence only** — IncQL preserves typed semantic intent or local evidence, but the current adapter does not execute that feature.
- **Outside the contract** — IncQL does not claim ownership of the capability.

## Carriers and execution

| Capability | IncQL status | Current DataFusion path | Boundary |
| --- | --- | --- | --- |
| `LazyFrame[T]` planning | Executable | Prism-backed plans lower to Substrait and can be executed or collected | intended model annotations do not yet prove complete physical source compatibility |
| `DataFrame[T]` materialization | Executable | returned by `Session.collect(...)` with resolved columns, row count, and preview text | preview text is diagnostic, not a stable serialization format |
| `DataStream[T]` carrier | Plan/type boundary only | no streaming execution path | streaming-specific execution semantics remain future work |
| `Session.execute(...)` | Executable | validates, lowers, binds, and runs while returning a deferred carrier | it is a checkpoint, not local row materialization |
| `Session.collect(...)` | Executable | materializes a local `DataFrame[T]` | memory, scale, and physical behavior remain backend-owned |

## Sources and sinks

| Capability | IncQL API | Current status | Boundary |
| --- | --- | --- | --- |
| CSV read | `session.read_csv(name, uri)` | Executable | registers a logical name and discovers CSV header fields; full model compatibility validation is not complete |
| Parquet read | `session.read_parquet(name, uri)` | Executable adapter path | returns deferred work; physical schema evidence is not represented as an authored model proof |
| Arrow IPC read | `session.read_arrow(name, uri)` | Executable adapter path | returns deferred work through Session registration |
| CSV write | `session.write_csv(...)` or `csv_sink(...)` | Executable for bounded inputs | no transactional guarantee is claimed |
| Parquet write | `session.write_parquet(...)` or `parquet_sink(...)` | Executable for bounded inputs | no transactional guarantee is claimed |
| databases, object stores, remote catalogs | no general v0.1 connector surface | Outside the contract | add through an adapter or product-owned integration rather than embedding credentials in plans |
| DDL, migrations, transactions | no v0.1 API | Outside the contract | owned by the database, storage system, or application platform |

## Relational authoring

| Capability | Method surface | Query-block surface | Current DataFusion path |
| --- | --- | --- | --- |
| filter and projection | `filter`, `select`, `with_column` | `WHERE`, `SELECT` | Executable |
| grouping and aggregates | `group_by(...).agg(...)` | `GROUP BY` plus aggregate helpers | Executable for registered exact and supported approximate aggregates |
| order and limit | `order_by`, `limit` | `ORDER BY`, `LIMIT` | Executable |
| inner and left joins | `join`, `left_join` | `JOIN`, `LEFT JOIN` | Executable for the documented same-carrier and predicate surface |
| row expansion | `generate(...)` | `EXPLODE` | Executable for registered generator mappings |
| windows | `with_window_column(...)` | `WINDOW BY` | Executable for the documented registered window bridge; unsupported expression shapes return backend planning diagnostics |
| set operations | lower relational support exists | no query-block clause is documented | use the exact carrier contract; do not assume SQL `UNION` text is accepted |
| right/full outer joins, CTEs, subqueries | no minimum query-block surface | not documented clauses | no general SQL compatibility claim |

## Function and logical-value families

| Family | IncQL semantic status | Current DataFusion status |
| --- | --- | --- |
| core scalar and exact aggregate helpers | registered typed expressions | Executable where listed in Function Reference |
| approximate aggregates | explicit approximate semantics | `approx_count_distinct` and `approx_percentile` are mapped and tested |
| nested and formatting helpers | registered typed expressions | Executable where listed; invalid arguments remain typed planning or adapter errors |
| generators and windows | relation-aware applications | Executable for documented mappings; unsupported bridge shapes fail explicitly |
| typed HyperLogLog sketch state | typed sketch planning, merge compatibility, and Substrait metadata | rejected with a DataFusion backend planning diagnostic because no sketch runtime implementation exists |
| typed variant values | typed variant planning, path access, kind predicates, and Substrait metadata | typed variant execution is rejected with a DataFusion backend planning diagnostic because no variant runtime implementation exists |

## Evidence surfaces

| Capability | Current status | What it does not prove |
| --- | --- | --- |
| local plan inspection and lineage | Available for Prism-backed `LazyFrame[T]` | not backend execution, global lineage, or complete external-catalog evidence |
| execution observations | Available for execute, collect, and write attempts | no row payloads, backend logs, byte counts, or trace IDs are fabricated when unavailable |
| adapter coverage records | Available for inferred and caller-supplied requirements | `Unknown` is not equivalent to covered |
| quality observations | Available for the documented assertion set | observations do not filter, quarantine, or stop work automatically |
| governed attributes and policy checkpoints | Available as local evidence records | they do not mask fields, certify compliance, or replace a policy engine |

## How to use this matrix

1. Check the carrier and source path first.
2. Check the specific relational or function family.
3. If the operation is capability-dependent, use `Session.check_plan_coverage(...)` or an explicit requirement record where the current inspection surface can express it.
4. Treat a returned backend diagnostic as a boundary answer, not permission to rewrite IncQL semantics around one backend.
5. Use the exact Reference page and relevant test-backed Guide before relying on a broad row in this matrix.

For source, sink, observation, and coverage signatures, see [Execution context][execution]. For exact relational signatures, see [Dataset methods][methods]. For query clauses, see [Query blocks][queries].

<!-- References -->

[execution]: execution_context.md
[methods]: dataset_methods.md
[queries]: query_blocks.md
