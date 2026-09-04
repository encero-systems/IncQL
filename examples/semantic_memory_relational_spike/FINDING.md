# Relational semantic-memory spike finding

**Status:** constrained positive result

This spike asks one question: does IncQL's relational surface improve the existing in-memory semantic-memory brain, which previously used only Incan models and list scans?

It does, but only as an inspectable read-model layer. It does not replace the brain's admission authority, revision semantics, or retrieval receipt. Two present implementation boundaries prevent it from becoming an executable IncQL-DB prototype today.

## Control and environment

The original `tests/test_brain.incn` was copied unchanged and is the behavioral control. It contains 17 tests.

The stable release control used the official `incan 0.5.1` installer in a fresh temporary toolchain home, with its Incan-owned Rust `1.98.0` toolchain. The installed release successfully baked the current `incql` library provider in both debug and release profiles.

Before this example declared an IncQL dependency, the stable release baked the no-dependency executable and ran all 17 control tests successfully.

The added adapter and its three focused tests type-check successfully against that sealed `incql` provider:

```text
incan check src/relational_adapter.incn
incan check tests/test_relational_adapter.incn
```

## What the adapter adds

`src/relational_adapter.incn` defines typed relational read rows for the existing record families:

- `RevisionRow`
- `ProjectionRow`
- `ScopeRow`
- `LinkRow`

It registers named logical sources and uses `query { }` to describe four formerly linear read shapes:

1. Snapshot-bounded revision lookup.
2. Snapshot-bounded scope lookup.
3. Source-pinned projection selection.
4. Direct provenance predecessor selection.

It also describes a concrete typed graph step: `ScopeRow` joined to another `ScopeRow` through `parent_scope_id`. `attach_selection_plan` pairs an existing `RetrievalRun` with its local `PlanInspection`, without executing a query or mutating the receipt.

Once the execution lane reaches the adapter, this gives a caller a typed query plan with named inputs, filters, output fields, plan nodes, and field lineage. A list scan cannot state or inspect those facts as a first-class artifact. This spike reached type-checking but not plan inspection at runtime.

## Constraint one: cross-family joins do not compile

The normalized form needed by the design is a typed join such as:

```incan
query {
    FROM projections
    JOIN revisions ON .source_reference == revisions.reference
    ...
}
```

Under the current carrier implementation, this is rejected because query-block lowering reaches `LazyFrame[T].join(other: Self)`. The concrete failures were:

```text
expected 'LazyFrame[ProjectionRow]', found 'LazyFrame[RevisionRow]'
expected 'LazyFrame[LinkRow]', found 'LazyFrame[RevisionRow]'
```

Therefore a typed `ProjectionRow -> RevisionRow` or `LinkRow -> RevisionRow` relation cannot yet be expressed as one normalized IncQL plan. The executable adapter deliberately keeps the exact source reference and uses independent typed lookup plans rather than hiding the limitation behind a generic stringly row type.

Same-family traversal works: `ScopeRow -> ScopeRow` produces a checked join plan. Cross-family joins need a richer carrier/output-shape contract before IncQL-DB can use IncQL model instances as genuinely normalized relational families.

## Constraint two: stable integrated execution stops at Oven closure selection

After the example declares its `incql` path dependency, `incan oven bake --project .` detects the provider's shared `adler2` registry closure and succeeds through the executable unified-Cargo fallback. The ordinary `incan test tests` invocation then collects all 20 tests but stops before executing any test body with:

```text
invalid Oven direct-rustc Oven registry Rust dependency: `datafusion` requirement `53` has no compatible receipt-bound Loaf registry leaf; prepare an explicit Oven-native closure
```

This is the receipt-bound shared-provider registry-closure failure tracked by Incan `0.6` issue [#1241](https://github.com/encero-systems/incan/issues/1241). That issue's validated minimal reproduction uses a library consumer that shares `serde`; this test execution path reaches the same reconciliation failure through the much larger `datafusion@53` leaf. The signature is a fail-closed receipt-bound leaf-resolution refusal, not the wall of false type errors associated with state damage. It is also a direct demonstration that the current single `incql` package is too coupled for an embedded dependency: its provider closure includes DataFusion, even though this spike only needs local `LazyFrame` and inspection types.

No Cargo wrapper, ambient artifact store, or source-current authority workaround was used.

## Decision

The relational surface is useful, but its first role is specific:

- IncQL-DB should expose typed record-family relations as read models.
- The semantic-memory store remains authoritative for records, decisions, snapshots, and receipt persistence.
- Prism inspection belongs on the read/query side and can be linked to `RetrievalRun` as evidence.
- Same-family graph traversal is viable now at the plan layer.
- Cross-family typed joins and runtime execution are not yet a valid IncQL-DB foundation.

## What must land before the next executable slice

1. Split the current IncQL root into a small planning core and optional execution packages. The semantic-memory path must not acquire DataFusion, Substrait code generation, or `protoc` by default.
2. Deliver the RFC 119 / [#1012](https://github.com/encero-systems/incan/issues/1012) unified registry-closure work that resolves [#1241](https://github.com/encero-systems/incan/issues/1241) without a user workaround.
3. Extend IncQL's carrier and query-lowering contract so a checked join can combine different typed input models and publish an explicit typed output shape.
4. Add an IncQL-DB in-memory relation source that can bind these plan roots to actual `RecordRevision`, `ContextProjection`, `MemoryScope`, and `EvidenceLink` values without making mutable brain lists the database boundary.

The next spike should wait for those prerequisites. It should then run the same 17-test control unchanged, execute the relational adapter, and compare its `PlanInspection`/lineage receipts with the original list-scan read paths.
