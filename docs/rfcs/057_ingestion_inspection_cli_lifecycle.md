# IncQL RFC 057: Local ingestion inspection and CLI lifecycle

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 004 (execution context and Session)
  - IncQL RFC 011 (source discovery and parse-unit expansion)
  - IncQL RFC 031 (local inspection APIs and artifacts)
  - IncQL RFC 036 (governed plan bundle)
  - IncQL RFC 037 (plan diff and blast-radius inputs)
  - IncQL RFC 043 (canonical equality and digest profiles)
  - IncQL RFC 046 (data contract ingress and product topology)
  - IncQL RFC 051 (native ingestion program and ownership boundary)
  - IncQL RFC 052 (declarative sources, resources, and connector packages)
  - IncQL RFC 053 (schema observation, reconciliation, and normalization)
  - IncQL RFC 054 (incremental extraction, state, and checkpoints)
  - IncQL RFC 055 (destination loading, write dispositions, and commit semantics)
  - IncQL RFC 056 (ingestion runs, load packages, and receipts)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines the local authoring, inspection, validation, execution, and maintenance lifecycle for native IncQL ingestion. Authors and tools must be able to scaffold a source, discover resources, take a bounded redacted sample, generate and compare candidate schemas, inspect an immutable ingestion plan, validate connector and destination coverage, execute one local run, inspect receipts and state, and preview destructive reset operations through structured artifacts. Deployment, schedules, backfills across environments, and centralized monitoring remain operational-layer concerns.

## Core model

1. **Scaffold** creates a source or destination declaration from a connector template, OpenAPI document, database reflection, or another supported input.
2. **Discover** enumerates resources, binding requirements, capabilities, and candidate schema metadata without a full load.
3. **Sample** obtains explicitly bounded, redacted evidence for development and schema observation.
4. **Plan** produces an immutable ingestion-plan artifact and required capability set without mutating a destination.
5. **Validate** checks declarations, bindings, schema decisions, state compatibility, destination coverage, and evidence policy.
6. **Run** executes one local ingestion plan through `Session` and emits a receipt.
7. **Inspect and maintain** read receipts, state, failed jobs, and change plans; destructive operations require explicit preview and confirmation.

## Motivation

Native ingestion is not credible if the only interface is "run this program and inspect the destination." Source integrations fail at many earlier boundaries: credentials are missing, an API changed pagination, discovery returns unexpected resources, schema drift is incompatible, state is stale, destination merge is unsupported, or a reset would delete more data than intended.

A good local workflow turns those boundaries into explicit checkpoints. It lets an author begin with a generated declaration, inspect a small sample, compare a candidate schema, review required changes, and validate a destination before any full load. After execution, the same structured artifacts support CI, IDEs, agents, and operational systems without requiring each tool to scrape console text.

The workflow must remain product-neutral and local-first. An operational layer can deploy the resulting plan, provide managed bindings, schedule it, or centralize receipts. Those capabilities should consume the same artifacts rather than replace local behavior with a separate proprietary path.

## Goals

- Define a coherent command and API lifecycle for scaffolding, discovery, sampling, planning, validation, execution, inspection, and maintenance.
- Require structured, versioned artifacts behind human-readable output.
- Make boundedness, redaction, capability coverage, schema authority, checkpoint impact, and destination mutation visible before execution.
- Support non-interactive CI and agent use without bypassing validation or confirmation policy.
- Provide local state, failed-job, receipt, and recovery inspection.
- Allow local development destinations and bindings without changing source or ingestion semantics.
- Keep deployment, scheduling, environment promotion, and centralized monitoring outside IncQL.

## Non-Goals

- Defining a hosted dashboard, managed catalog, or organization-wide receipt store.
- Defining schedules, triggers, workflow dependencies, deployment packaging, or alert routing.
- Requiring an interactive terminal for normal use.
- Making formatted console output the source of truth.
- Allowing samples to bypass source policy, redaction, or rate limits.
- Automatically accepting generated schemas or destructive state and destination changes.
- Standardizing one editor, notebook, or graphical interface.

## Guide-level explanation (how authors think about it)

The exact executable name remains an unresolved packaging decision. The command vocabulary below is normative in intent and illustrative in spelling.

Start by scaffolding a generic REST source from an OpenAPI document:

```text
incql source init github --openapi https://api.github.com/openapi.json
```

The command creates source declarations, resource candidates, binding requirements, and diagnostics. It does not write secrets or run a full extraction.

Discover and sample selected resources:

```text
incql source discover github --format json
incql source sample github.issues --max-items 100 --output target/incql/sample.json
```

Sampling records its limits and redaction profile. A sample artifact is evidence for development, not an authoritative dataset or complete schema.

Generate and compare a candidate model:

```text
incql schema observe github.issues --max-pages 3
incql schema diff github.issues --declared models.Issue
```

Before running, inspect and validate the complete plan:

```text
incql ingest plan sync_github --output target/incql/sync_github.plan.json
incql ingest validate sync_github --binding local --destination local_duckdb
```

Validation reports connector, schema, state, destination, commit, quality, policy, and payload-retention coverage. It does not mutate the destination.

Run locally and inspect the receipt:

```text
incql ingest run sync_github --binding local
incql ingest inspect --latest sync_github
```

State maintenance is previewed before application:

```text
incql state reset github.issues --plan-only
incql state reset github.issues --apply
```

The first command emits a change plan. The second must verify that the applied request matches that plan and follow interactive or non-interactive confirmation policy.

## Reference-level explanation (precise rules)

### Command and API parity

Every normative CLI operation must have an equivalent typed library or tooling API over the same artifacts. The CLI must not own semantics that cannot be exercised or tested without console invocation.

Human-readable output must be a projection from structured records. Commands must support a stable machine-readable output mode for CI, IDE, agent, and integration use.

The exact top-level executable and subcommand spelling may vary before this RFC becomes Planned, but the lifecycle stages and artifact semantics must remain available.

### Scaffolding

Scaffolding must be able to create or update source declarations from at least connector templates. Implementations may additionally support OpenAPI documents, SQL database reflection, filesystem discovery, data contracts, or package-provided templates.

A scaffold result must include:

- generated or updated files
- connector identity and version
- discovered or selected resource candidates
- binding requirements with no secret values
- generated schema candidates when requested
- unsupported source features
- diagnostics and warnings
- overwrite and merge decisions
- generator version and provenance

Scaffolding must not overwrite existing author files without explicit confirmation or an unambiguous non-interactive policy. Regeneration must preserve author-owned regions or report conflicts rather than silently replacing them.

Generated source and schema declarations are proposals. They must not be treated as reviewed or admitted merely because generation succeeded.

### Discovery

Discovery must expose source metadata, resources, dependencies, default selection, binding requirements, pagination or continuation policy, boundedness, schema state, capability requirements, and diagnostics according to IncQL RFC 052.

Discovery must support a mode that performs no full data extraction. Any metadata requests made during discovery must be bounded and reported.

Discovery artifacts must identify connector and binding snapshots so changes can be compared over time.

### Sampling

Sampling must require at least one explicit bound over items, pages, bytes, or duration. Implementations may provide conservative defaults for interactive use, but the effective limits must appear in the artifact.

Samples must apply source authorization, rate-limit, redaction, and payload-retention policy. They must not display or persist credentials, sensitive headers, or unredacted protected fields through ordinary output.

Sample artifacts must include provenance, bounds, schema observation references, redaction profile, payload-retention record, truncation status, and diagnostics. They must not be described as complete source snapshots.

### Planning

Planning must produce an immutable artifact containing or referencing:

- source and selected resource specifications
- connector versions and digests
- binding requirements
- declared and planned schema identities
- normalization profile
- checkpoint definitions and prior-state requirements
- destination specification and write disposition
- schema migration proposal when available
- required connector, backend, state-store, and destination capabilities
- quality and policy checkpoints
- payload-retention policy
- relational plan references
- evidence requirements and diagnostics

Planning must not resolve secret values or mutate source state or destination data.

Repeated planning over the same canonical inputs should produce the same plan digest. Environmental coverage observations may differ and must remain separate from plan identity.

### Validation

Validation must distinguish at least:

- declaration validation
- connector package and version validation
- binding-shape validation without exposing values
- optional live binding probe
- resource discovery compatibility
- declared and observed schema compatibility
- checkpoint-definition and state-version compatibility
- destination schema and migration compatibility
- disposition and commit-guarantee coverage
- quality and policy requirement coverage
- payload-retention policy coverage
- receipt-emission capability

Validation status must distinguish passed, failed, unsupported, incomplete, and unknown. Unknown coverage must not be reported as passed.

A live validation probe must be explicit because it may contact external systems. It must declare whether it is read-only, which requests or destination operations it may perform, and how resulting evidence is retained.

### Local execution

The tooling must provide a local path that executes one ingestion plan through `Session` and emits an IncQL RFC 056 receipt. It must not require Python, Spark or another cluster runtime, an operational scheduler, or a hosted service.

Local execution may override bindings, state-store location, destination location, resource selection, sample or safety limits, and execution backend only where the plan declares those values as bindable or overridable. Overrides must appear in the binding snapshot and receipt.

Local development may redirect a destination to DuckDB, files, or another supported local target. The tool must validate that the replacement destination covers the same required data semantics or report the differences.

### Inspection

Inspection must support at least:

- ingestion plan and digest
- source and resource graph
- schema layers, diffs, and decisions
- normalization topology
- committed and proposed checkpoint state
- destination plan and commit guarantee
- run, phase, package, job, and receipt status
- failed and ambiguous jobs
- quality and policy evidence
- capability coverage
- payload-retention posture
- recovery and supersession chain

Inspection must be read-only. It must not repair state, retry jobs, or mutate destination data as a side effect.

### Maintenance and destructive operations

State reset, destination refresh, pending-package abandonment, staged-artifact cleanup, and recovery operations must first produce a deterministic change-plan artifact.

A change plan must identify affected resources, state revisions, destination tables or objects, staged artifacts, receipt relationships, expected next-run behavior, required capabilities, and irreversible effects.

Interactive execution must require confirmation for destructive operations. Non-interactive execution must require an explicit apply flag and should require the digest of the reviewed change plan when practical.

Maintenance must preserve immutable receipts. Cleanup may delete retained payload or staging artifacts according to policy, but it must append evidence of the deletion or expiration rather than rewrite prior receipts.

### CI and agent use

Commands must provide stable exit status categories and machine-readable diagnostics. A failed validation, unsupported required capability, unknown required coverage, schema decision requirement, or destructive-plan mismatch must be distinguishable in structured output.

Agents may generate declarations, candidate schemas, reconciliation proposals, and change plans. They must not accept schemas, reveal secrets, apply destructive maintenance, or bypass runtime validation solely because the proposal was machine-generated.

### Deployment boundary

IncQL tooling may export an immutable plan, binding requirements, package dependencies, and receipt schema for an operational layer. It must not define schedules, environment promotion, workflow dependencies, central alerting, or managed retention as part of this RFC.

An operational layer must consume the same plan and receipt contracts used locally. It must not require authors to replace the IncQL declaration with a second user-authored ingestion script.

## Design details

### Syntax

This RFC defines workflow operations and artifacts, not Incan grammar. The executable name and final command spelling remain open until the packaging boundary is settled.

### Semantics

The local lifecycle is command-and-checkpoint oriented: propose, inspect, validate, execute, and inspect evidence. Generation and agent assistance may accelerate proposals, but runtime validation remains authoritative for execution.

### Interaction with other IncQL surfaces

IncQL RFC 031 provides the precedent for structured local inspection artifacts. Ingestion inspection extends that principle to source, schema, state, destination, and receipt artifacts without redefining Prism plan inspection.

IncQL RFC 036 provides bundle versioning and required/optional/unsupported evidence distinctions.

IncQL RFC 037 plan diff may compare ingestion-plan references and affected relational work, while this RFC adds source, state, and destination change plans.

IncQL RFC 046 may supply imported contract artifacts during scaffolding, planning, and validation.

IncQL RFC 056 supplies the receipt inspected after execution.

### Compatibility / migration

Existing `incan build`, `incan test`, and package-level IncQL workflows remain valid. The ingestion tooling should integrate with the existing toolchain without changing ordinary compilation semantics.

The first implementation may expose typed APIs before all CLI commands exist, but it must not claim the complete workflow until equivalent local command surfaces and machine-readable artifacts are available.

## Alternatives considered

- **Only provide library APIs.** Rejected because scaffolding, inspection, state maintenance, CI, and recovery need a consistent tool-facing workflow.
- **Only provide a hosted UI.** Rejected because local, open, scriptable behavior is part of the native ingestion contract.
- **Make console text the interface.** Rejected because CI, IDEs, agents, and integrations need structured versioned artifacts.
- **Run a full extraction to discover schema.** Rejected because discovery and sampling must be bounded and separable from destination mutation.
- **Let generated schemas become active immediately.** Rejected because generation is proposal, not authority.
- **Put deployment commands in IncQL.** Rejected because deployment, schedules, promotion, and centralized monitoring are operational lifecycle concerns.

## Drawbacks

- A coherent CLI adds maintenance beyond the library surface.
- Machine-readable artifact compatibility constrains output evolution.
- Safe destructive-operation workflows require extra steps and confirmation handling.
- Local destination substitution may expose semantic differences that simple demos would otherwise ignore.
- Scaffolding merge behavior is difficult when generated and author-owned declarations evolve together.

## Implementation architecture

This section is non-normative. The tooling can be delivered as an Incan command extension, an IncQL executable, or another package-aware entry point over one shared typed API. Commands should write artifacts under a predictable target directory, use the same connector test transports as package conformance, and render human reports from JSON or another versioned structured representation.

## Layers affected

- **IncQL specification** must define the local ingestion lifecycle and artifact semantics.
- **IncQL library package** must expose APIs for scaffolding, discovery, sampling, planning, validation, execution, inspection, and maintenance planning.
- **Incan tooling** must provide or host the final command entry point and preserve structured diagnostics and package discovery.
- **Execution / interchange** must support read-only probes, local binding overrides, plan export, receipt emission, and safe maintenance boundaries.
- **Documentation** must teach the command-and-checkpoint workflow without implying that deployment requires a hosted service.

## Unresolved questions

- Should the commands live under an `incql` executable, an `incan incql` extension, or package-discovered tool commands?
- Which machine-readable artifact format is mandatory for the first release?
- What conservative sampling limits and redaction profile should interactive commands use by default?
- Should non-interactive destructive operations require the reviewed change-plan digest in every case?
- How should scaffold regeneration preserve author-owned edits without inventing a fragile generated-region format?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->
