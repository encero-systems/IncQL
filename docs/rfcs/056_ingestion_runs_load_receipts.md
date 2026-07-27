# IncQL RFC 056: Ingestion runs, load packages, and receipts

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 027 (relational evidence program)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 029 (typed metadata attachments)
  - IncQL RFC 030 (Prism lineage graph)
  - IncQL RFC 031 (local inspection APIs and artifacts)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 034 (quality assertions and observations)
  - IncQL RFC 035 (governed attributes and policy checkpoints)
  - IncQL RFC 036 (governed plan bundle)
  - IncQL RFC 038 (evidence exchange bridges)
  - IncQL RFC 043 (canonical equality and digest profiles)
  - IncQL RFC 051 (native ingestion program and ownership boundary)
  - IncQL RFC 054 (incremental extraction, state, and checkpoints)
  - IncQL RFC 055 (destination loading, write dispositions, and commit semantics)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines the portable evidence model for native ingestion runs, phase attempts, load packages, load jobs, and final load receipts. A receipt must identify the immutable ingestion plan, connector and adapter versions, selected source resources, schema decisions, checkpoint lifecycle, destination effect, commit guarantee, counts, timings, diagnostics, quality and policy evidence, and payload-retention posture. Receipts must remain useful locally and across higher operational layers without embedding raw records, credentials, product-specific review state, or workflow semantics into the base IncQL contract.

## Core model

1. An **ingestion plan target** identifies one immutable source-to-destination intent snapshot.
2. An **ingestion run** is one top-level attempt to execute that plan.
3. A **phase attempt** records discover, extract, normalize, load, verify, or checkpoint-commit work.
4. A **load package** groups normalized artifacts and load jobs under one destination commit boundary; it need not contain persisted raw data.
5. A **load job record** identifies one retryable destination unit and its attempts.
6. A **load receipt** is the terminal or current evidence envelope for one run and its destination outcome.
7. A **receipt chain** links retries, resumes, recovery attempts, superseding runs, and higher-level operational receipts without rewriting prior evidence.

## Motivation

Data appearing in a destination is not enough to explain what happened. Operators and tools need to know which source and resource versions ran, what schema was declared and observed, which checkpoint was read and proposed, whether destination writes were atomic or partial, which rows were rejected, which quality checks ran, and whether raw payloads were retained.

Existing IncQL execution observations provide a strong base for relational execution attempts, but ingestion spans additional lifecycle boundaries. A run may successfully extract and normalize data, partially load several jobs, fail to commit state, and later resume. Flattening that history into one success flag or a backend log would lose the evidence needed for safe retry, review, and downstream governance.

Receipts also need an ownership boundary. IncQL should record source-to-destination facts. An operational layer may add pipeline, workflow, schedule, deployment, environment, and retry context. A governed AI runtime may later add package review or admissibility decisions. Those envelopes should reference the IncQL receipt rather than placing their product-specific fields into the base schema.

## Goals

- Define semantic targets and identities for ingestion plans, runs, phases, load packages, jobs, checkpoints, and receipts.
- Define required receipt fields for source, schema, state, destination, commit, counts, timing, diagnostics, quality, policy, and payload retention.
- Preserve success, partial success, failure, cancellation, conflict, and unknown outcomes.
- Support retry, resume, recovery, and supersession through immutable receipt chains.
- Integrate ingestion evidence with existing IncQL targets, observations, lineage, coverage, quality, policy, digests, and governed bundles.
- Keep raw records and secrets out of receipts by default.
- Allow operational systems to correlate their own run receipts without becoming the semantic owner of IncQL ingestion.

## Non-Goals

- Defining an operational pipeline, workflow, schedule, deployment, or alert schema.
- Defining package review, model behavior, or runtime admissibility fields for governed AI systems.
- Requiring raw extraction payloads to be persisted in a load package.
- Defining one hosted receipt database or retention service.
- Replacing OpenTelemetry, OpenLineage, or other external observability standards.
- Guaranteeing cryptographic authenticity or non-repudiation for every receipt in the first version.
- Recording credentials, authorization headers, row samples, or full backend logs by default.

## Guide-level explanation (how authors think about it)

The normal result of a local ingestion run is a typed receipt.

```incan
receipt = session.run_ingestion(plan)?

assert receipt.status == IngestionRunStatus.Committed
assert receipt.resources[0].resource_name == "issues"
assert receipt.load.commit_guarantee == CommitGuarantee.AtomicTransaction
assert receipt.checkpoint.status == CheckpointStatus.Committed
```

Inspection can answer concrete questions without opening destination internals:

```incan
println(receipt.schema.declared_digest)
println(receipt.schema.observed_digest)
println(receipt.schema.decision)
println(receipt.counts.rows_loaded)
println(receipt.counts.rows_rejected)
println(receipt.payload_retention.mode)
```

If a destination load commits but checkpoint advancement loses a state race, the receipt does not say `Committed` without qualification. It records the destination commit, the checkpoint conflict, the effective terminal status, and the evidence needed for a subsequent reconciliation run.

A higher operational layer may wrap the receipt:

```incan
run_receipt = operational_run_receipt(
    step_run_id="step-123",
    ingestion_receipt=receipt.reference(),
)
```

The wrapper may add schedule, environment, runner, retry, and workflow context. It must not change the source, schema, state, destination, or commit facts recorded by IncQL.

## Reference-level explanation (precise rules)

### Semantic targets and identity

IncQL RFC 028 must be extended with semantic targets for at least:

- connector definition
- source specification
- resource specification
- resource dependency
- ingestion plan
- ingestion run
- discovery attempt
- extraction attempt
- normalization attempt
- load package
- load job
- load-job attempt
- destination commit
- checkpoint definition
- committed checkpoint revision
- checkpoint proposal
- checkpoint commit attempt
- load receipt

Plan and specification targets should be deterministic for the same canonical artifact where possible. Run, attempt, job, commit, and receipt identities must be unique within their lifecycle and must preserve references to their governing plan targets.

Display names must not be the sole identity for sources, resources, destinations, or jobs.

### Ingestion run record

An ingestion run record must include:

- run identity and attempt identity
- ingestion-plan identity and canonical digest
- IncQL version and relevant rule/profile versions
- start time, end time or duration, and status
- selected source and resource target references
- connector identities, versions, and implementation digests when available
- source and destination binding snapshot references with redaction status
- requested execution backend or adapter context
- phase-attempt references
- load-package and load-job references
- schema evidence references
- checkpoint evidence references
- destination commit evidence
- quality and policy evidence references
- adapter requirement and coverage references
- counts and metrics available at the run level
- payload-retention record
- diagnostics, cancellation, conflict, recovery, and supersession references

The run record must distinguish absent, unsupported, unavailable, redacted, and empty evidence.

### Phase attempts

Every phase attempt must identify its phase, attempt number, parent run, input artifact or state references, output artifact or proposal references, start and end timing, status, counts or bytes when available, diagnostics, and execution observation references.

Phase status must distinguish at least pending, running, succeeded, failed, cancelled, skipped, unsupported, conflicted, partially_succeeded, and unknown_outcome.

Fused physical execution may emit one runtime span for multiple phases, but the receipt must still preserve the logical phase boundaries and available evidence for each.

### Load packages

A load package must identify the normalized schema version, included root and child relations, destination target, write disposition, commit scope, load-job set, artifact references, and package status.

A load package may reference in-memory, temporary, local, remote, or content-addressed normalized artifacts. It must not imply that raw extraction data was persisted. Raw, decoded, normalized, and destination-ready artifact classes must remain distinguishable.

Package status must distinguish at least prepared, normalized, loading, committed, partially_committed, failed, cancelled, abandoned, and unknown_outcome.

### Load job records

A load-job record must include job identity, package identity, relation and partition or chunk scope, destination target, disposition fragment, deterministic idempotency identity when available, input artifact reference, attempts, status, output bytes or rows when available, destination acknowledgement, and diagnostics.

Load-job attempts must be append-only evidence. A retry must create a new attempt record rather than overwriting the failed attempt.

### Schema evidence

Receipt schema evidence must reference or include:

- declared schema identity and digest
- planned schema identity and digest
- observed schema identity and digest when available
- normalized schema identity and digest
- prior and resulting destination schema identities and digests when available
- schema inference and normalization profile versions
- schema diff
- reconciliation decision
- migration plan and outcome
- unsupported or ambiguous fields

Schema digests must identify their canonicalization profile according to IncQL RFC 043.

### Checkpoint evidence

Receipt checkpoint evidence must include checkpoint-definition identity and version, prior committed revision identity and digest, effective extraction range or token, proposal identity and digest, checkpoint commit status, resulting committed revision when successful, conflict or migration diagnostics, and whether the run was a backfill permitted to advance canonical state.

Cursor values may be redacted or represented by protected digests. The receipt must state the representation and any resulting diagnostic limitations.

### Destination and commit evidence

Receipt destination evidence must include destination definition identity and version, logical target reference, write disposition, merge or replacement strategy, schema migration outcome, load-job summary, commit identity, commit status, commit guarantee and scope, completion-marker reference when applicable, post-load verification evidence, and partial or unknown outcome details.

A receipt must not summarize a partially committed multi-job load as success solely because one destination call returned successfully.

### Counts and metrics

When available, a receipt should include counts for:

- records or bytes discovered
- records or bytes extracted
- records normalized
- root and child rows produced
- rows accepted
- rows rejected
- values rejected or preserved as variants
- rows staged
- rows inserted, updated, deleted, merged, or skipped when the destination reports them reliably
- jobs attempted, succeeded, failed, retried, or unknown

Counts must identify their source and reliability. Adapter estimates must not be presented as exact counts.

### Quality and policy evidence

Quality assertions and observations must use IncQL RFC 034 records. Policy checkpoint decisions must use IncQL RFC 035 records. Receipts must reference those records and identify where they occurred relative to extraction, normalization, staging, commit, and checkpoint advancement.

The base receipt may record that a decision required approval or rejected a load. It must not define organization-specific approval workflow, reviewer identity policy, or package-runtime admissibility semantics.

### Payload retention

Every receipt must include a payload-retention record, even when no payload was persisted. The record must distinguish at least:

- **None**: raw source payloads were not persisted beyond transient processing required for the run.
- **Temporary staged**: payloads or decoded batches were staged for retry and are governed by an expiration or deletion policy.
- **Redacted retained**: a transformed or redacted representation was retained under an identified profile.
- **Content-addressed retained**: payload artifacts were retained by digest with an access-controlled external reference.
- **Unknown**: the runtime cannot determine retention behavior.

The record must include artifact class, scope, location reference when permitted, digest profile when available, redaction profile, expiration or deletion status, and diagnostics. It must not embed the payload itself.

### Receipt status

The top-level run status must distinguish at least:

- planned
- running
- committed
- committed_with_checkpoint_conflict
- partially_committed
- failed_before_destination_mutation
- failed_after_partial_mutation
- cancelled
- aborted
- superseded
- unknown_outcome

Status naming may evolve, but the model must distinguish destination outcome from checkpoint outcome. Consumers must not treat all non-`Committed` states as equivalent.

### Receipt chains and recovery

Retries, resumes, compensations, state reconciliation, and superseding runs must create new run or attempt records linked to prior evidence. Prior receipts must remain immutable.

A recovery record must identify the failure or ambiguous outcome being recovered, selected recovery action, reused or replayed jobs, destination verification, checkpoint decision, and resulting receipt.

Operational systems may attach their own run or workflow receipts through stable references. Those attachments must not mutate IncQL receipt content.

### Serialization and exchange

Receipt artifacts must be versioned and locally serializable without a hosted service. They must follow the required/optional/unavailable/unsupported distinctions of IncQL RFC 036.

Evidence exchange bridges under IncQL RFC 038 may map receipt facts to OpenTelemetry, OpenLineage, provenance, supply-chain, or dataset metadata formats. An external format must not become the internal source of IncQL ingestion semantics.

Sensitive fields must follow visibility and redaction rules from IncQL RFC 029 and relevant secret-value contracts.

## Design details

### Syntax

This RFC introduces no authoring syntax. Receipt models, references, serialization, and inspection APIs are the normative surface.

### Semantics

Receipts are evidence, not control flow. A receipt records what happened and what the runtime could establish. Higher layers may make operational decisions from that evidence, but the receipt does not schedule retries, approve deployments, or admit AI behavior.

### Interaction with other IncQL surfaces

IncQL RFC 027 must be amended to distinguish source checkpoint evidence from the cross-step lifecycle state it excludes.

IncQL RFC 028 supplies the shared target model and must add ingestion target categories.

IncQL RFC 032 execution observations remain the runtime-attempt evidence used inside phase and job records.

IncQL RFC 036 governed plan bundles may carry ingestion plans, schema and checkpoint records, load receipts, and external receipt references.

IncQL RFC 043 supplies digest profiles for plans, schemas, states, and retained artifacts.

IncQL RFCs 054 and 055 define the state and destination facts that receipts record; this RFC must not redefine their semantics.

### Compatibility / migration

Existing execution observations remain valid. Ingestion receipts should reference them rather than require replacement.

Adapters may initially report unsupported or unavailable fields, but they must not fabricate counts, atomicity, state progression, or payload-retention evidence.

## Alternatives considered

- **Use backend logs as receipts.** Rejected because logs are unstable, often sensitive, and do not preserve typed semantic targets.
- **Store only a success row in the destination.** Rejected because source, schema, checkpoint, partial-job, retention, and recovery evidence would be missing.
- **Require raw data in every load package.** Rejected because it increases privacy, storage, and credential-leakage risk and is not necessary for all retry strategies.
- **Put operational workflow fields in the base receipt.** Rejected because one ingestion run can be consumed by multiple operational systems with different lifecycles.
- **Put AI package review and admissibility fields in the base receipt.** Rejected because those are domain-specific decisions over IncQL evidence, not ingestion facts.
- **Overwrite receipts during retry.** Rejected because it destroys failure and recovery history.

## Drawbacks

- Complete receipts can become large for multi-resource and multi-table runs.
- Versioned artifact schemas create long-lived compatibility commitments.
- Honest unavailable and unknown evidence may frustrate consumers expecting one success flag.
- Digest and redaction profiles add complexity to otherwise simple local runs.
- Receipt chains require tooling to summarize history without hiding important intermediate failures.

## Implementation architecture

This section is non-normative. A session-owned receipt builder can collect immutable events from discovery, extraction, normalization, destination, and state coordinators, then serialize one terminal envelope plus referenced phase and job artifacts. Local storage can use a run directory or embedded database, while higher layers can ingest the same artifacts into external telemetry and evidence systems.

## Layers affected

- **IncQL specification** must define ingestion targets, lifecycle records, receipt fields, status, retention, chaining, and serialization semantics.
- **IncQL library package** must expose typed receipt records, references, writers, readers, and inspection projections.
- **Execution / interchange** must emit honest phase, job, destination, state, and coverage evidence without including secrets or raw payloads by default.
- **Documentation and tooling** must support local receipt inspection, recovery history, redaction explanation, and structured export.

## Unresolved questions

- Should the first receipt serialization embed phase and job records or reference sibling artifacts by default?
- Which receipt fields are mandatory for a connector or destination to claim minimum native-ingestion conformance?
- Should payload-retention mode `Unknown` prevent a receipt from satisfying the default local evidence policy even when destination commit succeeded?
- Which receipt records should receive cryptographic signatures or attestations in a later profile?
- How should receipt compaction summarize long retry chains without removing immutable source evidence?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->
