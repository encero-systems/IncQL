# IncQL documentation map

IncQL's public documentation is organized by reader need rather than repository shape:

- **Learn** builds a coherent mental model and offers a runnable first result.
- **Guides** solve a bounded task and include verification and failure boundaries.
- **Reference** defines exact contracts, signatures, clauses, and current capability.
- **Architecture** explains ownership and system boundaries.
- **Design records** preserve durable rationale and lifecycle state.

## Choose by background

### I know SQL

Start with [IncQL for SQL users][sql]. It maps familiar clauses to checked `query { ... }` blocks, explains where IncQL deliberately differs from SQL text, and ends at the exact [query-block reference][query-reference]. Then complete the [quickstart][quickstart] and use [Join typed relations][joins] for a second realistic task.

### I know Spark or DataFrame APIs

Start with [IncQL for Spark and DataFrame users][spark]. It maps eager, deferred, and streaming carrier concepts; explains the role of `Session` and Prism; and calls out that `DataStream[T]` execution is future work. Continue with [Build deferred dataset transformations][transforms] and [Inspect a plan and lineage graph][inspection-guide].

### I know databases or query engines

Read [What IncQL is — and is not][ownership] before the quickstart. Then use the [Architecture][architecture] page to follow authoring, Prism, Substrait, Session, and adapter ownership, and consult the [backend capability matrix][capabilities] before assuming database, catalog, transaction, or optimizer behavior.

### I build Incan applications

Run the [ten-minute quickstart][quickstart], then follow [Read and write data][read-write], [Execution context][execution], and [Troubleshoot common failures][troubleshooting]. Use the [IncQL Book][book] when you want one cumulative project rather than independent tasks.

## Choose by intent

| I want to… | Start here | Exact contract |
| --- | --- | --- |
| get one checked result | [Ten-minute quickstart][quickstart] | [Query blocks][query-reference] |
| read or write typed data | [Read and write data][read-write] | [Execution context][execution] |
| filter, project, group, or sort | [Build deferred transformations][transforms] | [Dataset methods][methods] |
| join two relations | [Join typed relations][joins] | [Dataset methods][methods] and [Query blocks][query-reference] |
| inspect meaning before execution | [Inspect plan and lineage][inspection-guide] | [Inspection][inspection-reference] |
| retain evidence from an attempt | [Execution observations][execution-observations] | [Execution context][execution] |
| evaluate data quality | [Quality observations][quality-guide] | [Quality][quality-reference] |
| diagnose a failure | [Troubleshooting][troubleshooting] | [Backend capability matrix][capabilities] |

## Specialist tracks

### Quality and governance

Follow [Observe data quality checks][quality-guide], [Capture execution observations][execution-observations], and [Inspect governed evidence][governed-evidence]. These surfaces produce evidence; the application still owns enforcement, retries, publication, and write decisions.

### Adapter and portability work

Read [Architecture][architecture], the [backend capability matrix][capabilities], [Substrait conformance][substrait], and the [read-root binding contract][read-roots]. This path is advanced and is not a prerequisite for ordinary query authoring.

### Analytics patterns

Use the transformation, join, window, approximate metric, and generator guides from the [Guides overview][guides]. Capability-dependent guides state their adapter boundary before code.

### Contributing to the specification

Read the [RFC index][rfcs] and [How to write an RFC][writing-rfcs]. RFCs explain durable design decisions; they are not a substitute for the shipped API Reference.

<!-- References -->

[architecture]: architecture.md
[book]: language/tutorials/book/index.md
[capabilities]: language/reference/capabilities.md
[execution]: language/reference/execution_context.md
[execution-observations]: language/how-to/execution_observations.md
[governed-evidence]: language/how-to/governed_evidence.md
[guides]: language/how-to/README.md
[inspection-guide]: language/how-to/inspect_plan_lineage.md
[inspection-reference]: language/reference/inspection.md
[joins]: language/how-to/joins.md
[methods]: language/reference/dataset_methods.md
[ownership]: language/explanation/what_incql_is.md
[quality-guide]: language/how-to/quality_observations.md
[quality-reference]: language/reference/quality.md
[query-reference]: language/reference/query_blocks.md
[quickstart]: language/quickstart.md
[read-roots]: language/reference/substrait/read_root_binding_contract.md
[read-write]: language/how-to/read_write_data.md
[rfcs]: rfcs/README.md
[spark]: language/explanation/from_spark.md
[sql]: language/explanation/from_sql.md
[substrait]: language/reference/substrait/conformance.md
[transforms]: language/how-to/dataset_transformations.md
[troubleshooting]: language/how-to/troubleshooting.md
[writing-rfcs]: contributing/writing_rfcs.md
