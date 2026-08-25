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

<div class="roadmap-glance crystal-surface">
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

??? note "Why this matters"

    Every data team has shipped a rename that passed review, ran green, and quietly
    poisoned a dashboard for a week. The mistake was cheap; the distance between
    making it and hearing about it was expensive.

    That distance is the whole cost. A typo caught while you still hold the context
    that created it costs seconds. The same typo caught by a stakeholder costs a
    morning of archaeology, a correction, and some of the trust that made anyone
    look at the number in the first place.

    The promise is not that you stop making mistakes. It is that the feedback
    arrives while you are still the person best placed to fix them.

??? abstract "Capabilities and status"

    | Capability | State | Where |
    | --- | --- | --- |
    | `query { }` blocks typechecked against the current query schema | Available | [Query blocks](language/reference/query_blocks.md) |
    | Row shapes are ordinary `model` types, so a projection that changes shape changes type | Available | [Dataset carriers](language/reference/dataset_carriers.md) |
    | Typed helpers validate their scalar inputs at the call site | Available | [Dataset methods](language/reference/dataset_methods.md) |
    | Field references resolved against the declared model at compile time | Planned | [#116](https://github.com/encero-systems/IncQL/issues/116) |
    | Unbounded carriers reject operations that need finite input | Planned | [#114](https://github.com/encero-systems/IncQL/issues/114) |

</div>

<div class="moment crystal-surface" data-status="available" markdown>

<span class="moment__num" aria-hidden="true">2</span>

### "I never left the language." {: data-status="available" }

No SQL strings. No stringly-typed row access. Your schema is a `model`, and your query is source your editor and compiler both understand.

??? note "Why this matters"

    When your logic lives inside strings, your tools go blind. Your editor cannot
    follow a reference it cannot parse. Rename a column and grep becomes your
    refactoring tool. Every guarantee the language gives you stops at the quote
    mark.

    Staying in the language means those guarantees keep applying to the part of
    your work that handles the most valuable thing you own. Your schema is a type,
    so it can be shared, imported, and reasoned about. Your query is source, so it
    is navigable, diffable, and reviewable like everything else.

    The alternative is not worse syntax. It is a smaller set of things your tools
    can help you with.

??? abstract "Capabilities and status"

    | Capability | State | Where |
    | --- | --- | --- |
    | SQL-familiar `query { }` blocks | Available | [Query blocks](language/reference/query_blocks.md) |
    | `DataSet[T]` method chains resolving identically | Available | [Dataset methods](language/reference/dataset_methods.md) |
    | Schemas as ordinary Incan `model` types | Available | [Dataset carriers](language/explanation/dataset_carriers.md) |
    | Optional pipe-forward (`\|>`) | Out of scope | [RFC 005](rfcs/005_incql_pipe_forward.md) |

</div>

<div class="moment crystal-surface" data-status="available" markdown>

<span class="moment__num" aria-hidden="true">3</span>

### "It ran, and the result is still typed." {: data-status="available" }

Read a source, transform it, get rows back that still carry their row type.

??? note "Why this matters"

    In most data tooling, types survive right up until the data arrives, and then
    evaporate. You carefully describe a schema, run the query, and get back
    something the compiler knows nothing about. Every line after that is guessing.

    Keeping the row type through execution means the code downstream of a query is
    as checked as the code upstream of it. The result is not a bag of columns you
    hope has the right shape — it is a value whose shape the compiler already
    agreed to.

    That matters most where data work usually gets fragile: the transformation
    after the transformation, written weeks later by someone else.

??? abstract "Capabilities and status"

    | Capability | State | Where |
    | --- | --- | --- |
    | Typed read, execute, collect and write | Available | [Read and write data](language/how-to/read_write_data.md) |
    | Typed sink descriptors and structured materialization | Available | [Execution context](language/reference/execution_context.md) |
    | DataFusion behind a Substrait backend boundary | Available | [Execution context](language/explanation/execution_context.md) |
    | Relations constructed from in-memory values | Planned | [#20](https://github.com/encero-systems/IncQL/issues/20) |
    | An explicit catalog model for logical-name schema binding | Planned | [RFC 004](rfcs/004_incql_execution_context.md) |
    | An output-schema contract for heterogeneous joins | Planned | [Joins](language/how-to/joins.md) |

</div>

<div class="moment crystal-surface" data-status="partial" markdown>

<span class="moment__num" aria-hidden="true">4</span>

### "I saw what it would do before it did it." {: data-status="partial" }

You can inspect a plan — its structure, its schema flow, and where each field came from — without executing it.

??? note "Why this matters"

    Reviewing data logic today usually means reading the code and hoping you
    correctly imagined what it would do — then finding out afterwards by reading
    logs. The feedback arrives after the compute is spent and the table is written.

    Being able to inspect the plan before execution moves review from post-mortem
    to pre-flight. You can see which sources it touches, how the schema flows, and
    where each output field actually came from, without running anything.

    This is also what makes the other moments compound: lineage that exists before
    execution is what lets a build system know precisely what your change affects.

??? abstract "Capabilities and status"

    | Capability | State | Where |
    | --- | --- | --- |
    | Typed plan inspection without executing | Available | [Inspect plan and lineage](language/how-to/inspect_plan_lineage.md) |
    | Lineage across value, control, grouping, join, sort, window, policy and quality edges | Available | [Inspection](language/reference/inspection.md) |
    | Uncomputed evidence marked rather than omitted | Available | [Inspection](language/reference/inspection.md) |
    | Serialized artifacts and a rendered report | Planned | [#117](https://github.com/encero-systems/IncQL/issues/117) |
    | Prism backing beyond `LazyFrame[T]` | Planned | [#16](https://github.com/encero-systems/IncQL/issues/16) |

</div>

<div class="moment crystal-surface" data-status="available" markdown>

<span class="moment__num" aria-hidden="true">5</span>

### "It told me the truth about its limits." {: data-status="available" }

IncQL says "I cannot do this here" instead of degrading quietly.

??? note "Why this matters"

    A tool that quietly approximates is more dangerous than one that refuses.
    Silent degradation is how a number ends up subtly wrong in a way nobody
    notices for two quarters — an unsupported operation gets emulated, a guarantee
    is assumed rather than checked, and the result looks exactly like a correct one.

    Saying "I cannot do this here" is a feature. So is distinguishing *this is
    unsupported* from *this was not checked* from *this passed*, because a reviewer
    needs to tell those apart and a log line cannot.

    The goal is that nothing IncQL reports is more confident than the evidence
    behind it.

??? abstract "Capabilities and status"

    | Capability | State | Where |
    | --- | --- | --- |
    | Adapter coverage: covered, partially covered, uncovered, unknown | Available | [Capabilities](language/reference/capabilities.md) |
    | Observed execution, collection and write attempts | Available | [Execution observations](language/how-to/execution_observations.md) |
    | Quality observations that never act as invisible filters | Available | [Quality](language/reference/quality.md) |
    | Governed attributes and policy checkpoints | Available | [Governance](language/reference/governance.md) |
    | A rendered form for coverage and unsupported evidence | Planned | [#117](https://github.com/encero-systems/IncQL/issues/117) |

</div>

<div class="moment crystal-surface" data-status="planned" markdown>

<span class="moment__num" aria-hidden="true">6</span>

### "It works on my actual data." {: data-status="planned" }

A typed data logic plane is only interesting when it operates on data you actually govern. Today IncQL reads local CSV and Parquet files.

??? note "Why this matters"

    Local files are where tools go to look good. Reading a CSV from disk proves
    nothing a dozen libraries have not already proven with less ceremony, and every
    demo works.

    The data an organization actually governs lives somewhere else: object storage,
    lakehouse tables with schemas that evolve, sources someone else owns and
    changes without telling you. That last part is the point — when the schema is
    authoritative and versioned, a typed layer can compare your declared contract
    against reality *before* reading anything, and tell you precisely how they
    have drifted apart.

    Until that works, IncQL is a good demonstration rather than a tool.

??? abstract "Capabilities and status"

    | Capability | State | Where |
    | --- | --- | --- |
    | Local CSV and Parquet sources with typed row shapes | Available | [Read and write data](language/how-to/read_write_data.md) |
    | Object-store locations and partitioned datasets | Planned | [#112](https://github.com/encero-systems/IncQL/issues/112) |
    | Schema inference that does not read the file into memory | Planned | [#112](https://github.com/encero-systems/IncQL/issues/112) |
    | Iceberg and Delta tables as typed, reconciled sources | Planned | [RFC 069](rfcs/069_lakehouse_table_format_sources.md) |
    | Addon component registry so a lakehouse stack is opt-in | Planned | [#113](https://github.com/encero-systems/IncQL/issues/113) |

</div>

<div class="moment crystal-surface" data-status="planned" markdown>

<span class="moment__num" aria-hidden="true">7</span>

### "I can work without stepping on anyone." {: data-status="planned" }

Your own materialization target, and a way to rebuild only the part you changed.

??? note "Why this matters"

    Ask a data engineer what actually slows them down and they rarely say the SQL.
    They say the shared development database where someone else's rebuild
    overwrites the table you were mid-test on, and the twenty-minute full refresh
    you run because nobody can tell you what your change affects.

    Having your own target removes the first. Being able to rebuild precisely what
    you touched removes the second. Neither has anything to do with the query
    language, and together they are what a team feels every single day.

    Because lineage here is typed and tracks fields rather than only relations,
    that selection can be column-level: rebuild what depends on *this column*, not
    everything downstream of the table that happens to contain it. That is a
    distinction a string-addressed dependency graph cannot make.

</div>

??? abstract "Capabilities and status"

    | Capability | State | Where |
    | --- | --- | --- |
    | The typed lineage graph the loop depends on | Available | [Inspection](language/reference/inspection.md) |
    | Projects as named relational assets with a typed dependency graph | Planned | [RFC 058](rfcs/058_data_projects_named_relational_assets.md) |
    | Materialization intent against one destination binding | Planned | [RFC 059](rfcs/059_materialization_applied_asset_lifecycle.md) |
    | Selector-driven builds with an append-only receipt | Planned | [RFC 062](rfcs/062_project_build_lifecycle_selectors_state.md) |

</div>

## The acceptance test

v0.1 is done when a stranger can do all of this in one sitting, without reading a single RFC.

<ol class="roadmap-test crystal-surface">
  <li data-result="yes">
    <span class="clause">Point IncQL at a real CSV and define a model for its rows</span>
    <span class="verdict"><b aria-hidden="true">✓</b>works</span>
    <span class="why">The row shape is an ordinary Incan <code>model</code>. There is no schema DSL and no separate registry to learn.</span>
  </li>
  <li data-result="yes">
    <span class="clause">Write a query against it</span>
    <span class="verdict"><b aria-hidden="true">✓</b>works</span>
    <span class="why">Either a SQL-familiar <code>query { }</code> block or a method chain on the carrier. Both resolve names the same way.</span>
  </li>
  <li data-result="part">
    <span class="clause">Make a genuine mistake and get an error that says what is wrong</span>
    <span class="verdict"><b aria-hidden="true">◑</b>partial</span>
    <span class="why">A mistyped column is caught — but when the plan lowers, not when it compiles, because column names are still strings internally. Earlier than most tools manage, since nothing touches the data first, but not the compile error IncQL is aiming for. Tracked in <a href="https://github.com/encero-systems/IncQL/issues/116">#116</a>.</span>
  </li>
  <li data-result="yes">
    <span class="clause">Fix it and run it</span>
    <span class="verdict"><b aria-hidden="true">✓</b>works</span>
    <span class="why">DataFusion executes the lowered Substrait plan, and the result still carries its row type.</span>
  </li>
  <li data-result="no">
    <span class="clause">Read the plan it will execute</span>
    <span class="verdict"><b aria-hidden="true">✗</b>not yet</span>
    <span class="why">Inspection already returns typed records — plan nodes, schema flow, lineage — but nothing renders them for a person to read. Tracked in <a href="https://github.com/encero-systems/IncQL/issues/117">#117</a>.</span>
  </li>
  <li data-result="no">
    <span class="clause">Point it at data that is not on their laptop</span>
    <span class="verdict"><b aria-hidden="true">✗</b>not yet</span>
    <span class="why">Local CSV and Parquet only today. Object storage and partitioned datasets are <a href="https://github.com/encero-systems/IncQL/issues/112">#112</a>; Iceberg and Delta tables are RFC&nbsp;069.</span>
  </li>
  <li data-result="no">
    <span class="clause">Rebuild just the part they changed, into their own space</span>
    <span class="verdict"><b aria-hidden="true">✗</b>not yet</span>
    <span class="why">Specified across RFCs 058, 059 and 062 — projects as typed assets, materialization intent, and selector-driven builds — but not yet implemented.</span>
  </li>
</ol>

Three of the seven hold outright, one holds partially, and three do not hold at all. That gap is the distance between a package that works and a tool someone adopts — and it maps exactly onto the moments still marked partial or planned above.

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
