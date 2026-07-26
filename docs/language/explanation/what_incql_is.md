# What IncQL is — and is not

IncQL is the typed data-logic plane for Incan applications. It gives application code a relational authoring surface, preserves deferred semantic intent in Prism, lowers portable relational plans through Substrait, and makes runtime attempts and selected evidence available through an explicit `Session`.

IncQL is not a database product. It does not own storage, transactions, scheduling, credentials, cluster execution, or organizational policy.

## Ownership at a glance

| Layer | Owns | Does not own |
| --- | --- | --- |
| Incan | language syntax, typechecking, imports, error propagation, application control flow | relational semantics specific to IncQL, storage, or backend execution |
| IncQL authoring | carriers, relational operations, query vocabulary, schema evolution, function registry contracts | concrete source credentials, transactions, or physical execution |
| Prism | immutable local logical-plan state, rewrites, authored-origin mappings, local inspection inputs | portable interchange or backend execution |
| Substrait boundary | portable relational meaning and extension identities | source secrets, backend registration, organization policy, or runtime scheduling |
| `Session` | logical-name registration, source binding, adapter selection, execution, collection, writes, observations | IncQL's core semantic meaning or caller-owned policy decisions |
| adapter | backend-specific planning, execution, materialization, and typed backend diagnostics | redefining IncQL semantics |
| application | whether to retry, publish, write, quarantine, alert, or reject based on returned evidence | silently delegated decisions that the program has not encoded |

## Database vocabulary translated

| Database term | IncQL framing |
| --- | --- |
| catalog or table name | a logical name registered in a `Session`; the portable plan carries logical identity, not credentials |
| schema | several explicit facts: authored row-model intent, fields discovered from a source, planned output fields, and backend-reported materialization evidence |
| logical plan | Prism-backed local state and the portable Substrait relation produced from it |
| optimizer | Prism can perform narrow canonical rewrites; the concrete backend still owns physical planning |
| execution engine | selected adapter, currently DataFusion by default |
| transaction | outside the current IncQL contract |
| DDL or migration | outside the current query-block and Session contract |
| write | an explicit Session-owned sink operation; transactional guarantees depend on the selected backend and sink |
| audit or policy decision | structured evidence can be produced, but enforcement remains caller- or platform-owned |

## The shared system path

1. Incan code expresses checked intent through carrier methods or an IncQL vocabulary such as `query`.
2. A `LazyFrame[T]` retains deferred Prism-backed plan state.
3. IncQL lowers the relational meaning through its portable Substrait boundary.
4. `Session` binds logical sources and selects an adapter.
5. The adapter plans and executes against its concrete runtime.
6. IncQL returns a result, typed error, observation, or coverage record.
7. Caller code decides what happens next.

The same path explains why authoring a query does not execute it, why a logical name is not a credential, why DataFusion cannot become the source of relational truth, and why an observation does not enforce organizational policy by itself.

## What to read next

- Build and run one result with the [ten-minute quickstart][quickstart].
- Follow every boundary visually in [Architecture][architecture].
- Learn the two carrier and runtime mental models in [Dataset carriers][carriers] and [Execution context][execution].
- Check current sources, sinks, carrier execution, and adapter gaps in the [backend capability matrix][capabilities].
- If you are building an adapter or portability layer, enter the advanced Substrait Reference only after these ownership boundaries are clear.

<!-- References -->

[architecture]: ../../architecture.md
[capabilities]: ../reference/capabilities.md
[carriers]: dataset_carriers.md
[execution]: execution_context.md
[quickstart]: ../quickstart.md
