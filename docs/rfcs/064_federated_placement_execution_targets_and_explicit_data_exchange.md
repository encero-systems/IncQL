# IncQL RFC 064: Federated placement, execution targets, and explicit data exchange

- **Status:** Draft
- **Created:** 2026-07-14
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 002 (Apache Substrait integration)
  - IncQL RFC 004 (execution context)
  - IncQL RFC 007 (Prism logical planning and optimization engine)
  - IncQL RFC 008 (optimizer boundary, statistics, cost-based optimization, and adaptive execution)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 048 (cluster execution backend mode)
  - IncQL RFC 052 (declarative sources, resources, and connector packages)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines federated placement for IncQL relational plans. Prism must choose eligible execution-target fragments and explicit data exchanges from source locality, adapter capabilities, statistics, and movement policy supplied through a Session. The default policy is to preserve semantics and policy, avoid data movement, minimise transferred bytes when movement is required, and prefer computation where the relevant data already exists. Backends realise the selected fragments and report actual movement; they must not silently pull remote data into a local engine or upload local data to a remote engine as a fallback.

## Core model

1. An **execution target** is a bound engine or service that can execute declared relational fragments under one semantic profile.
2. A **source binding** identifies where one relation can be read and may advertise one or more eligible execution targets; it is not itself an execution target.
3. A **planning context** is the session-supplied, redacted set of target capabilities, locality facts, statistics, exchange options, and movement authority available for one planning attempt.
4. A **placement plan** assigns every executable relational fragment to one eligible target and introduces an explicit exchange whenever a fragment consumes data produced elsewhere.
5. An **exchange** moves a bounded relation or stream between two targets through a declared representation, direction, authorization basis, and estimated size when known.
6. A **placement policy** constrains permitted targets, permitted exchanges, required semantic guarantees, and the default optimisation objectives.
7. An **execution observation** records the selected placement, realised fragments, completed exchanges, and any permitted runtime deviation without mutating authored Prism history.

## Motivation

IncQL already separates typed relational meaning, logical planning, and execution. That separation is insufficient once a plan can read from a database, warehouse, lakehouse, cluster, or local files while more than one of those systems can perform useful computation. A connector that only retrieves rows into the default local engine wastes source-local indexes, statistics, storage layout, and compute capacity. A backend that silently copies data to make a plan work creates avoidable cost, latency, governance risk, and surprising data egress.

The problem is not solved by treating every source as a backend, or every backend as a source. PostgreSQL may be both a relation source and an eligible target for a compatible fragment. An object store may be a source location while a cluster is the only eligible compute target. A remote target may accept filters and projections but not a particular IncQL function or join. IncQL needs one explicit contract for making those distinctions and explaining the result.

## Goals

- Define execution targets, source locality, placement plans, and exchanges as distinct concepts.
- Make Prism responsible for selecting among eligible fragment-placement and exchange alternatives.
- Require the default policy to optimise for no data movement before cost or latency preferences.
- Require every cross-target movement to be explicit, policy-authorized, and observable.
- Preserve IncQL semantics across target-specific lowering through capability and semantic-profile coverage.
- Support one-target plans, remote database computation, cluster execution, and mixed-target plans through one Session boundary.
- Keep credentials, endpoint secrets, and backend-specific physical details out of Prism and portable Substrait plans.

## Non-Goals

- Defining one SQL dialect, remote-engine protocol, driver, or connector implementation.
- Mandating distributed execution, a cluster scheduler, or a managed control plane.
- Requiring cost-based optimisation, complete statistics, or automatic federation in the first implementation.
- Making physical partitioning, worker placement, temporary-table names, or transfer transport internals part of IncQL authoring semantics.
- Allowing a target to reinterpret unsupported IncQL semantics as dialect-specific SQL behavior.
- Defining ingestion pagination, checkpoints, destination commit semantics, or workflow orchestration.

## Guide-level explanation (how authors think about it)

Authors write one typed IncQL relation. They select a session and bind sources as usual. They do not annotate ordinary filters, joins, or aggregates with an engine name merely to obtain sensible placement.

When a complete compatible fragment can run in the system that already stores its inputs, Prism keeps it there. For example, a filter, projection, grouping, and aggregate over PostgreSQL relations should remain a PostgreSQL fragment when the selected target profile covers those operations. Only the compact aggregate result should cross into another target when a later operation genuinely requires it.

When a plan combines PostgreSQL data with a local file, Prism may choose a PostgreSQL fragment, a local fragment, and one Arrow or other approved exchange between them. An inspection or execution observation must make that boundary visible. If policy forbids the transfer, or if no eligible fragment preserves the required semantics, planning fails with a typed placement diagnostic instead of quietly downloading the database table.

Authors and tools may request a stricter placement policy, such as requiring one selected target, forbidding egress from a region, or allowing only explicitly named exchanges. Such policy narrows the eligible plans; it does not change the meaning of the IncQL relation.

## Reference-level explanation (precise rules)

### Execution targets and source bindings

An execution target must have a stable target identity, semantic profile, adapter identity and version when available, capability coverage evidence, locality identity, and redacted binding reference. A target may be a local engine, cluster runner, database, warehouse, or another service capable of executing relational fragments.

A source binding must identify the relation it can resolve and the locality where that relation resides. A source binding may advertise eligible targets, but it must not imply that every target can execute every operation over that relation. Connector and adapter coverage determine eligibility for each candidate fragment.

### Planning context and ownership

The Session must construct a planning context from resolved bindings, target capability evidence, semantic profiles, available source statistics, exchange options, and placement policy. The planning context must not expose credentials or other sensitive binding values to Prism artifacts, Substrait plans, ordinary inspection output, or execution observations.

Prism must own selection among semantically equivalent eligible placement plans. Prism may use inferred logical facts, Session-supplied statistics, target capability evidence, locality facts, and exchange estimates. Prism must preserve provenance from selected fragments and exchanges back to the authored logical plan.

The Session and adapters must own target discovery, credential resolution, physical compilation, submission, transfer execution, runtime statistics, and execution lifecycle. They must not substitute an unselected target or exchange merely because it is convenient to execute.

### Placement policy

Unless a stricter author, session, or environment policy applies, Prism must rank eligible placement plans in this order:

1. Preserve required IncQL semantics, semantic-profile coverage, security, residency, and explicit movement constraints.
2. Prefer plans with no cross-target exchange.
3. Among plans that require exchange, minimise the estimated transferred bytes and number of exchanges.
4. Prefer fragments colocated with their dominant inputs.
5. Use estimated execution cost, latency, resource pressure, and other target-specific factors only as tie breakers after the preceding objectives.

Unknown statistics or unknown capability coverage must not justify an implicit movement fallback. A placement policy may permit a conservative explicit exchange when its authority and upper bounds are known; otherwise planning must reject the candidate or require explicit approval.

### Fragments and exchanges

A selected fragment must contain only operations that its target covers under the selected semantic profile and binding. Partial coverage must constrain the fragment shape or reject it. A target-specific compiler may lower a selected fragment into SQL, Substrait, a service request, or another execution representation, but that representation must preserve the IncQL result contract.

Every cross-target edge must be represented by an exchange. An exchange must record source target, destination target, relation schema, transfer representation, direction, authorization basis, and estimated byte count when available. It must distinguish streaming from bounded transfer where relevant.

An exchange must not occur unless it is selected by Prism and permitted by placement policy. Materialising a temporary relation at a target is an exchange and requires the same authority and observation. A target must not retrieve full source data as a hidden implementation detail when an unsupported fragment could instead produce a placement diagnostic.

### Failure, fallback, and adaptive execution

If no eligible placement plan satisfies required semantics and movement policy, the Session must fail before execution with a diagnostic that identifies the blocking fragment, capability, target, or prohibited exchange.

A policy may allow explicit fallback classes, including a named local target or a named exchange. Such fallback must be visible in placement explain output before execution and must remain subject to capability coverage.

Runtime adaptation may change physical strategy inside a selected target. It may not add a new execution target, introduce a new exchange, or widen an exchange outside the approved placement policy. When a permitted adaptive re-plan changes selected placement, the resulting observation must identify the deviation and its reason.

### Explainability and observations

Planning inspection must expose the candidate targets considered, rejected candidates and reasons, selected fragments, selected exchanges, applicable policy, and estimated movement when available. Execution observations must expose realised targets, completed exchanges, transferred-byte counts when available, and permitted deviations. These artifacts must remain redacted by default.

### Substrait and compatibility

Substrait remains the normative logical interchange for portable IncQL relational meaning. Placement plans and target-specific physical representations are execution artifacts, not new authored relational semantics. Portable Substrait plans must not embed credentials, endpoint secrets, temporary physical names, or a claim that one target is universally required.

Existing single-target sessions remain valid. A plan with one selected target and no exchanges is a federated placement plan with one fragment. The DataFusion reference backend remains the default target until other targets are implemented and covered.

## Design details

### Syntax

This RFC introduces no required query syntax. Placement policy and explain surfaces may initially use typed Session and inspection APIs. Ordinary relational expressions must remain backend-neutral.

### Semantics

Placement is execution planning, not authored relational meaning. Changing a permitted target or exchange may change latency, cost, and observations, but it must not change schema, values, null behavior, ordering guarantees, or other IncQL semantics.

### Interaction with other IncQL surfaces

RFC 004 remains the owner of the portable Session entry point. RFC 007 remains the owner of immutable authored Prism state and logical rewrites. RFC 008 governs the optimizer boundary: Prism selects placement alternatives; Session supplies facts and realises them. RFC 033 governs capability evidence, RFC 040 governs semantic-profile evidence, RFC 048 applies this model to cluster targets, and RFC 052 supplies source and connector facts.

### Compatibility / migration

This RFC is additive. Existing source registrations and single-target DataFusion execution retain their behavior. Multi-target execution may be introduced only after required coverage, placement, exchange, and observation artifacts are available. Adapters that cannot report sufficient facts remain eligible only for single-target execution or explicit author-approved fallback.

## Alternatives considered

- **Let each connector decide pushdown independently.** Rejected because connectors cannot reason about joins, competing target choices, or cross-source movement globally.
- **Make the Session choose all placement.** Rejected because global fragment selection must remain attributable to the same Prism planning model that owns semantic alternatives and provenance.
- **Always execute in the default local engine.** Rejected because it discards source-local computation and can create needless egress.
- **Always execute in the remote source system.** Rejected because mixed-source plans, incomplete target coverage, and explicit policy constraints require other choices.
- **Treat data transfer as an adapter detail.** Rejected because movement has material cost, governance, and correctness consequences that users and tools must be able to inspect.

## Drawbacks

- Placement expands the planning model and requires more connector and adapter metadata.
- Statistics can be stale, unavailable, or expensive to obtain, so early plans must remain conservative.
- Exact cross-engine semantics and type mapping require disciplined coverage and conformance work.
- Explicit exchanges may make plans more visible and more verbose than opaque local fallback.

## Implementation architecture

Non-normative: implementations should represent the selected placement as a separate execution artifact over the Prism logical plan. The Session can gather planning facts and delegate physical compilation to each target adapter, while a shared exchange layer transports approved typed relations. This separation keeps the logical plan portable and lets observation tooling compare planned with realised movement.

## Layers affected

- **IncQL specification** must distinguish logical relations, source bindings, execution targets, placement plans, and exchanges.
- **IncQL library package** must expose redacted target and source capability facts, placement inspection, policy configuration, and typed placement diagnostics without changing ordinary relational authoring APIs.
- **Execution / interchange** must compile only selected compatible fragments, execute only approved exchanges, preserve semantic-profile coverage, and record realised placement facts.
- **Documentation** must explain that data movement is explicit, policy-bound, and observable rather than an implicit fallback.

## Unresolved questions

- Which placement-policy controls must be portable Session options, and which should remain environment-specific binding policy?
- What minimum statistics and exchange estimates are required before automatic multi-target placement is enabled?
- Which transfer representations are required for the first bounded and streaming exchange profiles?
- How should an author or tool approve a bounded but otherwise policy-prohibited exchange without exposing backend-specific details?

<!-- Rename this section to "Design Decisions" once all questions have been resolved. An RFC cannot move from Draft to Planned until no unresolved questions remain. -->
