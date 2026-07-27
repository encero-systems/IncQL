# IncQL RFC 052: Declarative sources, resources, and connector packages

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 001 (dataset carriers and boundedness)
  - IncQL RFC 004 (execution context and Session)
  - IncQL RFC 009 (session format handler registry)
  - IncQL RFC 010 (CSV dialect and interpretation contract)
  - IncQL RFC 011 (source discovery and parse-unit expansion)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 048 (cluster execution backend mode)
  - IncQL RFC 050 (add-on component registry)
  - IncQL RFC 051 (native ingestion program and ownership boundary)
  - IncQL RFC 053 (schema observation, reconciliation, and normalization)
  - IncQL RFC 054 (incremental extraction, state, and checkpoints)
  - IncQL RFC 064 (federated placement, execution targets, and explicit data exchange)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines IncQL's declarative source, resource, and connector-package model. A source groups related resources behind one connector and shared configuration; a resource identifies one typed, selectable record-producing unit; and a connector package implements the protocol-specific discovery and extraction contract. Source declarations contain stable intent, binding references, and policies rather than executable Python generators or resolved credentials. The model must support generic REST/OpenAPI, SQL, and filesystem connectors while remaining extensible through versioned package components and explicit capability coverage.

## Core model

1. A **connector definition** names one protocol implementation and its versioned capabilities.
2. A **source specification** configures one connector instance and shared defaults for its resources.
3. A **resource specification** identifies one selectable record-producing unit, its declared row type, dependencies, extraction policy, and destination defaults when present.
4. A **binding requirement** names environment-provided values without carrying resolved credentials in source artifacts.
5. A **resource graph** records parent-child or dependency relationships needed for extraction and must remain distinct from an operational pipeline DAG.
6. A **connector package** supplies implementations through the add-on component registry while preserving the same public contracts as built-in connectors.

## Motivation

IncQL's current source model is a closed file-format descriptor with CSV, Parquet, and Arrow variants. That is enough for local file reads but cannot describe an API with multiple endpoints, a reflected database with selectable tables, a paginated resource, or a source whose child resource depends on identifiers produced by a parent resource.

Ad hoc source functions would solve the implementation problem while weakening the product. If arbitrary user code is the source contract, tools cannot reliably discover resources, inspect binding requirements, validate pagination, compare connector versions, determine incremental support, or generate a plan without executing code. IncQL needs declarations that are sufficiently expressive for common integrations and a typed connector interface for the cases that require custom protocol behavior.

The connector model also needs a clear boundary from formats and execution backends. A REST connector may decode JSON, a filesystem connector may delegate to a CSV format handler, and a SQL connector may expose tables that a DataFusion backend scans. Connector, format, and query backend are related roles, not synonyms.

## Goals

- Define stable source, resource, connector, binding-requirement, and resource-graph concepts.
- Support resource discovery and selection without extracting full datasets.
- Describe REST/OpenAPI endpoints, SQL tables or queries, and filesystem resources through one typed model.
- Define pagination, parent-resource resolution, bounded sampling, request retry, and rate-limit policy boundaries.
- Keep secret values and environment-specific endpoints outside portable source declarations.
- Make connector identity, version, digest, capabilities, and diagnostics inspectable.
- Make source locality, eligible execution targets, fragment capabilities, and source-statistics availability inspectable without resolving credentials into authored artifacts.
- Allow built-in and package-provided connectors to participate through the same registry and conformance model.

## Non-Goals

- Defining schema inference and normalization rules; IncQL RFC 053 owns them.
- Defining incremental checkpoint semantics; IncQL RFC 054 owns them.
- Defining destination write and commit behavior; IncQL RFC 055 owns it.
- Defining pipeline schedules, operational retries, backfills, or deployment.
- Guaranteeing that every API can be represented without a custom connector implementation.
- Requiring dynamic module loading in the first implementation.
- Treating connector package code as trusted merely because it is discoverable.

## Guide-level explanation (how authors think about it)

The common path should be declarative. The exact constructor names are illustrative.

```incan
from pub::incql.sources import (
    BearerAuthRef,
    CursorPagination,
    ParentField,
    RestResource,
    rest_source,
)
from models import Issue, IssueComment

github = rest_source(
    name="github",
    base_url="https://api.github.com/",
    auth=BearerAuthRef("github.token"),
    resources=[
        RestResource[Issue](
            name="issues",
            path="repos/{owner}/{repo}/issues",
            pagination=CursorPagination(next_link="link.next"),
        ),
        RestResource[IssueComment](
            name="issue_comments",
            path="repos/{owner}/{repo}/issues/{issue_number}/comments",
            params={"issue_number": ParentField("issues", "number")},
        ),
    ],
)

selected = github.select(["issues", "issue_comments"])?
inspection = selected.inspect()
```

Inspection can report both resources, the dependency from `issue_comments` to `issues`, required bindings, pagination requirements, connector identity, and schema status without sending requests that retrieve the full source.

A SQL source follows the same author model even though its connector implementation differs:

```incan
from pub::incql.sources import sql_source
from models import Customer

warehouse = sql_source(
    name="operational",
    connection=connection_ref("operational.readonly"),
)

customers = warehouse.table[Customer]("public.customers")
```

Source configuration is reusable across local and operational environments. The binding reference remains stable while each environment supplies its own credentials and endpoint resolution.

## Reference-level explanation (precise rules)

### Connector identity and package contract

Every connector definition must expose:

- a stable connector identifier
- connector contract version
- implementation version
- implementation digest when available
- supported source or destination roles
- binding requirement schema
- capability declarations
- configuration schema
- diagnostic vocabulary or stable diagnostic categories

When a source system can host relational computation, its connector definition must additionally expose a locality identity, eligible execution-target identities, supported fragment capability declarations, and the kinds of statistics or exchange representations it can provide. These declarations describe candidates for RFC 064 placement; they do not authorize execution, carry credentials, or make the connector the owner of global planning.

Package-provided connectors must register through the component mechanism defined by IncQL RFC 050 or an explicitly compatible registry. Built-in connectors must use the same public descriptor and capability model rather than relying on hidden `Session` branches.

Connector registration must not imply capability coverage. Coverage must be evaluated for the selected connector version, resource configuration, binding class, and execution environment. Unknown coverage must remain unknown according to IncQL RFC 033.

### Source specifications

A source specification must include source identity, connector identity, shared configuration, binding references, resource defaults when present, resource specifications, evidence metadata, and source-level diagnostics.

A source specification must not include resolved secret values. It may include non-secret portable endpoint intent such as an API base URL when that URL is part of the authored source definition. Environment-sensitive endpoints must use opaque binding references instead.

Source identity must be stable within one project artifact and must not depend only on a display name. Multiple configured instances of the same connector must remain distinguishable.

### Resource specifications

A resource specification must include:

- resource identity and display name
- declared row type or explicit discovery-only status
- boundedness
- connector-specific locator or endpoint declaration
- resource dependencies
- pagination or continuation policy when applicable
- binding requirements beyond source defaults
- selection status or default selection policy
- extraction limits permitted for sampling or testing
- capability requirements
- schema-policy reference
- incremental-policy reference when applicable
- evidence metadata and diagnostics

A resource is not itself a `LazyFrame[T]` or `DataStream[T]`. Session binding turns a configured resource into an executable typed carrier or ingestion-plan input. This distinction keeps environment binding and source protocol state out of authored relational plans.

A bounded resource must bind to bounded work for one run. Cursor-based incremental extraction remains bounded when each run has a finite completion condition. Only a source whose contract is genuinely unbounded may bind to `DataStream[T]`.

### Resource graphs

Resources may depend on other resources for endpoint parameters, identifiers, partitions, or discovery metadata. Dependencies must form an acyclic graph for one extraction plan unless a connector-specific fixed-point contract is standardized by a later RFC.

Selecting a dependent resource must either select the required dependency closure or fail with a diagnostic that names the missing resources. Implementations must not silently issue unconstrained child requests when parent values are unavailable.

Resource dependencies describe source-side extraction. They must not acquire workflow scheduling, cross-system sensor, retry-orchestration, or deployment semantics.

### Pagination and continuation

The portable connector vocabulary must be able to represent at least:

- one-page responses
- next-link or next-URL pagination
- response-header link pagination
- page-number pagination
- offset and limit pagination
- cursor-token pagination
- parent-resource expansion

A connector may support automatic detection, but inspection must report the selected pagination strategy and confidence. Automatic detection must not silently switch strategies after extraction begins without a diagnostic and receipt evidence.

Pagination state used only inside one extraction attempt is not a committed incremental checkpoint. Cross-run cursor state belongs to IncQL RFC 054 even when the same source field participates in both mechanisms.

### Request retries and rate limits

Connectors may declare request-level retry policy for transient transport failures and explicitly retryable responses. Retry policy must identify maximum attempts, backoff behavior, retryable categories, and idempotency assumptions. Non-idempotent requests must not be retried unless the connector can prove a safe replay mechanism.

Rate-limit policy may include concurrency, request spacing, response-header interpretation, and server-requested delay. Runtime observations must distinguish rate-limit waiting from transport time and user-requested throttling when those facts are available.

Request retries must remain distinct from retrying an entire resource extraction, ingestion run, operational step, pipeline, or workflow.

### Discovery and sampling

Connector discovery must be able to enumerate resources, binding requirements, source metadata, and candidate schemas without performing a full load. Discovery may make bounded metadata or schema requests when the connector contract permits them.

Sampling must be bounded by explicit item, page, byte, or time limits. A sample is evidence about observed values, not proof of the complete source schema or distribution.

Discovery and sampling must preserve redaction. Credentials, authorization headers, secret query parameters, and sensitive payload fields must not appear in ordinary inspection artifacts or diagnostics.

### Format and file discovery composition

Filesystem and object-store connectors must delegate file interpretation to the format contract from IncQL RFC 009 and format-specific RFCs such as IncQL RFC 010. They must delegate parse-unit enumeration to IncQL RFC 011.

A format handler must not become the owner of API pagination, SQL reflection, source-level authentication, resource dependencies, or cross-run checkpoints.

### Errors and diagnostics

Connector-facing diagnostics must distinguish at least:

- unknown connector or incompatible connector version
- invalid source or resource configuration
- unresolved binding requirement
- authentication or authorization failure without exposing secret values
- discovery failure
- unsupported pagination or continuation policy
- resource dependency failure
- rate-limit exhaustion
- request retry exhaustion
- response decoding failure
- capability mismatch
- cancellation or bounded-sample termination

## Design details

### Syntax

This RFC introduces no language grammar. Source and resource declarations should first use typed library APIs, model values, decorators, or component metadata that ordinary Incan tooling can inspect.

### Semantics

Source and resource specifications are declarative artifacts. Connector implementations execute those artifacts through a `Session` binding. An implementation may use callbacks internally, but callback identity and behavior must be represented through registered connector components rather than opaque unversioned closures in portable plans.

### Interaction with other IncQL surfaces

IncQL RFC 001 supplies the bounded and unbounded carrier distinction used after resource binding.

IncQL RFC 004 supplies the session registry and execution boundary. Source bindings must resolve through that boundary without embedding credentials into Substrait reads.

IncQL RFC 009 remains the format-codec registry beneath file-oriented connectors.

IncQL RFC 028 must gain semantic targets for connector definitions, source specifications, resource specifications, resource dependencies, and discovery attempts.

IncQL RFC 033 supplies capability requirements and coverage records. Connector capabilities must use that evidence model rather than boolean `supports_*` flags.

IncQL RFC 064 owns selection among source-local and other execution targets. Connector packages supply the source-local facts and target capability evidence that Prism needs for that selection; they must not silently retrieve full source data solely because a preferred remote fragment is unavailable.

IncQL RFC 050 supplies package component discovery and validation for connector implementations.

### Compatibility / migration

Existing file source descriptors should migrate behind built-in filesystem and format connector components without changing `Session.read_csv`, `read_parquet`, or `read_arrow` behavior for supported inputs.

Closed source-kind enums may remain as internal compatibility surfaces during migration, but the public extension model must not require adding a core enum variant for every connector package.

## Alternatives considered

- **Python generator functions as the source API.** Rejected because arbitrary execution prevents reliable static discovery, capability inspection, and package-level semantic validation.
- **One connector type per SaaS product in IncQL core.** Rejected because it creates an unbounded maintenance surface and makes core releases the extension bottleneck.
- **One generic string URI for every source.** Rejected because URI text cannot express resource graphs, pagination, bindings, capabilities, schema policy, or safe diagnostics.
- **Make formats, connectors, and query backends one plugin category.** Rejected because they own different contracts and failure modes.
- **Allow cyclic resource graphs.** Rejected for the base contract because termination, state, and replay semantics would be underspecified.

## Drawbacks

- Declarative connector configuration cannot represent every unusual protocol without custom components.
- Connector package compatibility and trust become supply-chain concerns.
- Capability evaluation may be verbose for connectors with many conditional features.
- Parent-resource expansion can create unexpectedly large request graphs and requires strong inspection tooling.
- The source model adds another typed layer before authors receive a familiar dataset carrier.

## Implementation architecture

This section is non-normative. Generic REST/OpenAPI, SQL, and filesystem connectors can provide the first conformance corpus. Connector components can compile source specifications into pull-based or batch-producing runtime handles, while the session owns binding resolution, cancellation, metrics, and the handoff into schema reconciliation. A connector SDK should expose test transports and fixture-driven response sequences so pagination, retry, redaction, and state behavior can be verified without live services.

## Layers affected

- **IncQL specification** must define connector, source, resource, binding, dependency, pagination, and capability semantics.
- **IncQL library package** must expose declarative source/resource construction, connector registration, discovery, selection, and binding APIs.
- **Incan compiler and standard library** must preserve typed connector component metadata and provide the async I/O, HTTP, JSON, secret, and iterator facilities required by connector implementations.
- **Execution / interchange** must resolve source resources without exposing credentials or confusing connector identity with query-backend identity.
- **Documentation and tooling** must support connector discovery, configuration validation, bounded sampling, and package diagnostics.

## Unresolved questions

- Should resource dependencies automatically select their complete dependency closure, or require explicit opt-in when that closure may be expensive?
- Which pagination strategies belong in the required portable connector vocabulary versus connector-specific extensions?
- What is the minimum stable connector component ABI needed before third-party packages can be supported?
- Should discovery-only resources have a dedicated type, or use one resource type with an explicit schema state?
- How should source definitions express non-secret environment-specific endpoints without weakening reproducibility?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->
