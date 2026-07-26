# IncQL RFC 065: Polyglot SQL AST ingress and dialect-aware egress

- **Status:** Draft
- **Created:** 2026-07-26
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 000 (core language model and layer boundaries)
  - IncQL RFC 004 (execution context)
  - IncQL RFC 007 (Prism logical planning and optimization engine)
  - IncQL RFC 012 (unified scalar expression surface)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 041 (Prism plan ingress and external client frontends)
  - IncQL RFC 066 (Prism relational reasoning and shared-work optimization)
- **Issue:** —
- **RFC PR:** [IncQL #105](https://github.com/encero-systems/IncQL/pull/105)
- **Written against:** Incan v0.5-era IncQL
- **Shipped in:** —

## Summary

This RFC defines an optional SQL frontend and egress boundary based on [Polyglot](https://github.com/tobilg/polyglot), the open-source typed SQL AST project maintained by `tobilg`. Polyglot parses and generates SQL for more than 30 documented dialects; IncQL will use that breadth at the edge while Prism remains the owner of relational semantics. IncQL must advertise a dialect or SQL feature only at the most specific level for which its Polyglot AST shape, Prism mapping, semantic profile, and required ingress, egress, or execution evidence are covered.

## Motivation

SQL is an important interoperability surface, but SQL text must not become IncQL's internal planning language. Sending dialect text directly to an execution engine would make that engine the accidental semantic owner. Translating text through ad-hoc strings would make schema, lineage, profile, and unsupported-feature diagnostics unreliable.

Polyglot provides a typed AST, dialect parser, generator, formatter, validator, lineage utilities, and builders. It makes a better boundary than handwritten text rewriting. This RFC gives IncQL a disciplined way to accept familiar SQL and emit target SQL without treating every accepted dialect as equivalent or promising an unearned compatibility level.

## Goals

- Define SQL ingress and egress as optional frontend boundaries around Prism.
- Preserve a typed AST at the SQL boundary rather than use SQL text as an internal relational representation.
- Make bidirectional mapping precise for the supported intersection of Polyglot AST shapes and Prism semantics.
- Require dialect, feature, profile, and execution coverage to be inspectable.
- Require structured diagnostics for unsupported or ambiguous SQL constructs.
- Credit Polyglot visibly as the upstream project enabling this interoperability surface.

## Non-Goals

- Claiming that IncQL supports every SQL dialect that Polyglot can parse or generate.
- Claiming more than 30 dialects, or any fixed dialect count, without current upstream evidence and IncQL coverage evidence.
- Replacing Prism with Polyglot, SQL text, Substrait, DataFusion, or a backend engine as IncQL's semantic owner.
- Carrying Polyglot AST nodes through Prism rewrite rules, cost evaluation, or row-by-row execution.
- Treating this RFC as a guarantee of full SQL compatibility, generic transpilation, stored-procedure execution, or vendor session emulation.
- Guaranteeing byte-identical SQL on a parse-to-emit round trip.
- Hiding unsupported syntax by silently delegating it to a backend.

## Guide-level explanation (how authors think about it)

An author or tool may submit a dialect-tagged SQL statement to an IncQL SQL frontend. The frontend parses the statement into a Polyglot AST, records the dialect and selected semantic profile, and asks Prism to analyze only the constructs it can represent. A normal IncQL plan then follows the ordinary inspection, optimization, Substrait, and execution paths.

```incan
# Illustrative API; this RFC does not standardize these exact names yet.
ingress = parse_sql("SELECT id, amount FROM orders", dialect="postgresql")
plan = ingress.prism_plan()

postgresql = emit_sql(plan, dialect="postgresql")
```

The reverse direction follows the same boundary in reverse. IncQL derives a supported Prism view, constructs a new Polyglot AST for the requested dialect, and asks Polyglot to generate SQL. It does not reconstruct SQL by concatenating identifiers and expressions into strings.

The useful promise is therefore: “IncQL can accept and emit selected SQL dialect profiles through Polyglot while keeping relational meaning in Prism.” A dialect name alone is not a promise that every statement in that dialect will run.

## Reference-level explanation (precise rules)

An SQL frontend must identify the source dialect and the Polyglot version or parser capability set used to decode a statement. It must decode text into a Polyglot typed AST before semantic mapping. It must not use a backend parser or backend execution result as the source of IncQL relational meaning.

SQL ingress must map a supported Polyglot AST into a Prism-owned unresolved or analyzed plan, as appropriate for the stage defined by IncQL RFC 041. The mapping must preserve source provenance sufficient to report the dialect, source location when available, AST construct, selected semantic profile, and coverage result.

SQL egress must start from Prism-owned relational semantics. It must construct a new Polyglot AST for a requested target dialect and generate SQL from that AST. Egress must not infer semantics from a prior SQL source string, and it must not use text substitution as a semantic transform.

Polyglot parsing and generation must occur at the SQL boundary, not in Prism's internal rewrite or execution loops. An ingress implementation may cache a successfully analyzed Prism plan. Cache validity must include the normalized source statement, source dialect, selected semantic profile, Polyglot capability version, relevant catalog or schema version, and any policy or session facts that affect analysis. An egress implementation may cache generated SQL for a selected Prism fragment. Cache validity must include the Prism plan identity, target dialect, target semantic profile, parameter shape, and capability facts that affect generation or pushdown eligibility.

For a dialect profile `d`, every IncQL SQL capability claim is the intersection of all of the following:

- Polyglot can parse or generate the relevant dialect construct for `d`.
- IncQL can map the construct between Polyglot AST and Prism without losing required relational meaning.
- The selected semantic profile records any dialect-specific constraints that affect the construct.
- The evidence required for the published claim level is present.

An `execution_supported` claim additionally requires coverage for the selected execution path. Ingress and egress claims do not imply that an adapter can execute the resulting Prism plan or generated SQL.

An ingress or egress result must distinguish at least these coverage states:

- `supported`: the construct is mapped with the required semantics under the selected profile.
- `partially_supported`: the construct is mapped only under recorded restrictions.
- `unsupported`: IncQL cannot map the construct without losing required semantics.
- `unknown`: IncQL lacks enough profile, schema, or execution evidence to decide.

Unsupported and unknown constructs must produce structured diagnostics before execution or emission. They must not be lowered to backend-specific behavior, omitted, or rewritten into a different relational meaning.

A bidirectional round trip is valid only for the declared supported intersection. Semantic equivalence must be assessed on the recorded AST-to-Prism mapping and profile, not by raw SQL string equality. Generated SQL may differ in formatting, quoting, or dialect-normalized spelling while remaining equivalent within the declared profile.

A published SQL capability claim must identify its level:

- `upstream_dialect`: Polyglot documents parsing or generation for the dialect; this is not an IncQL compatibility claim.
- `ingress_supported`: IncQL has fixtures that parse the declared feature subset, map it to Prism, and verify the resulting Prism semantics.
- `egress_supported`: IncQL has fixtures that construct the declared Prism subset, build the target Polyglot AST, and reparse or otherwise validate the generated SQL under the target dialect profile.
- `execution_supported`: IncQL has integration evidence that the selected execution path accepts the mapped Prism plan and produces the expected relational result under the declared profile.

IncQL must not collapse these levels into one dialect badge. A feature matrix may show different levels for one dialect, and user-facing compatibility material must use the most specific supported level.

## Design details

### Syntax

This RFC introduces no IncQL language syntax. SQL ingress and egress are package, service, or tool APIs around Prism.

### Semantics

The SQL boundary has four roles: parse or construct a Polyglot AST, map the supported portion to or from Prism, record profile and coverage evidence, and render SQL when egress is requested. Prism retains responsibility for relational analysis, optimization, lineage, diagnostics, requirements, and the plan that execution adapters receive. Polyglot is therefore a direct library dependency at the boundary, but not an internal Prism node kind or an optimizer dependency.

Every supported slice must declare its closed feature boundary and reject adjacent constructs whose mappings or profile implications lack evidence. An unfiltered `SELECT` with direct column projections over one unqualified, unaliased named table is a valid conformance seed: its Prism shape is a named-table read followed by a projection, and its declared coverage must reject aliases, computed projections, joins, filters, grouping, ordering, limits, offsets, common table expressions, and other undeclared constructs. That seed does not define the North Star or make broader relational coverage optional.

Common table expressions are a required design probe before the PostgreSQL core profile can be considered representative. A supported non-recursive CTE mapping must lower each CTE body to an ordinary Prism subframe and resolve later references through a statement-local lexical binding environment. Repeated references must retain shared Prism lineage; they must not become unrelated copied plans, session-global temporary tables, or SQL text substitution. Relation aliases must remain distinct relation identities when the same subframe is referenced more than once.

SQL egress must not depend on a plan having originated as SQL, and it must not independently select whether relational work is shared. Given a Prism-selected inline alternative, the lowerer may emit eligible relations as derived tables. Given a Prism-selected target-local sharing requirement and eligible shared subgraph, the lowerer may assign generated local names, order definitions by dependency, construct a fresh Polyglot `WITH` AST, and emit references when the selected SQL profile establishes that a CTE preserves the required semantics and evaluation multiplicity. A source CTE name is provenance, not Prism semantic identity or an egress requirement. If the target profile cannot realize a selected requirement, egress must request another legal Prism alternative or return a structured unsupported diagnostic; it must not silently inline, duplicate, or materialize the relation. Target-plan and execution evidence may inform a later Prism selection, but the lowerer does not become the sharing optimizer.

Recursive CTEs, data-modifying CTEs, volatile or otherwise profile-sensitive expressions, row-locking behavior, and dialect-specific materialization hints remain unsupported unless a later profile defines their semantics explicitly.

### Coverage evidence

Every declared ingress or egress feature must have a fixture corpus that names the dialect profile, SQL or Prism input, expected mapping result, and claim level. An ingress fixture must assert the Polyglot AST-to-Prism mapping rather than only accepting a parse. An egress fixture must assert the Prism-to-Polyglot AST mapping and dialect generation rather than only comparing strings. A bidirectional fixture must assert the declared semantic equivalence relation for its profile.

Every unsupported feature family adjacent to a supported slice must have at least one rejection fixture. A declared read/projection slice, for example, must reject a filter, join, expression projection, alias, grouping, ordering, limit, qualified or aliased source relation, and CTE until each has explicit coverage. The CTE corpus must include a non-recursive CTE referenced once and one referenced more than once, so a future mapping proves binding and reuse rather than superficial syntax acceptance.

An `execution_supported` claim requires expected-result integration evidence for the selected execution target. It must not be inferred from parser acceptance, SQL generation, a successful AST round trip, or a successful backend compile alone. For CTE support, that evidence must include a dbt-like CTE-heavy fixture that flows through Polyglot AST ingress into Prism, lowers through IncQL's ordinary Substrait path, and executes through the selected adapter without calling that adapter's SQL parser on the source statement. Where the profile permits, separate Prism-selected inline and target-local sharing alternatives must be realizable as inline and generated-CTE SQL and must produce equivalent results under the declared semantic profile. Target-plan inspection or measured execution may inform a later policy selection, but a structural scan-count difference alone is not a portable performance claim.

### Interaction with other IncQL surfaces

SQL, `query {}` blocks, and method-chain authoring may produce comparable Prism plans when they express the same supported relational intent under the same profile. They must not converge by treating an engine-generated SQL string as the canonical plan.

Semantic profiles from IncQL RFC 040 must record dialect-sensitive dimensions that affect a mapped construct, including identifier quoting and case handling, qualification, null semantics, type coercion, temporal and decimal behavior, function identity, and ordering where relevant. Missing profile evidence must produce `unknown`, not an assumption of portability.

Ingress coverage is frontend evidence. Adapter coverage remains execution evidence. Successful parsing by Polyglot must not be reported as successful IncQL execution, and successful egress generation must not be reported as compatibility with a target engine unless adapter and profile evidence establish that claim.

Prism lineage and inspection artifacts should retain the SQL source dialect, source AST construct identity where useful, mapping decisions, diagnostics, profile, and coverage state. They must not treat a Polyglot AST node identifier as Prism semantic identity.

### Compatibility / migration

This is additive. Existing IncQL authors and serialized plans remain valid. Each SQL dialect profile and feature mapping must be versioned or otherwise identified so inspection can distinguish a change in upstream parser behavior from a change in IncQL mapping semantics.

## Alternatives considered

- **Parse SQL directly into Substrait.** Rejected because Substrait is an interchange boundary and does not own IncQL's semantic analysis, profile evidence, or ingress diagnostics.
- **Send SQL directly to DataFusion or another backend.** Rejected because it bypasses Prism and makes backend behavior the accidental semantic authority.
- **Build a new SQL parser and generator.** Rejected because Polyglot already provides a maintained typed AST and broad dialect infrastructure; IncQL should focus on its own relational semantics and coverage.
- **Use SQL text rewriting between dialects.** Rejected because string rewriting cannot reliably preserve structure, source provenance, semantic profile constraints, or unsupported-feature diagnostics.
- **Advertise every Polyglot dialect as an IncQL dialect.** Rejected because parser availability is necessary but insufficient for Prism mapping and execution compatibility.

## Drawbacks

- IncQL gains an upstream dependency whose AST and dialect behavior must be tracked across releases.
- Dialect and feature coverage matrices require ongoing maintenance.
- A conservative unsupported diagnostic can feel less convenient than backend pass-through.
- Semantic profile work is required before broad dialect claims are trustworthy.
- Polyglot's documented dialect count can change, so marketing copy must be verified against the current upstream documentation and IncQL's own coverage records.

## Layers affected

- **IncQL specification** — SQL ingress, egress, AST boundary, dialect profile, coverage, and diagnostic vocabulary become normative.
- **IncQL library package** — public SQL frontend and egress APIs must expose structured results, AST mapping evidence, profile context, and coverage diagnostics.
- **Incan compiler** — Rust interoperability must preserve the typed upstream AST shapes required by supported mappings; this RFC introduces no new IncQL syntax.
- **Execution / interchange** — Prism remains the semantic source; Substrait and execution adapters receive Prism-owned plans and must report their own coverage separately from SQL coverage.
- **Documentation** — user-facing material must credit Polyglot and state supported dialect-and-feature profiles precisely rather than advertise parser breadth as execution compatibility.

## Unresolved questions

- Which dialect profile follows PostgreSQL in the first implementation, and what explicit feature subset earns that profile's first `supported` claim?
- Should SQL frontend APIs accept text only, or also accept a caller-provided Polyglot AST while preserving the same provenance and profile contract?
- How should schema-aware Polyglot validation and IncQL catalog resolution share facts without making either system the other's semantic owner?
- Which normalized AST or Prism evidence should be used to assert semantic equivalence for each round-trip test class?
- What compatibility and upgrade policy should apply when a Polyglot release changes parsing, generation, or dialect support for an already published IncQL profile?
- Which cache facts are mandatory for prepared SQL plans and emitted remote SQL fragments in the first implementation?
- Which initial dbt-like fixture family best represents repeated staging-model reuse, joins, aggregates, and incremental-model-adjacent patterns without accidentally importing dbt's materialization semantics into the first profile?
- What target-specific cost or execution evidence is sufficient before Prism may select target-local sharing for SQL realization rather than a legal inline alternative?

<!-- Rename this section to "Design Decisions" once all questions have been resolved. An RFC cannot move from Draft to Planned until no unresolved questions remain. -->
