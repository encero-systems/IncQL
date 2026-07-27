# IncQL RFC 051: Native ingestion program and ownership boundary

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 000 (core language model and layer boundaries)
  - IncQL RFC 001 (dataset carriers and boundedness)
  - IncQL RFC 004 (execution context and Session)
  - IncQL RFC 009 (session format handler registry)
  - IncQL RFC 011 (source discovery and parse-unit expansion)
  - IncQL RFC 027 (relational evidence program)
  - IncQL RFC 048 (cluster execution backend mode)
  - IncQL RFC 050 (add-on component registry)
  - IncQL RFC 052 (declarative sources, resources, and connector packages)
  - IncQL RFC 053 (schema observation, reconciliation, and normalization)
  - IncQL RFC 054 (incremental extraction, state, and checkpoints)
  - IncQL RFC 055 (destination loading, write dispositions, and commit semantics)
  - IncQL RFC 056 (ingestion runs, load packages, and receipts)
  - IncQL RFC 057 (local ingestion inspection and CLI lifecycle)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC establishes IncQL's native ingestion program and its ownership boundary. IncQL must let authors declare, inspect, and execute typed source-to-destination ingestion without requiring Python, Spark or another cluster runtime, an external ingestion service, or an operational pipeline framework. The program adds source and resource declarations, connector contracts, schema reconciliation, incremental state, destination commit semantics, and portable load receipts around the existing `Session` execution boundary. Higher operational layers may schedule, retry, deploy, backfill, and monitor the resulting ingestion plans, but they must not redefine their data semantics.

## Core model

1. A **connector** implements a versioned protocol contract for communicating with a source or destination system.
2. A **source** is a configured logical grouping of one or more extractable **resources**.
3. A **resource** describes one typed record stream or snapshot and the source-side rules needed to obtain it.
4. An **ingestion plan** combines selected resources, schema and normalization policy, incremental state policy, destination operations, and evidence requirements without containing resolved secrets.
5. An **ingestion run** executes one immutable plan snapshot through discover, extract, normalize, load, and checkpoint-commit boundaries.
6. A **load receipt** records what the runtime attempted and committed without making raw source payloads the default evidence format.
7. `Session` must be able to execute one ingestion run locally. Scheduling and multi-run operational lifecycle remain outside IncQL.

## Motivation

IncQL already owns typed read roots, schema-aware relational plans, session binding, writes, execution observations, adapter coverage, and local evidence. Its current file-oriented read surface is not enough for authors who need to pull records from APIs, databases, object stores, event systems, and other external sources. Requiring those authors to write and deploy a separate Python extraction program would split the type system, schema contract, state model, and evidence chain at the exact boundary where IncQL should be strongest.

The useful prior art from [dlt](https://dlthub.com/product/dlt) is not its Python host language. It is the workflow shape: sources contain selectable resources; extraction, normalization, and loading are distinct phases; schema and state survive between runs; destination writes have explicit dispositions; and every load has inspectable identity. IncQL can preserve that shape while improving the authority model: typed declarations rather than arbitrary script behavior, schema inference as evidence rather than silent truth, checkpoint advancement tied to destination commit, and receipts that compose with existing relational evidence.

The boundary also needs to be explicit. A standalone IncQL program should be capable of running ingestion locally. That does not make IncQL a scheduler, deployment manager, workflow engine, secret store, or organization-wide control plane. IncQL owns the meaning of one data movement operation; operational layers own when, where, and under which multi-run policy that operation executes.

## Goals

- Define the umbrella contract for native, non-Python IncQL ingestion.
- Establish stable terminology for connectors, sources, resources, ingestion plans, runs, load jobs, checkpoints, and receipts.
- Require a complete local path from source declaration through destination commit and receipt emission.
- Preserve typed relational planning and evidence across ingestion boundaries.
- Separate source configuration from environment-specific bindings and resolved credentials.
- Define the child RFC set required before the native ingestion program can be considered implemented.
- Keep operational scheduling, deployment, backfills, and monitoring composable above IncQL rather than embedded into its semantics.

## Non-Goals

- Defining pipeline, workflow, scheduling, trigger, retry-orchestration, or deployment syntax.
- Shipping every possible source and destination connector in the core IncQL package.
- Guaranteeing that all external systems provide transactional or exactly-once behavior.
- Making raw payload persistence mandatory for extraction or evidence.
- Defining an organization-wide secret manager, policy engine, catalog, approval service, or hosted control plane.
- Requiring dedicated source or resource language keywords before the library and artifact contracts are proven.
- Treating an operational pipeline run as the same identity or lifecycle as an IncQL ingestion run.

## Guide-level explanation (how authors think about it)

An author should be able to describe a source and run it with IncQL alone. The exact helper names are illustrative; the child RFCs own the stable surface.

```incan
from pub::incql import Session
from pub::incql.ingest import Merge, secret_ref
from pub::incql.sources import rest_source
from pub::incql.destinations import duckdb_destination
from models import Issue

github = rest_source(
    name="github",
    base_url="https://api.github.com/",
    credential=secret_ref("github.token"),
)

issues = github.resource[Issue](
    name="issues",
    path="repos/{owner}/{repo}/issues",
    cursor="updated_at",
)

plan = issues.load_into(
    duckdb_destination("target/issues.duckdb"),
    disposition=Merge(keys=["id"]),
)

session = Session.default()
receipt = session.run_ingestion(plan)?
println(receipt.status)
```

The source declaration contains no token value. A local binding resolves `github.token` when the session runs. The resource model `Issue` is the declared schema authority. Discovery may report additional source fields, but those fields do not silently alter `Issue` or destination tables. The cursor advances only after the destination reports a successful commit.

An operational layer may later wrap the same plan in a scheduled workload. It may choose a runner, provide production bindings, retry failed attempts, or backfill a date range. The plan's resource identity, schema rules, write disposition, checkpoint rules, and load receipt remain IncQL contracts.

## Reference-level explanation (precise rules)

### Program components

The native ingestion program consists of IncQL RFCs 052 through 057 unless this RFC is amended or superseded:

- IncQL RFC 052 defines declarative sources, resources, connector packages, and connector capability evidence.
- IncQL RFC 053 defines schema observation, reconciliation, evolution decisions, and deterministic normalization.
- IncQL RFC 054 defines incremental extraction, checkpoint state, replay, reset, and checkpoint commit.
- IncQL RFC 055 defines destination descriptors, write dispositions, load jobs, commit guarantees, and partial-failure behavior.
- IncQL RFC 056 defines ingestion-run identity, phase records, load packages, receipts, and evidence integration.
- IncQL RFC 057 defines local inspection, scaffolding, validation, sampling, execution, and maintenance workflows.

This umbrella RFC must not be marked Implemented while any required child RFC remains unresolved, unless the completion set is changed by an explicit design decision.

### Ownership boundary

IncQL must own:

- source and resource data semantics
- connector capability requirements and coverage
- declared, planned, observed, and normalized schema relationships
- source-side incremental cursor and checkpoint semantics
- destination write disposition and commit semantics
- one-run execution through `Session`
- local inspection artifacts and load receipts
- relational transforms referenced by an ingestion plan

IncQL must not own:

- schedules, external triggers, or dependency sensors
- cross-step DAG orchestration
- deployment packaging or environment promotion
- organization-wide secret storage or identity policy
- operator approval queues or managed monitoring retention
- retries whose scope is an entire operational step, pipeline, or workflow

Request-level retry policy may be part of a connector contract when it is required to communicate safely with a source. Load-job retry and resume may be part of destination commit semantics. Those narrow retries must remain distinguishable from operational retries of an entire ingestion run or workflow step.

### Phase model

An ingestion run must expose the following logical boundaries even when an implementation fuses them physically:

1. **Discover** resolves connector metadata, selected resources, binding requirements, and candidate schemas without committing destination data.
2. **Extract** obtains bounded batches or unbounded events according to the resource contract and produces a proposed checkpoint when incremental state applies.
3. **Normalize** reconciles observed data with declared schema and deterministically maps nested or variant values according to IncQL RFC 053.
4. **Load** applies destination schema decisions and write dispositions through one or more load jobs according to IncQL RFC 055.
5. **Commit checkpoint** advances canonical resource state only after the destination outcome satisfies the checkpoint policy from IncQL RFC 054.

An implementation may stream batches from extraction through normalization and loading without persisting an intermediate raw package. Physical fusion must not remove phase status, diagnostics, or receipt evidence required by IncQL RFC 056.

### Plan and execution boundary

An ingestion plan must be immutable and inspectable before execution. It must identify connector and resource versions, declared schema references, state policy, destination intent, write disposition, required capabilities, and evidence policy. It must not contain resolved credentials or secret values.

An ingestion plan is not itself a Prism relational plan. It may contain or reference Prism-managed relational work for source-side or pre-load transformations. The ingestion plan must preserve stable references to that relational plan and its evidence rather than copying backend-specific SQL or physical plans.

`Session` must provide a local execution path for supported connectors and destinations. A conforming implementation must not require an operational scheduler, hosted service, Python runtime, Spark or another cluster runtime, or separate extraction script to run that path.

Connector implementations may be authored in Incan, implemented through native runtime code, or supplied by compatible packages. Their implementation language must not change the public connector semantics or require authors to deploy a second user-authored program.

### Secret and payload boundary

Source and destination declarations must carry opaque binding references rather than resolved secrets. Inspection, plans, receipts, diagnostics, and ordinary debug output must preserve that separation.

Raw source payloads must not be embedded in inspection artifacts or receipts by default. If an ingestion policy permits staging or retaining payloads, the plan and receipt must record the retention mode, scope, location reference, digest when available, and deletion or expiration policy without exposing secret-bearing payload content.

### Completion contract

The native ingestion program is complete only when a standalone IncQL program can:

- declare at least one non-file source with multiple resources
- discover and select resources
- establish or admit a typed schema
- execute an incremental load with durable checkpoint state
- write through at least append and merge dispositions
- recover safely from an interrupted load according to an explicit commit guarantee
- inspect the plan, schema diff, state, and resulting receipt locally
- run without Python, Spark or another cluster runtime, or an operational pipeline framework

The same ingestion plan must remain consumable by higher operational layers without changing its IncQL-defined semantics.

## Design details

### Syntax

This RFC introduces no new language grammar. The first implementation should prove the model through typed library APIs and artifacts. Dedicated `source` or `resource` declarations require a separate language-surface decision only if library APIs cannot provide the intended author experience or static guarantees.

### Semantics

Native ingestion extends IncQL's data-logic boundary to include the typed acquisition and loading semantics needed to establish relational inputs and durable outputs. It does not transfer operational scheduling or deployment into IncQL.

The term `pipeline` is intentionally not the normative IncQL name for one ingestion plan. Pipeline is reserved for higher-level composition of steps and workloads; using distinct terminology prevents source/resource extraction state from being confused with cross-step operational state.

### Interaction with other IncQL surfaces

IncQL RFC 000 must be amended so that "typed data logic" includes native source-to-destination ingestion semantics while preserving its prohibition on becoming an orchestration framework.

IncQL RFC 001 remains the carrier boundary. Incremental bounded extraction produces bounded work for one run; only genuinely unbounded sources produce `DataStream[T]`.

IncQL RFC 004 remains the `Session` execution boundary and must be extended from file registration and relational execution to one-run ingestion execution.

IncQL RFCs 009 through 011 remain the format and file-discovery layers beneath broader connector semantics.

IncQL RFCs 027 through 047 remain the evidence vocabulary. Ingestion RFCs must extend those target and artifact families rather than creating an unrelated observability model.

IncQL RFC 048 remains the cluster backend boundary. Cluster placement may change execution mechanics but must not redefine source, schema, state, load, or receipt semantics.

### Compatibility / migration

Existing `Session.read_csv`, `read_parquet`, `read_arrow`, and typed sink APIs remain valid. They should become convenience paths over the connector, format, discovery, and destination contracts where those contracts apply.

Existing operational integrations may continue to register logical tables directly. Adoption of native ingestion is additive until an existing read or write surface claims behavior that conflicts with the accepted child RFCs.

## Alternatives considered

- **Require a separate Python ingestion tool before IncQL.** Rejected because it splits schema authority, state, evidence, packaging, and deployment across two user-authored runtimes.
- **Put all ingestion behavior in an operational pipeline layer.** Rejected because standalone IncQL would be unable to establish its own typed inputs and durable outputs, and operational adoption would become mandatory for basic data work.
- **Put scheduling and workflows into IncQL as well.** Rejected because one-run data semantics and multi-run operational lifecycle have different ownership, failure modes, and compatibility contracts.
- **Treat every connector as an execution backend.** Rejected because a source system, destination system, and query execution engine are distinct roles even when one product can perform more than one of them.
- **Specify one giant ingestion RFC.** Rejected because source contracts, schema evolution, state, destination commits, receipts, and tooling each create independent compatibility obligations.

## Drawbacks

- IncQL's public surface and runtime responsibilities become materially larger.
- Connector and destination conformance require substantial test matrices.
- The boundary between request retry, load retry, and operational retry requires disciplined terminology.
- A typed authority model is less permissive than arbitrary script mutation and therefore needs explicit escape hatches through connector packages and variant data.
- The complete program spans several RFCs before the end-to-end capability is available.

## Implementation architecture

This section is non-normative. A practical implementation can represent connectors as versioned package components that emit Arrow-compatible batches into a `Session`-owned ingestion executor. The executor can stream batches through deterministic normalization into destination adapters, keep checkpoint proposals separate from committed state, and emit phase observations into one portable receipt. Built-in generic connectors should prioritize REST/OpenAPI, SQL databases, and filesystems before adding service-specific packages.

## Layers affected

- **IncQL specification** must define native ingestion as one coordinated program and preserve its boundary from orchestration.
- **IncQL library package** must expose typed source, resource, plan, state, destination, run, and receipt surfaces.
- **Incan compiler and standard library** must support the typed package, async I/O, HTTP, secret-value, and iterator boundaries used by connector implementations; new grammar is not required by this RFC.
- **Execution / interchange** must preserve connector capabilities, logical read identities, schema decisions, destination outcomes, and receipt evidence across local and cluster execution.
- **Documentation and tooling** must present a standalone non-Python ingestion path and distinguish it from operational deployment.

## Unresolved questions

- Should the first stable author surface use builders, decorators, declarative models, or another library-level construction pattern?
- What is the exact type relationship between a configured resource and the `LazyFrame[T]` or `DataStream[T]` produced after session binding?
- Which connector and destination combinations constitute the minimum conformance suite for moving this umbrella RFC to Planned?
- Should the first implementation expose a dedicated `IngestionPlan` value publicly, or initially return a narrower executable plan interface?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->
