# IncQL RFC 053: Schema observation, reconciliation, and normalization

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 000 (core schema shapes and layer boundaries)
  - IncQL RFC 001 (dataset carriers and schema surfaces)
  - IncQL RFC 010 (CSV dialect and interpretation contract)
  - IncQL RFC 020 (nested data functions)
  - IncQL RFC 026 (semi-structured variant logical values)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 029 (typed metadata attachments)
  - IncQL RFC 034 (quality assertions and observations)
  - IncQL RFC 036 (governed plan bundle)
  - IncQL RFC 043 (canonical equality and digest profiles)
  - IncQL RFC 045 (constraint evidence and verification-aware planning)
  - IncQL RFC 046 (data contract ingress and product topology)
  - IncQL RFC 051 (native ingestion program and ownership boundary)
  - IncQL RFC 052 (declarative sources, resources, and connector packages)
  - IncQL RFC 055 (destination loading, write dispositions, and commit semantics)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines how native IncQL ingestion observes source shape, reconciles it with declared types and imported contracts, and deterministically normalizes records into relational outputs. Schema inference is evidence about sampled or extracted data; it must not silently become type authority. The contract distinguishes declared, planned, observed, normalized, and destination schemas; defines exact, minimum-guarantee, evolve-by-decision, and discovery-only modes; and requires explicit treatment of additional fields, incompatible values, nested structures, dynamic tables, and schema migration proposals.

## Core model

1. The **declared schema** is the author-approved Incan model or equivalent typed contract used by IncQL authoring.
2. The **planned schema** is the shape IncQL can establish before extraction from declarations, connector metadata, and admitted contracts.
3. The **observed schema** is evidence derived from bounded discovery, samples, or extracted batches.
4. The **normalized schema** is the deterministic relational shape produced after applying a versioned normalization profile.
5. The **destination schema** is the shape currently present at a selected sink and is runtime evidence, not authoring authority.
6. A **schema reconciliation decision** records how differences between those layers are handled.
7. A **normalization profile** determines how nested, variant, missing, and incompatible values map into typed relations.

## Motivation

Ingestion begins at an unstable boundary. APIs add fields, databases change column types, files contain mixed representations, and nested objects do not always map naturally to one table. A system that automatically evolves destination schema from whatever it most recently observed is convenient, but it weakens IncQL's typed contract and makes schema changes difficult to review before they affect consumers.

The opposite extreme is also insufficient. Requiring a complete closed model before any source can be inspected makes unfamiliar systems cumbersome to adopt and prevents tooling from generating useful candidate schemas. IncQL needs a staged authority model: discovery can observe and propose; authors or policy can admit a schema; typed planning uses admitted declarations; runtime reconciliation checks actual data; and destination migration follows an explicit decision.

Normalization needs the same discipline. Unnesting every list into a child table, preserving every nested value as a variant, or silently creating type-specific columns are all defensible in some contexts and wrong in others. IncQL should make the choice explicit, versioned, deterministic, and visible in evidence.

## Goals

- Define declared, planned, observed, normalized, and destination schema layers.
- Define schema observation as evidence with scope, sample limits, provenance, confidence, and digest.
- Define schema modes for exact contracts, minimum guarantees, explicit evolution, and discovery-only resources.
- Require explicit reconciliation decisions for new fields, missing fields, nullability changes, type changes, and incompatible values.
- Define deterministic normalization profiles for structs, lists, maps, variants, and nested child relations.
- Produce reviewable schema diffs and migration proposals before destination mutation.
- Compose with Incan models, relational evidence, quality assertions, constraints, and imported data contracts.

## Non-Goals

- Defining connector discovery or extraction protocols; IncQL RFC 052 owns them.
- Defining destination transaction and migration execution; IncQL RFC 055 owns it.
- Defining operational quarantine destinations, approval workflows, or retry policy.
- Guaranteeing that finite sampling discovers every field or value type present in a source.
- Defining one universal locale, timestamp, decimal, or string-coercion profile for every source.
- Automatically rewriting author-owned model declarations when drift is observed.
- Treating an imported contract as proof that source data satisfies it.

## Guide-level explanation (how authors think about it)

An author can begin with a declared model and ask IncQL to compare observed source shape against it.

```incan
from pub::incql.ingest import ExactSchema, observe_schema
from models import Issue

issues = github.resource[Issue](
    name="issues",
    path="repos/{owner}/{repo}/issues",
    schema=ExactSchema(),
)

observation = observe_schema(issues, max_items=500)?
diff = observation.compare_to[Issue]()
println(diff.status)
```

If the source contains a new `milestone_title` field, the observation records it. Exact mode does not add the field to `Issue`, expose it as a typed query column, or migrate a destination table. The author can update the model, select a minimum-guarantee mode that preserves extras through an explicit variant field, or reject the source change.

For an unfamiliar source, discovery can generate a candidate model artifact:

```incan
candidate = github.resource("issues").discover_schema(max_pages=3)?
candidate.write_model_candidate("generated/issue_candidate.incn")?
```

The generated file is a proposal. It must be admitted through ordinary source review before it becomes the declared row type of a typed resource.

Nested data follows a named normalization profile:

```incan
profile = normalization_profile(
    structs="preserve",
    lists="child_relation",
    variants="typed_variant",
    max_child_depth=2,
)

plan = issues.normalize_with(profile)
```

Inspection can show that `labels` becomes a child relation, which keys connect it to `issues`, which fields remain nested, and which values could not be represented under the selected profile.

## Reference-level explanation (precise rules)

### Schema layers

Every schema record must identify its schema layer, target resource or relation, version, digest profile, field identities, field order when meaningful, types, nullability, constraints when known, provenance, observed or declared time, evidence references, and diagnostics.

The layers have distinct authority:

- **Declared schema** is author- or policy-admitted type authority for typed IncQL authoring.
- **Planned schema** is pre-execution analysis and must identify which facts come from declarations, connector metadata, contracts, or prior observations.
- **Observed schema** is runtime or sample evidence and must record observation limits and confidence.
- **Normalized schema** is produced by applying a named, versioned normalization profile to declared and observed inputs.
- **Destination schema** reports the current sink shape and capabilities at one binding snapshot.

No layer may silently overwrite another. A schema reconciliation decision must link the compared versions and describe the resulting action.

### Schema modes

The portable contract must support at least the following modes:

- **Exact**: declared fields, types, nullability, and closed-shape constraints must match according to the selected semantic profile. Additional or incompatible fields are violations.
- **Minimum guarantee**: declared fields are required and type-compatible; additional observed fields are allowed only through an explicit preservation, ignore, or evidence-only policy.
- **Evolve by decision**: observed changes produce a candidate schema and migration proposal, but do not become authoritative until an explicit reconciliation decision accepts them.
- **Discovery only**: the resource may be sampled and inspected without a declared row type, but it must not enter a typed `DataSet[T]` plan until a schema is admitted.

Implementations may expose stricter profiles, but they must not define a default mode that silently accepts all source changes and mutates destination schema.

### Observation evidence

A schema observation must include source and resource identity, connector version, binding snapshot reference, sample or extraction scope, item/page/byte/time limits, observed field paths, inferred types, null and missing evidence, incompatible value evidence, normalization assumptions, confidence, digest, and diagnostics.

Observation from a sample must be distinguishable from observation over a complete bounded extraction. Neither form proves future source stability.

Inference rules must be versioned. Re-running the same sample under a different inference profile must produce a new observation identity even when the resulting field list is equal.

### Reconciliation decisions

A reconciliation decision must classify at least:

- new field
- missing declared field
- field rename candidate
- type widening
- type narrowing
- incompatible type change
- nullability widening or narrowing
- precision, scale, timezone, or collation change when relevant
- nested-shape change
- new or removed child relation
- constraint change

Each difference must receive an explicit outcome such as accept into a new declared version, preserve as variant, preserve in an extras field, ignore with evidence, reject row, reject resource, or require review. Implementations must not silently discard rows or values. Any discard outcome must be explicitly selected, counted, and represented in load evidence.

Accepting a candidate schema must produce a new schema identity and version. It must not mutate a prior schema artifact in place.

### Type compatibility

Type compatibility must be evaluated under an explicit semantic profile. Numeric widening, decimal precision, timestamp precision, timezone treatment, string encoding, binary values, enums, missing values, variants, lists, maps, and structs must not inherit hidden backend rules.

When a value cannot be represented by the declared type, normalization must follow the selected reconciliation outcome. It may fail, route the row or value to an explicit rejected-data output, or preserve it in a typed variant representation. It must not coerce to an unrelated type without evidence.

### Normalization profiles

A normalization profile must be versioned and must define at least:

- field-name canonicalization
- path separator and escaping rules
- struct preservation or flattening behavior
- list preservation or child-relation behavior
- map representation
- variant representation
- maximum nested depth
- parent, root, and element identity strategy for child relations
- field-order behavior
- missing and null handling
- incompatible-value handling
- dynamic table or relation routing policy

Equivalent input under the same schema, semantic profile, and normalization profile must produce the same normalized relation names, field names, child relationships, and schema digests.

### Nested child relations

When a list or repeated object becomes a child relation, the normalized schema must identify the parent relation, parent identity field or generated parent identity, root identity when applicable, element ordinal when order is preserved, and source field path.

Generated relationship fields must be collision-safe and must not masquerade as source-provided fields. Their provenance must be visible through metadata and lineage evidence.

Deleting or replacing parent rows must define how associated child rows are handled. Destination enforcement belongs to IncQL RFC 055, but the normalized relationship and required capability must be present in the ingestion plan.

### Dynamic relations

Routing records into dynamically named relations must require an explicit bounded naming rule, sanitization profile, and capability requirement. Unbounded creation of destination tables from arbitrary source values must not be portable default behavior.

Dynamic relation names must preserve source value provenance without exposing secret or sensitive values in identifiers. Unsupported or invalid names must produce diagnostics rather than backend-dependent sanitization.

### Schema diffs and migration proposals

A schema diff must be a deterministic artifact over identified schema versions. It must include added, removed, changed, and ambiguous fields or relations; compatibility classification; affected constraints; normalization changes; evidence references; and unsupported comparisons.

A migration proposal may be derived from an accepted reconciliation decision, but it is not a destination mutation. IncQL RFC 055 defines when and how a destination applies that proposal.

### Quality, constraints, and contracts

Schema violations may generate quality assertions or observations under IncQL RFC 034 and constraint evidence under IncQL RFC 045. Schema reconciliation must not replace those evidence families with unstructured messages.

Imported contracts under IncQL RFC 046 may supply declared expectations and source bindings. They remain attested evidence until verification proves that observed source data satisfies them.

## Design details

### Syntax

This RFC introduces no grammar. Schema modes, observation profiles, reconciliation decisions, and normalization profiles should be typed values and artifacts before any dedicated syntax is considered.

### Semantics

Inference observes; declarations authorize; reconciliation decides; normalization maps; destination loading commits. Implementations must preserve those boundaries even when they optimize the data path.

### Interaction with other IncQL surfaces

IncQL RFC 000 provides the exact and minimum-required schema concepts used by typed query planning.

IncQL RFC 001 provides carrier schema surfaces. A typed carrier must not expose observed extra fields as declared columns unless a reconciliation decision admits them.

IncQL RFC 026 provides the typed variant value model used when a normalization profile preserves heterogeneous values.

IncQL RFCs 028 through 036 provide semantic targets, metadata, quality, policy, and governed bundle records for schema evidence.

IncQL RFC 043 provides canonical digest profiles. Schema digests must identify their canonicalization profile rather than hash unstable serialization.

IncQL RFC 055 consumes accepted migration proposals and normalized relation topology when loading destinations.

### Compatibility / migration

Existing file reads that infer only CSV header names may continue as a limited planned-schema profile. They must not be presented as full type inference or as proof that later rows satisfy the header-derived shape.

Existing destination tables remain valid. Native ingestion must inspect and compare them before applying migrations under the new contract.

## Alternatives considered

- **Let the destination infer and evolve schema automatically.** Rejected because destination behavior would become the semantic owner and source changes could bypass typed review.
- **Require a closed model before any source access.** Rejected because discovery and candidate generation are necessary for unfamiliar sources.
- **Treat samples as complete schema truth.** Rejected because finite samples cannot establish absent fields or future value types.
- **Always flatten nested structures.** Rejected because flattening can lose structure, create name collisions, and produce unstable schemas.
- **Always create child tables for nested lists.** Rejected because typed nested and variant values are sometimes the correct portable representation.
- **Silently discard incompatible values.** Rejected because data loss must be an explicit, counted, reviewable decision.

## Drawbacks

- Authors must make more schema decisions than in permissive auto-evolution systems.
- Schema artifacts, profiles, and diffs create versioning obligations.
- Some sources will remain discovery-only until an adequate typed representation is chosen.
- Deterministic nested normalization is a substantial cross-destination conformance burden.
- Explicit incompatibility handling may produce rejected-data outputs that operational layers must manage.

## Implementation architecture

This section is non-normative. A practical implementation can use a schema observer over Arrow-compatible batches, produce candidate Incan models and normalized relation descriptors, and apply reconciliation through immutable schema-version records. Normalization should operate on batches and emit one root relation plus zero or more child batches, preserving source paths and generated relationship metadata for lineage and receipts.

## Layers affected

- **IncQL specification** must define schema-layer authority, observation evidence, reconciliation outcomes, and normalization profiles.
- **IncQL library package** must expose schema observation, comparison, candidate generation, decision, and normalization APIs.
- **Incan compiler and type system** must preserve model field identity, nullability, generic row types, and variant representations used by admitted schemas.
- **Execution / interchange** must validate schema compatibility before load and preserve normalized relation topology across adapters.
- **Documentation and tooling** must present schema diffs, confidence, unsupported evidence, and explicit decisions without implying that inference is authority.

## Unresolved questions

- Which exact type-inference lattice should the first observation profile standardize?
- How should minimum-guarantee schemas preserve additional fields without weakening typed access to declared fields?
- Should candidate model generation preserve source-native names exactly or emit canonical names plus source-name metadata?
- Which nested representation should be the default for lists of objects: typed nested values, child relations, or a profile selected by connector family?
- How should explicit rejected-value and rejected-row outputs be typed and related to operational quarantine handling?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->
