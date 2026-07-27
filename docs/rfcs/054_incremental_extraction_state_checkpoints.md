# IncQL RFC 054: Incremental extraction, state, and checkpoints

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 001 (dataset carriers and boundedness)
  - IncQL RFC 004 (execution context and Session)
  - IncQL RFC 011 (source discovery and parse-unit expansion)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 036 (governed plan bundle)
  - IncQL RFC 043 (canonical equality and digest profiles)
  - IncQL RFC 048 (cluster execution backend mode)
  - IncQL RFC 051 (native ingestion program and ownership boundary)
  - IncQL RFC 052 (declarative sources, resources, and connector packages)
  - IncQL RFC 055 (destination loading, write dispositions, and commit semantics)
  - IncQL RFC 056 (ingestion runs, load packages, and receipts)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines incremental extraction and durable checkpoint state for native IncQL ingestion. Incremental state must be typed, versioned, scoped to stable source and resource identities, and advanced through an explicit proposal-and-commit protocol. A resource reads one committed checkpoint, extracts a bounded increment, and proposes a successor checkpoint; the runtime commits that successor only after the corresponding destination outcome satisfies the selected commit policy. Cursor-based incremental batch extraction remains bounded work for one run and must not be conflated with unbounded `DataStream[T]` execution.

## Core model

1. A **checkpoint definition** declares the type and semantics of durable resource progress.
2. A **committed checkpoint** is the canonical progress record visible to a new ingestion attempt.
3. A **checkpoint proposal** is the successor state produced during extraction but not yet authoritative.
4. A **state revision** provides optimistic concurrency and immutable history for checkpoint updates.
5. A **state store** persists revisions and supports atomic compare-and-commit for one checkpoint scope.
6. A **replay or lookback policy** intentionally overlaps prior progress and requires explicit deduplication semantics.
7. **Operational run state** such as schedules, step retries, and pipeline resume remains separate from resource checkpoint state.

## Motivation

Incremental ingestion is where convenience becomes correctness-sensitive. A timestamp or integer cursor seems simple until records arrive late, multiple rows share one cursor value, a destination partially commits, two runs overlap, a backfill should not move the live cursor, or the source mutates records behind a previously observed timestamp.

An untyped mutable dictionary can hold all of those cases, but it does not define which value is authoritative, how it is versioned, when it becomes committed, which resource owns it, or whether another runtime may update it concurrently. IncQL needs state semantics that are inspectable before execution and safe under failure without pretending every source and destination can provide exactly-once behavior.

The boundedness distinction is equally important. A daily API request for records newer than yesterday is a finite incremental batch even though it has durable progress. An event subscription that has no natural end is unbounded. Treating both as `DataStream[T]` would weaken static capability rules and obscure the different recovery models.

## Goals

- Define typed checkpoint definitions, committed values, proposals, revisions, and state-store behavior.
- Support scalar, composite, partitioned, and opaque connector cursor values through explicit profiles.
- Define cursor ordering, tie-breaking, replay, lag, lookback, and deduplication semantics.
- Tie checkpoint commit to destination outcome rather than extraction completion alone.
- Define optimistic concurrency and overlapping-run behavior.
- Define inspectable reset, refresh, and backfill state transitions.
- Distinguish bounded incremental extraction from unbounded stream offsets and checkpoints.
- Preserve state identity, digest, diagnostics, and commit evidence in load receipts.

## Non-Goals

- Defining schedules, trigger evaluation, cross-step workflow state, or pipeline resume.
- Guaranteeing exactly-once delivery across arbitrary external systems.
- Defining every source-specific CDC log, replication slot, or event-broker protocol.
- Requiring one hosted state service.
- Allowing connector code to mutate canonical state outside the runtime commit boundary.
- Defining destination write behavior independently of IncQL RFC 055.
- Treating a backfill range as an automatic replacement for canonical live progress.

## Guide-level explanation (how authors think about it)

An incremental resource declares how progress is observed and how overlapping values are handled.

```incan
from pub::incql.ingest import Incremental, Lookback, Merge
from models import Issue

issues = github.resource[Issue](
    name="issues",
    path="repos/{owner}/{repo}/issues",
    incremental=Incremental(
        cursor="updated_at",
        initial="2026-01-01T00:00:00Z",
        lookback=Lookback.hours(6),
        tie_breaker="id",
        deduplicate_by=["id", "updated_at"],
    ),
)

plan = issues.load_into(target, disposition=Merge(keys=["id"]))
receipt = Session.default().run_ingestion(plan)?
```

At run start, the session reads the committed checkpoint. The connector requests records from the checkpoint minus six hours, preserving late updates. Extraction proposes the highest observed `(updated_at, id)` value. The destination merge removes overlap by key. Only after the merge commit succeeds does the state store commit the proposed checkpoint.

If loading fails, the proposal remains uncommitted. A later run starts from the prior committed checkpoint and may safely replay some data according to the declared write and deduplication semantics.

A backfill is explicit and isolated:

```incan
backfill = plan.for_range(
    start="2025-10-01T00:00:00Z",
    end="2025-11-01T00:00:00Z",
    advance_canonical_checkpoint=false,
)
```

The backfill may produce its own receipt and checkpoint evidence, but it does not move the live resource cursor unless a separate state transition explicitly authorizes that change.

## Reference-level explanation (precise rules)

### Checkpoint definitions

A checkpoint definition must include:

- checkpoint-definition identity and version
- source and resource scope
- cursor value type or opaque profile identity
- source field or connector token path when applicable
- ordering direction and comparison profile
- initial value or initial-state rule
- tie-breaker fields or token semantics
- replay, lag, or lookback policy
- deduplication identity and required destination behavior
- empty-increment behavior
- state compatibility version
- evidence references and diagnostics

Changing any semantic field of a checkpoint definition must produce a new definition version. A runtime must not read prior state under a changed definition without an explicit compatibility or migration decision.

### Checkpoint lifecycle

The checkpoint lifecycle must distinguish:

1. **Read**: the runtime obtains one committed checkpoint and its state revision.
2. **Extract**: the connector uses that checkpoint to bound or continue source requests.
3. **Propose**: extraction emits a successor value and supporting observation evidence.
4. **Load**: normalized records are written according to IncQL RFC 055.
5. **Commit**: the runtime atomically commits the proposal only if the destination outcome satisfies the checkpoint policy and the prior revision is still current.
6. **Reject or abandon**: failed, cancelled, superseded, or conflicting proposals remain non-canonical and are recorded in run evidence.

Connector implementations must not write canonical state directly. They may produce connector-private attempt state, but any cross-run state that changes extraction behavior must be represented by a versioned checkpoint or explicitly named auxiliary state record governed by the same commit protocol.

### Cursor value profiles

The portable contract must support at least:

- monotonically increasing integer or decimal values
- timestamps with explicit precision and timezone semantics
- lexicographically ordered strings under a named comparison profile
- composite tuples with ordered component comparison
- partitioned cursors keyed by a stable partition identity
- opaque continuation tokens whose ordering is connector-defined or absent

If a connector cannot compare opaque tokens, it must define successor and replay behavior without claiming monotonic ordering. Inspection and receipts must report that limitation.

Cursor comparison must not inherit backend-specific timestamp, collation, null, or decimal behavior. It must reference an explicit semantic or canonical comparison profile where those dimensions matter.

### Ties, replay, and deduplication

If multiple records can share a cursor value, the checkpoint definition must declare a stable tie-breaker, inclusive replay boundary, source-supported continuation token, or another strategy that prevents records from being skipped.

Lookback and lag policies must state their unit, direction, maximum overlap when bounded, and interaction with the initial value. A runtime must record the effective extraction lower and upper bounds in the receipt.

Any policy that intentionally replays records must declare deduplication or idempotency requirements. A plan that uses append-only loading without an adequate source uniqueness or destination idempotency strategy must report uncovered or unknown replay safety rather than claiming safe incremental behavior.

### State stores

A state store must support:

- lookup by stable checkpoint scope
- immutable state revisions
- atomic compare-and-commit against an expected prior revision
- state version and digest storage
- committed time and committing run identity
- proposal or conflict diagnostics
- read-only inspection
- explicit reset or migration operations

The default local `Session` path must provide a durable local state store. Operational layers may supply remote or managed stores through the binding boundary, but the checkpoint semantics must remain unchanged.

State stores should support leases or equivalent coordination when multiple active runs could share one checkpoint scope. A lease must not replace compare-and-commit; runtimes must still detect stale revisions.

### Overlapping runs and conflicts

Two runs must not both commit successor checkpoints from the same prior revision without an explicit commutative merge profile. The default behavior is that the first valid commit succeeds and the later commit reports a state conflict.

A state conflict must not retroactively invalidate destination data that already committed. The run receipt must report the split outcome so an operational layer can reconcile, compensate, or rerun according to destination semantics.

### Empty increments

A run that extracts no records may still produce a checkpoint proposal when the source protocol provides a meaningful continuation token or high-watermark. The checkpoint definition must state whether empty increments may advance state.

The runtime must not infer advancement from wall-clock time alone unless the checkpoint profile explicitly defines that behavior and its safety assumptions.

### Reset, refresh, and migration

State maintenance must distinguish at least:

- inspect only
- reset one checkpoint to its initial state
- set a checkpoint to an explicitly supplied value
- migrate state to a new checkpoint-definition version
- reset resource state without touching destination data
- coordinate resource data replacement with state reset
- reset all resources owned by one source

Destructive state operations must first produce a deterministic change plan naming affected state scopes, destination effects when requested, and expected next-run behavior. Interactive tools must require confirmation unless explicitly configured for non-interactive automation.

State reset must not imply destination deletion. Destination refresh must not imply state reset. Combined operations must declare both effects and their ordering.

### Backfills

A backfill must identify its range or source-specific replay scope, parent ingestion plan, canonical checkpoint policy, destination write behavior, and receipt relationship to the live resource.

Backfills must not advance the canonical live checkpoint by default. If advancement is requested, the runtime must validate that the backfill endpoint and current state have a defined ordering and must record the explicit state transition.

### Bounded incrementals and streams

Cursor-based incremental extraction is bounded when each run has a finite source range or termination condition. It must produce bounded carriers and may use ordinary bounded destination writes.

An unbounded source produces `DataStream[T]` and follows the streaming lifecycle, offset, watermark, state-store, and sink-commit requirements of IncQL RFC 048 in addition to any connector checkpoint contract. A finite micro-batch implementation does not make an unbounded source semantically bounded.

### State evidence and redaction

Committed checkpoints, proposals, conflicts, resets, and migrations must be represented in load receipts according to IncQL RFC 056. Receipts must include state version and digest, but may redact or hash cursor values when they contain sensitive source information.

Redaction must preserve enough equality or ordering evidence to diagnose state progression when possible. If redaction prevents that analysis, the receipt must report the evidence as unavailable rather than fabricating a safe comparison.

## Design details

### Syntax

This RFC introduces no grammar. Checkpoint definitions, replay policies, state-store bindings, and maintenance requests should be typed values and artifacts.

### Semantics

Extraction proposes progress; destination success authorizes progress; the state store commits progress. This ordering is the central correctness rule.

Exactly-once behavior is not a generic IncQL guarantee. A plan may claim a stronger delivery guarantee only when source replay, destination idempotency or transactionality, checkpoint commit, and failure recovery collectively provide evidence for that guarantee.

### Interaction with other IncQL surfaces

IncQL RFC 001 remains the source of boundedness semantics. Durable progress does not make a bounded increment into an unbounded carrier.

IncQL RFC 011 remains the file discovery contract. Incremental file discovery may use checkpoints defined here without moving parse-unit semantics into this RFC.

IncQL RFC 032 execution observations must correlate runtime attempts with checkpoint read, proposal, and commit outcomes.

IncQL RFC 033 capability vocabulary must include cursor extraction, checkpoint compare-and-commit, replay safety, partitioned state, and destination-coupled commit requirements.

IncQL RFC 043 supplies digest profiles for state definitions and values when canonical hashing is possible.

IncQL RFC 055 defines the destination outcome required before state commit.

### Compatibility / migration

Existing stateless reads remain valid and carry no checkpoint definition.

Any existing source implementation with ad hoc mutable state must migrate that cross-run behavior into explicit checkpoint or auxiliary-state records before it can claim conformance with native incremental ingestion.

## Alternatives considered

- **Mutable untyped dictionaries exposed to connector code.** Rejected because state shape, ownership, concurrency, and commit timing become implicit.
- **Advance state after extraction succeeds.** Rejected because a later destination failure could skip data on the next run.
- **Treat all incrementals as streams.** Rejected because finite incremental batches and unbounded execution have different static and operational semantics.
- **Use destination data as the only checkpoint.** Rejected because not every destination exposes a reliable or efficient progress query and the state contract would become destination-specific.
- **Promise exactly once.** Rejected because external source replay and destination commit capabilities vary and must be evidenced rather than assumed.
- **Let every backfill move the live cursor.** Rejected because historical replay and live progression are separate operations.

## Drawbacks

- Compare-and-commit introduces conflicts that simple single-process state files do not expose.
- Strong replay safety often requires destination merge or idempotency support.
- Partitioned and composite state can become large and expensive to inspect.
- Explicit reset and migration plans add ceremony to maintenance workflows.
- Some connector-native tokens cannot be meaningfully compared or redacted while preserving diagnostics.

## Implementation architecture

This section is non-normative. A local state store can use an embedded transactional database keyed by source, resource, checkpoint definition, and binding scope. The ingestion executor can carry immutable prior and proposed state records through one run and invoke compare-and-commit only after destination completion. Remote stores can implement the same contract through a provider interface with leases and optimistic revisions.

## Layers affected

- **IncQL specification** must define checkpoint identity, lifecycle, replay, conflict, reset, backfill, and boundedness semantics.
- **IncQL library package** must expose checkpoint definitions, state-store interfaces, proposals, commits, inspection, and maintenance artifacts.
- **Execution / interchange** must coordinate destination outcomes and state commits without embedding state or credentials into relational plans.
- **Documentation and tooling** must explain replay assumptions, conflicts, reset impact, and the difference between incremental batches and streams.

## Unresolved questions

- Which state-store transaction guarantees are required for the first portable conformance level?
- Should auxiliary connector state use the same typed checkpoint abstraction or a separate versioned state-record family?
- How should partitioned checkpoint maps be compacted without losing revision history required for audit and recovery?
- What should happen when destination commit succeeds but checkpoint compare-and-commit loses a race?
- Which backfill-to-live-checkpoint advancement rules are safe enough to standardize rather than leave connector-specific?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->
