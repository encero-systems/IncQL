# IncQL Roadmap

This page tracks implementation status, release scope, and sequencing.

IncQL development is driven by RFCs (Request for Comments).

- An RFC captures a design proposal, including syntax, semantics, typing rules, and lowering contracts.
- RFCs are not necessarily implemented in the order they are written.
- Milestones track release posture and sequencing. They define scope, not urgency.

See the [RFC index][rfcs] for the full set and each document's current status.

IncQL is a library package for the [Incan][incan] language, so parts of this roadmap depend on compiler and toolchain work landing there first. **v0.1 is sequenced behind Incan v0.6.**

## Strategic direction

IncQL's direction is to make relational work **checkable in source**, then to keep everything downstream of that honest.

Raw SQL strings and untyped rows defer mistakes to runtime. IncQL keeps schemas as ordinary Incan `model` types, resolves names the same way across every authoring surface, and lowers to Apache Substrait so logical intent stays portable while execution, credentials, and physical reads stay in the layer below.

The v0.1 target is described below as seven moments rather than as a feature list. A feature list says what a tool contains; these say what using it should feel like, which is a more useful thing to be held to.

| Status | Meaning |
| ------ | ------- |
| **Available** | Works today in the published package. |
| **Partial** | Usable, but does not yet cover everything the moment implies. |
| **Planned** | Designed and specified in an RFC; not yet implemented. |

## The v0.1 experience

### 1. "It caught it." · Partial

You reference a column that does not exist, compare mismatched types, or aggregate the wrong thing — and you find out before anything runs.

`query { }` blocks are typechecked against the current query schema. Row shapes are ordinary `model` types, so a transformation that changes shape changes type: `LazyFrame[Order]` becoming `LazyFrame[PaidOrder]` is checked, not asserted. Typed helpers validate their scalar inputs, so `add(col("amount"), 1)` and `cast(col("amount_text"), float)` are checked at the call site.

Column *names* are still strings internally, so a mistyped column is caught when the plan lowers rather than when it compiles. That is earlier than most tools manage — nothing touches your data first — but it is not the compile error IncQL is aiming for. Making leading-dot field references resolve against the declared model closes this ([#116][i116]). Unbounded carriers do not yet reject operations that only make sense on finite input ([#114][i114]).

### 2. "I never left the language." · Available

No SQL strings. No stringly-typed row access. Your schema is a `model`, and your query is source your editor and compiler both understand.

Both authoring surfaces resolve the same way: SQL-familiar `query { }` blocks, and method chains on `DataSet[T]` carriers. The [ten-minute quickstart][quickstart] carries the whole shape in about fifty lines.

Optional pipe-forward (`|>`) is specified in [RFC 005][rfc005] and is deliberately out of scope for v0.1.

### 3. "It ran, and the result is still typed." · Available

Read a source, transform it, get rows back that still carry their row type.

Sessions provide typed read, execute, collect, and write, with typed sink descriptors and structured materialization rather than rendered text as the contract. Apache DataFusion is the reference execution adapter, reached through a backend boundary over Substrait plans rather than wired into session state.

Still planned: constructing a relation directly from in-memory values ([#20][i20]), an explicit catalog model for logical-name schema binding, and a real output-schema contract for joins between different row types.

### 4. "I saw what it would do before it did it." · Partial

You can inspect a plan — its structure, its schema flow, and where each field came from — without executing it.

`inspect_plan(...)` and `inspect_lineage(...)` return typed records over Prism-backed plans: semantic targets, output schema, authored and rewritten plan nodes, and lineage edges across value, control, grouping, join, sort, window, policy and quality dependencies, each carrying exact, conservative, or unknown confidence. Evidence that could not be computed is marked as such rather than silently omitted.

Those records are not yet written as versioned artifacts, and there is no rendered report — so the evidence is available to code but not yet to a person reading it ([#117][i117]). Prism currently backs `LazyFrame[T]`; extending it to the other carriers is tracked in [#16][i16].

### 5. "It told me the truth about its limits." · Available

IncQL says "I cannot do this here" instead of degrading quietly.

Adapter coverage reports whether a plan is covered, partially covered, uncovered, or unknown against a target. Execution, collection, and writes have observed variants that capture structured evidence for both success and failure. Quality assertions produce observations without acting as invisible filters — a failed check is reported, never silently applied. Where a backend has no implementation for a helper, it reports a planning diagnostic rather than approximating.

### 6. "It works on my actual data." · Planned

A typed data logic plane is only interesting when it operates on data you actually govern. Today IncQL reads local CSV and Parquet files.

Planned for v0.1: object-store locations and partitioned datasets, with schema inference that does not read a file into memory to find its header ([#112][i112]). Then Apache Iceberg and Delta Lake tables as typed sources ([RFC 069][rfc069], [#115][i115]), delivered as addon packages through a component registry ([#113][i113]) so a lakehouse stack is never something you compile without asking for it.

Table formats change the schema story in IncQL's favour. A CSV has no schema, so one must be inferred. An Iceberg or Delta table carries an authoritative schema and tracks its evolution — so a declared `model` can be reconciled against the table's real, current shape before any data is read, and a renamed column can be reported as a rename rather than as a disappearance.

### 7. "I can work without stepping on anyone." · Planned

Your own materialization target, and a way to rebuild only the part you changed.

This is specified across three RFCs: data projects as [named relational assets][rfc058] with a typed dependency graph available without executing your code, [materialization intent][rfc059] resolved against one destination binding, and a [build lifecycle][rfc062] where structured selectors resolve to an immutable build set and emit a build receipt.

The lineage graph behind moment 4 is what makes this interesting rather than familiar. Because lineage is typed and tracks fields rather than only relations, selection can be **column-level**: rebuild what actually depends on a given column, rather than everything downstream of the relation that happens to contain it.

## Status by area

- **Authoring and language:** see [RFC 000][rfc000] and [RFC 003][rfc003]. Query blocks and carrier method chains share one resolution model.
- **Dataset carriers:** see [RFC 001][rfc001]. The bounded/unbounded split exists; static capability gating is the remaining work.
- **Function catalogue:** complete. Core operators, aggregates and modifiers, common scalars, window helpers, generators, nested-data helpers, format and approximate functions, typed sketches, and variant values all ship through one registry-backed helper model.
- **Planning and interchange:** see [RFC 002][rfc002] and [RFC 007][rfc007]. Substrait is the normative interchange; Prism backs `LazyFrame[T]`.
- **Execution:** see [RFC 004][rfc004]. DataFusion is the reference adapter behind a portable backend boundary.
- **Evidence and inspection:** see [RFC 027][rfc027] and its child RFCs. Semantic targets, attachments, lineage, execution observations, adapter coverage, quality observations and governed attributes ship; serialized artifacts and a rendered report do not yet.
- **Data access:** the immediate release surface. Object storage, partitioned datasets, and lakehouse table formats.

## Deliberately out of scope

These are boundaries rather than backlog. IncQL owns data logic; each of these belongs to a layer below or beside it.

- **Pipeline and workflow orchestration.** Scheduling, retries, and DAG execution stay downstream.
- **A semantic catalog.** Logical registration and backend-resolved reads are in scope; a portable catalog API across vendors is not.
- **Credential and secret management.** Provider configuration is resolved at the binding and never enters a plan, artifact, or inspection record.
- **A second execution engine.** The portable backend boundary is the requirement, and it is satisfied; additional adapters are tracked separately and do not gate v0.1.

## Guides

- [Ten-minute quickstart][quickstart]
- [From SQL][from-sql] and [From Spark and DataFrame APIs][from-spark]
- [What IncQL is and is not][what-incql-is]

## Interested in contributing?

Work toward v0.1 is tracked in the [v0.1 milestone][milestone]. Normative design lives in the [RFCs][rfcs], and shipped user-visible changes are summarized in the [release notes][release-notes].

See the [Project][project] pages for repository layout, documentation conventions, and the contributor workflow.

<!-- References -->

[incan]: https://github.com/encero-systems/incan
[quickstart]: language/quickstart.md
[from-sql]: language/explanation/from_sql.md
[from-spark]: language/explanation/from_spark.md
[what-incql-is]: language/explanation/what_incql_is.md
[project]: project.md
[rfcs]: rfcs/README.md
[rfc000]: rfcs/000_incql_syntax.md
[rfc001]: rfcs/001_incql_dataset.md
[rfc002]: rfcs/002_apache_substrait_integration.md
[rfc003]: rfcs/closed/implemented/003_incql_query_blocks.md
[rfc004]: rfcs/004_incql_execution_context.md
[rfc005]: rfcs/005_incql_pipe_forward.md
[rfc007]: rfcs/007_prism_planning_engine.md
[rfc027]: rfcs/027_relational_evidence_program.md
[rfc058]: rfcs/058_data_projects_named_relational_assets.md
[rfc059]: rfcs/059_materialization_applied_asset_lifecycle.md
[rfc062]: rfcs/062_project_build_lifecycle_selectors_state.md
[rfc069]: rfcs/069_lakehouse_table_format_sources.md
[release-notes]: release_notes/v0_1.md
[milestone]: https://github.com/encero-systems/IncQL/milestone/1
[i16]: https://github.com/encero-systems/IncQL/issues/16
[i20]: https://github.com/encero-systems/IncQL/issues/20
[i112]: https://github.com/encero-systems/IncQL/issues/112
[i113]: https://github.com/encero-systems/IncQL/issues/113
[i114]: https://github.com/encero-systems/IncQL/issues/114
[i115]: https://github.com/encero-systems/IncQL/issues/115
[i116]: https://github.com/encero-systems/IncQL/issues/116
[i117]: https://github.com/encero-systems/IncQL/issues/117
