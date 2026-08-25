# IncQL RFC 069: Lakehouse table-format sources

- **Status:** Draft
- **Created:** 2026-08-24
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 002 (Apache Substrait integration)
  - IncQL RFC 004 (execution context and DataFusion)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 031 (local inspection APIs and artifacts)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 050 (addon component registry and package contract)
  - IncQL RFC 052 (declarative sources, resources, and connectors)
  - IncQL RFC 053 (schema reconciliation and normalization)
  - IncQL RFC 055 (destination loading and commit semantics)
  - IncQL RFC 059 (materialization and applied asset lifecycle)
  - IncQL RFC 061 (asset interfaces, contracts, access, and versions)
- **Issue:** [IncQL #115](https://github.com/encero-systems/IncQL/issues/115)
- **RFC PR:** —
- **Written against:** IncQL 0.1.0 / Incan 0.5.0
- **Shipped in:** —

## Summary

This RFC defines how IncQL reads and writes lakehouse table formats — Apache Iceberg and Delta Lake — as typed relational sources. A table-format source is provided by an addon component rather than by IncQL core. Its authoritative table schema is reconciled against the declared Incan `model` before planning completes, and that reconciliation produces a typed, inspectable outcome rather than a runtime surprise. Every read carries a version selector, reads at exactly one immutable version, and records which version it read as part of the read root's semantic identity and its evidence. Credentials, endpoints, and provider configuration are resolved by the component's binding and never enter a plan.

## Core model

1. A table-format source is a read/write component registered through the addon component registry. IncQL core defines the contract; it does not implement Iceberg or Delta.
2. A source is addressed either by **location** or by **catalog reference**. Both resolve to the same typed relation, and the addressing mode is recorded.
3. The table's own schema is authoritative for physical shape. The declared `model` is authoritative for the author's contract. Reconciliation between them is explicit, typed, and diagnosable.
4. Where a format provides stable field identity, reconciliation must use it, so a renamed column is reported as a rename rather than as a disappearance.
5. Every read carries a version selector, not a hardcoded version. Execution resolves it, reads consistently at one immutable version, and records which version it read. Which selectors an asset permits is a contract question, not a source-format question.
6. Credentials and endpoint configuration belong to the component's binding. They must not appear in a plan, an artifact, or an inspection record.

## Motivation

IncQL currently reads a local file. That is enough to demonstrate typed relational authoring and nothing else: a local CSV is a file that every existing tool already reads with less ceremony. A typed data logic plane earns its place only when it operates on the data an organization actually governs, and for a growing share of that data the unit of governance is a lakehouse table rather than a file or a warehouse relation.

Table formats also change the schema problem in IncQL's favour. A CSV has no schema, so IncQL must infer one — expensively, and without authority. An Iceberg or Delta table carries an authoritative schema, tracks its evolution, and in Iceberg's case assigns stable identity to every field. That means a typed relational layer can do something no untyped tool can: compare the author's declared contract against the table's real, current, versioned shape *before any data is read*, and say precisely how they differ.

That comparison is the point of this RFC. Reading a table format is table stakes. Reconciling it against a declared type, and treating the result as evidence, is the capability that distinguishes IncQL from a DataFrame library that happens to open Parquet.

## Goals

- Define a source contract that Iceberg and Delta components can implement without IncQL core depending on either.
- Make schema reconciliation between a declared `model` and a table schema a first-class, typed, diagnosable outcome.
- Use format-provided field identity so column renames are distinguishable from column removals.
- Read at exactly one immutable table version, and preserve the selector and the resolved version as evidence.
- Keep version-selection policy with the asset's contract rather than hardcoding it into source access.
- Keep credentials, endpoints, and provider configuration outside plans, artifacts, and inspection records.
- Support object-store-backed tables across more than one cloud without changes to IncQL core.

## Non-Goals

- Implementing Iceberg or Delta. This RFC defines a contract; components implement it.
- Defining a portable catalog API. This RFC defines how a catalog reference is *addressed and recorded*, not a normalized catalog interface across vendors.
- Managing secrets, identity federation, or credential rotation.
- Defining the materialization and applied-asset lifecycle, which IncQL RFC 059 owns.
- Defining general ingestion from operational systems, which IncQL RFC 051 owns.
- Table maintenance operations such as compaction, expiry, or manifest rewriting.

## Guide-level explanation (how authors think about it)

An author declares the row shape they intend to work with, then reads a table:

```incan
@derive(Clone)
model Order:
    order_id: int
    customer_id: str
    amount: float


orders: LazyFrame[Order] = session.read_table("warehouse.sales.orders")?
```

The declared model is a contract, not a guess. If the table no longer has `amount`, the author does not discover this when a job fails at 3am — planning reports it, naming the field and what happened to it. If the table has thirty columns and the model names three, the read projects to those three and records that it did so. If the table widened `amount` from a 32-bit to a 64-bit float, that is compatible and proceeds. If it narrowed, it does not.

Because the table carries its own schema, nothing is inferred and no file is read to find out its shape.

A read is also versioned. By default it reads the table's current version and records which one that was, so an inspection says exactly which data it described. An author who needs reproducibility can pin the version instead, or name a historical one — but whether a table is safe to read at `current` is a property of the agreement with its producer, not of the file format, so that policy lives with the asset's contract.

The names above are illustrative. The contract is that a table-format read is typed, reconciled, versioned, and inspectable before execution.

## Reference-level explanation (precise rules)

### Source components

A table-format source must be provided by a component registered through the addon component registry. IncQL core must not depend on an Iceberg or Delta implementation, and must not special-case either format in its plan, lowering, or evidence models.

A component must declare the formats it provides, the addressing modes it supports, the object stores or catalogs it can bind, and its read and write capabilities. IncQL must reject a source whose requested capability is absent from the selected component's declaration, and must report that rejection as a capability diagnostic rather than a planning failure of unknown cause.

### Addressing

A table-format source must be addressed in exactly one of two modes:

- **Location addressing** names a storage location that is sufficient to resolve the table's own metadata.
- **Catalog addressing** names a catalog, a namespace path, and a table name, resolved through a catalog client the component provides.

Both modes must resolve to the same typed relation and the same reconciliation contract. The addressing mode, the resolved identifiers, and the identity of the component that resolved them must be recorded on the read root and must be available to inspection.

This RFC does not define a portable catalog interface. A catalog client is component-provided, and the diversity of catalog protocols is deliberately left outside the core contract.

Both addressing modes compose with the version selectors defined below, including explicit historical versions where the component supports them.

### Schema reconciliation

Reconciliation compares the declared model against the table schema of the resolved version. It must occur during planning, before any data is read, and must produce exactly one outcome:

- `exact`: every declared field matches a table field in name or identity, type, and nullability, and no accommodation was required;
- `compatible`: every declared field resolves, and every difference is an accommodation this RFC permits;
- `incompatible`: at least one declared field cannot be resolved or resolves to a field this RFC does not permit accommodating;
- `unknown`: the component cannot supply a schema for the resolved version, or supplies one whose shape IncQL cannot interpret.

`incompatible` and `unknown` must fail planning. Neither may be downgraded to a warning, and neither may be resolved by reading data.

Field resolution must proceed as follows. Where the format provides stable field identity — Iceberg field IDs, or Delta column mapping identifiers — reconciliation must resolve declared fields by that identity, and must fall back to name matching only for fields the format does not identify. A component that cannot expose field identity must declare that limitation, and reconciliation against it must record that resolution was name-based.

The following accommodations are permitted and yield `compatible`:

- a table field whose type widens the declared type without loss;
- a table field that is non-nullable where the declared field is optional;
- table fields not named by the model, which are projected away and recorded as unreferenced.

The following must yield `incompatible`:

- a declared field with no resolvable table field;
- a table field whose type narrows the declared type, or whose conversion may lose information;
- a table field that is nullable where the declared field is not optional.

Where field identity resolves a declared field to a table field with a different name, reconciliation must succeed and must emit a rename diagnostic naming both the declared name and the current table name. A review profile may treat a rename as blocking, but reconciliation itself must not silently present a renamed field as though nothing changed.

Every reconciliation outcome must record, per field, the resolution basis used, the accommodation applied if any, and the diagnostic raised if any. A `compatible` outcome that accommodated a difference is not equivalent to an `exact` one and must not be reported as though it were.

### Version selection, identity, and evidence

A read must carry a **version selector** rather than a literal version baked in by the planner. A selector must be one of:

- `current`: resolve the table's current version at execution time;
- `pinned`: resolve at planning time and require execution to read that same version;
- an explicit version: resolve the named table version, whenever the plan runs.

An explicit version selector is how this RFC supports historical reads. A component that cannot resolve a historical version must declare that limitation, and a request for one must be rejected as a capability diagnostic rather than silently served from the current version.

Whichever selector is used, execution must read at exactly one immutable version and must record which version it read. A read must never observe more than one version.

**Which selector is permitted is a contract question.** A table whose producer guarantees append-only writes and additive schema evolution can be read at `current` safely; one with no such guarantee cannot. This RFC defines the selector mechanism and the evidence it produces. It does not decide which selector an asset should use, and it must not encode a global default that overrides an asset's declared contract. IncQL RFC 061 owns asset interfaces, contracts, access, and versions, and is the authority for which selectors an asset permits.

Absent a declared contract, a read must default to `current`. That default is safe only because reconciliation runs twice, as below; it is not a claim that reading current data is generally safe.

Reconciliation must run **twice**:

- at planning time, against the then-resolvable schema, to give the author immediate feedback on their declared model;
- at execution time, against the schema of the version actually read, to establish correctness.

The planning-time reconciliation is advisory and exists for authoring experience. The execution-time reconciliation is authoritative. An execution-time `incompatible` or `unknown` outcome must fail execution even where the planning-time outcome was `exact`, and the resulting diagnostic must name both outcomes so the divergence is visible rather than inferred.

The selector, the resolved version identity, the table identity, the addressing mode, the resolving component identity, and both reconciliation outcomes must become part of the read root's semantic target and must be preserved in inspection artifacts and metadata attachments. Two plans that differ only in resolved table version must be distinguishable by their read-root identity.

A version identity is provenance, not a freshness guarantee. It states which version was read. It must not be presented as evidence that the data was verified or that the table is current.

### Physical layout metadata

A component should record the table's declared partition specification, sort order, and clustering columns as source evidence where the format provides them. These are declared table facts, not measured statistics, and recording them does not make IncQL an owner of physical layout.

IncQL must not act on layout metadata in this RFC. Whether layout can be exploited is an adapter capability question under IncQL RFC 033: one execution target may prune by partition while another cannot express the concept at all. Layout evidence must therefore be recorded alongside the coverage evidence that says whether the selected target can use it, and a consumer must not infer that recorded layout implies realized pruning.

### Credentials and provider configuration

Credentials, tokens, endpoints, region settings, and other provider configuration must be resolved by the component's binding at execution time. They must not appear in a plan, an inspection record, an artifact, a metadata attachment, or a diagnostic.

Where a component must record that a credential was used, it must record a non-secret reference to the binding, never the credential itself. A binding reference must be treated as sensitive metadata under the visibility rules of IncQL RFC 029.

IncQL core must not define a credential format, a secret store interface, or an identity provider integration.

### Writes

A component may declare write capability. Where it does, a write must resolve the same table identity, reconciliation, and capability checks as a read, and must produce a commit outcome that records the table version before and after the write.

This RFC does not define when a write occurs, how it is scheduled, or how an applied asset is versioned; IncQL RFC 055 and IncQL RFC 059 own that lifecycle. It defines only that a table-format write is reconciled and version-recorded on the same terms as a read.

### Errors and diagnostics

A reconciliation diagnostic must name the declared field, the resolved table field where one exists, the resolution basis, and the specific rule that was violated. A diagnostic that reports only that a schema did not match is not sufficient.

A capability rejection, an unresolvable address, an unavailable catalog, and a reconciliation failure must be distinguishable from one another.

## Design details

### Syntax

This RFC introduces no language syntax. Table-format reads use the existing typed Session read surface.

### Semantics

Reconciliation is a planning-time operation over metadata. It must not read table data, must not execute a plan, and must not mutate the table.

A reconciled read is an ordinary typed relation. Once reconciliation succeeds, downstream planning, lowering, and execution treat the relation exactly as any other typed relation; nothing about the source format may leak into relational semantics.

### Interaction with other IncQL surfaces

Reconciled table reads must be usable identically from `query {}` blocks and from `DataSet[T]` method chains, and must lower through the same Substrait read-root contract as other sources. A table-format read root stays logical in the plan; the component binds it at execution.

Reconciliation outcomes, version identities, and rename diagnostics are evidence. They must be exposed through the local inspection surface rather than through log output, and must follow the artifact and versioning rules of IncQL RFC 031.

Where IncQL RFC 053 defines general reconciliation and normalization behavior, this RFC specializes it for table formats and must not contradict it. Where IncQL RFC 061 defines asset interfaces and versions, a table-format source is one such interface.

### Compatibility / migration

This RFC is additive. Existing file-based reads remain valid and unchanged. No serialized plan shape changes for existing sources.

Adopting a table-format source changes where schema authority lives: for file sources IncQL infers a schema, and for table-format sources the table supplies one. Authors moving a relation from a file source to a table source must expect reconciliation to surface differences that inference previously hid.

## Alternatives considered

- **Implement Iceberg and Delta in IncQL core.** Rejected. It contradicts the addon component contract, makes every user compile a lakehouse stack they may not use, and privileges two formats in a layer that should stay format-neutral.
- **Treat a table as a directory of Parquet files.** Rejected. It discards the table's schema authority, snapshot isolation, and field identity — which are precisely the properties that make typed reconciliation possible.
- **Infer the schema from data as file sources do.** Rejected. The table already states its schema authoritatively; inferring one would be slower, less correct, and would forfeit rename detection.
- **Follow renames silently using field identity.** Rejected. Resolution by identity is correct, but presenting a renamed field as unchanged hides a real change to a contract the author wrote down.
- **Accept an unpinned read.** Rejected. An unpinned read makes a plan describe no particular data, which defeats the inspection and evidence contracts.
- **Define a portable catalog API now.** Rejected for this RFC. Catalog protocols differ enough that a premature normalization would encode one vendor's model as IncQL's.

## Drawbacks

- Two addressing modes and a reconciliation matrix are more contract than a simple reader would need.
- Strict reconciliation will reject reads that a permissive tool would accept, which will feel obstructive to authors migrating existing pipelines.
- Version pinning makes plan identity change whenever a table changes, which will surface as plan churn in evidence-sensitive workflows.
- Component-provided catalog clients mean catalog behavior is not uniform across components, and that non-uniformity is visible to users.

## Layers affected

- **IncQL specification** — table-format sources become a defined source class with a normative reconciliation contract.
- **IncQL library package** — the Session read surface must accept table-format sources, and reconciliation outcomes must be typed records rather than diagnostics-as-strings.
- **Addon components** — components must implement the source contract, declare their capabilities and addressing modes, and own credential binding.
- **Execution / interchange** — a table-format read root must remain logical in Substrait, with binding deferred to the component at execution.
- **Evidence and inspection** — reconciliation outcomes, version identities, and rename diagnostics must be first-class inspection evidence.
- **Documentation** — reference documentation must describe the reconciliation matrix and the addressing modes as a user contract, not as component-specific behavior.

## Unresolved questions

- Which reconciliation accommodations, if any, should a strict profile refuse that this RFC permits?
- What is the minimum field-identity guarantee a component must provide before IncQL will resolve by identity rather than by name?
- Should a component be permitted to declare that it cannot re-reconcile at execution time, and if so, what does that cost the caller?

### Resolved

- **Historical reads are in scope here.** An explicit version selector serves them, using machinery this RFC already requires. Time-travel addressing does not need a separate home.
- **Pin drift is not a failure mode to arbitrate; it was an artifact of pinning at planning time.** A version selector resolved at execution removes it. Reconciliation runs twice — advisory at planning for authoring feedback, authoritative at execution for correctness.
- **Version-selection policy belongs to the asset contract**, not to this RFC. IncQL RFC 061 is the authority for which selectors an asset permits; this RFC defines only the mechanism and a safe fallback.
- **Partition, sort, and clustering metadata are recorded as source evidence.** They are declared table facts rather than measured statistics. Whether they can be exploited is an adapter capability question under IncQL RFC 033, since execution targets differ in whether they can express the concept at all.

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->
