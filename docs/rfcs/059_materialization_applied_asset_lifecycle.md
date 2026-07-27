# IncQL RFC 059: Materialization intent and applied asset lifecycle

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 004 (execution context and Session)
  - IncQL RFC 007 (Prism logical planning and optimization engine)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 036 (governed plan bundle)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 050 (addon component registry and package contract)
  - IncQL RFC 055 (destination loading, write dispositions, and commit semantics)
  - IncQL RFC 058 (data projects, named relational assets, and the asset graph)
  - IncQL RFC 060 (incremental transformation and temporal history semantics)
  - IncQL RFC 061 (asset interfaces, contracts, access, ownership, versions, and deprecation)
  - IncQL RFC 062 (project build lifecycle, selectors, state, artifacts, and delegated execution)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines how a named relational asset declares whether and how its logical result should become an independently applied physical asset. Materialization intent is typed, backend-neutral policy attached to an immutable relational asset version; it is not arbitrary SQL or a runtime hook. Session resolves that intent against one destination binding and capability snapshot, produces an inspectable materialization plan before mutation, and records the committed, partial, unknown, or abandoned outcome as an applied asset record. Logical asset identity, physical destination identity, and one materialization attempt must remain distinct.

## Core model

1. A **logical asset** is the named Prism-managed relational result defined by IncQL RFC 058.
2. A **materialization intent** declares the persistence class, destination requirements, replacement policy, evidence requirements, and semantic guarantees expected by the asset.
3. A **destination binding** resolves logical destination requirements to one environment-specific connector, locator, and binding snapshot without changing logical meaning.
4. A **materialization plan** is the immutable, pre-mutation resolution of one logical asset, one destination binding, adapter coverage, physical operations, and commit policy.
5. A **materialization attempt** executes one materialization plan and records phase and effect evidence.
6. An **applied asset** is a successfully visible physical realization of one logical asset version under one binding and semantic profile.
7. An **applied asset record** identifies the logical input, physical output, schema, component versions, commit outcome, and evidence needed to reuse or defer to that applied asset.

## Motivation

Named relational logic and physical persistence are different decisions. The same typed asset may be computed locally for exploration, exposed as a view in a warehouse, replaced as a table in a lakehouse, incrementally refreshed, or compiled into a downstream asset without an independent physical object. If persistence is encoded inside the relational body, the logical plan becomes tied to one destination and cannot be inspected or reused independently.

dbt's [materialization vocabulary][dbt-materializations] demonstrates the value of declaring table, view, incremental, ephemeral, and materialized-view intent separately from a model's select statement. It also demonstrates the risk of implementing that boundary through adapter-specific macros and arbitrary SQL. Similar names can hide different replacement, atomicity, schema, and failure behavior across platforms.

IncQL already has the stronger pieces needed for a precise boundary: typed Prism plans, semantic profiles, adapter coverage, destination commit vocabulary from IncQL RFC 055, execution observations, and governed evidence. The missing contract is how those pieces produce one physical applied asset without making a database relation name the identity of the logical computation.

Materialization must also work locally. A standalone Session should be able to apply a supported asset to a local table or file target and emit the same records consumed by a higher operational layer. Scheduling and environment promotion remain outside IncQL.

## Goals

- Define backend-neutral materialization intent for named relational assets.
- Distinguish logical-only, inline, view, table, incremental, history, and backend-managed persistence classes.
- Require capability and contract validation before destination mutation where possible.
- Define immutable materialization plans and stable attempt identities.
- Define applied asset records and their relationship to logical assets, physical objects, bindings, schemas, profiles, and receipts.
- Reuse destination write, staging, idempotency, atomicity, and commit vocabulary from IncQL RFC 055.
- Make partial and unknown physical outcomes explicit rather than reporting generic failure.
- Prevent arbitrary pre- and post-SQL hooks from becoming the extension contract.
- Preserve a complete local Session execution path and a delegatable operational boundary.

## Non-Goals

- Defining incremental refresh, merge, replay, or temporal history semantics; IncQL RFC 060 owns them.
- Defining project selection, build ordering, state comparison, retries, or delegated scheduling; IncQL RFC 062 owns them.
- Defining asset access, versions, ownership, or compatibility; IncQL RFC 061 owns the interface.
- Defining source extraction or checkpoint advancement; IncQL RFCs 052 through 056 own ingestion.
- Defining one universal physical DDL sequence for every destination.
- Guaranteeing multi-asset atomicity across independent destinations.
- Defining database user permissions, grants, or organization-wide deployment policy.
- Allowing adapter-specific strings to silently redefine the logical output schema or relational semantics.
- Requiring every named relational asset to be physically materialized.

## Guide-level explanation (how authors think about it)

An author first defines a logical asset, then chooses whether it should have an independent physical realization. The exact helpers are illustrative.

```incan
from pub::incql.project import asset
from pub::incql.materialize import table
from models import CustomerSummary

@asset(
    name="commerce.customer_summary",
    materialization=table(
        destination="analytics",
        object="customer_summary",
        replacement="atomic_replace",
    ),
)
def customer_summary() -> DataSet[CustomerSummary]:
    return build_customer_summary()
```

The asset body remains one typed Prism plan. The materialization declaration says that a selected build should create or replace a table through the logical `analytics` destination binding. It does not contain a production credential, a warehouse hostname, or a `create table` statement.

Before mutation, Session can inspect the materialization plan:

```incan
plan = session.plan_materialization(customer_summary)?
println(plan.coverage.status)
println(plan.commit_guarantee)
println(plan.schema_change)
```

If the selected destination cannot atomically replace the object, cannot represent a required type, or cannot enforce a required interface precondition, planning reports uncovered or partial coverage. It must not silently downgrade the request.

After execution, the applied record links logical and physical state:

```incan
outcome = session.materialize(customer_summary)?
println(outcome.applied_asset.logical_asset_ref)
println(outcome.applied_asset.physical_object_ref)
println(outcome.applied_asset.commit_status)
```

Another build may later reuse that applied asset only if its logical asset version, plan digest, binding, schema, profile, and commit evidence satisfy IncQL RFC 062.

## Reference-level explanation (precise rules)

### Materialization classes

The materialization intent must distinguish at least:

| Class | Required meaning |
| --- | --- |
| `logical_only` | The asset has no independently applied physical object. It may still be executed, collected, or consumed by another plan. |
| `inline` | The asset is intentionally compiled into selected consumers and is not independently addressable in the destination. |
| `view` | The destination stores a named logical relation whose result is evaluated according to destination view semantics. |
| `table` | The destination stores a named physical relation produced from a bounded execution of the full asset plan. |
| `incremental` | The destination stores a table refreshed according to IncQL RFC 060 incremental semantics. |
| `history` | The destination stores temporal history according to IncQL RFC 060. |
| `managed` | The destination owns refresh mechanics, such as a materialized view, while IncQL records the requested and observed guarantees. |

`logical_only` and `inline` must remain distinct. A logical-only asset may be selected for direct execution or collection without being fused into a consumer. An inline asset explicitly permits consumer compilation and lacks an independent applied object.

The first implementation may support only a subset of persistence classes, but unsupported classes must remain explicit uncovered capability rather than aliases for a different class.

### Materialization intent

A materialization intent must identify or derive:

- materialization class
- logical destination requirement
- physical object naming policy
- schema application policy
- replacement, refresh, or visibility policy
- requested commit and atomicity guarantee
- idempotency scope
- retention or cleanup policy for staging artifacts
- required connector and runtime capabilities
- required quality, contract, policy, and verification checkpoints
- redaction and receipt requirements

The intent must not contain resolved credentials, live destination handles, backend-native objects, or executable SQL strings as its semantic definition.

An asset with no explicit persistence intent must be treated as `logical_only`. IncQL must not mutate a destination merely because a named asset was discovered or inspected.

Project-level defaults may propose a materialization intent, but the resolved intent and provenance must appear in the project manifest. Conflicting defaults and asset-local declarations must resolve deterministically or fail.

### Destination binding and physical identity

A destination binding must resolve the intent's logical destination requirement to:

- connector component identity and version
- binding snapshot identity
- destination locator or namespace
- physical object naming result
- destination semantic profile
- credential and configuration references without values
- capability and commit-coverage evidence

The physical object name must not become the logical asset identity. Two environments may apply the same logical asset to different objects, and one environment may contain several applied versions.

A physical object reference must identify enough destination context to distinguish objects without embedding credentials.

### Materialization planning

Materialization planning must occur before mutation and must produce an immutable plan containing:

- logical project, asset, version, plan, and interface references
- selected materialization intent and provenance
- destination binding snapshot
- output schema and planned physical schema
- schema and type-lowering decisions
- physical operation classes and staging requirements
- component and semantic-profile identities
- capability requirements and coverage
- requested and available commit guarantees
- expected applied object identity
- quality, policy, contract, and verification checkpoints
- diagnostics and unsupported or unknown states

Planning may perform an explicit read-only destination metadata probe when the caller permits it. The plan must record that probe, its binding snapshot, and observed metadata. Planning must not run DDL, DML, hooks, or cleanup mutations.

Repeated planning over the same canonical logical asset, intent, binding snapshot, destination observations, and component versions should produce the same materialization plan digest.

### Capability and contract validation

Before mutation, Session must validate:

- the compute runtime can execute the Prism plan under the selected profile
- source bindings are compatible with the runtime
- the destination connector can represent the output schema
- the requested materialization class is supported
- the requested replacement or refresh policy is supported
- the requested commit guarantee is covered
- required interface, quality, policy, and verification checkpoints can be evaluated
- staging and cleanup requirements are available

Unknown required coverage must not be reported as covered. A caller may explicitly admit partial or unknown coverage only through a recorded policy decision from the appropriate evidence boundary.

Destination-native constraint declarations must not be treated as enforced unless coverage evidence shows that the destination enforces them at the required phase.

### Full table materialization

A `table` materialization must execute the full logical asset plan for the selected input bindings. Its replacement policy must distinguish at least:

- `create_only`: fail if the destination object already exists
- `replace`: replace according to the destination's reported visibility and atomicity
- `atomic_replace`: require a staging-and-publish or transactional swap whose prior committed object remains visible until the successor is committed

If `atomic_replace` is requested and unavailable, the plan must be uncovered. It must not silently use drop-and-create.

A successful table materialization must record the exact logical plan digest, input binding snapshot references, output schema, physical object reference, and commit evidence.

### View and managed materialization

A `view` materialization must record the destination-native definition or definition digest when available, the logical asset digest it represents, dependency bindings, schema observations, and replacement outcome.

The destination may lower the logical plan to SQL or another native representation. That physical representation is execution evidence, not the source of IncQL relational semantics.

A `managed` materialization must record which refresh, invalidation, scheduling, staleness, and atomicity responsibilities are delegated to the destination. IncQL must not claim freshness or refresh success solely because the object was created.

### Inline materialization

An inline asset may be expanded into one or more consuming Prism plans. The rewrite must preserve authored asset origin, interface references, and lineage.

Inlining must not bypass access checks, version resolution, fixture tests, quality requirements, or policy checkpoints that apply to the consumer or inlined asset.

An inline asset has no applied asset record of its own unless a child RFC defines a cache or intermediate realization with an independent identity. The consuming applied asset record must identify the inlined asset versions and plan digests.

### Attempt lifecycle and outcomes

A materialization attempt must expose at least these logical phases when applicable:

1. bind and validate
2. execute logical plan
3. stage physical output
4. verify staged schema and required checks
5. publish or commit
6. verify visibility
7. clean up or retain staging artifacts according to policy

Physical implementations may fuse phases, but attempt evidence must preserve the observable boundaries needed to explain failures and commits.

Attempt status must distinguish at least:

- `planned`
- `running`
- `committed`
- `failed_before_effect`
- `failed_after_partial_effect`
- `commit_unknown`
- `abandoned`
- `superseded`

A generic failure status must not hide whether a physical effect may be visible.

### Applied asset record

An applied asset record must contain or reference:

- applied asset id and schema version
- project manifest and build-set references when available
- logical asset id and resolved version
- authored and optimized Prism plan digests
- asset interface and output schema identities
- materialization intent and plan digests
- destination connector, runtime, and evidence-provider identities and versions
- binding snapshot and semantic profile
- physical object reference
- requested and observed commit guarantees
- commit status and visibility observation
- input applied asset, external relation, and ingestion receipt references
- quality, policy, contract, and verification evidence
- attempt, timing, diagnostics, and trace references
- staging retention and cleanup status

The record must not embed resolved credentials or raw relation contents by default.

Only a `committed` record with sufficient visibility and contract evidence may be treated as an available applied asset. A `commit_unknown` record must require reconciliation before reuse.

Applied records must be append-only. Replacing or superseding a physical object creates a new record and a supersession relationship; it must not rewrite the prior outcome.

### Hooks and extension effects

Arbitrary pre- and post-materialization SQL strings must not be the extension contract.

A package may provide a typed materialization component or lifecycle effect only through IncQL RFC 050 registration. Such an extension must declare:

- component and effect identity
- admissible lifecycle phase
- typed inputs and outputs
- side-effect and idempotency class
- required bindings and capabilities
- transaction and commit participation
- redaction and evidence behavior

An effect that can mutate external state must not run during project discovery, static inspection, plan compilation, documentation generation, or read-only validation.

### Diagnostics

Materialization diagnostics must distinguish at least:

- unsupported materialization class
- incompatible source/runtime or runtime/destination binding
- schema or type-lowering incompatibility
- replacement-policy mismatch
- insufficient commit or atomicity coverage
- inaccessible physical object
- staged output verification failure
- partial physical effect
- unknown commit or visibility
- stale or incompatible applied asset
- lifecycle effect unavailable or inadmissible

Diagnostics must preserve component, binding, asset, materialization plan, and attempt identities without exposing secret values.

## Design details

### Syntax

This RFC introduces no new language grammar. Materialization intent should first be represented by typed Incan values attached to relational asset declarations.

Backend-specific options may be carried through namespaced typed component configuration, but they must not replace the portable intent or suppress coverage diagnostics.

### Semantics

Materialization changes physical availability, not the logical meaning of a relational asset. One logical asset version may have zero, one, or many applied asset records across environments and times.

An applied asset record is evidence that one materialization attempt produced a reported physical state. It is not proof that the data remains unchanged or available forever.

### Interaction with other IncQL surfaces

IncQL RFC 004 remains the local binding and execution boundary.

IncQL RFC 032 execution observations describe runtime attempts; this RFC adds the destination effect and applied-object lifecycle needed for persistence.

IncQL RFC 033 and RFC 040 provide capability and semantic-profile context for runtime, type, DDL, DML, commit, and constraint behavior.

IncQL RFC 050 provides connector, compute-runtime, and typed extension component identities.

IncQL RFC 055 supplies reusable destination disposition, staging, idempotency, and commit vocabulary. Ingestion loads and transformation materializations retain distinct plan and run identities.

IncQL RFC 058 supplies the logical asset and project identities attached to materialization intent.

IncQL RFC 060 specializes the `incremental` and `history` classes.

IncQL RFC 061 supplies the interface that a materialization must preserve.

IncQL RFC 062 composes materialization attempts into project builds and controls reuse, deferral, skip, and resume.

### Compatibility / migration

Existing Session write helpers remain valid. They should become direct one-off materialization or destination operations where their current behavior has a precise equivalent.

Existing code that emits backend-specific SQL may continue through an explicitly profiled ingress or runtime component, but a named asset materialization must still produce portable intent, coverage, and applied records.

No existing named asset implicitly gains persistence when this RFC is adopted. Authors or project policy must opt into a non-logical materialization class.

## Alternatives considered

- **Treat physical table names as asset identity.** Rejected because logical assets must survive environment, schema, backend, and replacement changes.
- **Put DDL and DML in the relational asset body.** Rejected because persistence would become part of logical semantics and static inspection could gain side effects.
- **Adopt dbt custom materialization macros.** Rejected because string generation and adapter dispatch do not provide typed effects, capability evidence, or stable commit semantics.
- **Default every named asset to a view.** Rejected because a default physical mutation is surprising and view support or semantics vary across destinations.
- **Make every asset a table.** Rejected because local, inline, view, managed, and non-persisted use cases are legitimate.
- **Use only execution logs instead of applied asset records.** Rejected because logs do not provide a stable logical-to-physical identity and commit contract.
- **Let an operational layer own materialization semantics.** Rejected because standalone IncQL must be able to produce durable outputs and operational scheduling does not define data-write meaning.

## Drawbacks

- Applied asset identity and lifecycle add substantial artifact volume.
- Destination capability matrices become more detailed than a generic write API.
- Strong pre-mutation validation may reject workflows that previously relied on destination-specific scripts.
- Some destinations cannot provide definitive commit or visibility evidence.
- Typed lifecycle extensions require more implementation work than arbitrary hooks.

## Implementation architecture

This section is non-normative. Session can lower a materialization intent into a connector-owned operation graph after Prism planning and capability validation. Staged table writes can reuse RFC 055 load-job and commit machinery, while view and managed definitions use destination-specific physical lowering that remains attached as evidence. Applied asset records should be emitted from canonical typed records, with human logs and reports rendered as projections.

## Layers affected

- **IncQL specification** must define materialization classes, plans, attempts, outcomes, applied asset records, and extension-effect restrictions.
- **IncQL library package** must expose typed materialization intent, planning, execution, inspection, reconciliation, and applied-record surfaces.
- **Incan compiler and package tooling** must preserve declaration metadata and typed component configuration; new grammar is not required by this RFC.
- **Execution / interchange** must validate runtime and destination coverage, preserve logical asset identity through physical lowering, and record commit and visibility outcomes.
- **Documentation and tooling** must explain logical assets, materialization intent, physical objects, applied state, and ambiguous outcomes as distinct concepts.

## Unresolved questions

- Should `inline` remain an explicit author intent, or should it be an optimizer decision permitted only for `logical_only` assets?
- Which table replacement policy should be the recommended default for local development and for production bindings?
- What minimum visibility probe is required before a committed applied asset may be reused?
- Should backend-managed materializations use one `managed` class with capability details or distinct portable classes for common refresh models?
- Which multi-asset publication guarantees belong in this RFC versus the project build lifecycle in IncQL RFC 062?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->

<!-- References -->

[dbt-materializations]: https://docs.getdbt.com/docs/build/materializations
