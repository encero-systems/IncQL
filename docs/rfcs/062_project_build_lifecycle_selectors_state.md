# IncQL RFC 062: Project build lifecycle, selectors, state, artifacts, and delegated execution

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 004 (execution context and Session)
  - IncQL RFC 027 (relational evidence program)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 030 (Prism lineage graph)
  - IncQL RFC 031 (local inspection APIs and artifacts)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 034 (quality assertions and observations)
  - IncQL RFC 035 (governed attributes and policy checkpoints)
  - IncQL RFC 036 (governed plan bundle)
  - IncQL RFC 037 (plan diff and blast-radius inputs)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 043 (canonical equality and digest profiles)
  - IncQL RFC 047 (semantic evidence graph and agent query surface)
  - IncQL RFC 057 (local ingestion inspection and CLI lifecycle)
  - IncQL RFC 058 (data projects, named relational assets, and the asset graph)
  - IncQL RFC 059 (materialization intent and applied asset lifecycle)
  - IncQL RFC 060 (incremental transformation and temporal history semantics)
  - IncQL RFC 061 (asset interfaces, contracts, access, ownership, versions, and deprecation)
  - IncQL RFC 063 (typed relational fixtures and expected-result testing)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines the reproducible build lifecycle for an IncQL data project. Project compilation produces a complete project manifest; structured selectors resolve to an immutable build set; Session validates bindings and capabilities, runs pre-materialization fixture tests, executes selected assets in dependency order, evaluates post-materialization evidence, commits applied state, and emits an append-only build receipt. Logical project state, applied asset state, and invocation results must remain separate. State comparison and deferred reuse must operate on explicit semantic and applied artifacts, with mixed-environment provenance visible. A higher operational layer may schedule or place build nodes from the immutable build set, but it must not redefine IncQL asset dependencies, materialization semantics, admissible transitions, or receipts.

## Core model

1. A **project manifest** is the complete immutable logical description of one resolved IncQL data project from IncQL RFC 058.
2. A **selector** is a structured query over project resources, graph relationships, interface metadata, prior state, or prior results.
3. A **build set** is the immutable, fully resolved resource selection plus dependency closure, exclusions, execution requirements, and selection evidence for one build intent.
4. A **build plan** expands one build set into ordered IncQL lifecycle nodes without adding new semantic asset dependencies.
5. A **build run** is one top-level attempt to execute one build plan under one binding, component, runner, and state snapshot.
6. A **build node attempt** records one asset, fixture test, assertion, materialization, verification, or state transition attempt.
7. A **project state snapshot** identifies the logical manifest, available applied assets, prior results, and environment provenance considered by selection and reuse.
8. A **deferred binding** explicitly resolves an unbuilt dependency to one prior applied asset record.
9. A **build receipt** records selection, execution, skips, deferred reuse, gates, effects, state transitions, and evidence references without copying or rewriting upstream receipts.

## Motivation

A project graph is useful only if authors and tools can build a deliberate subset, understand what will run, distinguish unchanged resources from reusable physical results, and explain why downstream work ran or skipped. A generic `run everything` operation is too expensive for large projects and too weak for CI, local iteration, impact analysis, recovery, and operational delegation.

dbt provides strong workflow prior art: graph [selectors][dbt-selection], [state-based selection][dbt-state], `dbt ls` previews, one [`build` command][dbt-build] that orders models and tests, [artifacts][dbt-artifacts] that separate manifests from run results, slim CI through state comparison, and [deferral][dbt-defer] to previously applied relations. Those features make a project operationally usable. Their limitations are equally instructive: logical and applied state can be drawn from different environments, deferred tests can cross environments, retries rely on prior result files and idempotence assumptions, and command compilation may still execute live warehouse queries through template escape hatches.

IncQL should preserve the command-and-checkpoint workflow while using stronger boundaries. Static project compilation must be effect-free. Structured selection must produce an artifact, not only a shell expression. Reuse must be based on logical, interface, binding, profile, commit, and verification evidence. A failed node must not be considered reusable merely because it emitted a success-shaped log line. A mixed-environment build must be visible before execution and subject to policy.

The lifecycle must remain independently useful. Session must be able to build locally without a scheduler. At the same time, an operational layer needs a safe way to place, retry, and observe project work without reimplementing the IncQL graph or translating each asset into a second user-authored pipeline.

## Goals

- Define project manifest, selector, build set, build plan, run, node attempt, state snapshot, deferred binding, and build receipt artifacts.
- Define structured resource selection, graph traversal, set operations, exclusions, and preview.
- Define pure project compilation separately from explicit live binding probes and destination mutation.
- Define preflight, fixture-test, materialization, quality, verification, commit, and receipt phases.
- Define deterministic dependency, skip, block, and gate behavior.
- Define logical state comparison using semantic plans, interfaces, lineage, materialization, and evidence changes.
- Define applied-state reuse and deferral with explicit environment and binding provenance.
- Define safe local resume and operational delegation from immutable build sets.
- Preserve upstream IncQL ingestion, materialization, refresh, quality, policy, and verification receipts by reference.
- Provide stable machine-readable CLI and API parity for local, CI, IDE, agent, and operational consumers.

## Non-Goals

- Defining schedules, calendars, external triggers, sensors, deployment promotion, autoscaling, or managed retention.
- Defining operational step retry, lease, placement, timeout, or cancellation policy.
- Defining asset, materialization, incremental, interface, or fixture-test semantics owned by IncQL RFCs 058 through 061 and 063.
- Treating source-code version control as sufficient applied-state evidence.
- Guaranteeing safe reuse from a successful status without commit, interface, binding, and profile evidence.
- Silently mixing development, production, or historical bindings.
- Executing arbitrary SQL or network calls during static project compilation, selection preview, or documentation generation.
- Defining dbt project or manifest migration.
- Replacing organization-wide lineage, catalog, policy, or observability systems.

## Guide-level explanation (how authors think about it)

The exact executable spelling remains subject to packaging, but the command and artifact lifecycle is normative.

Compile and inspect the complete project without contacting data systems:

```text
incql project compile --output target/incql/project.manifest.json
incql project list --select "group:commerce"
```

The second command previews the resources selected from the manifest. It does not execute models or mutate destinations.

Select one asset and its dependencies:

```text
incql build plan \
  --select "asset:commerce.customer_summary+upstream" \
  --binding local \
  --output target/incql/customer_summary.build.json
```

The build set records the selected asset, required upstream closure, fixture tests, assertions, interface versions, materialization intents, binding requirements, and reasons each resource was included.

Run locally:

```text
incql build run target/incql/customer_summary.build.json
incql build inspect --latest commerce.customer_summary
```

Fixture tests run before their target is materialized. Post-build assertions run after a committed or staged output according to their declared phase. A failing required test or gate blocks affected downstream assets and records the reason.

For CI, compare with a prior project and applied-state snapshot:

```text
incql project diff \
  --current target/incql/project.manifest.json \
  --state artifacts/main/

incql build plan \
  --select "state:modified+downstream" \
  --state artifacts/main/ \
  --defer-state artifacts/production/
```

Logical comparison and physical reuse are separate inputs. The resulting build set identifies which assets changed and which unselected dependencies would be reused from production. If that creates a mixed environment, the plan says so before execution.

The same build set may be handed to an operational layer:

```text
incql build export target/incql/customer_summary.build.json \
  --format workload-bundle
```

The operational layer may choose runners and attempts. It consumes IncQL node contracts and returns evidence; it does not rewrite the asset graph or replace the IncQL materialization and state APIs.

## Reference-level explanation (precise rules)

### Artifact separation

The lifecycle must keep these artifact families separate:

| Artifact | Authority and scope |
| --- | --- |
| Project manifest | Complete logical project declarations and graph for one resolved source and package snapshot |
| Build set | Immutable resolved selection and dependency closure for one build intent |
| Build plan | IncQL lifecycle expansion under one binding and capability snapshot |
| Applied asset record | One physical realization and commit outcome from IncQL RFC 059 |
| Project state snapshot | References to prior logical, applied, and result artifacts considered by a build |
| Build receipt | One invocation's attempts, decisions, outcomes, and evidence references |

A run result must not replace the project manifest. An applied asset record must not replace the logical asset. A project state snapshot must not copy mutable physical state into logical identity.

### Static project compilation

Project compilation must:

- discover resources according to IncQL RFC 058
- resolve package, asset, version, access, and generated-manifest references
- typecheck relational asset interfaces
- compile or reference Prism plans
- construct the asset graph
- attach materialization, test, assertion, contract, policy, and product-topology references
- emit diagnostics and unsupported evidence
- produce a deterministic project manifest digest

Static compilation must not:

- resolve secret values
- open network, source, destination, or catalog connections
- execute relational queries
- run DDL or DML
- initialize external addon components
- call lifecycle hooks with effects

An operation that needs live metadata must be a separate explicit validation or planning probe and must emit observation evidence.

### Selector model

Selectors must be representable as typed structured values. CLI syntax is a projection over that model.

The initial selector methods must include:

- canonical asset or resource identity
- project or package namespace
- resource kind
- asset group
- tag or typed metadata value
- access level
- asset version
- materialization class
- source location
- quality, fixture-test, or contract attachment
- prior result status
- logical state-change classification
- applied-state availability or staleness

Selectors must support:

- union
- intersection
- exclusion
- direct upstream parents
- transitive upstream closure
- direct downstream children
- transitive downstream closure
- configurable traversal depth

Selection must operate on a specific project manifest and optional state snapshots. The manifest and state digests must appear in the selection result.

### Selection preview

Selection preview must be read-only and must return a structured list containing:

- selected resource ids and versions
- inclusion reason
- graph path or selector clause responsible
- direct and transitive dependency status
- excluded resources and exclusion reason
- fixture tests and assertions added indirectly
- required but unavailable dependencies
- state and result evidence used
- diagnostics and ambiguity

Human CLI output must be rendered from this structured result.

### Build-set resolution

A build set must freeze:

- project manifest id and digest
- selector syntax and normalized structured selector
- explicitly selected resources
- dependency closure
- selected fixture tests and assertions
- exclusions and admitted missing resources
- asset versions and interfaces
- materialization intents
- required external relations and ingestion outputs
- required binding, component, runtime, destination, and state capabilities
- logical state and prior-result inputs
- deferred-binding candidates
- required gate and evidence policies
- selection diagnostics

Changing any frozen semantic input must create a new build set and digest.

A build set must not contain resolved secret values or live handles.

### Dependency closure

By default, selecting a persisted relational asset for build must include every non-reused upstream dependency required to produce it. An author may explicitly exclude an upstream dependency only when:

- a valid deferred binding resolves it to an applied asset
- the target plan treats it as an external relation with a valid binding
- the build is validation-only and execution will not require the dependency
- an explicit incomplete-build policy admits it

The build set must report incomplete or unresolved closure. Execution must not discover and silently add missing dependencies.

### Indirect tests and assertions

Selecting an asset must include fixture tests and quality assertions according to declared attachment and selector policy.

The default build policy must:

- run required IncQL RFC 063 fixture tests before materializing their target
- run required staged-output checks before publication when the destination supports staging
- run required post-commit observations after publication
- evaluate operational continuation only from typed evidence and declared gate policy

A test or assertion with several parent assets must identify the dependency scope it gates. It must not block unrelated descendants merely because it has multiple independent parents.

### Build plan and phases

After binding and capability validation, one build set must produce an immutable build plan. The plan must expose these logical phases when applicable:

1. validate project manifest and build-set compatibility
2. resolve binding, component, runtime, destination, and state snapshots
3. evaluate capability and policy preflight
4. run fixture tests and static verification
5. execute logical assets in dependency order
6. stage and verify materializations
7. publish or commit applied assets
8. run post-materialization quality and verification observations
9. commit incremental or project state transitions
10. emit final build receipt

Physical execution may overlap independent nodes and fuse implementation phases, but it must preserve dependency, gate, effect, and receipt semantics.

### Build-node model

A build plan may contain node kinds for:

- fixture test
- ingestion asset invocation or admitted prior receipt
- relational asset execution
- materialization planning
- materialization attempt
- quality assertion
- verification
- policy checkpoint
- deferred applied-asset binding
- refresh-state commit
- receipt finalization

Build nodes are execution expansion of project resources. They must reference the originating project resource or evidence target and must not create new project asset dependencies.

### Ordering and concurrency

A build node may run only after all required predecessor nodes reach an admissible outcome.

Independent nodes may execute concurrently when:

- their bindings and destination effects do not conflict
- their state transitions have independent scopes or safe concurrency controls
- their declared resource requirements permit concurrency
- deterministic evidence association is preserved

Concurrency changes timing and placement, not graph meaning.

### Gate, block, and skip semantics

Node outcome must distinguish at least:

- `succeeded`
- `failed`
- `warning`
- `blocked_by_dependency`
- `blocked_by_gate`
- `skipped_not_selected`
- `skipped_deferred`
- `reused_applied_asset`
- `cancelled`
- `effect_unknown`
- `unsupported`

A downstream node must be blocked when a required predecessor fails, has an unknown required effect, or produces evidence rejected by a required gate.

A warning may permit continuation only when the gate policy explicitly admits it.

Skip and reuse statuses must identify the exact dependency, gate, selector, or applied asset responsible. They must not be generic success.

### Logical state comparison

Logical state comparison must use project manifests and IncQL RFC 037 semantic diff evidence. It must compare at least:

- resource addition, removal, and identity
- asset implementation and Prism plan
- output interface and field identity
- lineage and source dependencies
- materialization intent
- incremental or history policy
- fixture tests and quality assertions
- access, version, and deprecation
- semantic profile and adapter requirements
- package and component requirements

State selectors must preserve per-dimension change classification. A source-text change with no semantic change may be reported separately from a semantic plan change.

`state:modified` must never mean only `file bytes changed` in the canonical model.

### Applied state and reuse

An applied asset may be reused only when the build policy establishes compatibility across:

- logical asset id and resolved version
- project and Prism plan digests
- asset interface and schema
- materialization intent and physical class
- binding and destination scope
- semantic and equality profiles
- upstream input applied records and ingestion receipts
- component versions and capability coverage
- commit, visibility, quality, policy, and verification evidence
- staleness or freshness requirements

If one requirement is unknown, reuse must be unknown or rejected according to policy. Prior success status alone is insufficient.

Reuse must produce a build-node record that references the applied asset and explains the decision.

### Deferred bindings

A deferred binding resolves one selected or unselected logical dependency to one prior committed applied asset record.

The binding must record:

- logical dependency and version
- applied asset record and physical object reference
- source environment or binding profile
- current build environment
- compatibility and freshness evidence
- interface and semantic-profile comparison
- reason for deferral
- mixed-environment classification
- gate or waiver evidence

Deferral must not apply to an inline asset with no independently applied record.

The build set must expose whether all inputs come from one environment, several known environments, or unknown provenance. Tests spanning assets from different environments must be marked as mixed-context before execution.

An implementation must not silently prefer an existing local physical object over the explicitly selected deferred state or vice versa. Precedence must be declared and recorded.

### Project state snapshot

A project state snapshot must reference, rather than copy, the canonical artifacts used for:

- logical comparison
- prior result selection
- applied-asset availability
- deferred bindings
- incremental refresh state
- ingestion checkpoint and receipt context

Logical comparison state and deferred applied state may come from different snapshots. When they do, the build set must identify both and explain their roles.

### Local resume

Local resume must create a new build-run identity while referencing the interrupted run and its node attempts.

A node may be reused during resume only when its prior outcome is committed, visible, compatible with the current build plan, and safe under its idempotency and side-effect contract.

A failed, partial, cancelled, or unknown-effect attempt must remain in evidence. Resume must not rewrite it as though it never happened.

If no durable node outcome exists, resume must restart the required work or fail with a reconciliation requirement.

### Delegated execution

IncQL must support exporting one build plan or build-set workload bundle for a higher operational layer.

The export must include:

- immutable build and project identities
- node ids, kinds, dependencies, and admissible predecessor outcomes
- typed inputs, outputs, bindings, and capability requirements
- effect, idempotency, timeout-admissibility, and cancellation boundaries where known
- required IncQL runtime and component versions
- evidence and receipt schemas
- state-transition APIs and authority
- redaction requirements

The operational layer may choose placement, runners, concurrency within declared constraints, attempt timing, operational retry policy, and monitoring projection.

The operational layer must not:

- add or remove semantic asset dependencies
- change selected asset versions
- reinterpret materialization, refresh, schema, quality, or checkpoint semantics
- mark an IncQL state transition committed without calling the authoritative IncQL operation
- copy and rewrite upstream receipts as its own evidence
- treat operational success as proof of an IncQL data guarantee

IncQL must be able to validate returned node evidence and assemble the same build receipt shape used by local execution.

### Build receipt

A build receipt must contain or reference:

- build run, build plan, build set, project manifest, and state snapshot identities
- normalized selector and selection reasons
- binding, component, runner, destination, and semantic-profile snapshots
- node attempts and outcomes
- fixture-test, quality, policy, contract, and verification evidence
- ingestion, materialization, applied-asset, refresh, and checkpoint receipts
- deferred and reused applied assets
- skip, block, warning, waiver, cancellation, and unknown-effect reasons
- state proposals and committed transitions
- timing, counts, diagnostics, and trace references
- payload and secret-redaction posture
- supersession and resume relationships

The build receipt must be append-only and schema-versioned. It must preserve external or child receipt authority through content-digested references rather than lossy copies.

### Artifact encodings

The normative contract is the typed artifact schema and canonical digest profile, not one physical encoding.

Implementations must support at least one portable structured encoding. They should provide columnar projections for large graph, node, timing, and observation collections. A columnar projection must reference the canonical artifact identity and must not become an alternate source of semantic truth.

Human logs, documentation pages, dashboards, and CLI tables must be projections from structured artifacts.

### CLI and API parity

Every normative project and build CLI operation must have an equivalent typed API over the same artifacts.

The tool surface must provide operations equivalent to:

- project compile
- project list or selector preview
- project inspect
- project diff
- build plan
- build validate
- build run
- build resume
- build inspect
- build export

Static, read-only live-probe, and mutating operations must be visibly distinct.

### Diagnostics

Build diagnostics must distinguish at least:

- invalid or stale project manifest
- invalid selector or empty selection
- incomplete dependency closure
- inaccessible or incompatible asset version
- missing required fixture test or assertion
- unavailable binding or component
- uncovered or unknown required capability
- incompatible prior applied asset
- mixed-environment deferral
- dependency or gate block
- partial or unknown effect
- stale state revision
- unsafe resume
- invalid delegated evidence
- receipt schema or digest mismatch

Diagnostics must preserve relevant project, build, asset, node, state, applied, component, and environment identities without exposing secret values.

## Design details

### Syntax

This RFC defines typed selector and lifecycle semantics. The exact CLI shorthand may evolve before Planned status.

Selectors must have a structured representation even when users write concise strings. An implementation must not make shell parsing the only normative selector model.

### Semantics

Project compilation describes all resources. Selection chooses one immutable build set. Binding and planning resolve one execution environment. Execution produces attempts and effects. Receipts describe what happened. These phases must not be collapsed into one mutable status document.

A local build and a delegated build must preserve the same IncQL semantic transitions and evidence shapes. Operational control may differ without changing data meaning.

### Interaction with other IncQL surfaces

IncQL RFC 031 provides the local structured-inspection principle.

IncQL RFC 036 provides governed bundle and unsupported-evidence conventions.

IncQL RFC 037 supplies semantic plan and interface diff inputs.

IncQL RFC 047 supplies graph queries over declared and observed build evidence.

IncQL RFC 057 supplies analogous command/API parity, explicit live probes, and destructive-operation discipline for ingestion.

IncQL RFC 058 supplies the complete project resource and asset graph.

IncQL RFC 059 and RFC 060 supply materialization, applied asset, refresh, and state transitions.

IncQL RFC 061 supplies interface, access, version, compatibility, and deprecation evidence.

IncQL RFC 063 supplies fixture-test planning and observations.

### Compatibility / migration

Existing standalone Session execution remains valid. A one-asset local build may be represented as a build set containing one selected asset and its required dependencies.

Existing CI scripts may adopt project manifest, selector preview, build set, and build receipt artifacts incrementally. Human log scraping should be deprecated once equivalent structured records are available.

Existing external orchestrators may initially execute a whole IncQL build as one operational step. Per-node delegated execution should be adopted only after the workload bundle and evidence-return contract are stable.

## Alternatives considered

- **Use one mutable manifest for logical state, applied state, and results.** Rejected because those facts have different lifecycles and authorities.
- **Make selectors CLI-only strings.** Rejected because APIs, agents, CI, and operational layers need deterministic structured selection.
- **Select changed files rather than changed semantics.** Rejected because formatting can change without impact and plan or interface meaning can change through dependencies.
- **Reuse any prior successful node.** Rejected because success does not establish binding, interface, input, profile, commit, or freshness compatibility.
- **Silently defer to production.** Rejected because mixed-environment data and cross-environment tests can produce misleading results.
- **Let an external orchestrator reconstruct the graph.** Rejected because dependency, gate, effect, and state semantics would drift from local IncQL.
- **Require an operational layer for every build.** Rejected because standalone IncQL must remain usable locally.
- **Store only logs.** Rejected because logs are unstable human projections and cannot safely drive state, resume, or delegation.

## Drawbacks

- Build manifests, sets, plans, node attempts, applied records, and receipts create a substantial artifact model.
- Strict reuse checks may rebuild more work than systems that assume idempotence and compatibility.
- Semantic state comparison can be expensive for large plans and dependency graphs.
- Mixed-environment safety makes some convenient CI patterns require explicit policy.
- Delegated execution requires a carefully versioned workload and evidence protocol.
- Columnar and structured artifact projections add serialization and migration obligations.

## Implementation architecture

This section is non-normative. A local build controller can compile a project manifest, resolve a typed selector into a build set, bind it through Session, expand it into a phase-aware DAG, and execute ready nodes through a bounded scheduler. The same build plan can be exported as a workload bundle whose nodes call authoritative IncQL APIs. Artifact storage should separate canonical envelopes from query-friendly graph and observation projections.

## Layers affected

- **IncQL specification** must define selectors, build artifacts, phase ordering, state separation, reuse, deferral, resume, delegation, and receipt semantics.
- **IncQL library package** must expose project compilation, selection, planning, local build control, inspection, state, resume, and workload export APIs.
- **Incan compiler and package tooling** must provide deterministic project compilation and declaration metadata; new selector or build grammar is not required by this RFC.
- **Execution / interchange** must preserve node contracts, applied state, receipts, and authoritative state transitions across local, cluster, and delegated runners.
- **Documentation and tooling** must expose pure compilation, live validation, mutation, selection reasons, mixed provenance, skips, blocks, and effects clearly.

## Unresolved questions

- What concise CLI selector syntax should project onto the structured selector model?
- Which indirect fixture-test and quality-assertion selection policy should be the default?
- What minimum assurance is required before an applied asset is reusable in local development versus CI?
- Should mixed-environment deferral default to warning, failure, or policy-required explicit admission?
- What is the minimum per-node workload contract needed for the first delegated operational integration?
- Which artifact families require canonical JSON-compatible envelopes, and which should have first-class Arrow or Parquet projections?
- Should a project build commit applied state asset-by-asset or support an optional multi-asset publication group?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->

<!-- References -->

[dbt-artifacts]: https://docs.getdbt.com/reference/artifacts/dbt-artifacts
[dbt-build]: https://docs.getdbt.com/reference/commands/build
[dbt-defer]: https://docs.getdbt.com/reference/node-selection/defer
[dbt-selection]: https://docs.getdbt.com/reference/node-selection/syntax
[dbt-state]: https://docs.getdbt.com/reference/node-selection/state-selection
