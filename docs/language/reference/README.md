# Reference

Reference pages describe IncQL's current public contracts. Use them when you need an exact type, signature, clause, record field, support boundary, or portability rule. If you are still deciding what to build, begin with [Learn][learn] or an outcome in [Guides][guides].

## Language and relational authoring

- [Dataset carriers][dataset-carriers] defines `DataSet`, `DataFrame`, `LazyFrame`, and `DataStream`.
- [Dataset methods][dataset-methods] lists relational operations shared across carrier families.
- [Query blocks][query-blocks] defines clauses, expression resolution, aliases, and lowering behavior.
- [Filter builders][filter-builders], [projection builders][projection-builders], and [aggregate builders][aggregate-builders] define programmatic expression construction.

## Runtime and I/O

- [Execution context][execution] defines Session construction, logical-name registration, source reads, execution, collection, writes, observations, and adapter coverage.
- [Backend capability matrix][capabilities] summarizes what is executable today, what is plan-only, and which facts remain adapter-dependent.

Application developers should normally start here before reading interchange contracts.

## Inspection, quality, and governance

- [Inspection][inspection] defines structured plan, schema, lineage, requirement, and artifact records available before execution.
- [Quality][quality] defines typed assertions and quality observations.
- [Governance][governance] defines governed attributes and policy-checkpoint evidence.
- [Governed plan bundles][governed-plan-bundles] define the typed local handoff that keeps a plan and its evidence-section states together.
- [Plan diffs][plan-diffs] define local semantic-change records and blast-radius input artifacts.

These APIs produce evidence. They do not silently make caller-owned enforcement or publication decisions.

## Function catalog

[Function Reference][functions] indexes scalar, aggregate, generator, sketch, formatting, nested, variant, and window helpers. Each family page states its expression shape and any current adapter boundary.

## Interchange and adapter authoring

This advanced track is for adapter, platform, portability, and conformance work:

- [Substrait conformance][substrait] defines the portable logical boundary and scenario coverage.
- [Operator catalog][operators] maps IncQL relational operations to Substrait relations.
- [Read-root binding contract][read-roots] separates logical plan identity from Session-owned source binding.
- [Revision and extension policy][extensions] defines compatibility rules for Substrait revisions and extension identities.

These pages are not prerequisites for ordinary query authoring. Read [What IncQL is — and is not][ownership] or [Architecture][architecture] first if the ownership boundary is unfamiliar.

<!-- References -->

[aggregate-builders]: builders/aggregates.md
[architecture]: ../../architecture.md
[capabilities]: capabilities.md
[dataset-carriers]: dataset_carriers.md
[dataset-methods]: dataset_methods.md
[execution]: execution_context.md
[extensions]: substrait/revision_and_extension_policy.md
[filter-builders]: builders/filters.md
[functions]: functions/index.md
[governance]: governance.md
[governed-plan-bundles]: governed_plan_bundles.md
[guides]: ../how-to/README.md
[inspection]: inspection.md
[learn]: ../README.md
[operators]: substrait/operator_catalog.md
[ownership]: ../explanation/what_incql_is.md
[plan-diffs]: plan_diffs.md
[projection-builders]: builders/projections.md
[quality]: quality.md
[query-blocks]: query_blocks.md
[read-roots]: substrait/read_root_binding_contract.md
[substrait]: substrait/conformance.md
