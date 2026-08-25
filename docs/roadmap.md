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

<div class="roadmap-legend crystal-surface">
  <p class="roadmap-legend__label">How to read this page</p>
  <ol>
    <li data-state="available"><span>Available</span><strong>Works today in the published package</strong></li>
    <li data-state="partial"><span>Partial</span><strong>Usable, but does not yet cover everything the moment implies</strong></li>
    <li data-state="planned"><span>Planned</span><strong>Designed and specified in an RFC; not yet implemented</strong></li>
  </ol>
</div>

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

<div class="moment-caps" markdown>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">`query { }` blocks typechecked against the current query schema</span><span class="cap-state">available</span></summary>

Clause-oriented syntax that is checked, not templated. Names resolve against the query schema at the point you write them.

[Query blocks](language/reference/query_blocks.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Row shapes are ordinary `model` types</span><span class="cap-state">available</span></summary>

A projection that changes shape changes type: `LazyFrame[Order]` becomes `LazyFrame[PaidOrder]` because the SELECT says so, and the compiler agrees.

[Dataset carriers](language/reference/dataset_carriers.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Typed helpers validate their scalar inputs</span><span class="cap-state">available</span></summary>

Helpers accept primitives where that is the natural shape — `add(col("amount"), 1)` — while still rejecting inputs whose types cannot combine.

[Dataset methods](language/reference/dataset_methods.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Field references resolved against the declared model</span><span class="cap-state">planned</span></summary>

Today `.amount` lowers to `col("amount")`, a string, so a typo surfaces at plan lowering rather than at compile time. Making the shorthand resolve against the model closes the gap, with `col("…")` left as the explicit escape for reaching past a partial model.

[#116](https://github.com/encero-systems/IncQL/issues/116)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Unbounded carriers reject bounded-only operations</span><span class="cap-state">planned</span></summary>

The root `DataSet[T]` trait currently declares every operation, so `DataStream[T]` inherits joins, grouping and ordering. Compiler support for the gating landed upstream in April; adoption here has not.

[#114](https://github.com/encero-systems/IncQL/issues/114)
</details>

</div>

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

<div class="moment-caps" markdown>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">SQL-familiar `query { }` blocks</span><span class="cap-state">available</span></summary>

Both the brace spelling and the expression-position `query:` form, covering SELECT aliases, grouped aggregates, DISTINCT, joins, generators and named windows.

[Query blocks](language/reference/query_blocks.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">`DataSet[T]` method chains resolving identically</span><span class="cap-state">available</span></summary>

The same naming and schema rules apply whichever surface you author in, so the two are equivalent where it counts rather than merely similar.

[Dataset methods](language/reference/dataset_methods.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Schemas as ordinary Incan `model` types</span><span class="cap-state">available</span></summary>

No schema DSL and no separate registry. A row shape is a type you can share, import, and reason about like any other.

[Dataset carriers](language/explanation/dataset_carriers.md)
</details>

<details class="cap" data-state="out of scope" markdown>
<summary markdown><span class="cap-what">Optional pipe-forward (`\|>`)</span><span class="cap-state">out of scope</span></summary>

Specified and dependent on Incan's scoped DSL glyph mechanism, which shipped. Deliberately excluded from v0.1 rather than unfinished.

[RFC 005](rfcs/005_incql_pipe_forward.md)
</details>

</div>

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

<div class="moment-caps" markdown>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Typed read, execute, collect and write</span><span class="cap-state">available</span></summary>

`read_csv`, `read_parquet`, `execute`, `collect`, `write` and the file-specific sink helpers, each carrying the row type through.

[Read and write data](language/how-to/read_write_data.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Typed sink descriptors and structured materialization</span><span class="cap-state">available</span></summary>

`collect(...)` returns a `DataFrame[T]` with resolved columns and row counts, not rendered text that happens to look tabular.

[Execution context](language/reference/execution_context.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">DataFusion behind a Substrait backend boundary</span><span class="cap-state">available</span></summary>

Session dispatch routes through an adapter boundary over Substrait plans, so the reference engine is not wired into Session state.

[Execution context](language/explanation/execution_context.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Relations constructed from in-memory values</span><span class="cap-state">planned</span></summary>

`Session.from_values(...)` needs a canonical Incan-to-Arrow row encoding before it can join the core Session surface.

[#20](https://github.com/encero-systems/IncQL/issues/20)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">An explicit catalog model for schema binding</span><span class="cap-state">planned</span></summary>

Logical-name binding is an implicit global registry today. It needs a catalog or snapshot model with real overwrite diagnostics.

[RFC 004](rfcs/004_incql_execution_context.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">An output-schema contract for heterogeneous joins</span><span class="cap-state">planned</span></summary>

Joins are `Self`-only, so two different row types cannot yet produce a third with a checked shape.

[Joins](language/how-to/joins.md)
</details>

</div>

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

<div class="moment-caps" markdown>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Typed plan inspection without executing</span><span class="cap-state">available</span></summary>

`inspect_plan(...)` and `inspect_lineage(...)` read Prism state locally. No execution, no backend binding, no physical plan.

[Inspect plan and lineage](language/how-to/inspect_plan_lineage.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Lineage across eight relationship kinds</span><span class="cap-state">available</span></summary>

Value, control, grouping, join, sort, window, policy and quality dependencies, each carrying exact, conservative or unknown confidence.

[Inspection](language/reference/inspection.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Uncomputed evidence marked, not omitted</span><span class="cap-state">available</span></summary>

An empty lineage graph is distinguishable from one that was never computed or is unsupported — which is what makes the absence trustworthy.

[Inspection](language/reference/inspection.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Serialized artifacts and a rendered report</span><span class="cap-state">planned</span></summary>

Inspection returns typed records but writes no artifacts, and nothing renders them for a person. A local spike proved the shape; productionising it is the work.

[#117](https://github.com/encero-systems/IncQL/issues/117)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Prism backing beyond `LazyFrame[T]`</span><span class="cap-state">planned</span></summary>

`DataFrame[T]` and `DataStream[T]` are not Prism-backed, so inspection does not reach them.

[#16](https://github.com/encero-systems/IncQL/issues/16)
</details>

</div>

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

<div class="moment-caps" markdown>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Adapter coverage with four honest states</span><span class="cap-state">available</span></summary>

Covered, partially covered, uncovered, or unknown — against the selected adapter, for requirements inferred from plan evidence or supplied by a caller.

[Capabilities](language/reference/capabilities.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Observed execution, collection and write attempts</span><span class="cap-state">available</span></summary>

The observed variants return a structured record for both success and failure, so an attempt can be audited rather than reconstructed from logs.

[Execution observations](language/how-to/execution_observations.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Quality observations that never filter silently</span><span class="cap-state">available</span></summary>

A failed check is reported, never applied. Row counts, null rates, uniqueness and cross-relation equality produce evidence, not hidden WHERE clauses.

[Quality](language/reference/quality.md)
</details>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Governed attributes and policy checkpoints</span><span class="cap-state">available</span></summary>

Provenance, confidence, authority, lifetime and visibility attach to semantic targets without turning IncQL into a policy engine.

[Governance](language/reference/governance.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">A rendered form for coverage evidence</span><span class="cap-state">planned</span></summary>

Coverage and unsupported evidence share the same gap as plan inspection: available to code, not yet to a person.

[#117](https://github.com/encero-systems/IncQL/issues/117)
</details>

</div>

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

<div class="moment-caps" markdown>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">Local CSV and Parquet with typed row shapes</span><span class="cap-state">available</span></summary>

Enough to demonstrate the authoring model end to end, and not much more.

[Read and write data](language/how-to/read_write_data.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Object-store locations and partitioned datasets</span><span class="cap-state">planned</span></summary>

`read_csv` already takes a URI, but validation only checks non-emptiness and no object store is registered, so a remote path fails as a missing local file.

[#112](https://github.com/encero-systems/IncQL/issues/112)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Schema inference that does not read the whole file</span><span class="cap-state">planned</span></summary>

CSV inference currently reads the entire file into a string to find a header, which is local-only and does not scale.

[#112](https://github.com/encero-systems/IncQL/issues/112)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Iceberg and Delta as typed, reconciled sources</span><span class="cap-state">planned</span></summary>

The table's schema is authoritative, so a declared model can be reconciled against it before any data is read — and a renamed column reported as a rename rather than a disappearance.

[RFC 069](rfcs/069_lakehouse_table_format_sources.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Addon registry so a lakehouse stack is opt-in</span><span class="cap-state">planned</span></summary>

Table formats arrive as addon packages rather than core dependencies, so nobody compiles an engine they never call.

[#113](https://github.com/encero-systems/IncQL/issues/113)
</details>

</div>

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

<div class="moment-caps" markdown>

<details class="cap" data-state="available" markdown>
<summary markdown><span class="cap-what">The typed lineage graph the loop depends on</span><span class="cap-state">available</span></summary>

Already built, and the reason selection can be column-level rather than relation-level.

[Inspection](language/reference/inspection.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Projects as named relational assets</span><span class="cap-state">planned</span></summary>

A statically discoverable asset graph available without executing user logic, opening connections, or resolving secrets.

[RFC 058](rfcs/058_data_projects_named_relational_assets.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Materialization intent against one destination</span><span class="cap-state">planned</span></summary>

Typed, backend-neutral policy resolved against a destination binding — which is what gives each developer their own target.

[RFC 059](rfcs/059_materialization_applied_asset_lifecycle.md)
</details>

<details class="cap" data-state="planned" markdown>
<summary markdown><span class="cap-what">Selector-driven builds with an append-only receipt</span><span class="cap-state">planned</span></summary>

Structured selectors resolve to an immutable build set, execute in dependency order, and record what actually happened.

[RFC 062](rfcs/062_project_build_lifecycle_selectors_state.md)
</details>

</div>

</div>
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

## Status by area

<div class="roadmap-areas" markdown>

<div class="roadmap-area" data-state="available" markdown>
**Function catalogue**

Complete. Core operators, aggregates and modifiers, common scalars, window helpers, generators, nested-data helpers, format and approximate functions, typed sketches and variant values all ship through one registry-backed helper model.
</div>

<div class="roadmap-area" data-state="available" markdown>
**Authoring and language**

`query { }` blocks and carrier method chains share one resolution model. See [RFC 000][rfc000] and [RFC 003][rfc003].
</div>

<div class="roadmap-area" data-state="partial" markdown>
**Dataset carriers**

The bounded/unbounded split exists; static capability gating is the remaining work. See [RFC 001][rfc001].
</div>

<div class="roadmap-area" data-state="partial" markdown>
**Planning and interchange**

Substrait is the normative interchange. Prism backs `LazyFrame[T]` only. See [RFC 002][rfc002] and [RFC 007][rfc007].
</div>

<div class="roadmap-area" data-state="partial" markdown>
**Evidence and inspection**

Targets, attachments, lineage, observations, coverage, quality and governed attributes ship. Serialized artifacts and a rendered report do not. See [RFC 027][rfc027].
</div>

<div class="roadmap-area" data-state="available" markdown>
**Execution**

DataFusion is the reference adapter behind a portable backend boundary. See [RFC 004][rfc004].
</div>

<div class="roadmap-area" data-state="planned" markdown>
**Data access**

The immediate release surface: object storage, partitioned datasets, and lakehouse table formats. See [RFC 069][rfc069].
</div>

</div>

## Deliberately out of scope

These are boundaries, not backlog. Each belongs to a layer below or beside IncQL.

<div class="roadmap-bounds" markdown>

- **Pipeline and workflow orchestration** — scheduling, retries and DAG execution stay downstream.
- **A semantic catalog** — logical registration and backend-resolved reads are in scope; a portable catalog API across vendors is not.
- **Credential and secret management** — provider configuration resolves at the binding and never enters a plan, artifact, or evidence record.
- **A second execution engine** — the portable backend boundary is the requirement, and it is satisfied. Additional adapters are tracked separately and do not gate v0.1.

</div>

<section class="incql-final-cta roadmap-cta" markdown="1">

<div class="incql-final-cta__copy" markdown="1">
<p class="incql-section-kicker">Seven moments, three of them still ahead</p>

## Want to shape what lands next?

The gaps on this page are specific, scoped, and written down. Several are unclaimed — and the ones that decide whether IncQL feels like a tool are not the hardest ones.

</div>

<div class="incql-actions" markdown="span">
<a class="incql-button incql-button--primary" href="https://github.com/encero-systems/IncQL/milestone/1" target="_blank" rel="noreferrer"><svg class="incql-button__mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"></path></svg>The v0.1 milestone on GitHub</a>
<a class="incql-button" href="../rfcs/">Read the RFCs</a>
<a class="incql-button" href="../project/">Contributor guide</a>
</div>

</section>

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
