# IncQL RFC 058: Data projects, named relational assets, and the asset graph

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 000 (core language model and layer boundaries)
  - IncQL RFC 001 (dataset carriers and boundedness)
  - IncQL RFC 004 (execution context and Session)
  - IncQL RFC 007 (Prism logical planning and optimization engine)
  - IncQL RFC 027 (relational evidence program)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 030 (Prism lineage graph)
  - IncQL RFC 031 (local inspection APIs and artifacts)
  - IncQL RFC 046 (data contract ingress and product topology)
  - IncQL RFC 050 (addon component registry and package contract)
  - IncQL RFC 051 (native ingestion program and ownership boundary)
  - IncQL RFC 052 (declarative sources, resources, and connector packages)
  - IncQL RFC 059 (materialization intent and applied asset lifecycle)
  - IncQL RFC 061 (asset interfaces, contracts, access, ownership, versions, and deprecation)
  - IncQL RFC 062 (project build lifecycle, selectors, state, artifacts, and delegated execution)
  - IncQL RFC 063 (typed relational fixtures and expected-result testing)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines an IncQL data project as a statically discoverable collection of named relational assets, external relations, ingestion assets, assertions, and product-topology records connected by a typed inter-asset dependency graph. A named relational asset is a stable project resource whose implementation produces one typed IncQL relation through Prism. The project graph must be available without executing user data logic, opening external connections, resolving secrets, or evaluating template code. It is distinct from both the Prism graph inside one relational asset and any operational run graph used to schedule attempts.

## Core model

1. A **data project** is one reproducible project root plus its resolved Incan package dependencies and project configuration.
2. A **project resource** is one statically discoverable, independently identified declaration that participates in project inspection, selection, validation, or builds.
3. A **named relational asset** is a project resource whose implementation produces a typed relational result, normally `DataSet[T]` or a more specific carrier.
4. An **external relation** is a typed logical reference to data already available through a binding; it is not an IncQL RFC 052 extraction source.
5. An **ingestion asset** is a project resource that references an immutable IncQL ingestion plan and its produced relation or destination identities.
6. An **asset reference** is a typed symbolic dependency on a specific project resource identity and resolved version.
7. The **asset graph** is the acyclic inter-resource graph used for project validation, selection, impact analysis, and build ordering.
8. A **project manifest** is the immutable, versioned artifact that records the resolved resources and graph without containing resolved secrets or live handles.

## Motivation

IncQL currently gives authors typed relational carriers, Prism logical plans, Substrait interchange, Session execution, ingestion plans, and a rich evidence model. Those pieces describe one relational computation or one ingestion operation well, but they do not yet define how a repository names many reusable data outputs, declares dependencies between them, inspects them together, or selects a coherent subset to build.

The useful idea in [dbt projects][dbt-projects] is that transformations become named resources in a durable graph. Authors can refer to one transformation from another, select upstream or downstream subgraphs, attach tests and contracts, and emit a project manifest. IncQL should adopt that project shape without adopting SQL files as the semantic source, Jinja as a graph-construction language, or warehouse relations as the only execution target.

dbt also demonstrates the cost of discovering dependencies by evaluating templates. A dependency expressed through [`ref`][dbt-ref] but hidden behind runtime template control flow may require a special comment to force graph discovery. IncQL already has a checked language, typed symbols, and Prism-managed plans; requiring authors or tools to reconstruct the graph from strings would discard those advantages.

The graph boundary must also remain precise. Prism records relational operators, expressions, rewrites, and field lineage inside one asset. A project asset graph records which named resources depend on which other named resources. A scheduler may later expand one immutable build set into operational attempts. Combining all three into one graph would make relational meaning depend on scheduling and make a project resource identity depend on backend plan fragments.

## Goals

- Define data projects and project resources as first-class IncQL concepts.
- Define named relational assets without overloading the existing meaning of an Incan `model` type.
- Define typed asset references, stable identities, namespaces, versions, and dependency edges.
- Keep external relations distinct from connector sources and extraction resources.
- Require project discovery and graph construction to be deterministic and free of external side effects.
- Reuse Incan packages and workspaces for dependency resolution instead of creating an IncQL package manager.
- Define a project manifest that composes with existing identity, lineage, evidence, and inspection RFCs.
- Keep the Prism graph, asset graph, and operational run graph separate while preserving references between them.
- Support local standalone project inspection and execution without requiring an operational platform.

## Non-Goals

- Defining materialization and applied-state semantics; IncQL RFC 059 owns those contracts.
- Defining incremental transformation or temporal history semantics; IncQL RFC 060 owns those contracts.
- Defining contracts, access levels, ownership, versions, or deprecation; IncQL RFC 061 owns those interfaces.
- Defining selectors, build phases, run receipts, state comparison, or delegated execution; IncQL RFC 062 owns the build lifecycle.
- Defining typed relational unit tests; IncQL RFC 063 owns fixtures and expected-result testing.
- Defining schedules, triggers, retries across operational steps, deployment promotion, or managed monitoring.
- Defining a global organization-wide catalog or asset registry.
- Requiring SQL, Jinja, Python, Spark, or a warehouse to author or inspect an IncQL project.
- Defining dbt manifest or project migration. That compatibility surface belongs to a later RFC after the native project model is stable.
- Defining a metrics or semantic-layer query language.

## Guide-level explanation (how authors think about it)

An author should think of a named relational asset as a typed, reusable output in an IncQL project. The exact declaration helpers are illustrative; the reference-level contract is normative.

```incan
from pub::incql import DataSet
from pub::incql.project import DataProject, asset, external_relation
from models import CustomerSummary, Order

project = DataProject.current()

orders = external_relation[Order](
    project=project,
    name="commerce.orders",
    binding="warehouse.orders",
)

@asset(
    project=project,
    name="commerce.customer_summary",
    inputs=[orders],
)
def customer_summary() -> DataSet[CustomerSummary]:
    return (
        orders.read()
        .group_by(["customer_id"])
        .agg({
            "order_count": count(),
            "lifetime_value": sum("amount"),
        })
    )
```

`Order` and `CustomerSummary` are Incan model types that describe row shape. `commerce.orders` and `commerce.customer_summary` are project resource identities. The two concepts are related but not interchangeable.

Project inspection can resolve that `commerce.customer_summary` depends on `commerce.orders` without reading the warehouse. Compiling the relational asset body produces a Prism plan and field lineage. The project manifest references that plan and lineage rather than replacing them with a project-level approximation.

An ingestion plan can participate in the same project:

```incan
github_issues = project.ingestion_asset(
    name="support.github_issues",
    plan=sync_github_issues,
)

@asset(
    project=project,
    name="support.issue_activity",
    inputs=[github_issues.output("issues")],
)
def issue_activity() -> DataSet[IssueActivity]:
    return summarize_issue_activity(github_issues.read("issues"))
```

The ingestion asset does not turn the project graph into an ingestion pipeline. Its source, schema, checkpoint, destination, and receipt semantics remain owned by IncQL RFCs 051 through 057. The project graph records the dependency on its output.

## Reference-level explanation (precise rules)

### Project identity and boundary

A data project must have a stable project id, project schema version, project source identity, and resolved dependency snapshot. Project identity must not be derived solely from an absolute filesystem path.

The project root must define or resolve:

- project id and display name
- project configuration schema version
- IncQL compatibility requirement
- resource discovery roots
- resolved Incan package and feature dependencies
- project-level metadata defaults
- optional named selector declarations consumed by IncQL RFC 062

The resolved dependency snapshot must use Incan package and workspace resolution. IncQL must not define a second package lockfile or independently resolve package versions.

### Project resource kinds

The initial project model must recognize at least these resource kinds:

| Resource kind | Meaning |
| --- | --- |
| `relational_asset` | A named typed relation produced through Prism-managed relational work |
| `external_relation` | A typed logical read root whose physical data already exists and is supplied by a binding |
| `ingestion_asset` | A named reference to one immutable ingestion plan and its declared outputs |
| `quality_assertion` | An IncQL RFC 034 assertion attached to a project resource or field |
| `fixture_test` | An IncQL RFC 063 pre-materialization relational test |
| `exposure` | A product-topology or downstream-use record normalized through IncQL RFC 046 |

Child RFCs may add resource kinds when they create an independent identity, compatibility, or lifecycle boundary. A materialization intent is configuration on a relational asset, not a separate resource merely because execution expands it into several physical actions.

### Relational asset identity

A relational asset identity must include:

- project or package namespace
- stable asset name
- resolved asset version
- resource kind

Display labels, file paths, physical database names, and backend relation names must not be the canonical identity.

Two resources in one resolved project manifest must not have the same canonical identity. Name resolution must diagnose ambiguity rather than selecting by discovery order.

An asset version is part of interface resolution under IncQL RFC 061. The manifest must contain the resolved version even when authoring syntax uses a local current-version alias.

### Typed asset output

A relational asset must declare or derive one typed output carrier. Its row model, field identities, nullability, and logical types must be available before physical execution.

The asset declaration and its implementation body must agree on carrier boundedness and output row type. A mismatch must fail project compilation.

An asset implementation must lower through the ordinary IncQL authoring surface into a Prism plan. Project registration must not create a second relational plan language.

Multiple named outputs require either independently identified relational assets or an explicit multi-output resource contract defined by a later RFC. An unstructured map of runtime-created tables must not silently become project resources.

### External relations and connector sources

An external relation denotes a typed relation that is already available through a runtime binding. Its declaration must identify a logical binding requirement and schema authority without containing resolved credentials or a live connection.

An IncQL RFC 052 source groups extractable connector resources and owns extraction behavior. It must not be used as the generic name for every pre-existing warehouse table or object.

A connector resource may produce an ingestion asset output. That output may then be referenced as a relation by other project resources. The project manifest must preserve both the project-resource identity and the underlying ingestion-plan or receipt references.

### Asset references

An asset reference must resolve through checked project and package symbols to one resource identity and version. String names may be accepted at CLI or interchange boundaries, but native authoring must not rely on unvalidated strings as the only dependency representation.

A relational asset implementation must declare enough information for the project compiler to identify its direct asset and external-relation dependencies before execution. The compiler may confirm or enrich those dependencies from the resulting Prism plan.

If a declared dependency and the compiled Prism read roots disagree, project compilation must fail or produce an explicitly unsupported result. The implementation must not silently add a runtime-only dependency.

Cross-package references must use resolved Incan dependencies and exported public asset interfaces from IncQL RFC 061. Importing a package must not make all of its private project resources visible.

### Asset graph

The asset graph must be a directed acyclic graph for one resolved project manifest. Cycles between materialized or logical assets must fail project compilation with a diagnostic that identifies the cycle path.

Asset graph edges must distinguish at least:

- `reads`: one relational asset reads another asset or external relation
- `produced_by_ingestion`: a relation is an output of an ingestion asset
- `asserts`: a quality assertion targets an asset or field
- `tests`: a fixture test targets an asset
- `exposes`: a product-topology record identifies a downstream use

The graph may project richer evidence relationships from IncQL RFC 047, but the project graph must not claim observed execution, verified lineage, or policy approval merely because a declared edge exists.

Relation- and field-level dependency meaning inside a relational asset remains owned by Prism and IncQL RFC 030. The asset graph must link to those plan and lineage artifacts through stable identities.

### Static discovery and purity

Project resource discovery and initial graph construction must not:

- open network or database connections
- resolve secret values
- execute destination mutations
- query data values
- evaluate runtime-dependent branches to discover resources
- execute arbitrary SQL, hooks, or package initialization side effects

Ordinary imports and checked declaration metadata may participate in discovery. Any code executed by the compiler to construct resource descriptors must be deterministic, bounded to local checked inputs, and incapable of external effects.

Generated resources may be admitted only through an explicit generated-manifest artifact that records generator identity, generator version, canonical inputs, input digests, produced resource identities, and diagnostics. Runtime control flow must not create project resources that are absent from the project manifest.

### Project manifest

Project compilation must produce a versioned project manifest containing at least:

- project identity and configuration version
- resolved IncQL and Incan compatibility context
- resolved package, feature, and source identities
- every project resource identity, kind, version, source location, and descriptor digest
- typed output schema references
- asset graph nodes and edges
- Prism plan, lineage, quality, contract, policy, and product-topology references where available
- materialization intent references from IncQL RFC 059
- interface and access records from IncQL RFC 061
- fixture-test references from IncQL RFC 063
- unsupported, incomplete, and unknown diagnostics

The manifest must not contain resolved credentials, live handles, raw data payloads, or backend-native runtime objects.

Repeated compilation over the same canonical declarations, dependency snapshot, and compiler/profile inputs should produce the same semantic manifest digest. Source timestamps and absolute paths must not affect semantic identity unless explicitly included as provenance outside that digest.

### Diagnostics

Project compilation must distinguish at least:

- duplicate or ambiguous resource identity
- unresolved asset reference
- inaccessible asset reference
- incompatible asset version
- dependency cycle
- declared and compiled dependency mismatch
- missing or incompatible output schema
- runtime-created resource absent from the manifest
- invalid generated-manifest provenance
- unsupported resource kind or manifest version

Diagnostics must identify the project resource and relevant dependency path without exposing secret bindings.

## Design details

### Syntax

This RFC introduces no new Incan grammar. The first implementation should prove resource declarations, typed references, static discovery, and project manifests through ordinary Incan package APIs and declaration metadata.

Dedicated asset declaration syntax or compiler-recognized decorators require a separate language-surface decision if library-level declarations cannot provide static discovery, checked dependency resolution, and acceptable author ergonomics.

### Semantics

A named relational asset is a stable project resource around one Prism-managed relational result. Naming an asset does not materialize it, schedule it, certify it, or make it publicly accessible.

The asset graph is declared and semantic project structure. It is not an execution log. A build run may execute only a selected subgraph and may reuse prior applied assets, but those runtime choices do not change the canonical dependency graph.

### Interaction with other IncQL surfaces

IncQL RFC 007 remains the owner of relational planning inside one asset.

IncQL RFC 028 must add project, asset, external-relation, ingestion-asset, project-manifest, and asset-reference target categories.

IncQL RFC 030 must link field and relation lineage inside one asset to project-level dependency edges without collapsing the two graph levels.

IncQL RFC 031 must expose project and asset graph inspection as structured artifacts.

IncQL RFC 046 exposures and product ports may target project assets, but imported product topology remains evidence rather than project authority.

IncQL RFC 050 remains the package contract for executable connectors, runtimes, ingress frontends, and evidence providers. Project resources are checked data declarations distributed through ordinary Incan packages; they are not addon components merely because they are packaged.

IncQL RFCs 051 through 057 remain the source-to-destination ingestion contract. This RFC makes ingestion plans addressable in a project without redefining them.

### Compatibility / migration

Existing standalone `DataSet[T]`, query-block, Session, and ingestion programs remain valid without a data project.

An existing IncQL repository may adopt a project by naming selected read roots and relational plans as resources. Plan and schema identities should be preserved where possible; new asset identities become an additional project scope rather than replacements for Prism identities.

Existing string-named Session registrations may be represented as external relations during migration. Native project references should move to checked asset handles while CLI and artifact boundaries may continue to accept canonical string ids.

## Alternatives considered

- **Use one Prism graph for the entire project.** Rejected because intra-plan relational operations and inter-asset dependencies have different identity, optimization, versioning, and execution boundaries.
- **Infer dependencies from emitted SQL or backend plans.** Rejected because that loses typed authored intent, fails for non-SQL backends, and discovers meaning after the authoritative planning boundary.
- **Discover dependencies by executing templates or user functions.** Rejected because graph inspection would gain ambient I/O, hidden runtime branches, and non-reproducible side effects.
- **Call relational assets models.** Rejected as the normative vocabulary because Incan already uses `model` for typed row and schema declarations.
- **Call every bound relation a source.** Rejected because IncQL RFC 052 already uses source for a configured extraction boundary with resources and connector semantics.
- **Create a separate IncQL package manager.** Rejected because Incan already owns package and workspace resolution.
- **Require an operational platform to construct the project graph.** Rejected because standalone local IncQL must remain complete for data authoring and execution.

## Drawbacks

- Authors gain another identity layer in addition to row models, Prism plans, physical relations, and runtime attempts.
- Static discovery constrains dynamic resource generation and requires explicit generated manifests for legitimate code generation.
- Cross-package asset interfaces require coordination with Incan package exports and lock resolution.
- Project-wide validation and manifest generation may become expensive for very large repositories.
- The distinction between external relations, connector sources, ingestion outputs, and relational assets requires careful documentation.

## Implementation architecture

This section is non-normative. A practical implementation can collect checked declaration metadata during Incan package compilation, lower each relational asset body through the existing IncQL surface, and assemble a project manifest from descriptor records plus Prism plan references. Manifest generation should cache by declaration and dependency digests while preserving full invalidation when package, compiler, semantic profile, or declaration metadata changes.

## Layers affected

- **IncQL specification** must define project resources, relational asset identity, typed references, graph edges, purity, and manifest requirements.
- **IncQL library package** must expose project, asset, external-relation, ingestion-asset, reference, and inspection surfaces.
- **Incan compiler and package tooling** must make checked declaration metadata and resolved package identities available for static project discovery; new grammar is not required by this RFC.
- **Execution / interchange** must preserve asset and project references through Prism, Substrait, Session binding, materialization, and evidence artifacts without making them backend object names.
- **Documentation and tooling** must distinguish row models, relational assets, external relations, connector sources, Prism graphs, asset graphs, and operational run graphs.

## Unresolved questions

- Which first author surface best provides static discovery: explicit project builders, decorators, module-level declarations, or compiler-recognized declaration metadata?
- Should asset names be globally unique within a project or unique within hierarchical namespaces that are always present in canonical ids?
- Which resource kinds, if any, need first-class multi-output contracts in the initial release?
- How should generated-manifest producers be sandboxed and versioned by the Incan toolchain?
- Which project configuration belongs in `incan.toml`, and which requires a separate IncQL project document?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->

<!-- References -->

[dbt-projects]: https://docs.getdbt.com/docs/build/projects
[dbt-ref]: https://docs.getdbt.com/reference/dbt-jinja-functions/ref
