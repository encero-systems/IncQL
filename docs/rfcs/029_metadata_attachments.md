# IncQL RFC 029: Typed metadata attachments

- **Status:** In Progress
- **Created:** 2026-05-29
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 007 (Prism logical planning and optimization engine)
  - IncQL RFC 027 (relational evidence program)
  - IncQL RFC 028 (semantic identity and target model)
- **Issue:** [IncQL #63](https://github.com/encero-systems/IncQL/issues/63)
- **RFC PR:** [IncQL #60](https://github.com/encero-systems/IncQL/pull/60)
- **Written against:** Incan v0.3-era IncQL
- **Shipped in:** —

## Summary

This RFC defines typed metadata attachments for IncQL semantic targets. Attachments provide a common way to associate lifecycle, source, visibility, typed payloads, provenance, and evidence references with plans, fields, expressions, requirements, observations, and other semantic targets without hardcoding every evidence family into one model.

## Motivation

Relational evidence needs more than lineage edges. A field may carry a redacted label, a source assertion, a planner diagnostic, a session observation, an adapter capability result, or an exported catalog reference. Without a typed attachment model, each feature will invent its own string map and lifecycle rules, making evidence inconsistent and difficult to export.

## Goals

- Define a common attachment shape for semantic targets.
- Require lifecycle, source, visibility, and typed payload metadata.
- Preserve provenance and evidence references.
- Support sensitive and redacted metadata without forcing it into portable plans.
- Let child RFCs define specialized payload schemas while sharing one attachment contract.

## Non-Goals

- Defining every possible metadata key.
- Defining business glossary, certification, stewardship, or ownership lifecycle.
- Defining a hosted metadata store.
- Making arbitrary untyped string maps the public evidence model.

## Guide-level explanation (how authors think about it)

Most authors should see attachments through inspection results:

```incan
plan = inspect_plan(summary)
field = plan.output_field("customer_id")

for attachment in field.attachments():
    print(attachment.namespace, attachment.key, attachment.visibility)
```

The attachment shape lets tools distinguish a user-authored label, a planner-derived fact, an adapter-reported observation, and a redacted sensitive value.

## Reference-level explanation (precise rules)

An IncQL metadata attachment must include:

- target semantic identity
- namespace
- key
- typed payload
- lifecycle
- source
- visibility
- evidence references

Attachment lifecycle must distinguish at least authored, planned, analyzed, rewritten, lowered, bound, executed, exported, and imported states.

Attachment source must distinguish at least IncQL, user, Prism, Session, adapter, function registry, quality engine, policy engine, external catalog, and imported artifact.

Attachment visibility must distinguish at least public, internal, sensitive, and redacted. Sensitive attachments must not be emitted into portable artifacts by default. Redacted attachments may preserve the existence, target, and reason code of a hidden fact without exposing the payload.

Typed payloads must be schema-versioned when serialized. Consumers must be able to reject unknown payload schemas without treating the attachment as absent.

Attachments must not override semantic structure. A metadata attachment may describe a field, but it must not create a field identity or lineage edge by itself. Structural evidence belongs in the semantic target and lineage models.

## Design details

### Syntax

This RFC introduces no syntax. Future helper APIs may expose attachments, but authoring syntax is not required.

### Semantics

Attachments are evidence records, not semantic authority by default. A child RFC may define an authoritative attachment kind only when the authority, lifecycle, and conflict behavior are explicit.

### Interaction with other IncQL surfaces

Function registry metadata may produce attachments when functions affect lineage, adapter requirements, null behavior, determinism, or extension support. Those attachments must derive from registry facts rather than duplicating function names or signatures in a separate evidence catalog.

### Compatibility / migration

Existing APIs may continue returning simple inspection data. New evidence APIs should expose the attachment model so clients can migrate away from ad hoc metadata maps.

## Alternatives considered

- **One model per evidence family with no shared attachment layer.** Rejected because lifecycle, visibility, provenance, and evidence references would drift.
- **Arbitrary string-key maps.** Rejected because untyped payloads are hard to validate and unsafe to export.
- **Put all metadata into Substrait extensions.** Rejected because Substrait extension metadata is not a reliable authoritative store for local evidence.

## Drawbacks

- Attachments introduce generic machinery before all payload families exist.
- Visibility rules require discipline from export adapters.
- Poorly scoped namespaces could still become clutter if review is weak.

## Layers affected

- **IncQL specification** — metadata attachments must become the shared extension point for evidence families.
- **IncQL library package** — inspection and artifact APIs must preserve typed attachment payloads and visibility.
- **Execution / interchange** — lowering and adapters may carry attachment references but must not leak sensitive payloads by default.
- **Documentation** — docs must show which attachment namespaces are stable public contracts.

## Unresolved questions

- Which attachment namespaces should be reserved by IncQL core?
- Should users be able to author arbitrary attachments directly, or only through typed helper APIs?
- What is the first serialized payload schema format for attachments?

<!-- When every question is resolved, rename this section to **Design Decisions**, group answers under ### Resolved, and remove this comment. -->

## Implementation plan and checklist (non-normative)

This section tracks the implementation path for this RFC. It is intentionally operational and does not change the normative semantics above.

### Plan

1. Land one common attachment shape usable by every child evidence RFC.
2. Land lifecycle, source, visibility, and evidence-reference metadata on that shape.
3. Specify namespace and key rules so independently authored payload schemas cannot collide.

### Checklist

- [x] One attachment shape carries target, namespace, key, and typed payload.
- [x] Lifecycle and source metadata are present.
- [x] Visibility supports sensitive and redacted attachments without forcing them into portable plans.
- [x] Evidence references are preserved on the attachment.
- [ ] Namespace ownership and key uniqueness rules are specified normatively, including the behavior when two attachments claim the same namespace and key on one target.
- [ ] At least one child RFC payload schema is expressed through this contract, demonstrating specialization without a second attachment model.

### Exit criteria for RFC status change

RFC 029 can move from `In Progress` to `Implemented` when every checklist item above is complete and the IncQL CI gate is green on the target release branch. The namespace and collision rules are required: the contract's purpose is to let child RFCs define payloads independently, which is unsafe while collision behavior is undefined.
