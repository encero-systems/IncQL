# Inspect governed evidence

## When to use this

Use governed attributes and policy checkpoints when you need local evidence about sensitive, classified, reviewed, or policy-relevant relational targets without making IncQL responsible for your organization’s policy engine.

Use these records when a catalog, review, CI job, or governance tool needs interoperable local facts alongside plan targets and lineage.

## Before you begin

You need a Prism-backed `LazyFrame` or an existing semantic target, a clear authority for any caller-supplied attribute, and caller code that owns the response to warnings or denials. Decide whether each fact is inferred, asserted, observed, stale, rejected, or unsupported rather than collapsing absence into approval.

## Inspect inferred governed attributes

`inspect_plan(...)` carries governed evidence next to lineage, metadata attachments, adapter requirements, and unsupported-evidence markers.

```incan
from pub::incql import inspect_plan

inspection = inspect_plan(summary)

for attribute in inspection.governed_attributes:
    println(f"{attribute.target.name}: {attribute.key} = {attribute.value.value}")
    println(f"  source={attribute.source.value()} status={attribute.status.value()}")
```

Inspection infers field schema attributes when local plan evidence includes a field’s primitive kind. These records use the same target, provenance, confidence, status, and evidence-reference shape as caller-supplied attributes, so catalog, contract, and policy-ingress steps can attach compatible evidence without a separate record model.

## Declare a caller-supplied attribute

Use `governed_attribute(...)` when another local step already knows a governed fact and wants to attach it to a semantic target.

```incan
from pub::incql import (
    GovernedAttributeConfidence,
    GovernedAttributeScope,
    GovernedAttributeSource,
    GovernedAttributeStatus,
    governed_attribute,
    inspect_plan,
)

inspection = inspect_plan(customer_report)
email_target = inspection.output_fields[0]

classification = governed_attribute(
    email_target,
    "classification",
    "personal_data",
    scope=GovernedAttributeScope.Field,
    source=GovernedAttributeSource.User,
    confidence=GovernedAttributeConfidence.High,
    status=GovernedAttributeStatus.Asserted,
    authority=Some("privacy-review"),
    evidence_refs=["catalog:customer_report.email"],
)
```

This only creates evidence. It does not mask the field, filter rows, block execution, or certify the output.

## Record a policy checkpoint

Use `policy_checkpoint(...)` to record a policy result or observation at a known boundary.

```incan
from pub::incql import (
    MetadataVisibility,
    PolicyCheckpointAction,
    PolicyCheckpointKind,
    policy_checkpoint,
)

checkpoint = policy_checkpoint(
    email_target,
    PolicyCheckpointKind.Planning,
    PolicyCheckpointAction.Warn,
    "policy:pii-export",
    "masking_recommended",
    visibility=MetadataVisibility.Internal,
    evidence_refs=[classification.attribute_id],
)
```

The checkpoint says that a warning decision was recorded. A CI job, notebook, orchestration layer, or governance tool can decide what to do with that warning. IncQL keeps the decision evidence explicit and local.

## Read policy observation from inspection

Local inspection emits a planning checkpoint when it observes governed evidence. That checkpoint uses `PolicyCheckpointAction.Observe`, not `Allow` or `Deny`, because inspection is not a policy engine.

```incan
for checkpoint in inspection.policy_checkpoints:
    println(f"{checkpoint.checkpoint.value()}: {checkpoint.action.value()} {checkpoint.reason_code}")
```

## Verify the result

- Confirm every attribute and checkpoint targets the intended plan, relation, or field.
- Retain authority, confidence, status, and evidence references for caller-supplied facts.
- Confirm inspection-derived checkpoints use `Observe` unless another explicit authority made a policy decision.
- Test caller behavior separately; the existence of a record does not prove enforcement.

## Current support and failure boundaries

IncQL creates and carries local governed evidence. It does not mask fields, filter rows, certify compliance, contact an external catalog, or replace an organization policy engine. Local inspection currently infers a bounded set of schema-derived attributes; missing evidence is not proof that no governed fact exists.

## Reference

Use [Governed attributes and policy checkpoints][governance] for complete record and enum contracts and [Inspection][inspection] for the plan-local evidence envelope.

<!-- References -->

[governance]: ../reference/governance.md
[inspection]: ../reference/inspection.md
