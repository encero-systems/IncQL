# IncQL RFC 060: Incremental transformation and temporal history semantics

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 001 (dataset carriers and boundedness)
  - IncQL RFC 004 (execution context and Session)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 034 (quality assertions and observations)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 043 (canonical equality and digest profiles)
  - IncQL RFC 045 (constraint evidence and verification-aware planning)
  - IncQL RFC 054 (incremental extraction, state, and checkpoints)
  - IncQL RFC 055 (destination loading, write dispositions, and commit semantics)
  - IncQL RFC 058 (data projects, named relational assets, and the asset graph)
  - IncQL RFC 059 (materialization intent and applied asset lifecycle)
  - IncQL RFC 061 (asset interfaces, contracts, access, ownership, versions, and deprecation)
  - IncQL RFC 062 (project build lifecycle, selectors, state, artifacts, and delegated execution)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines incremental refresh and temporal history as explicit materialization semantics for named relational assets. Every incremental asset must retain a full-result definition, declare how changed input is selected, state how incoming rows affect prior applied output, and commit successor state only after the destination outcome is known. Incremental transformation state is applied-asset state, not an ingestion checkpoint or generic workflow variable. Temporal history must declare entity keys, change detection, valid-time and observation-time behavior, current-row representation, deletion handling, late-arrival policy, and interval semantics rather than relying on destination-specific SCD macros.

## Core model

1. A **full-result plan** defines the complete logical result of the relational asset for a bounded input snapshot.
2. An **incremental refresh policy** defines when an existing applied asset may be updated from a bounded change set instead of fully rebuilt.
3. An **input snapshot set** identifies the upstream applied assets, ingestion receipts, external-relation observations, and binding versions used by one refresh.
4. A **change-selection policy** defines which input rows or partitions are reconsidered and why that selection is complete enough for the declared guarantee.
5. A **refresh strategy** defines how recomputed rows affect the existing physical output.
6. An **applied refresh state** records the last committed output, input snapshot set, refresh boundary, strategy state, and evidence needed for a successor attempt.
7. A **temporal history policy** defines how versions of one logical entity are represented over valid and observation time.
8. A **refresh receipt** records selection, replay, deduplication, destination effects, verification, and successor-state commit without rewriting prior history.

## Motivation

Incremental transformation is attractive because rebuilding a large derived table can be unnecessarily expensive. The apparent shortcut is to filter for rows newer than a timestamp and append or merge them into the target. That becomes unsafe when rows arrive late, timestamps tie, keys are null or duplicated, upstream data is corrected, partitions are rewritten, deletes occur, a destination partially commits, or the transformation logic changes.

dbt [incremental models][dbt-incremental] make this tradeoff visible, but they leave the author to encode change selection in conditional SQL and often infer progress from the existing target table. The exact update behavior varies by adapter and strategy. This is useful prior art for workflow ergonomics, but it is not a sufficiently portable state or correctness contract for IncQL.

Temporal [snapshots][dbt-snapshots] have a related problem. Periodically comparing mutable rows can produce useful type-2 history, but the result depends on entity keys, change columns, source timestamps, observation time, interval boundaries, deletion representation, and late corrections. Calling the result a snapshot does not define those semantics.

IncQL can do better because it owns typed plans, applied asset records, destination commit evidence, canonical equality profiles, constraint evidence, and explicit semantic profiles. Incremental execution can therefore be treated as a verified optimization of a full-result definition, with every precondition and uncertainty preserved.

## Goals

- Define incremental transformation separately from incremental source extraction.
- Require every incremental asset to retain a full-result plan and output interface.
- Define input snapshot sets, change-selection policies, refresh strategies, applied refresh state, and successor-state commit.
- Define append, key-merge, partition-replace, and bounded recomputation semantics.
- Make replay, lookback, deduplication, null-key behavior, duplicate-key behavior, deletes, schema change, and logic change explicit.
- Define temporal history with entity keys, tracked values, valid time, observation time, current rows, and deletion policy.
- Require capability, constraint, and commit evidence before incremental mutation.
- Define full-refresh, backfill, repair, reconciliation, and equivalence-verification boundaries.
- Preserve local Session execution and operational delegation without transferring state authority.

## Non-Goals

- Defining connector extraction cursors or source checkpoint stores; IncQL RFC 054 owns those semantics.
- Defining unbounded streaming checkpoints, watermarks, or continuous materialized views.
- Guaranteeing that every incremental refresh is mathematically equivalent to a full rebuild without declared and verified preconditions.
- Defining schedules or deciding when a refresh should run.
- Defining destination DDL, DML, staging, or commit behavior independently of IncQL RFCs 055 and 059.
- Defining arbitrary user-managed state dictionaries.
- Requiring temporal history for every mutable source.
- Defining a complete bitemporal query language.
- Treating a backfill as permission to advance live ingestion or applied refresh state.

## Guide-level explanation (how authors think about it)

An incremental asset still has one ordinary full-result definition:

```incan
from pub::incql.materialize import incremental
from pub::incql.project import asset

@asset(
    name="commerce.daily_revenue",
    materialization=incremental(
        strategy="partition_replace",
        partition_by="order_date",
        change_basis="orders.updated_at",
        lookback=days(3),
    ),
)
def daily_revenue() -> DataSet[DailyRevenue]:
    return (
        orders.read()
        .group_by(["order_date"])
        .agg({"revenue": sum("amount")})
    )
```

The function describes the complete result. The materialization policy says that a normal refresh may identify affected `order_date` partitions from changed orders, include a three-day replay horizon, recompute those partitions from authoritative input, and atomically replace those partitions if the destination supports it.

The plan must explain what it will reuse:

```incan
refresh = session.plan_refresh(daily_revenue)?
println(refresh.previous_applied_asset)
println(refresh.input_snapshot_set)
println(refresh.selected_partitions)
println(refresh.equivalence_assurance)
```

A key-merge asset is different:

```incan
@asset(
    name="support.issue_state",
    materialization=incremental(
        strategy="key_merge",
        keys=["issue_id"],
        change_basis="issues.updated_at",
        null_key="reject",
        duplicate_key="fail",
    ),
)
def issue_state() -> DataSet[IssueState]:
    return current_issue_state(issues.read())
```

The key declaration is a required precondition. A declared key is not automatically verified uniqueness evidence. Planning must report whether the destination, prior observations, or an explicit verification provides enough assurance for the requested merge.

Temporal history uses a separate policy:

```incan
@asset(
    name="commerce.customer_history",
    materialization=history(
        entity_keys=["customer_id"],
        tracked_fields=["status", "segment"],
        source_valid_from="updated_at",
        current_end="open",
        deletes="tombstone",
    ),
)
def customer_history_input() -> DataSet[Customer]:
    return customers.read()
```

The resulting relation records when each version is valid and when IncQL observed it. The policy, not a hidden macro, determines whether a source deletion closes the prior version, inserts a tombstone, or remains unknown.

## Reference-level explanation (precise rules)

### Incremental and ingestion state

IncQL RFC 054 committed checkpoints describe progress reading one connector resource. This RFC's applied refresh state describes progress updating one derived relational asset.

The two state families must have different identities, schemas, authorities, and commit operations. A build may reference both, but it must not copy an ingestion cursor into an asset refresh state or advance either state merely because the other advanced.

Operational run state such as retries, leases, schedules, or step completion remains outside both state families.

### Full-result definition

Every incremental or history asset must have a full-result plan that:

- produces the complete declared output for one bounded input snapshot set
- typechecks against the asset interface
- is inspectable without the prior applied output
- can be selected for full refresh or verification when required capabilities are available

An incremental-only code path with no defined full result is invalid.

The incremental execution path must not change the declared output semantics. It is an execution strategy whose claimed equivalence to the full-result plan depends on recorded preconditions and assurance.

### Input snapshot set

Each refresh attempt must identify the input snapshot set used to select and compute changes. The set must contain, as applicable:

- upstream applied asset ids and commit records
- upstream logical asset versions and plan digests
- ingestion plan and load receipt references
- external relation binding and observation snapshots
- source checkpoint revisions
- catalog, table-version, partition, or file-manifest observations
- semantic and equality profiles
- observation times and diagnostics

If an input cannot provide a stable snapshot identity, the refresh must record that limitation and must not claim repeatable or snapshot-consistent execution.

### Applied refresh state

Applied refresh state must be versioned, immutable by revision, and scoped to one logical asset identity, resolved asset version, materialization destination scope, and strategy schema version.

The committed state must include or reference:

- prior applied asset record
- full-result and incremental-policy digests
- last committed input snapshot set
- committed change boundary or partition set
- replay or lookback policy
- strategy-specific state
- schema and interface versions
- destination commit evidence
- equivalence and quality evidence
- state revision and supersession relationship

A refresh attempt may propose successor state before destination commit. The successor must not become canonical until the corresponding applied asset outcome is committed under IncQL RFC 059.

Compare-and-commit must reject a stale predecessor revision. Overlapping refresh attempts must not silently overwrite each other's state.

### Change-selection policies

A change-selection policy must identify:

- the input or inputs whose change drives refresh
- the field, partition, manifest, table version, receipt, or explicit delta artifact used as the basis
- inclusive or exclusive boundary behavior
- tie handling
- null and invalid boundary behavior
- replay or lookback window
- limits and truncation behavior
- completeness assumption and assurance

Supported policy families may include:

- monotonic field boundary
- input partition or manifest change
- upstream applied-asset delta artifact
- explicit bounded time window
- explicit author-supplied affected-key or affected-partition relation
- full recomputation

Reading the maximum value from the target table may be an observed optimization input, but it must not be the sole canonical refresh state unless a declared state profile defines and validates that behavior.

A policy must not claim complete change capture when the source can update rows behind the boundary and no replay, change log, version observation, or verification covers that risk.

### Refresh strategies

The portable strategy families are:

| Strategy | Required semantics |
| --- | --- |
| `append` | Insert incoming rows without modifying prior rows; duplicate prevention requires separate evidence or idempotency keys. |
| `key_merge` | Match incoming and existing rows by declared key fields, update or replace matches according to one explicit policy, and insert non-matches. |
| `partition_replace` | Recompute complete selected partitions and replace those partitions as publication units. |
| `bounded_recompute` | Recompute an explicitly bounded subset and reconcile it with existing output under a declared key or partition policy. |
| `full_refresh` | Recompute the full-result plan and replace the applied asset under IncQL RFC 059. |

Destination-specific strategies such as delete-and-insert or native merge are physical implementations. They must report which portable strategy they realize and any semantic difference.

### Append semantics

Append must identify an idempotency scope or explicitly report that retry can duplicate rows.

An append refresh must not claim equivalence to a full result when prior input rows can be updated or deleted unless another mechanism reconciles those changes.

Repeated execution of the same append attempt must use a stable load or effect identity when the destination supports idempotent writes.

### Key-merge semantics

A key-merge policy must declare one or more output fields as the match key and define:

- null-key behavior: reject, quarantine, or treat as never matching
- duplicate incoming-key behavior
- duplicate existing-key behavior
- matched-row update behavior
- unmatched-row insert behavior
- source deletion behavior when available
- field update selection when partial rows are permitted

Null or duplicate keys must not be left to adapter accident. The default for a required portable key merge must be to fail planning or verification when usable key assurance is absent.

Declared key fields are constraint claims under IncQL RFC 045. The plan must distinguish declared, destination-enforced, observed, verified, and unknown key assurance.

### Partition replacement

A partition-replace policy must define the partition expression through typed relational semantics or a registered partition transform, not only a backend SQL string.

Every selected partition must be recomputed from an input range that is complete for that output partition under the declared transform. Replacing a partition from a partial sample is invalid unless the asset explicitly declares partial output semantics.

The destination must report the atomicity of publishing one partition and a set of partitions. Partial partition publication must produce a partial or unknown applied outcome and must not advance canonical refresh state.

### Replay, late data, and deduplication

Replay intentionally reselects input before the committed boundary. A replay policy must define the horizon and how repeated rows are reconciled.

Late-arriving data outside the replay horizon must be classified as uncovered, detected-late, quarantined, or repaired through an explicit backfill. It must not be silently ignored while claiming complete refresh.

Deduplication must define its key, ordering or winner rule, null behavior, and profile. `last row wins` is invalid unless the ordering that determines last is stable and recorded.

### Logic and schema changes

A changed full-result plan, incremental policy, output interface, key, partition transform, or equality profile must be compared with committed applied refresh state before incremental execution.

The planner must classify the change as at least:

- incrementally compatible
- requires bounded repair
- requires full refresh
- incompatible
- unknown

An implementation must not continue incremental refresh merely because the destination table still exists.

Schema evolution must follow the asset interface and destination coverage. Adding a nullable field may be incrementally compatible under one destination and still require full refresh when historical rows need derived values.

### Full refresh, repair, and backfill

A full refresh must create a new materialization plan and applied asset record. It may replace the prior physical object only under IncQL RFC 059 commit semantics.

A repair is an explicit recomputation of identified keys, partitions, or time ranges against a declared input snapshot set. It must record whether it updates canonical live refresh state.

A backfill must have an explicit historical scope and state policy. By default, it must not advance the live applied refresh state or an ingestion checkpoint. Promoting a backfill result into live state requires a separate validated state transition.

### Equivalence and verification

The target correctness claim for an incremental refresh is equivalence to the full-result plan over the same logical input snapshot set under a declared equality profile.

Assurance must distinguish at least:

- `declared`: the policy claims equivalence but has not verified data-dependent preconditions
- `constraint_supported`: constraint evidence supports the rewrite
- `sample_verified`: bounded verification found no mismatch under recorded limits
- `fully_verified`: a complete comparison under the selected equality profile found equivalence
- `proven`: a supported proof artifact establishes the claim
- `unknown`: no usable assurance is available

Quality checks alone must not be described as equivalence verification unless they compare the required full and incremental results.

### Temporal history model

A temporal history policy must declare:

- entity key fields
- tracked fields or tracked-row equality profile
- source valid-time field when available
- observation-time source
- valid-from and valid-to representation
- interval boundary convention
- current-row representation
- deletion policy
- late and out-of-order update policy
- null and duplicate entity-key behavior
- same-timestamp tie behavior
- schema evolution behavior

The history output must preserve stable identities for entity versions where practical.

### Valid time and observation time

**Valid time** describes when a source fact is asserted to apply in the modeled domain. **Observation time** describes when the IncQL refresh observed or committed that version.

The two must not be conflated. If no reliable source valid time exists, the history policy may use observation time as the valid-time approximation, but the applied record and output metadata must identify that approximation.

The interval convention must be explicit. The recommended portable convention is half-open `[valid_from, valid_to)`, with the current version represented by an open end or a declared sentinel.

Timestamp type, precision, timezone, and equality behavior must be governed by an IncQL RFC 040 semantic profile.

### Change detection

Temporal change detection may use:

- a reliable source update timestamp
- comparison of explicitly tracked fields
- comparison under a canonical row equality or digest profile
- an authoritative upstream change event

A source timestamp strategy must define behavior for unchanged, decreasing, null, duplicate, and same-timestamp conflicting values.

A tracked-field strategy must identify fields excluded from comparison and must re-evaluate schema changes. A digest is evidence for equality only under the digest and canonicalization profile that produced it.

### Current rows and deletions

Current-row representation must be one of:

- open `valid_to`
- declared maximum or sentinel `valid_to`
- explicit current flag in addition to interval fields

The policy must make range-query behavior deterministic.

Deletion handling must distinguish:

- `ignore`: absence does not prove deletion
- `close`: close the prior current interval without adding a tombstone row
- `tombstone`: close the prior interval and add a deleted version
- `unknown`: record that the source cannot distinguish deletion from omission

A periodic source snapshot must not infer deletion from absence unless the observation is declared complete for the relevant entity scope.

### Late and out-of-order history

The policy must define whether a late valid-time update:

- inserts into and splits existing intervals
- creates a correction record without rewriting prior intervals
- is quarantined for review
- is rejected

Rewriting historical intervals must create new applied and refresh records. Immutable run receipts must not be rewritten even if the materialized history table is corrected.

### Refresh receipt

Every incremental or history attempt must emit a refresh receipt containing or referencing:

- logical asset, version, full-result plan, and policy digests
- predecessor applied asset and refresh-state revisions
- input snapshot set
- selected change boundaries, keys, partitions, or time ranges
- replay, deduplication, and late-data policy
- refresh strategy and destination physical implementation
- schema and interface decisions
- counts for selected, inserted, updated, deleted, rejected, and unchanged rows when available
- verification and equivalence assurance
- destination commit and visibility outcome
- proposed and committed successor state
- diagnostics, partial effects, and reconciliation requirements

Counts reported by an adapter must identify their meaning and unknown values; a generic affected-row count must not be decomposed speculatively.

## Design details

### Syntax

This RFC introduces no new grammar. Incremental and history policies should first be typed values attached to IncQL RFC 059 materialization intent.

Incremental predicates, keys, partition transforms, and tracked fields should use checked field references or registered typed expressions. Raw backend expressions may be admitted only as profiled extension configuration with explicit portability loss.

### Semantics

Incremental refresh is an optimization of a complete relational asset, not an independent business definition. Its authority comes from the full-result plan plus recorded state, preconditions, destination outcomes, and verification evidence.

Temporal history is a modeled output relation. It is not the same as immutable execution evidence, source checkpoints, or version control history.

### Interaction with other IncQL surfaces

IncQL RFC 034 supplies quality assertions over incoming changes, staged output, and applied history.

IncQL RFC 043 supplies equality and digest profiles used for deduplication, tracked-row comparison, and full-result verification.

IncQL RFC 045 supplies key, uniqueness, partition coverage, and other constraint evidence.

IncQL RFC 054 remains the connector extraction checkpoint contract and must not be widened into transformation refresh state.

IncQL RFC 055 supplies append, merge, staging, idempotency, and commit vocabulary for destination effects.

IncQL RFC 059 supplies materialization plans, attempts, and applied asset records.

IncQL RFC 061 supplies output contracts and compatibility classification for schema or semantic changes.

IncQL RFC 062 decides which assets refresh, which prior applied assets may be reused, and how local or delegated execution resumes.

### Compatibility / migration

Existing append or merge write helpers may be used as physical implementations only after their key, retry, state, schema, and commit behavior is made explicit under this RFC.

Existing timestamp-filtered transformations should migrate by declaring the full-result plan, change basis, boundary inclusivity, replay policy, strategy, state scope, and equivalence assurance.

Existing SCD2 tables may be imported as applied state only if their entity keys, interval convention, timestamp meaning, current-row representation, deletion policy, and schema can be observed or admitted. Unknown legacy semantics must remain unknown.

## Alternatives considered

- **Reuse ingestion checkpoints for transformations.** Rejected because extraction progress and derived-output application have different owners, commit dependencies, and reset behavior.
- **Infer state from the target maximum timestamp.** Rejected as the canonical model because target data may be incomplete, corrected, truncated, or unrelated to source progress.
- **Let authors write separate full and incremental business logic.** Rejected because the two paths can diverge without a common semantic definition.
- **Treat a unique-key string as sufficient merge correctness.** Rejected because nulls, duplicates, winner rules, and destination enforcement remain unresolved.
- **Define only destination-specific merge strategies.** Rejected because portable author intent and cross-adapter coverage would disappear.
- **Represent history with one universal updated-at convention.** Rejected because valid time, observation time, deletes, ties, and corrections differ materially.
- **Advance live state after any successful backfill.** Rejected because historical repair and live progress are separate state transitions.

## Drawbacks

- Incremental correctness requires substantially more metadata and evidence than a conditional filter.
- Full-result definitions may be expensive to execute for verification.
- Some sources cannot expose stable snapshots or complete change information.
- Temporal correction can require expensive interval rewrites.
- Cross-adapter equivalence depends on semantic profiles and may remain unknown.
- Strict state and commit rules reduce the convenience of ad hoc target-table mutation.

## Implementation architecture

This section is non-normative. A refresh planner can compare the current asset manifest and prior applied refresh state, derive an affected-key or affected-partition relation, compile the ordinary full-result Prism plan with bounded input restrictions, and lower the selected portable strategy to destination operations. State proposals should be stored separately from canonical committed state and linked to the resulting applied asset record.

## Layers affected

- **IncQL specification** must define full-result plans, change selection, refresh strategies, applied refresh state, temporal history, equivalence, and receipts.
- **IncQL library package** must expose incremental and history policy values, planning, state, verification, repair, and inspection APIs.
- **Incan compiler and package tooling** must preserve typed field, key, partition, and declaration metadata; new grammar is not required by this RFC.
- **Execution / interchange** must carry snapshot, state, strategy, temporal, capability, commit, and verification evidence across local and cluster backends.
- **Documentation and tooling** must distinguish extraction checkpoints, applied refresh state, operational run state, valid time, observation time, and immutable evidence.

## Unresolved questions

- Which change-selection policy families are required for the first portable implementation?
- Should full-result equivalence verification be required periodically, configurable by assurance policy, or purely caller-selected?
- Which destination strategies qualify as conforming implementations of portable `key_merge` and `partition_replace`?
- Should the first temporal-history release support insertion into prior intervals or require quarantine for out-of-order valid-time corrections?
- Is bitemporal query convenience part of this RFC's first implementation or a later relational-function RFC?
- How should upstream assets publish reusable affected-key or affected-partition delta artifacts?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->

<!-- References -->

[dbt-incremental]: https://docs.getdbt.com/docs/build/incremental-models
[dbt-snapshots]: https://docs.getdbt.com/docs/build/snapshots
