# IncQL RFC 063: Typed relational fixtures and expected-result testing

- **Status:** Draft
- **Created:** 2026-07-11
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 001 (dataset carriers and boundedness)
  - IncQL RFC 004 (execution context and Session)
  - IncQL RFC 007 (Prism logical planning and optimization engine)
  - IncQL RFC 028 (semantic identity and target model)
  - IncQL RFC 030 (Prism lineage graph)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 034 (quality assertions and observations)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 042 (async verification evidence)
  - IncQL RFC 043 (canonical equality and digest profiles)
  - IncQL RFC 044 (verifier statements and proof artifacts)
  - IncQL RFC 045 (constraint evidence and verification-aware planning)
  - IncQL RFC 058 (data projects, named relational assets, and the asset graph)
  - IncQL RFC 061 (asset interfaces, contracts, access, ownership, versions, and deprecation)
  - IncQL RFC 062 (project build lifecycle, selectors, state, artifacts, and delegated execution)
- **Issue:** —
- **RFC PR:** [IncQL #98](https://github.com/encero-systems/IncQL/pull/98)
- **Written against:** Incan v0.4.0
- **Shipped in:** —

## Summary

This RFC defines pre-materialization unit testing for named relational assets using typed input fixtures, the same Prism plan as production, explicit environment and nondeterminism bindings, typed expected results or verifier statements, canonical comparison profiles, and immutable test observations. A fixture test must declare every substituted direct input and must reject unresolved live dependencies by default. Exact, unordered, ordered, subset, predicate, digest, and verifier-backed expectations must remain distinct. Fixture tests validate transformation behavior for bounded examples; they do not replace post-build data quality assertions, integration tests against live systems, destination contract coverage, or universal semantic proof.

## Core model

1. A **relational fixture** is a bounded typed dataset with stable schema, provenance, content identity, redaction policy, and optional human-readable source form.
2. A **fixture binding** substitutes one external relation or upstream relational asset reference with one compatible fixture for a test run.
3. A **fixture test** targets one resolved relational asset version and defines its fixture bindings, environment bindings, expectation, comparison profile, and required execution profile.
4. An **expected result** is a typed bounded relation or structured assertion describing acceptable output.
5. A **comparison profile** defines row ordering, field selection, null, NaN, decimal, timestamp, collation, nested-value, and tolerance semantics.
6. A **test plan** combines the production Prism plan with fixture substitutions and verification work without creating an alternate transformation implementation.
7. A **test observation** records the target, plan, fixtures, profiles, runtime coverage, outcome, differences, diagnostics, and redaction posture.

## Motivation

Data quality tests over materialized tables are necessary but late. A transformation can be logically wrong, materialize successfully, and only then reveal an error through carefully chosen production data. Authors need fast examples that prove joins, filters, null handling, aggregations, windows, nested values, and edge cases before a destination is mutated.

dbt [unit tests][dbt-unit-tests] provide valuable workflow prior art: static inputs replace model references, an expected output is evaluated before materialization, and a failed unit test can block the target build. Their limitations follow from SQL and warehouse coupling: tests support only selected model forms, fixtures carry adapter caveats, and comparison behavior depends on generated SQL and destination semantics.

IncQL already has typed model values, Prism plans, a local DataFusion reference backend, canonical equality profiles, semantic profiles, verification evidence, and a Session boundary. A native fixture test can therefore use checked row models and execute the same relational semantics without requiring Python, Spark, a warehouse, or a second test implementation.

The boundary with quality must remain explicit. A fixture test asks whether one transformation produces the expected result for controlled bounded inputs. An IncQL RFC 034 assertion asks whether an actual dataset satisfies a quality rule. Passing one does not imply passing the other.

## Goals

- Define typed bounded fixtures for relational asset inputs and expected outputs.
- Require fixture bindings to typecheck against the input interface they replace.
- Execute the same Prism plan used by the production asset.
- Define exact, unordered, ordered, subset, predicate, digest, and verifier-backed expectations.
- Use explicit canonical equality and semantic profiles.
- Bind or reject clocks, randomness, environment values, volatile metadata, and other nondeterministic inputs.
- Emit immutable structured test observations and bounded difference evidence.
- Run locally before materialization and integrate with IncQL RFC 062 build gates.
- Support shared tests across compatible asset versions while resolving each version independently.
- Preserve adapter-specific and portable test coverage separately.

## Non-Goals

- Replacing IncQL RFC 034 data quality assertions over actual datasets.
- Proving correctness for all possible inputs from finite fixtures alone.
- Defining a general-purpose Incan test framework.
- Requiring a live destination or warehouse for portable fixture tests.
- Mocking arbitrary external side effects or operational workflows.
- Defining connector contract tests, destination conformance tests, or performance benchmarks.
- Treating snapshot-file approval as equivalent to semantic review.
- Allowing untyped JSON blobs to bypass model and schema checking.
- Persisting sensitive fixture or difference payloads without explicit retention policy.

## Guide-level explanation (how authors think about it)

An author can define a small typed input and expected output:

```incan
from pub::incql import Session
from pub::incql.testing import fixture_test, unordered_rows
from models import CustomerSummary, Order

orders_fixture = Session.from_values([
    Order(id=1, customer_id=10, amount=20, status="paid"),
    Order(id=2, customer_id=10, amount=30, status="paid"),
    Order(id=3, customer_id=11, amount=99, status="cancelled"),
])

expected = Session.from_values([
    CustomerSummary(
        customer_id=10,
        order_count=2,
        lifetime_value=50,
    ),
])

customer_summary_test = fixture_test(
    name="customer_summary_excludes_cancelled_orders",
    target=project.asset_ref("commerce.customer_summary", version=2),
    inputs={
        orders: orders_fixture,
    },
    expected=expected,
    comparison=unordered_rows(),
)
```

The test compiles the production `commerce.customer_summary` Prism plan and substitutes the `orders` read root with the fixture. No warehouse table is created.

Ordering is explicit. If the asset promises ordered output, the test may use `ordered_rows()`. If order is not part of the interface, `unordered_rows()` compares row multiplicities without treating backend output order as meaning.

A test may use structured assertions instead of enumerating every output row:

```incan
customer_totals_test = fixture_test(
    name="customer_totals_preserve_grain",
    target=customer_summary,
    inputs={orders: orders_fixture},
    expect=all_of([
        row_count(1),
        unique(["customer_id"]),
        field_value("lifetime_value", 50),
    ]),
)
```

Those expectations remain test-local verifier statements. They do not become global quality claims unless separately declared under IncQL RFC 034.

## Reference-level explanation (precise rules)

### Test scope

A fixture test must target:

- one canonical relational asset id
- one resolved asset version
- one project manifest or compatible asset bundle
- one authored Prism plan identity

A test must not target an ambiguous current or latest alias in its resolved artifact. Authoring may use such an alias only when project compilation records the selected version.

Tests may target logical-only, inline, view, table, incremental, history, or managed assets because the test evaluates relational meaning before physical materialization. Materialization-specific conformance remains outside this RFC.

### Fixture identity and schema

A relational fixture must contain or reference:

- fixture id and schema version
- row model and logical schema
- boundedness
- canonical content digest or explicit unknown digest status
- source form and provenance
- row count when known
- semantic and equality profile
- redaction and retention policy
- diagnostics and truncation status

A fixture must be bounded. Unbounded streams require a separately defined bounded event-window or stream-test contract.

The fixture schema must typecheck against the input interface it replaces. Field aliases or compatibility coercions may be applied only through explicit profile-backed conversion evidence.

An empty fixture is valid when its row model supplies a complete schema.

### Fixture sources

Portable fixture sources may include:

- checked inline Incan model values
- a schema-bearing virtual table
- Arrow or Parquet data with a declared model mapping and digest
- another immutable fixture artifact
- a generated fixture with generator identity, input digest, and deterministic seed

CSV, JSON, or other weakly typed source forms may be used only after explicit parsing and schema admission. The parsed typed fixture, not the source text alone, is the test input.

A live table or API response is not a unit fixture by default. A test that explicitly observes live data must be classified as an integration or observation test and must not claim portable fixture-test semantics.

### Fixture bindings

Every direct external relation or upstream asset dependency reached by the target Prism plan must be:

- replaced by a compatible fixture binding
- replaced by a declared test double contract
- explicitly admitted as a live dependency under a non-unit test profile

The default fixture-test profile must reject unbound live dependencies.

A fixture binding must identify the original read-root or asset-reference target and the replacement fixture. Substitution must occur at the logical binding boundary, not by rewriting generated SQL strings.

Fixture substitution must preserve:

- expected row type and field identities
- boundedness requirements
- semantic profile requirements
- lineage from fixture fields into the test plan
- diagnostic references to the original dependency

A fixture must not gain access to private asset implementation details that the target asset itself could not reference.

### Production-plan fidelity

The test plan must use the same authored Prism plan as the selected relational asset version.

The implementation may apply test-specific physical planning and safe logical optimization, but it must preserve authored plan identity and record any rewritten plan digest.

The test must not call a separate author-maintained `test implementation` of the transformation.

If the production asset performs an inadmissible external effect inside its relational body, project compilation or fixture planning must reject it. Fixture testing must not silently skip arbitrary effects.

### Environment and nondeterminism bindings

A test plan must identify and bind or reject nondeterministic inputs, including as applicable:

- current time and timezone
- random values and seeds
- environment variables
- current user or session identity
- locale and collation
- backend-specific metadata
- volatile functions
- unordered input assumptions

The default portable profile must reject unbound nondeterminism that can affect the expected result.

Generated fixtures and randomized property-style tests must record the seed and generator version. A failing generated case must be reproducible from recorded evidence when possible.

### Expectation kinds

The portable expectation kinds are:

| Expectation | Meaning |
| --- | --- |
| `exact_relation` | Actual output must equal the expected typed relation under the selected comparison profile. |
| `unordered_multiset` | Row order is ignored, but duplicate multiplicity is preserved. |
| `ordered_sequence` | Row order is semantically compared under the declared ordering and value profile. |
| `field_subset` | Only declared output fields participate; ignored fields and justification are recorded. |
| `predicate_set` | Structured row, aggregate, schema, or relation predicates must all produce admitted observations. |
| `digest_match` | Actual and expected canonical digests must match under one explicit digest profile. |
| `verifier_statement` | A verifier statement or proof backend evaluates the expected claim and returns typed evidence. |

An expectation must not infer order significance from incidental backend output.

An expected relation must have a schema compatible with the target output interface or with an explicit field-subset projection.

Predicate-set expectations must use typed IncQL RFC 034 assertions or IncQL RFC 044 verifier statements where applicable. A textual assertion description is not executable semantics.

### Comparison profiles

Every relation comparison must name or embed an IncQL RFC 043 canonical equality profile.

The profile must define as applicable:

- row ordering significance
- duplicate multiplicity
- field selection and ordering
- null equality
- NaN and infinity behavior
- decimal scale, precision, and rounding
- floating tolerance
- timestamp precision and timezone normalization
- string collation and case behavior
- nested list, map, struct, and variant comparison
- canonical serialization and digest algorithm

Default comparison must be strict logical equality with unordered row multiset semantics unless the asset interface declares order as part of its output contract.

Approximate numeric comparison must be opt-in and must record absolute, relative, or domain-specific tolerance.

### Difference evidence

A failed relation comparison should produce bounded structured difference evidence containing:

- missing expected rows
- unexpected actual rows
- multiplicity differences
- field-level value differences
- ordering differences
- schema differences
- profile and canonicalization diagnostics

Difference payloads must be bounded by row, byte, and field limits. Truncation must be explicit.

Sensitive values must follow fixture and project redaction policy. A failure report must not reveal protected values merely because the test failed.

Digest-only or redacted comparisons may report a mismatch without row payloads.

### Test planning

Fixture-test planning must validate:

- target project, asset, and version identity
- target implementation and interface compatibility
- complete fixture or admitted live binding coverage
- fixture schemas and field identities
- nondeterminism bindings
- runtime and function capability coverage
- comparison and semantic profiles
- expectation schema and verifier availability
- redaction, retention, and difference limits

Unknown required coverage must not be reported as a valid portable test plan.

Planning must not mutate a destination or resolve unrelated production credentials.

### Execution profiles

A portable fixture test should execute on the local reference backend when the Prism plan and functions have covered semantics there.

Tests may request another compute runtime or semantic profile to verify backend-specific behavior. The observation must distinguish:

- portable logical test outcome
- adapter-specific conformance outcome
- unsupported or partially covered execution

Success on one adapter must not imply success under every semantic profile.

The test runtime must not materialize the target's configured production destination. Temporary or in-memory physical work must be isolated under the test plan and recorded when relevant.

### Test observations

Every fixture-test attempt must emit a typed observation containing or referencing:

- test id, name, and schema version
- project manifest and target asset version
- authored and executed Prism plan digests
- fixture ids, schemas, content digests, and bindings
- environment and nondeterminism bindings
- expectation and comparison profile
- runtime, adapter, component, and semantic profile
- capability coverage
- status and timing
- expected and actual row counts when available
- bounded difference evidence
- verifier, proof, quality, or constraint evidence
- redaction and retention posture
- diagnostics, trace references, and supersession

Status must distinguish at least:

- `passed`
- `failed`
- `error`
- `unsupported`
- `incomplete`
- `unknown`
- `skipped`

A runtime error must not be reported as a failed semantic expectation. Unsupported coverage must not be reported as a passing skipped test.

Observations must be append-only. Updating fixtures or expectations creates a new test-plan and observation identity.

### Build integration

IncQL RFC 062 must run required fixture tests before materializing their target asset.

A failed, errored, unsupported, incomplete, or unknown required fixture test must block the target unless an explicit gate or waiver admits that outcome.

A passing test admits only the selected build transition under the declared policy. It does not certify all data, all backends, or all future versions.

Indirect test selection must record why the test was included and which target or downstream nodes it gates.

### Versioned assets and shared tests

A fixture test may target one explicit asset version or a structured version selector.

When one declaration selects several versions, project compilation must instantiate and typecheck an independent test plan for each version. A shared name must not hide version-specific fixture or expectation incompatibility.

A new asset version must not inherit prior test success. It may reuse the test declaration and fixtures, but it must produce new observations against its own plan and interface.

### Fixture governance

Fixtures may contain synthetic, sampled, anonymized, or production-derived values. Their provenance and retention policy must identify which.

Production-derived fixtures must record redaction or transformation evidence and must not be persisted in source control or ordinary artifacts unless policy permits it.

Fixture generation by an agent or model creates a proposal. Runtime typechecking and test execution remain authoritative for whether the fixture is usable; generated examples do not become approved expected semantics solely because they compile.

### Diagnostics

Fixture-test diagnostics must distinguish at least:

- unresolved or incompatible target version
- missing direct fixture binding
- fixture schema mismatch
- inaccessible dependency
- unbound nondeterminism
- unsupported function or runtime capability
- expected-output schema mismatch
- invalid comparison profile
- bounded difference truncation
- redaction or retention violation
- verifier unavailable
- runtime execution error
- expectation mismatch

Diagnostics must preserve target, fixture, plan, profile, runtime, and observation identities.

## Design details

### Syntax

This RFC introduces no grammar. Fixture, binding, expectation, comparison, and test declarations should first be typed Incan library values.

`Session.from_values` is the intended ergonomic path for checked inline fixtures once its canonical Incan-to-Arrow row encoding is available. Other fixture sources must lower to the same typed logical binding contract.

### Semantics

A fixture test is a bounded experiment over one production relational plan. Its evidence is scoped to the fixtures, bindings, runtime, profiles, and test version that produced it.

Fixture expected results are authored claims. Passing execution verifies those claims for the selected examples; it does not make them universal data contracts.

### Interaction with other IncQL surfaces

IncQL RFC 004 supplies the local Session binding and execution boundary.

IncQL RFC 030 must preserve fixture-origin lineage through substituted read roots.

IncQL RFC 034 remains the data quality assertion model. This RFC may execute assertion-shaped expectations but must preserve their test-local scope.

IncQL RFC 040 and RFC 043 supply semantic and equality profiles.

IncQL RFC 044 and RFC 045 supply verifier statements, proof artifacts, and constraint evidence for richer expectations.

IncQL RFC 058 supplies target asset and dependency identities.

IncQL RFC 061 supplies the versioned output contract used to typecheck fixtures and expectations.

IncQL RFC 062 selects, orders, gates, and records fixture tests within project builds.

### Compatibility / migration

Existing Incan tests that construct a `DataSet[T]` and compare collected values remain valid. They may migrate to fixture-test artifacts when they need project selection, asset-version targeting, build gating, or portable evidence.

Existing data-quality assertions should remain under IncQL RFC 034. They must not be relabeled as unit tests merely because they use small data.

Existing golden files may become expected-relation fixtures after schema admission, canonical profile declaration, content digesting, and review provenance are explicit.

## Alternatives considered

- **Run only post-materialization data tests.** Rejected because logic errors should be caught before destination mutation and controlled edge cases need small fixtures.
- **Maintain a separate test implementation of each transformation.** Rejected because production and test logic would drift.
- **Compare generated SQL strings.** Rejected because SQL is backend-specific physical output and does not establish relational result semantics.
- **Use untyped JSON fixtures.** Rejected because fixtures must respect the same model and schema contracts as production inputs.
- **Treat row order as always significant.** Rejected because many relational results have no semantic order.
- **Treat row order as never significant.** Rejected because ordered assets and windowed outputs may declare order guarantees.
- **Permit live dependencies by default.** Rejected because unit tests would become environment-dependent and potentially mutating.
- **Store unlimited failing rows.** Rejected because differences can be large or sensitive.
- **Treat test success as certification.** Rejected because finite fixtures provide scoped evidence, not universal proof.

## Drawbacks

- Typed fixtures can be verbose for wide or deeply nested models.
- Canonical comparison profiles add concepts that simple equality assertions avoid.
- Large expected relations may create expensive artifacts and reviews.
- Strict live-dependency rejection requires explicit fixtures for every direct input.
- Backend-specific behavior may require a test matrix beyond the local reference runtime.
- Difference redaction can make some failures harder to diagnose.

## Implementation architecture

This section is non-normative. Fixture planning can clone the target's authored Prism plan, replace logical read bindings with schema-bearing virtual tables, bind deterministic environment providers, execute through Session, and lower actual and expected outputs into canonical comparison or verifier plans. Difference evidence should be produced through bounded relational operations rather than unconstrained in-memory formatting.

## Layers affected

- **IncQL specification** must define fixture, binding, expectation, comparison, test-plan, observation, and build-gate semantics.
- **IncQL library package** must expose typed fixture construction, asset test declarations, comparison profiles, execution, differences, and inspection.
- **Incan compiler and package tooling** must support canonical model-value reflection and row encoding needed for inline fixtures; new test grammar is not required by this RFC.
- **Execution / interchange** must preserve fixture bindings, semantic profiles, plan identity, adapter coverage, and bounded difference evidence.
- **Documentation and tooling** must distinguish fixture tests, data quality assertions, integration tests, adapter conformance, and proofs.

## Unresolved questions

- Which expectation kinds are required for the first implementation beyond exact unordered relation comparison?
- Should inline fixture declarations support a dedicated concise syntax after the typed library path is proven?
- What canonical field identity and row encoding must `Session.from_values` expose for nested and variant values?
- How should snapshot or golden expected results be reviewed and updated without turning approval into an untracked file replacement?
- Which nondeterministic functions require built-in test binding providers?
- What bounded difference defaults balance diagnosis, performance, and data protection?
- Should property-based fixture generators be part of this RFC's first release or a later testing extension?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->

<!-- References -->

[dbt-unit-tests]: https://docs.getdbt.com/docs/build/unit-tests
