# IncQL RFC 049: Declarative quality block vocabulary

- **Status:** Implemented
- **Created:** 2026-07-06
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 003 (query blocks)
  - IncQL RFC 027 (relational evidence program)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 034 (quality assertions and observations)
  - IncQL RFC 042 (async verification evidence)
- **Issue:** [IncQL #96](https://github.com/encero-systems/IncQL/issues/96)
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4-era IncQL
- **Shipped in:** v0.1

## Summary

This RFC adds a declarative quality block vocabulary on top of RFC 034. Authors can write `FROM`, `EXPECT`, `REQUIRE`, and `GROUP BY` clauses inside `quality` blocks, use threshold operators such as `row_count() >= 1`, and attach stable assertion names with `as <name>`. The syntax still lowers to ordinary `QualityAssertion` helper values and does not execute, filter, quarantine, or mutate relations by itself.

## Motivation

RFC 034 established the right semantic boundary: quality helpers declare checks, and session observation APIs produce evidence. The first quality syntax was intentionally close to the helper API, which made the implementation small but left the authoring experience too mechanical for real suites. Quality declarations should read like checks over a relation without hiding the fact that execution remains an explicit session operation.

## Goals

- Make quality assertion lists readable as declarative relation checks.
- Preserve RFC 034 as the single quality assertion and observation model.
- Support single-relation context with `FROM` without making quality blocks execute anything.
- Support `EXPECT` and `REQUIRE` clauses for policy-neutral handling intent.
- Support stable assertion names through `as <name>`.
- Support common threshold syntax for row counts and null rates.
- Support grouped row-count expectations after `GROUP BY`.
- Support explicit cross-relation row-count equality declarations while keeping `observe_quality_pair(...)` explicit.

## Non-Goals

- Defining a full quality-suite runtime object separate from `list[QualityAssertion]`.
- Making `quality` blocks execute checks directly.
- Making required checks throw, filter, quarantine, or stop execution by themselves.
- Defining a Great Expectations-compatible or dbt-test-compatible import/export layer.
- Defining accepted-value, range, regex, or aggregate-condition assertion families beyond the helper families already available under RFC 034.
- Defining row-level validation or model instance validation.

## Guide-level explanation

Authors can keep using helper expressions when that is clearer:

```incan
checks = quality {
    row_count(Some(1)).require()
    null_rate(.customer_id, 0.0)
    unique(.order_id)
}
```

For larger suites, the declarative clause form reads closer to the intent:

```incan
checks = quality {
    FROM paid_orders
    REQUIRE row_count() >= 1 as non_empty_orders
    EXPECT null_rate(.customer_id) <= max_customer_null_rate as customer_id_required
    REQUIRE unique(.order_id) as unique_order_ids
    GROUP BY .region, .channel
    EXPECT count() >= 10 as enough_orders_per_group
}

observations = session.observe_quality(paid_orders, checks)
```

The `FROM` clause documents the relation context for the assertion declarations and scopes leading-dot field references. The returned value is still a `list[QualityAssertion]`; the caller still passes the actual relation to `Session.observe_quality(...)`.

Cross-relation checks stay explicit:

```incan
checks = quality {
    REQUIRE row_count(source_orders) == row_count(target_orders) as row_counts_match
}

observations = session.observe_quality_pair(source_orders, target_orders, checks)
```

The comparison names both relation values, but the block does not capture or execute those values. The pair observation API remains the execution boundary.

## Reference-level explanation

Importing `pub::incql` must activate the RFC 034 quality expression syntax and the RFC 049 clause syntax. Both forms must return `list[QualityAssertion]`.

A `quality` block may contain ordinary assertion expressions, clause declarations, or both. Ordinary assertion expressions must continue to lower exactly as in RFC 034.

`FROM` may contain one named relation value. The clause supplies authoring context for single-relation suites. It must not execute the relation or bind hidden session inputs.

`EXPECT` and `REQUIRE` are expression-list clauses. Each item must lower to one `QualityAssertion`. `EXPECT` leaves assertion mode unchanged. `REQUIRE` must return the assertion with `QualityAssertionMode.Require`. The required mode is metadata for callers; it must not cause `Session.observe_quality(...)` to throw on failure.

Expression-list aliases must lower to stable assertion names. `expr as name` must return the same assertion family with a declaration target whose name and assertion ID use `name`.

`row_count() >= n`, `count() >= n`, `row_count() <= n`, `count() <= n`, and equality forms must lower to `row_count(...)` or `group_row_count(...)` depending on the active grouping context. `>` and `<` forms may be supported only when the threshold is an integer literal because non-literal offsetting would change expression semantics.

`null_rate(field) <= rate` must lower to `null_rate(field, rate)`. Other null-rate comparison operators are rejected by this RFC because the helper family models a maximum tolerated rate.

`GROUP BY` records grouping expressions for following row-count expectations. Grouped row-count checks must lower to `group_row_count(group_by, ...)`.

`row_count(left) == row_count(right)` inside a quality block must lower to `cross_relation_row_count_equal()`. The comparison names the intended pair, but execution still requires `Session.observe_quality_pair(left, right, assertions)`.

Quality clause syntax must not create a second semantic model. The only public assertion values produced by the block are the same `QualityAssertion` values that helper calls produce.

## Design details

### Assertion naming

Quality assertions already carry both `name` and `target`. Declarative aliases need to affect both fields, otherwise `as <name>` would only be display text. This RFC therefore requires a public assertion naming operation that returns the same assertion family, scope, expression, thresholds, mode, severity, and evidence references with a new assertion ID and declaration target derived from the alias.

### Clause ordering

The recommended order is `FROM`, optional `GROUP BY`, then `EXPECT` and `REQUIRE` clauses. Implementations may allow repeated `EXPECT`, `REQUIRE`, and `GROUP BY` clauses so authors can group related checks without forcing a nested suite object.

### Expression bodies remain valid

The initial RFC 034 surface is not deprecated. It remains useful when helper calls are explicit and short, or when authors need a helper shape not yet represented by the clause sugar.

## Compatibility / migration

Existing helper calls and RFC 034 `quality` assertion-expression blocks remain valid. The new syntax is additive.

## Implementation plan

The implementation extends the vocabulary companion manifest, quality desugarer, and public `QualityAssertion` API. The desugarer keeps expression-body lowering intact, adds `FROM`, `GROUP BY`, `EXPECT`, and `REQUIRE` clause lowering, maps threshold expressions back to existing helper calls, and applies alias names through the assertion naming API.

## Progress checklist

- [x] Add RFC 049 and attach it to issue #96.
- [x] Add stable assertion naming.
- [x] Keep RFC 034 assertion-expression quality blocks working.
- [x] Add `FROM`, `EXPECT`, `REQUIRE`, and `GROUP BY` vocabulary clauses.
- [x] Lower row-count, count, null-rate, grouped row-count, and cross-relation row-count sugar to RFC 034 helpers.
- [x] Add tests for assertion metadata and concrete session observation output.
- [x] Update reference docs, how-to docs, and release notes.

## Alternatives considered

- **Keep only helper-call syntax.** Rejected because larger quality suites become too mechanical and hide intent behind helper argument ordering.
- **Introduce a `QualitySuite` object.** Rejected for this RFC because RFC 034 intentionally uses `list[QualityAssertion]`, and the current needs can be met without a second model.
- **Make `quality` blocks execute checks.** Rejected because declaration and observation are separate semantics. Session APIs own runtime evidence.
- **Treat `REQUIRE` as an exception or pipeline gate.** Rejected because the assertion model records handling intent while callers own enforcement behavior.

## Drawbacks

There is some syntactic overlap with query blocks, especially `FROM` and `GROUP BY`, but the lowered result is different: query blocks return relation carriers, while quality blocks return assertion values. Cross-relation row-count syntax can document the compared relation names, but it cannot remove the need for explicit `observe_quality_pair(...)` inputs without introducing a larger suite execution model.

## Layers affected

- **IncQL specification** — quality block syntax and lowering rules become normative.
- **IncQL library package** — `QualityAssertion` gains stable naming and the vocab companion gains clause syntax.
- **Documentation** — reference docs, how-to docs, RFC index, and release notes describe the new authoring surface.
- **Tests** — quality helper metadata, vocab syntax, and session observation behavior require focused coverage.

## Design Decisions

- Quality blocks remain declaration syntax and return `list[QualityAssertion]`.
- `REQUIRE` records intent; it does not enforce policy during session observation.
- `FROM` supplies single-relation authoring context, not hidden execution inputs.
- `as <name>` changes assertion identity and target metadata, not just display text.
