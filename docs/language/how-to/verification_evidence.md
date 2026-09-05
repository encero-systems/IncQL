# Track async verification state

## When to use this

Use verification evidence when checks happen over time or come from different evidence strengths. A migration or reconciliation run might first receive an attested source count, then verified partition checks, then a waiver for a known mismatch. IncQL keeps those as append-only observations and derives current state from them instead of overwriting older evidence.

## Before you begin

You need the semantic targets the checks are about (`orders_target` in the examples is a target taken from an inspection), stable identifiers for assertions, runs, observations, and waivers, and the evidence strength of each observation. Decide the assurance level honestly: attested, verified, and waived are recorded separately from outcome and lifecycle and are never inferred from execution success or quality status.

## Declare what should be checked

A verification assertion describes intent. It is stable while observations change.

```incan
from pub::incql import VerificationAssertionKind, VerificationScopeKind, verification_assertion

assertion = verification_assertion(
    "orders_partition_digest",
    VerificationAssertionKind.DigestEquality,
    orders_target,
    comparison_intent="source and target partition digests match",
    scope_kind=VerificationScopeKind.Partition,
    required_semantic_profile_ids=["profile:orders:canonical"],
)
```

The assertion does not say passed or failed. It anchors the check to semantic targets and records what profiles or context matter for interpreting evidence.

## Record a run and observations

A run records the attempt. Observations record facts emitted by the run.

```incan
from pub::incql import (
    VerificationAssurance,
    VerificationCaptureBasis,
    VerificationLifecycle,
    VerificationOutcome,
    verification_coverage,
    verification_observation,
    verification_run,
)

run = verification_run(
    "verification-run:orders:2026-06-20",
    [assertion],
    requested_source_snapshot_id=Some("snapshot:oracle:orders:2026-06-20"),
    requested_target_snapshot_id=Some("snapshot:athena:orders:2026-06-20"),
)

passed_partition = verification_observation(
    "verification-observation:orders:2026-06-18",
    run,
    assertion,
    VerificationLifecycle.Complete,
    VerificationOutcome.Passed,
    VerificationAssurance.Verified,
    scope_id="orders/order_date=2026-06-18",
    coverage=verification_coverage(1, 1, "partition"),
    basis=VerificationCaptureBasis.InternallyComputed,
    event_sequence=1,
)
```

Lifecycle, outcome, and assurance are separate. A check can be complete but failed, passed but only attested, or failed but waived. Do not infer verification assurance from execution success or quality status.

## Waive a known exception

Waivers are observations, not edits. Keep the failed observation and add a later waived observation that supersedes it for the current projection.

```incan
from pub::incql import verification_waiver, waived_verification_observation

waiver = verification_waiver(
    "waiver:orders:2026-06-19",
    "known source correction accepted during cutover",
    "migration-review",
    approved_by=Some("data-owner"),
)

waived_partition = waived_verification_observation(
    "verification-observation:orders:2026-06-19:waived",
    run,
    assertion,
    VerificationOutcome.Failed,
    waiver,
    scope_id="orders/order_date=2026-06-19",
    coverage=verification_coverage(1, 1, "partition"),
    supersedes_observation_ids=["verification-observation:orders:2026-06-19:failed"],
    event_sequence=3,
)
```

The current projection can show the waived observation as active, but the outcome remains `Failed`. That distinction lets reports say “all non-waived partitions verified; one failed partition accepted by waiver” instead of implying the waived partition matched.

## Project current state

Use `project_verification_state(...)` to derive the current state for an assertion and scope from the append-only observation stream.

```incan
from pub::incql import project_verification_state

projection = project_verification_state(
    assertion,
    [passed_partition, failed_partition, waived_partition],
    "orders/order_date=2026-06-19",
)

println(projection.outcome.value())
println(projection.assurance_count(VerificationAssurance.Waived))
```

No observations means `Unknown`, not passed and not covered. Mixed active observations remain `Mixed`, and assurance counts stay visible by label.

## Package verification evidence in a governed bundle

Pass verification evidence into a governed plan bundle when a local tool needs one handoff value with the plan and evidence together.

```incan
from pub::incql import governed_plan_bundle, verification_evidence

evidence = verification_evidence(
    [assertion],
    [run],
    [passed_partition, waived_partition],
    projections=[projection],
    waivers=[waiver],
    evidence_refs=["verification:orders:cutover"],
)

bundle = governed_plan_bundle(summary, verification_evidence=[evidence])

println(bundle.section_available("verification_evidence"))
println(bundle.section_available("verification_projections"))
```

The bundle now exposes `verification_evidence`, `verification_assertions`, `verification_runs`, `verification_observations`, `verification_projections`, `verification_snapshots`, `verification_commitments`, and `verification_waivers` sections. Omitted verification evidence is `Unavailable`. Canonical equality profiles, digest profiles, proof artifacts, and constraint planning remain separate RFC families and stay `Unsupported` until implemented.

## Verify the result

- Project the state with `project_verification_state(...)` for the assertion and scope you care about; `Unknown` means no observations arrived, not that the check passed.
- Confirm waived observations keep their `Failed` outcome and that each waiver supersedes the observation you intended, by id.
- Check the assurance counts by label so a report can say how much of the evidence is verified, attested, or waived.
- After bundling, confirm the verification sections are `Available` and counted.

## Current support and failure boundaries

Verification evidence is append-only: waivers and later observations supersede earlier ones in the projection without deleting them. IncQL stores and projects the evidence; it does not run the comparisons, fetch snapshots, or decide that a waiver is acceptable. Canonical equality profiles, digest profiles, proof artifacts, and constraint planning are separate RFC families and remain `Unsupported` sections until implemented.

## Reference

Use [Async verification evidence][verification-ref] for the assertion, run, observation, waiver, and projection contracts and [Governed plan bundles][bundles-ref] for the verification sections.

<!-- References -->

[verification-ref]: ../reference/verification.md
[bundles-ref]: ../reference/governed_plan_bundles.md
