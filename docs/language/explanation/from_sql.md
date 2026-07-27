# IncQL for SQL users

IncQL query blocks use SQL-familiar relational clauses, but they are checked Incan expressions rather than SQL strings sent to a database. Your query names typed carrier values already present in the program, builds deferred intent, and crosses an explicit `Session` boundary when you execute, collect, or write it.

## Translate the mental model

| Familiar SQL idea | IncQL equivalent | Important difference |
| --- | --- | --- |
| table name in a catalog | a logical name registered by `Session` and represented by a typed carrier value | the query block reads the carrier variable; registration and credentials remain outside the plan |
| `SELECT` statement | `query { ... }` expression | the block returns a `DataFrame[T]`, `LazyFrame[T]`, or `DataStream[T]` matching its input carrier family |
| query optimizer plan | Prism-backed local plan, then portable Substrait | IncQL owns relational meaning; the concrete adapter owns backend planning and execution |
| running a query | `session.collect(...)`, `execute(...)`, or `write(...)` | authoring a query does not execute it |
| result schema | current query schema plus the carrier's intended row model | selected aliases are checked today; full field-for-field compatibility with an annotated output model is follow-up work |
| query diagnostics | typed Incan diagnostics plus `SessionError` and optional observations | planning, adapter, execution, and quality failures remain distinguishable |

## Read one query block

```incan
paid_orders: LazyFrame[PaidOrderReview] = query {
    FROM orders
    WHERE .status == "paid"
    SELECT
        .order_id as order_id,
        .customer_id as customer_id,
        .amount as amount,
    ORDER BY desc(.amount)
    LIMIT 10
}
```

This block does not parse a SQL string. `orders` is a typed Incan value, `.status` resolves against the current query schema, `==` is an Incan comparison that lowers to IncQL's equality helper, and `desc(...)` is a normal helper call. The result remains deferred because `orders` is a `LazyFrame`.

## Current clause map

| SQL-family task | IncQL v0.1 query-block surface | Notes |
| --- | --- | --- |
| source | `FROM <dataset>` | required |
| filter | `WHERE <predicate>` | accepted before or after `SELECT`; the post-projection form fills the role often served by `HAVING` |
| projection | `SELECT <expr> as <alias>` | explicit aliases publish the output schema |
| distinct projection | `SELECT DISTINCT ...` | distinct applies at the projection boundary |
| grouping | `GROUP BY <expr>, ...` | aggregate helpers such as `sum(...)` and `count()` appear in `SELECT` |
| inner join | `JOIN <dataset> ON <predicate>` | joined fields use `relation.column` |
| left join | `LEFT JOIN <dataset> ON <predicate>` | right and full outer joins are not part of the minimum query-block surface |
| sort | `ORDER BY asc(...)` or `desc(...)` | postfix `ASC` and `DESC` tokens are not syntax |
| row cap | `LIMIT <n>` | non-negative integer expression |
| row expansion | `EXPLODE <expr> as <alias>` | generator semantics, not a general lateral-subquery surface |
| windows | `WINDOW BY <alias> = <window expression>` | use registered IncQL window helpers |

The current query-block contract does not claim general SQL ingestion, DDL, transactions, stored procedures, arbitrary subqueries, CTEs, or database-specific syntax. Set operations exist in the lower relational model but are not listed as query-block clauses. Use the exact [Query blocks Reference][query-reference] rather than assuming that familiar SQL text is accepted.

## Differences that matter early

- Write `==`, not SQL's single `=`, inside predicates.
- Use `desc(.amount)` or `asc(.amount)`, not `.amount DESC`.
- Give selected expressions explicit aliases when they define the output schema.
- Treat the output model parameter as intended row shape, not proof that a physical CSV schema has already been validated field for field.
- Keep source registration, execution, and writes in `Session`; a query block owns none of them.
- Treat `NULL` behavior as a typed expression concern. Use the documented helpers when you need explicit null predicates or null-safe comparison rather than guessing from a particular database dialect.

## A practical learning route

1. Run the [ten-minute quickstart][quickstart].
2. Complete [Book chapter 8][book-query] for filtering, projection, ordering, and collection.
3. Complete [Book chapter 9][book-summary] for grouping, aggregation, aliases, and a post-projection filter.
4. Use [Join two typed sources][joins] for method and query-block forms.
5. Keep [Query blocks Reference][query-reference] open for exact clause and resolution rules.

<!-- References -->

[book-query]: ../tutorials/book/08_first_query_block.md
[book-summary]: ../tutorials/book/09_summarize_query.md
[joins]: ../how-to/joins.md
[query-reference]: ../reference/query_blocks.md
[quickstart]: ../quickstart.md
