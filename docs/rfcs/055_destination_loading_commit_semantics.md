# IncQL RFC 055: Destination loading, write dispositions, and commit semantics

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 001 (bounded and unbounded dataset carriers)
  - IncQL RFC 004 (execution context and Session writes)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 034 (quality assertions and observations)
  - IncQL RFC 035 (governed attributes and policy checkpoints)
  - IncQL RFC 043 (canonical equality and digest profiles)
  - IncQL RFC 048 (cluster execution backend mode)
  - IncQL RFC 051 (native ingestion program and ownership boundary)
  - IncQL RFC 053 (schema observation, reconciliation, and normalization)
  - IncQL RFC 054 (incremental extraction, state, and checkpoints)
  - IncQL RFC 056 (ingestion runs, load packages, and receipts)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines destination loading for native IncQL ingestion: typed destination descriptors, append, replace, and merge dispositions, schema migration boundaries, load-job chunking, idempotency, staging, completion markers, atomicity classes, and partial-failure evidence. Destination adapters must either satisfy the requested semantics or reject the plan before mutation where possible. A successful extraction does not authorize checkpoint advancement; IncQL RFC 054 may commit a proposed checkpoint only after the destination outcome reported under this RFC satisfies the selected commit policy.

## Core model

1. A **destination definition** identifies one destination protocol implementation and its capabilities.
2. A **destination specification** describes the logical target, binding requirements, table or object layout, and write policy without resolved secrets.
3. A **write disposition** defines how incoming rows affect existing destination data.
4. A **load plan** combines normalized relations, accepted schema changes, destination capabilities, job partitioning, and commit requirements.
5. A **load job** writes one retryable unit under a stable idempotency identity.
6. A **commit guarantee** describes what visibility and atomicity the destination actually provides.
7. A **completion record** distinguishes fully committed loads from partial or abandoned writes.

## Motivation

Writing a file or inserting rows is easy; defining what happens under schema drift, retries, partial failure, and multi-table normalization is not. A destination may support one transaction across all affected tables, transactions only within one table, staged replacement, merge through temporary tables, append with no rollback, or an object-store manifest that makes a set of files visible only after publication.

If IncQL exposes one generic `write` operation without a precise disposition and commit contract, every adapter will inherit different semantics. An interrupted run may duplicate rows, expose partial child tables, advance source state too early, or claim success despite an unverified commit. The typed source and checkpoint model is only useful if destination behavior is equally explicit.

Destination schema migration also needs to stay downstream of schema authority. An adapter may know how to add a column, but it must not decide whether an observed source field is allowed to become part of the declared and normalized schema. That decision belongs to IncQL RFC 053; this RFC defines how an accepted proposal is applied.

## Goals

- Define typed destination definitions and specifications separate from query execution backends.
- Standardize append, replace, and merge dispositions and their required keys and capabilities.
- Leave room for versioned merge strategies such as upsert, delete-insert, insert-only, and slowly changing dimension type 2.
- Define schema migration validation and execution after an accepted reconciliation decision.
- Define load-job identities, idempotency requirements, retries, staging, verification, and abort behavior.
- Define portable commit-guarantee classes and partial-load reporting.
- Couple successful destination outcomes to checkpoint commit without promising universal exactly-once behavior.
- Preserve quality, policy, coverage, and commit evidence in load receipts.

## Non-Goals

- Defining source extraction or checkpoint cursor semantics.
- Defining schedules, operational retries, notifications, or workflow compensation.
- Requiring every destination to support merge, schema migration, transactions, or multi-table atomicity.
- Standardizing every database DDL dialect or storage layout option.
- Inferring write disposition from filename extensions or destination type alone.
- Treating staging as proof of atomicity without an explicit publication or transaction guarantee.
- Defining organization-wide retention, deletion approval, or data-lifecycle policy.

## Guide-level explanation (how authors think about it)

An author chooses the data effect explicitly.

```incan
from pub::incql.ingest import Merge
from pub::incql.destinations import duckdb_destination

target = duckdb_destination(
    path="target/analytics.duckdb",
    dataset="github",
)

plan = issues.load_into(
    target.table("issues"),
    disposition=Merge(keys=["id"]),
)

receipt = Session.default().run_ingestion(plan)?
```

Before extraction mutates the destination, IncQL can inspect whether the selected adapter covers merge by `id`, whether the destination schema is compatible with the normalized schema, which migrations are proposed, and what commit guarantee will apply.

Replacing a table is a different request:

```incan
plan = snapshot.load_into(
    target.table("daily_snapshot"),
    disposition=Replace(),
)
```

The adapter may implement replacement with a transaction, staged table swap, versioned object manifest, or another mechanism. The receipt records which guarantee was used. A destination that can only truncate and append non-atomically must not claim atomic replace.

## Reference-level explanation (precise rules)

### Destination identity and package contract

Every destination definition must expose a stable identifier, contract version, implementation version, implementation digest when available, supported target classes, configuration schema, binding requirements, capability declarations, and diagnostic categories.

A destination specification must identify the destination definition, logical target, dataset or namespace, table or object layout, binding references, write disposition, schema policy reference, commit policy, evidence requirements, and adapter-specific options explicitly marked as non-portable when applicable.

Resolved credentials must not appear in destination specifications, plans, inspection artifacts, or receipts.

### Write dispositions

The portable contract must support at least:

- **Append**: incoming rows are added without removing or updating existing rows.
- **Replace**: the selected destination scope becomes exactly the successful load result according to the declared replacement boundary.
- **Merge**: incoming rows update, insert, or otherwise reconcile with existing rows according to stable key and strategy rules.

Append must declare replay and duplicate assumptions. If an incremental plan may replay rows and the destination cannot enforce idempotency, coverage must be unknown or uncovered for duplicate-safe delivery.

Replace must declare its scope, such as one table, partition set, object-manifest version, or dataset. The runtime must reject an ambiguous replacement scope.

Merge must declare primary or merge keys, null-key behavior, duplicate-key behavior within the incoming batch, source-order assumptions when multiple versions of one key are present, delete behavior when supported, and a named merge strategy.

Initial named merge strategies may include upsert, delete-insert, insert-only deduplication, and slowly changing dimension type 2. A destination may report partial or uncovered support for individual strategies.

### Destination capability validation

Before destination mutation, the load plan must evaluate adapter coverage for every required behavior that can be checked without execution. Requirements may include:

- append, replace, or selected merge strategy
- key and constraint enforcement
- destination schema inspection
- additive or destructive schema migration
- staging
- transaction scope
- atomic publication or table swap
- idempotent job replay
- child-relation consistency
- completion-marker storage
- checkpoint-coupled commit
- post-load verification

Unknown or uncovered required capabilities must cause rejection, explicit downgrade with author-approved semantics, or non-enforcing execution according to a higher policy. They must not silently degrade to a different disposition.

### Schema migration

Destination schema changes must derive from an accepted schema reconciliation decision under IncQL RFC 053. A destination adapter must not create new columns, tables, child relations, or type changes solely because it observed incoming values.

A migration plan must identify prior destination schema, accepted normalized schema, ordered operations, destructive operations, required capabilities, expected compatibility, rollback or abort behavior, and evidence references.

Destructive changes must be explicit and must not be hidden inside replace or merge. If a destination cannot apply a migration safely, the load must fail before data mutation where possible.

### Load jobs and idempotency

A load plan may divide normalized data into load jobs for chunking, parallelism, destination limits, or retry. Every job must have stable identity within one ingestion run and must record its relation, partition or chunk scope, input artifact or batch reference, destination target, disposition fragment, attempt count, status, and diagnostics.

Retryable jobs must have an idempotency mechanism appropriate to their disposition and destination. The mechanism may use a destination transaction, idempotency key, staged object name, deterministic file identity, merge key, completion ledger, or another declared strategy.

An adapter must not retry a job after an ambiguous failure unless it can determine whether the prior attempt committed or can replay idempotently. Ambiguous outcomes must be reported explicitly.

### Commit protocol

A load may expose the following logical stages even when a destination implements them differently:

1. **Prepare** validates target state, schema, bindings, capabilities, and idempotency identity.
2. **Stage** writes non-visible or not-yet-canonical data when the destination supports staging.
3. **Apply** performs append, replace, merge, migration, or publication operations.
4. **Verify** checks destination acknowledgement, completion marker, row or byte evidence, schema version, and optional quality assertions.
5. **Commit** marks the load complete under the selected guarantee.
6. **Abort** removes or invalidates staged work where supported after failure or cancellation.

Physical implementations may fuse stages, but receipts must preserve the observable status and guarantee distinctions.

### Commit guarantees

The portable vocabulary must distinguish at least:

- **Atomic transaction**: all declared destination effects become visible together or none do within the stated scope.
- **Atomic publication**: staged data becomes canonical through an atomic swap, manifest, pointer, or equivalent publication operation.
- **Job-atomic with completion marker**: individual jobs commit independently; readers can identify a complete load through a durable marker and exclude incomplete job sets.
- **Idempotent eventual completion**: jobs may become visible incrementally, but replay can safely converge to the intended result.
- **Best effort**: partial data may be visible and replay safety is not guaranteed.
- **Unknown**: the adapter cannot establish the guarantee.

The guarantee must identify its scope. A transaction covering one table must not be reported as an atomic multi-table load.

Exactly-once claims require evidence across source replay, destination idempotency or transactionality, and checkpoint commit. This RFC does not define exactly once as a default guarantee.

### Multi-relation loads

Normalization may produce a root relation and child relations. A load plan must define relation ordering, parent-child consistency requirements, failure behavior, and the commit scope that covers those relations.

If the destination cannot atomically commit all required relations, the plan must use a completion-marker or idempotent convergence strategy, reject the load, or execute under an explicitly weaker guarantee. It must not claim relational consistency that the adapter cannot provide.

### Partial failure and recovery

Load status must distinguish at least planned, prepared, staged, applying, verifying, committed, partially_committed, failed, cancelled, aborted, and unknown_outcome.

A partially committed or unknown outcome must prevent automatic checkpoint advancement unless the checkpoint policy explicitly recognizes a completion marker or idempotent convergence state that makes replay safe.

Recovery may resume pending jobs, replay idempotent jobs, verify ambiguous jobs, abort staged work, or start a replacement load. The selected action and its evidence must appear in the resulting receipt chain.

### Completion metadata

Destination completion metadata may live in destination-owned internal tables, object manifests, sidecar state storage, or another bound metadata provider. IncQL must define the portable record, not require one physical placement.

A completion record must identify load identity, destination target, schema version, disposition, commit guarantee, committed jobs, completion time, checkpoint relationship, and verification evidence.

User data tables must not be polluted with internal columns unless the plan or destination profile explicitly requires them and exposes their semantics. If row-level load identity columns are added, they must be reserved, collision-safe, documented, and represented in schema and lineage evidence.

### Quality and policy checkpoints

The load plan may require pre-load, post-stage, or post-commit quality assertions and policy checkpoints. IncQL RFCs 034 and 035 own their evidence semantics.

This RFC defines only where those checks occur relative to destination mutation and whether their result is required for commit. Operational handling such as notification, human approval, or long-term quarantine workflow remains outside IncQL.

## Design details

### Syntax

This RFC introduces no grammar. Destination specifications, dispositions, merge strategies, migration plans, and commit policies should be typed library values.

### Semantics

Write disposition describes intended data effect. Commit guarantee describes what the selected destination can actually make visible and recover. Both are required; one must not be inferred from the other.

### Interaction with other IncQL surfaces

IncQL RFC 004 remains the `Session.write` and execution boundary. Existing typed sinks should become destination specifications or convenience wrappers over them.

IncQL RFC 033 owns adapter requirement and coverage evidence. Destination support must not use undocumented boolean capability flags.

IncQL RFC 053 supplies accepted normalized schemas and migration proposals.

IncQL RFC 054 supplies checkpoint proposals and defines whether the reported destination outcome permits state commit.

IncQL RFC 056 records load plans, jobs, attempts, completion records, and commit guarantees in receipts.

IncQL RFC 048 requires cluster workers to resolve destination bindings and report commit outcomes through the same semantics.

### Compatibility / migration

Existing `session.write_csv`, `write_parquet`, and typed sink descriptors remain valid. Their current behavior should map to explicit append or replace semantics and an honest commit-guarantee profile.

Existing adapters that cannot report commit guarantees may operate with `Unknown` coverage during migration, but callers must not infer atomicity or replay safety from prior success alone.

## Alternatives considered

- **One generic write operation with backend defaults.** Rejected because append, replace, merge, migration, and commit behavior would vary silently.
- **Infer disposition from destination or filename.** Rejected because the intended data effect is author policy, not a naming convention.
- **Require transactions everywhere.** Rejected because filesystems, object stores, APIs, and some warehouses use different publication models.
- **Treat staging as atomic.** Rejected because staged data needs a separate atomic or durable publication step.
- **Advance checkpoints when all jobs were submitted.** Rejected because submission is not destination commit.
- **Store all metadata in destination tables.** Rejected because physical metadata placement varies and must not contaminate user schemas by default.

## Drawbacks

- Honest commit guarantees make some destinations appear weaker than their happy-path APIs suggest.
- Merge and migration conformance vary substantially across engines.
- Completion ledgers and deterministic job identities add storage and operational overhead.
- Multi-relation atomicity is unavailable on many destinations and requires explicit weaker strategies.
- Recovery from ambiguous outcomes may require destination-specific verification work.

## Implementation architecture

This section is non-normative. Destination adapters can compile a portable load plan into staged files, database transactions, merge statements through typed APIs, or object-manifest publication. A session-owned load coordinator can assign deterministic job identities, persist local job state, collect adapter acknowledgements, and emit a completion record before invoking checkpoint compare-and-commit.

## Layers affected

- **IncQL specification** must define destination identity, dispositions, migration, jobs, commit guarantees, and partial-failure semantics.
- **IncQL library package** must expose typed destination, disposition, migration, load-plan, job, completion, and verification surfaces.
- **Execution / interchange** must perform capability validation, preserve idempotency identities, report destination outcomes, and coordinate checkpoint commit.
- **Documentation and tooling** must show intended data effects, actual commit guarantees, destructive migrations, and replay assumptions before execution.

## Unresolved questions

- Which merge strategies are required for the first portable conformance level beyond basic upsert?
- Should completion-marker storage be part of each destination adapter or supplied through a separate metadata-store binding?
- What minimum post-load verification is required before a load may report `Committed`?
- How should a multi-table destination report mixed guarantees when some relations are transactional and others are best effort?
- Which destructive migration operations, if any, should be permitted in an unattended local run?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->
