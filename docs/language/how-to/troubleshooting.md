# Troubleshoot an IncQL pipeline

Use this guide to identify which boundary rejected an IncQL operation before changing code or weakening a semantic contract.

## When to use this

Use this workflow when a read, plan, collection, write, observation, or quality check does not produce the expected result. The goal is to classify the failure first: setup, registration, authoring, lowering, adapter capability, execution, materialization, quality, or caller policy.

## Before you begin

Keep the original typed error or observation. Record:

- the operation you called;
- the logical source names involved;
- whether the value was `DataFrame`, `LazyFrame`, or `DataStream`;
- the selected backend name;
- the first diagnostic code and message;
- whether failure happened before or after `Session` was invoked.

Do not reduce a backend capability failure to “the query is invalid” and do not interpret a failed quality observation as an automatic pipeline exception.

## Classify the boundary

| Symptom | Likely boundary | First check |
| --- | --- | --- |
| package or vocabulary cannot be imported | project/toolchain setup | local path dependency, lockfile, and compatible Incan toolchain |
| duplicate or unknown logical name | Session registration | every name is non-empty, unique, and registered in this Session |
| missing or ambiguous field | authoring or lowering | current schema, aliases, and joined-relation qualification |
| plan inspection works but collect fails before execution | lowering or adapter planning | `SessionError.kind`, diagnostic message, and capability matrix |
| diagnostic says typed sketch or typed variant execution | adapter capability | preserve the typed plan; choose a capable adapter or avoid executing that family |
| collect returns an error after adapter start | backend execution or materialization | source readability, backend diagnostic, and observed attempt |
| write fails | sink validation or backend write | non-empty URI, bounded input, permissions, and sink kind |
| quality observation is `Failed` | data-quality evidence | metrics, diagnostics, assertion mode, and caller decision |
| coverage state is `Unknown` | evidence/classification gap | do not treat it as covered; provide an explicit requirement or adapter evidence |

## Capture a typed execution attempt

```incan
observed = session.collect_observed(plan)

match observed.error:
    Some(error) =>
        println(error.error_message())
        println(observed.observation.diagnostics[0].code)
    None =>
        println(f"rows={observed.observation.row_count:?}")
```

Observed methods preserve one attempt record whether the operation succeeds or fails. They do not fabricate unavailable byte counts, trace IDs, adapter versions, backend logs, or row payloads.

## Inspect before executing

```incan
inspection = inspect_plan(plan.clone())

for diagnostic in inspection.diagnostics:
    println(f"{diagnostic.code}: {diagnostic.message}")

for unsupported in inspection.unsupported_evidence:
    println(unsupported)
```

Local inspection can expose plan, schema, lineage, requirement, and unsupported-evidence facts before a backend is involved. A clean inspection does not prove that a selected adapter can execute every registered extension.

## Separate quality from enforcement

```incan
observations = session.observe_quality(plan, checks)

for observation in observations:
    println(f"{observation.assertion.name}: {observation.status.value()}")
```

A failed required or quarantine-mode assertion is still an observation. Caller code, CI, orchestration, or a governance platform decides whether to block, quarantine, retry, or write.

## Verify the result

- Reproduce with the smallest source and plan that retains the same boundary error.
- Print or retain the typed error kind, not only the human message.
- Use `inspect_plan(...)` to separate local semantic evidence from adapter execution.
- Use observed Session methods when timing and attempt identity matter.
- Check the capability matrix before replacing typed semantics with backend-specific code.
- Verify a fix at the same boundary that originally failed.

## Current support and failure boundaries

IncQL exposes typed Session errors, local inspection diagnostics, execution observations, adapter coverage records, and quality observations. It does not expose a universal distributed trace, backend log collector, automatic retry policy, transaction manager, or organization policy engine.

`Unknown` coverage is non-enforcing and not proof of support. `DataStream` execution remains future work. The current DataFusion adapter deliberately rejects typed sketch and typed variant execution while preserving their backend-neutral plan meaning.

## Reference

Use [Execution context][execution] for errors and observed operations, [Inspection][inspection] for local plan evidence, [Quality][quality] for assertion results, and the [backend capability matrix][capabilities] for current adapter boundaries.

<!-- References -->

[capabilities]: ../reference/capabilities.md
[execution]: ../reference/execution_context.md
[inspection]: ../reference/inspection.md
[quality]: ../reference/quality.md
