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

The v0.1 target is described below as **seven moments** rather than as a feature list. A feature list says what a tool contains; a moment says what using it should feel like, which is a more useful thing to be held to.

<p class="roadmap-thesis" markdown>Strip away the RFC numbering and IncQL makes one promise: your data mistakes become compile errors instead of 3am pager duty. Everything else serves that — and the loop you live in every day decides whether anyone stays long enough to find out.</p>

| Status | Meaning |
| ------ | ------- |
| **Available** | Works today in the published package. |
| **Partial** | Usable, but does not yet cover everything the moment implies. |
| **Planned** | Designed and specified in an RFC; not yet implemented. |

## The seven moments

<div class="roadmap-glance">
  <a href="#it-caught-it" data-status="partial"><span>1</span>It caught it</a>
  <a href="#i-never-left-the-language" data-status="available"><span>2</span>I never left the language</a>
  <a href="#it-ran-and-the-result-is-still-typed" data-status="available"><span>3</span>It ran, and the result is still typed</a>
  <a href="#i-saw-what-it-would-do-before-it-did-it" data-status="partial"><span>4</span>I saw what it would do before it did it</a>
  <a href="#it-told-me-the-truth-about-its-limits" data-status="available"><span>5</span>It told me the truth about its limits</a>
  <a href="#it-works-on-my-actual-data" data-status="planned"><span>6</span>It works on my actual data</a>
  <a href="#i-can-work-without-stepping-on-anyone" data-status="planned"><span>7</span>I can work without stepping on anyone</a>
</div>

<div class="roadmap-moments" markdown>

<div class="moment crystal-surface" data-status="partial" markdown>

<span class="moment__num" aria-hidden="true">1</span>

### "It caught it." {: data-status="partial" }

You reference a column that does not exist, compare mismatched types, or aggregate the wrong thing — and you find out before anything runs.

<div class="moment-split" markdown>

<div markdown>
Available

- `query { }` blocks typechecked against the current query schema
- Row shapes are ordinary `model` types, so `LazyFrame[Order]` becoming `LazyFrame[PaidOrder]` is checked, not asserted
- Typed helpers validate scalar inputs at the call site
</div>

<div markdown>
Planned

- Column names are still strings internally, so a typo is caught at plan lowering rather than at compile time ([#116][i116])
- Unbounded carriers do not yet reject operations that need finite input ([#114][i114])
</div>

</div>
</div>

<div class="moment crystal-surface" data-status="available" markdown>

<span class="moment__num" aria-hidden="true">2</span>

### "I never left the language." {: data-status="available" }

No SQL strings. No stringly-typed row access. Your schema is a `model`, and your query is source your editor and compiler both understand.

<div class="moment-split" markdown>

<div markdown>
Available

- SQL-familiar `query { }` blocks and `DataSet[T]` method chains resolve identically
- The [ten-minute quickstart][quickstart] carries the whole shape in about fifty lines
</div>

<div markdown>
Out of scope

- Optional pipe-forward (`|>`) is specified in [RFC 005][rfc005] and deliberately excluded from v0.1
</div>

</div>
</div>

<div class="moment crystal-surface" data-status="available" markdown>

<span class="moment__num" aria-hidden="true">3</span>

### "It ran, and the result is still typed." {: data-status="available" }

Read a source, transform it, get rows back that still carry their row type.

<div class="moment-split" markdown>

<div markdown>
Available

- Typed read, execute, collect, and write, with typed sink descriptors
- Structured materialization rather than rendered text as the contract
- DataFusion as reference adapter behind a Substrait backend boundary
</div>

<div markdown>
Planned

- Constructing a relation directly from in-memory values ([#20][i20])
- An explicit catalog model for logical-name schema binding
- A real output-schema contract for joins between different row types
</div>

</div>
</div>

<div class="moment crystal-surface" data-status="partial" markdown>

<span class="moment__num" aria-hidden="true">4</span>

### "I saw what it would do before it did it." {: data-status="partial" }

You can inspect a plan — its structure, its schema flow, and where each field came from — without executing it.

<div class="moment-split" markdown>

<div markdown>
Available

- Typed inspection records over Prism-backed plans
- Lineage across value, control, grouping, join, sort, window, policy and quality dependencies, each with exact, conservative, or unknown confidence
- Evidence that could not be computed is marked, not silently omitted
</div>

<div markdown>
Planned

- Records are not yet written as versioned artifacts, and there is no rendered report ([#117][i117])
- Prism currently backs `LazyFrame[T]` only ([#16][i16])
</div>

</div>
</div>

<div class="moment crystal-surface" data-status="available" markdown>

<span class="moment__num" aria-hidden="true">5</span>

### "It told me the truth about its limits." {: data-status="available" }

IncQL says "I cannot do this here" instead of degrading quietly.

<div class="moment-split" markdown>

<div markdown>
Available

- Adapter coverage reports covered, partially covered, uncovered, or unknown
- Execution, collection and writes have observed variants capturing evidence for success and failure
- Quality assertions produce observations without acting as invisible filters
- A backend with no implementation reports a planning diagnostic rather than approximating
</div>

<div markdown>
Planned

- Coverage and unsupported evidence share the rendered-report gap from moment 4
</div>

</div>
</div>

<div class="moment crystal-surface" data-status="planned" markdown>

<span class="moment__num" aria-hidden="true">6</span>

### "It works on my actual data." {: data-status="planned" }

A typed data logic plane is only interesting when it operates on data you actually govern. Today IncQL reads local CSV and Parquet files.

<div class="moment-split" markdown>

<div markdown>
Available

- Local CSV and Parquet sources with typed row shapes
</div>

<div markdown>
Planned

- Object-store locations and partitioned datasets, with inference that does not read a file into memory ([#112][i112])
- Iceberg and Delta tables as typed sources ([RFC 069][rfc069], [#115][i115])
- Delivered as addon packages through a component registry ([#113][i113]), so a lakehouse stack is never compiled unasked
</div>

</div>

Table formats change the schema story in IncQL's favour. A CSV has no schema, so one must be inferred. An Iceberg or Delta table carries an authoritative schema and tracks its evolution — so a declared `model` can be reconciled against the table's real, current shape before any data is read, and a renamed column can be reported as a rename rather than as a disappearance.

</div>

<div class="moment crystal-surface" data-status="planned" markdown>

<span class="moment__num" aria-hidden="true">7</span>

### "I can work without stepping on anyone." {: data-status="planned" }

Your own materialization target, and a way to rebuild only the part you changed.

<div class="moment-split" markdown>

<div markdown>
Available

- The typed lineage graph this depends on already exists
</div>

<div markdown>
Planned

- Data projects as [named relational assets][rfc058] with a typed dependency graph available without executing your code
- [Materialization intent][rfc059] resolved against one destination binding
- A [build lifecycle][rfc062] where structured selectors resolve to an immutable build set and emit a receipt
</div>

</div>

Because lineage is typed and tracks fields rather than only relations, selection can be **column-level**: rebuild what actually depends on a given column, rather than everything downstream of the relation that happens to contain it.

</div>

</div>

## The acceptance test

v0.1 is done when a stranger can do all of this in one sitting, without reading a single RFC.

<ol class="roadmap-test">
  <li data-result="yes">Point IncQL at a real CSV and define a model for its rows</li>
  <li data-result="yes">Write a query against it</li>
  <li data-result="part">Make a genuine mistake and get an error that says what is wrong <em>— caught at plan lowering today, not at compile time</em></li>
  <li data-result="yes">Fix it and run it</li>
  <li data-result="no">Read the plan it will execute <em>— no rendered form yet</em></li>
  <li data-result="no">Point it at data that is not on their laptop</li>
  <li data-result="no">Rebuild just the part they changed, into their own space</li>
</ol>

Four of the seven hold today. The three that do not are the three moments still marked planned or partial above — which is the whole distance between a package that works and a tool someone adopts.

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
