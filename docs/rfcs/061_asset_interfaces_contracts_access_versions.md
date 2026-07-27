# IncQL RFC 061: Asset interfaces, contracts, access, ownership, versions, and deprecation

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 029 (typed metadata attachments)
  - IncQL RFC 030 (Prism lineage graph)
  - IncQL RFC 034 (quality assertions and observations)
  - IncQL RFC 035 (governed attributes and policy checkpoints)
  - IncQL RFC 037 (plan diff and blast-radius inputs)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 045 (constraint evidence and verification-aware planning)
  - IncQL RFC 046 (data contract ingress and product topology)
  - IncQL RFC 058 (data projects, named relational assets, and the asset graph)
  - IncQL RFC 059 (materialization intent and applied asset lifecycle)
  - IncQL RFC 060 (incremental transformation and temporal history semantics)
  - IncQL RFC 062 (project build lifecycle, selectors, state, artifacts, and delegated execution)
  - IncQL RFC 063 (typed relational fixtures and expected-result testing)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines the stable interface of a named relational asset: its typed output contract, semantic declarations, dependency access level, owning group, independently addressable versions, compatibility classification, and deprecation lifecycle. The structural contract must derive from the asset's checked output type and stable field identities rather than duplicate warehouse-specific YAML. Declared, destination-enforced, observed, verified, and proven guarantees must remain distinct. Asset access controls which project resources may take a dependency; it is not user authorization or a database grant. Breaking versions may coexist so consumers can migrate deliberately.

## Core model

1. An **asset interface** is the versioned public or internal boundary through which another project resource consumes a named relational asset.
2. An **output contract** defines stable field identities, logical types, nullability, shape, grain and constraint claims, semantic metadata, and required assurance.
3. An **asset group** is a named ownership and encapsulation boundary for related project resources.
4. An **access level** determines which project compilation scopes may resolve an asset reference.
5. An **asset version** identifies one interface generation that may coexist with other generations of the same logical asset name.
6. A **compatibility assessment** compares two interface and plan evidence snapshots and classifies consumer risk.
7. A **deprecation record** announces that a version or interface is being retired, identifies a replacement when available, and defines reviewable removal conditions.

## Motivation

A named asset becomes an interface as soon as another transformation, application, dashboard, model-training job, or package depends on it. A field rename, type change, grain change, key change, semantic reinterpretation, or removal can break consumers even when the producing query still runs successfully.

dbt [contracts][dbt-model-contracts], [access levels][dbt-model-access], groups, and [model versions][dbt-model-versions] demonstrate the value of treating selected data outputs as APIs. They also reveal important limits: contracts are opt-in, use platform-native type names, apply to only some resource and materialization types, and may contain constraints that a warehouse accepts but does not enforce. Structural compatibility also cannot detect a logic change that preserves columns while changing their meaning.

IncQL has a stronger basis. A relational asset already produces a checked `DataSet[T]`; Prism owns its semantics and lineage; metadata, governed attributes, constraints, quality observations, verification, and semantic profiles already have typed evidence homes. The interface should compose those records without pretending that a declaration is an enforced fact.

Access and ownership also need disciplined scope. An asset marked public is available for checked project dependency resolution; that declaration does not grant a person permission to query the physical object. Ownership identifies responsibility and escalation context; it does not make an owner's unverified claims authoritative.

## Goals

- Define a versioned asset interface for named relational assets.
- Derive the structural output contract from checked Incan model and relation metadata.
- Preserve stable field identity independently from display names and physical column names.
- Integrate constraint, quality, governed-attribute, lineage, semantic-profile, and verification evidence.
- Define private, project, and public dependency access.
- Define asset groups and ownership records without conflating them with user authorization.
- Allow multiple breaking asset versions to coexist and be selected explicitly.
- Define compatibility classifications that include structural, semantic, lineage, policy, quality, and materialization changes.
- Define deprecation and removal evidence.
- Support local package consumption and cross-package references through Incan dependency resolution.

## Non-Goals

- Defining database users, roles, grants, row policies, or physical IAM.
- Defining organization-wide ownership, approval, or catalog services.
- Treating all quality assertions or SLAs as structural schema fields.
- Guaranteeing semantic compatibility solely because schemas match.
- Defining project build selection, state comparison mechanics, or promotion policy; IncQL RFC 062 consumes interface evidence.
- Defining an external data contract standard; IncQL RFC 046 imports existing contract formats as evidence.
- Requiring every private intermediate asset to carry the same governance burden as a public interface.
- Defining metric semantics or business ontology.
- Automatically deleting deprecated physical objects.

## Guide-level explanation (how authors think about it)

An author publishes a stable asset interface by declaring access, group, and version around the typed output:

```incan
from pub::incql.project import asset, asset_group

commerce = asset_group(
    name="commerce",
    owner="team.commerce_data",
)

@asset(
    name="commerce.customer_summary",
    group=commerce,
    access="public",
    version=2,
)
def customer_summary_v2() -> DataSet[CustomerSummaryV2]:
    return build_customer_summary_v2()
```

`CustomerSummaryV2` supplies field names, stable field metadata, logical types, and nullability. Additional declarations attach grain, keys, classifications, descriptions, or required quality and verification evidence.

A consumer resolves a versioned reference:

```incan
customer_summary = project.asset_ref[CustomerSummaryV2](
    "commerce.customer_summary",
    version=2,
)
```

The build manifest always records the resolved version. A project-local alias such as `current` may improve ergonomics, but it must not make a build artifact ambiguous.

When a breaking change is needed, versions may coexist:

```incan
deprecate_asset(
    "commerce.customer_summary",
    version=1,
    replacement_version=2,
    removal_after="2027-01-01",
    reason="customer grain changed from account to legal entity",
)
```

The deprecation record does not delete version 1 or rewrite consumers. It gives project builds and downstream tools enough evidence to warn, block new references, and coordinate removal according to policy.

## Reference-level explanation (precise rules)

### Asset interface identity

An asset interface identity must include:

- canonical asset identity from IncQL RFC 058
- asset version
- interface schema version

The interface digest must include all normative contract, access, and version facts. Ownership contact changes and other non-semantic metadata may be excluded from the semantic digest if their separate evidence digest remains referenced.

An applied physical object must reference the interface it claims to realize. Physical schema inspection must not replace the declared interface identity.

### Structural output contract

The structural output contract must derive from the checked output carrier and row model and contain at least:

- stable field target ids
- authored field names and aliases
- logical types and nested shapes
- nullability
- field ordering when semantically relevant
- boundedness
- declared relation grain when available
- declared keys and constraints
- required semantic profile

The contract must use IncQL logical types. Destination-native type names may appear in lowering plans and coverage evidence, but they must not be the portable contract.

Every output field in a public contract must have a stable target identity. Renaming a field while preserving identity and providing an admitted alias may be classified differently from removing one identity and adding another.

The checked implementation must produce an output compatible with its declared structural contract before materialization. A mismatch must fail project compilation or preflight validation.

### Declared and assured guarantees

The interface may include or reference:

- constraint claims from IncQL RFC 045
- quality assertions from IncQL RFC 034
- governed attributes and policy requirements from IncQL RFC 035
- lineage and source requirements from IncQL RFC 030
- semantic and equality profiles from IncQL RFCs 040 and 043
- verification requirements and observations
- imported contract evidence from IncQL RFC 046

Each guarantee must preserve its evidence status. At minimum, tools must distinguish:

- declared
- destination-defined but not enforced
- destination-enforced
- observed
- verified
- proven
- waived
- unknown

An interface must not collapse those statuses into a boolean `contracted` or `trusted`.

Quality assertions may be part of an interface's required service or admission policy, but a post-build quality observation is not a structural type guarantee.

### Groups and ownership

An asset group must have a stable group id. It may carry owner, description, support, escalation, and metadata references.

Every asset may belong to at most one primary group in one resolved project manifest. Additional topical classifications should use metadata or product-topology evidence rather than ambiguous secondary ownership groups.

Ownership records must identify provenance and authority. A group owner is responsible metadata, not proof that every attached contract or quality claim is true.

Changing an owner must not change the logical asset plan or applied data identity. It must create updated interface or metadata evidence according to the selected digest profile.

### Access levels

The portable access levels are:

| Access | Dependency scope |
| --- | --- |
| `private` | Only assets in the same primary asset group may resolve the reference. |
| `project` | Any asset in the same resolved data project may resolve the reference. |
| `public` | Assets in dependent projects or packages may resolve the reference through an explicit Incan dependency and exported asset interface. |

The default access level must be `project` for compatibility with an initially ungrouped project. Authors should use `private` for new implementation-detail assets.

Access must be checked during project reference resolution. An inaccessible reference must fail project compilation even if the physical destination object happens to be queryable.

Access is not user authorization. A public asset does not grant database `SELECT`; a private asset does not revoke physical permissions. Operational binding and IAM systems may enforce corresponding physical policy, but their evidence remains separate.

An inline asset must still obey access checks. Inlining must not expose a private plan through a consumer that could not legally reference it.

### Asset versions

An asset version must be a positive integer within one canonical asset name for the initial portable profile. A later RFC may add richer version labels without changing the rule that build artifacts contain one resolved immutable version.

Several versions may coexist. Each version must have:

- its own implementation and plan digest
- its own interface contract
- independent materialization intent where needed
- explicit source location
- optional deprecation record

One version may be designated `current` for project-local authoring convenience. The current designation is resolution metadata, not part of the canonical version identity.

A public cross-project reference must either name a version explicitly or resolve through a dependency lock that records the chosen version. Unlocked implicit latest-version resolution must not be used for reproducible builds.

Changing the current designation must not mutate existing manifests, build sets, or applied records.

### Compatibility assessment

A compatibility assessment must compare old and new interface, plan, lineage, materialization, and evidence snapshots and classify each relevant change.

The top-level result must be one of:

- `backward_compatible`
- `conditionally_compatible`
- `breaking`
- `unknown`

The assessment must preserve per-dimension findings rather than reducing all changes to one schema result.

Dimensions must include at least:

- field identity and presence
- logical type and nested shape
- nullability
- grain and key constraints
- ordering guarantees when declared
- semantic profile
- lineage and source dependencies
- quality and verification requirements
- governed attributes and classifications
- access level
- materialization availability and commit guarantee
- plan semantic-change evidence

### Structural compatibility rules

The portable baseline must classify these changes as breaking unless an explicit profile proves compatibility:

- removing a public field identity
- changing a field to an incompatible logical type
- making a previously required output field nullable
- changing nested shape incompatibly
- changing declared grain or entity key
- removing a required constraint or lowering its required assurance
- changing a bounded output to unbounded
- reducing access so an existing consumer scope can no longer resolve the asset

Adding a nullable field is structurally backward compatible for consumers that ignore unknown fields, but may be conditionally compatible for materializations, exact-record encodings, or consumers with closed schemas.

Renaming a field while preserving stable identity and an admitted alias may be conditionally compatible. Removing the old name without migration evidence must be reported.

Changing from nullable to non-null may be structurally compatible for readers but still require build and historical-data verification. The assessment must not claim unconditional compatibility without evidence that existing applied data satisfies the stronger contract.

### Semantic compatibility

A schema-preserving plan change may still be semantically breaking. Examples include changing:

- measure definition
- filter population
- join type or cardinality
- time-zone interpretation
- unit or currency
- business grain
- source authority
- deduplication winner
- incremental or history semantics

IncQL RFC 037 plan diff and IncQL RFC 030 lineage must provide evidence for these dimensions. When IncQL cannot establish semantic compatibility, the result must be `unknown`, not `backward_compatible`.

Authors may explicitly classify a semantic change, but that declaration remains authored evidence and may require review or verification under project policy.

### Version creation

A breaking public interface change must create a new asset version unless all known consumers are updated in the same closed project scope and project policy explicitly permits an in-place break.

A new version may reuse unchanged fields, metadata, assertions, or implementation components by reference, but its resolved interface must be complete and independently inspectable.

Versions of one asset may share an implementation when their interface projections differ. The manifest must still preserve separate version identities and output contracts.

### Deprecation

A deprecation record must contain:

- asset id and version
- deprecation status
- reason
- replacement asset and version when available
- announcement time or project revision
- earliest removal condition
- owner and support reference
- evidence or approval references when required

Deprecation must be append-only evidence. Updating a removal date or replacement creates a successor deprecation record.

Project policy may warn or fail on new dependencies to deprecated versions. Existing consumers must not be silently redirected to a replacement version.

Removal must fail project validation while known in-scope consumers still reference the version unless an explicit waiver or coordinated migration policy admits it.

### Interface and materialization

A materialization plan under IncQL RFC 059 must validate that the physical schema and destination behavior can realize the selected interface.

An applied asset record must identify:

- the exact interface version
- physical schema lowering
- destination constraint coverage
- quality and verification observations
- known deviations or waivers

One logical interface may be applied to several destinations with different physical enforcement. Those applied records share logical meaning but not assurance.

### Interface and tests

IncQL RFC 063 fixture tests may be attached to one asset version or to every version through an explicit selector.

A version must not inherit a test implicitly when its inputs, output type, or expected semantics are incompatible. Shared tests must be resolved and typechecked separately against each selected version.

Test success is execution evidence for the tested fixtures and profile. It must not be promoted to universal semantic compatibility.

### Diagnostics

Interface diagnostics must distinguish at least:

- implementation-output and contract mismatch
- unstable or duplicate field identity
- inaccessible asset reference
- missing or unresolved asset version
- unlocked public version resolution
- breaking structural change
- unknown semantic compatibility
- lowered destination contract
- unenforced required constraint
- deprecated dependency
- removal with active consumers
- invalid group or ownership reference

Diagnostics must identify affected asset versions, fields, consumers, evidence status, and profile where available.

## Design details

### Syntax

This RFC introduces no grammar. Asset interface, group, access, version, and deprecation declarations should first use typed library values and declaration metadata.

The exact spelling of `private`, `project`, `public`, `current`, and version selectors may evolve before Planned status, but the scope and identity distinctions are normative.

### Semantics

An asset interface is a checked dependency contract. It does not guarantee physical availability, freshness, user authorization, or semantic truth beyond its attached assurance evidence.

Versions identify intentional interface generations. Every implementation commit or applied refresh does not create a new asset version; those changes have plan, manifest, build, and applied-record identities.

### Interaction with other IncQL surfaces

IncQL RFC 028 must add asset-interface, group, version, compatibility-assessment, and deprecation targets.

IncQL RFC 029 and RFC 035 carry descriptive and governed metadata without replacing structural contract facts.

IncQL RFC 030 and RFC 037 supply lineage and semantic change evidence.

IncQL RFC 034 and RFC 045 supply quality and constraint declarations plus observed assurance.

IncQL RFC 046 may import external contracts and product topology, but normalized evidence must still map onto this native interface.

IncQL RFC 058 supplies project and asset identity and enforces access during graph resolution.

IncQL RFC 059 and RFC 060 must preserve the selected interface through physical materialization and refresh.

IncQL RFC 062 consumes compatibility and deprecation evidence for state selection, build admission, and deferred reuse.

### Compatibility / migration

Existing typed relational functions already provide a structural starting point. Adopting this RFC assigns stable asset and field identities and records explicit access and version state around them.

An unversioned named asset may migrate to version 1 without changing its implementation. Existing project-local references may resolve to version 1 during a declared migration window, but the resulting manifest must record version 1.

Existing warehouse contracts may be imported as evidence through IncQL RFC 046. Platform-native types and constraints must be normalized to IncQL logical types and assurance states rather than copied as authoritative native contracts.

## Alternatives considered

- **Use warehouse schema as the contract.** Rejected because it is environment-specific, appears after lowering, and cannot represent full semantic intent or portable assurance.
- **Duplicate every field contract in YAML.** Rejected because the checked output row model should remain the structural source and duplicated declarations drift.
- **Treat access as database authorization.** Rejected because project dependency resolution and human/runtime permissions are separate systems.
- **Use package version as asset version.** Rejected because one package may contain many assets with independent breaking lifecycles.
- **Resolve every unpinned reference to latest.** Rejected because builds would change when producers move a pointer.
- **Classify compatibility from columns only.** Rejected because grain, filters, joins, sources, units, quality, policy, and materialization can break consumers without a schema change.
- **Replace an old version in place.** Rejected for public breaking changes because consumers need an explicit migration interval.

## Drawbacks

- Stable field identity and semantic compatibility require more discipline than schema-by-name.
- Coexisting versions increase materialization, documentation, and maintenance cost.
- Semantic compatibility can remain unknown despite complete structural information.
- Project access levels add another policy layer beside package exports and physical IAM.
- Ownership and deprecation metadata can become stale without operational governance.

## Implementation architecture

This section is non-normative. Interface records can derive structural fields from Incan model metadata, then attach normalized constraint, quality, governance, lineage, and profile records by target id. Compatibility tooling can layer structural comparison over RFC 037 plan diffs and emit a typed per-dimension assessment consumed by project builds and documentation.

## Layers affected

- **IncQL specification** must define interface identity, structural contracts, assurance, groups, access, versions, compatibility, and deprecation.
- **IncQL library package** must expose declarations, reference resolution, comparison, inspection, and deprecation records.
- **Incan compiler and package tooling** must preserve stable model-field metadata, checked exports, package dependencies, and declaration versions; new grammar is not required by this RFC.
- **Execution / interchange** must preserve interface identities and report physical lowering and enforcement coverage.
- **Documentation and tooling** must present structural, semantic, access, ownership, version, compatibility, and assurance facts without conflating them.

## Unresolved questions

- Is a positive integer sufficient as the only portable asset-version form, or should the first contract admit semantic labels?
- Should the default access level remain `project`, or should projects opt into a stricter default once groups are declared?
- Which field-identity metadata must Incan model declarations expose to make rename compatibility reliable?
- Which semantic changes can IncQL classify automatically rather than reporting unknown?
- How should removal conditions reference dates, package versions, project revisions, and consumer acknowledgements portably?
- Can one logical asset name change row model types across versions while preserving ergonomic typed reference syntax?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->

<!-- References -->

[dbt-model-access]: https://docs.getdbt.com/docs/mesh/govern/model-access
[dbt-model-contracts]: https://docs.getdbt.com/docs/mesh/govern/model-contracts
[dbt-model-versions]: https://docs.getdbt.com/docs/mesh/govern/model-versions
