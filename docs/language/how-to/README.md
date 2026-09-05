# Guides

Guides solve bounded tasks against IncQL's current public surface. Choose the outcome you need; each guide states its prerequisites, a concrete workflow, how to verify the result, current support boundaries, and the exact Reference pages behind the task.

If IncQL is new to you, complete the [ten-minute quickstart][quickstart] first. If you are translating an existing mental model, start from the [SQL bridge][sql-bridge] or [Spark and DataFrame bridge][spark-bridge].

## Start and connect

- [Read and write data][read-write] covers typed CSV, Parquet, and Arrow inputs plus bounded CSV and Parquet outputs.
- [Troubleshoot common setup and execution failures][troubleshooting] separates activation, logical-name, schema, adapter, and observation failures.

## Transform and query

- [Build deferred dataset transformations][dataset-transformations] covers projection, filters, grouping, aggregates, ordering, and limits.
- [Join typed relations][joins] covers inner and left joins through methods and query blocks.
- [Normalize semi-structured fields][normalize-semistructured-fields] turns nested input into an explicit relational shape.
- [Work with nested row values][nested-row-values] accesses typed nested structures.
- [Expand rows with generators][generator-rows] applies relation-aware row expansion.
- [Add window columns][window-columns] builds documented window expressions.

## Inspect and trust

- [Inspect a plan and lineage graph][inspect-plan-lineage] reads authored meaning before execution.
- [Capture execution observations and adapter coverage][execution-observations] records concrete attempts and coverage evidence.
- [Observe data quality checks][quality-observations] evaluates typed assertions without hiding caller-owned policy.
- [Inspect governed evidence][governed-evidence] carries local governance metadata into an explicit decision point.
- [Package a governed plan bundle][governed-plan-bundles] keeps one planned relation and its local evidence together in a typed handoff value.
- [Compare plans and produce blast-radius inputs][plan-diffs] classifies local semantic changes without claiming a global dependency graph.
- [Exchange evidence with adjacent tools][evidence-exchange] projects and imports explicitly scoped evidence without transferring semantic ownership.
- [Assess semantic profiles][semantic-profiles] records the source or target environment behind portability and coverage evidence.
- [Analyze an external plan request][ingress] turns a supported unresolved ingress request into Prism-owned relational evidence.
- [Record and project verification evidence][verification-evidence] keeps assertion, run, observation, assurance, scope, and waiver evidence separate.

## Advanced and capability-dependent

These guides deliberately state their DataFusion boundary before the first example. Consult the [backend capability matrix][capabilities] before choosing one for production work.

- [Estimate approximate metrics][approximate-metrics]
- [Build typed HyperLogLog sketches][typed-hll-sketches]
- [Inspect typed variant payloads][variant-payloads]

## The guide contract

Every task guide answers the same five questions:

1. When should I use this?
2. What must already be true?
3. How do I perform the task?
4. How do I verify the result?
5. What is supported now, and where is the exact contract?

This structure is intentional: a code sample without a verification step or a capability boundary is not a complete IncQL guide.

<!-- References -->

[approximate-metrics]: approximate_metrics.md
[capabilities]: ../reference/capabilities.md
[dataset-transformations]: dataset_transformations.md
[execution-observations]: execution_observations.md
[evidence-exchange]: evidence_exchange.md
[generator-rows]: generator_rows.md
[governed-evidence]: governed_evidence.md
[governed-plan-bundles]: governed_plan_bundles.md
[inspect-plan-lineage]: inspect_plan_lineage.md
[ingress]: ingress.md
[joins]: joins.md
[nested-row-values]: nested_row_values.md
[normalize-semistructured-fields]: normalize_semistructured_fields.md
[plan-diffs]: plan_diffs.md
[quality-observations]: quality_observations.md
[quickstart]: ../quickstart.md
[read-write]: read_write_data.md
[semantic-profiles]: semantic_profiles.md
[spark-bridge]: ../explanation/from_spark.md
[sql-bridge]: ../explanation/from_sql.md
[troubleshooting]: troubleshooting.md
[typed-hll-sketches]: typed_hll_sketches.md
[variant-payloads]: variant_payloads.md
[verification-evidence]: verification_evidence.md
[window-columns]: window_columns.md
