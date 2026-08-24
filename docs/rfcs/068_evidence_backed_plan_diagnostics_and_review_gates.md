# IncQL RFC 068: Evidence-backed plan diagnostics and review gates

- **Status:** Draft
- **Created:** 2026-08-10
- **Author(s):** Danny Meijer (@dannymeijer)
- **Related:**
  - IncQL RFC 007 (Prism logical planning and optimization engine)
  - IncQL RFC 008 (optimizer boundary, statistics, cost-based optimization, and adaptive execution)
  - IncQL RFC 027 (relational evidence program)
  - IncQL RFC 032 (execution observations)
  - IncQL RFC 033 (adapter requirements and coverage)
  - IncQL RFC 037 (plan diff and blast-radius inputs)
  - IncQL RFC 038 (evidence exchange bridges)
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 042 (async verification evidence)
  - IncQL RFC 045 (constraint evidence and verification-aware planning)
  - IncQL RFC 047 (semantic evidence graph and agent query surface)
  - IncQL RFC 066 (Prism relational reasoning and shared-work optimization)
  - Incan RFC 106 (shared codegraph projection consumed by this RFC's source anchors): [incan#777](https://github.com/encero-systems/incan/issues/777)
  - Incan RFC 120 (canonical source symbol identity; owner of source-location identity): [incan#1042](https://github.com/encero-systems/incan/issues/1042)
- **Issue:** [IncQL #110](https://github.com/encero-systems/IncQL/issues/110)
- **RFC PR:** [IncQL #109](https://github.com/encero-systems/IncQL/pull/109)
- **Written against:** IncQL 0.1.0 / Incan 0.5.0-dev.46
- **Shipped in:** —

## Summary

This RFC defines a deterministic rule-evaluation, diagnostic, and review-gate layer over IncQL plans and their evidence. It evaluates a bounded versioned rule set completely, turns evidence-backed conditions into reviewable findings with stable identities and source and plan anchors, preserves assurance from the evidence records that own it, and applies scoped review waivers without mutating those records. It does not make diagnostics part of relational semantics, and it does not let a warning become a performance fact unless the supplied evidence supports that claim.

## Core model

1. A versioned rule catalog defines each reviewable condition, its application scope, required evidence, and possible outcomes.
2. A versioned review profile selects compatible rule versions, severity and gate policy, evidence requirements, freshness limits, and accepted review-waiver authorities.
3. A review evaluation artifact records one explicit outcome for every required rule-and-scope evaluation over one immutable plan, canonical evidence snapshot, and explicit evaluation context.
4. A diagnostic explains each finding, unknown result, or unsupported evaluation without replacing the owner-issued evidence that supports it.
5. A gate derives one deterministic decision from a complete evaluation artifact, its selected profile, and a canonical snapshot of applicable review waivers. Missing evaluations cannot produce a passing gate.
6. A review waiver is a separate scoped decision that may alter the gate result but cannot alter plan semantics, source evidence, verification assurance, or optimizer authority.

## Motivation

Prism needs to explain why a legal plan was selected, and IncQL needs to expose execution observations, adapter coverage, plan diffs, and verification evidence. Those capabilities are necessary but not sufficient for a human or CI review decision. A reviewer needs a concise answer to different questions: what condition was detected, why it matters, which evidence supports it, whether the impact is measured or only possible, and whether a deliberate exception is still valid.

Without a dedicated contract, every UI, agent, and CI integration will invent its own severity, remediation text, and waiver behavior. That would blur warnings with optimizer legality, cause cross-target comparisons to overclaim, and make a stale suppression look like a current decision. IncQL needs one public review projection that remains subordinate to the plan, evidence, and execution owners.

## Goals

- Define a stable, machine-readable diagnostic record for plan-review findings.
- Require every evaluation and finding to retain its evidence, authority, scope, freshness, and owner-issued assurance context.
- Distinguish an unsupported analysis, an unknown result, a potential impact, and a measured impact.
- Define deterministic review profiles and narrowly scoped, auditable waivers.
- Enable CI, editor, and agent consumers to make the same review decision from the same snapshot.
- Keep planner legality, target realization, and observed runtime behavior under their existing owners.

## Non-Goals

- Defining a general-purpose linter, policy engine, dashboard, or hosted review service.
- Replacing Prism's optimization, search, explain, or target-selection contracts.
- Making a static pattern a universal performance claim.
- Automatically rewriting an author's plan or applying a suggested repair.
- Establishing that an external SQL, dbt, catalog, or telemetry artifact is IncQL semantic truth.
- Defining organization-wide approval workflow or identity management.

## Guide-level explanation (how authors think about it)

An author continues to write ordinary IncQL. A review profile asks the tooling to inspect a particular immutable plan and evidence snapshot:

```incan
review = review_plan(
    plan,
    profile="local-strict",
    evidence=[adapter_profile, plan_explain, observations],
)
```

The names are illustrative. The result is not a second optimizer. It is a complete evaluation artifact plus findings such as "a required projection is not realizable by this target" or "the selected plan repeats an expensive subplan, but no materialization evidence was supplied." Each enabled rule reports whether its condition is clear, detected, unknown, or unsupported. A finding separately says whether its impact is absent, potential, measured, or unknown, and links the owner-issued planning, coverage, profile, verification, or observation evidence that supports that claim.

A team may waive a finding only through a separately reviewable decision that names the rule key and evaluation identity, the affected plan or artifact identity, the evidence scope, and an expiry or invalidation rule. Removing a line of text from a configuration file must not silently turn a blocking finding into a passing review.

## Reference-level explanation (precise rules)

### Rule evaluations and diagnostic records

A review evaluation artifact is a derived, immutable record. It must identify the plan, planning context, review profile, canonical evidence snapshot, rule-catalog version, evaluator version, explicit evaluation context, freshness policy, and canonically ordered rule-evaluation records. The evaluation context must include the decision instant used for freshness checks rather than consulting an implicit clock. The artifact must also state whether the required evaluation set is complete.

Each enabled rule must publish a deterministic application-scope algorithm. Every rule-and-scope pair required by that algorithm must produce exactly one evaluation outcome:

- `clear`: all prerequisite evidence is present and acceptable, the rule was evaluated, and its condition was not detected;
- `finding`: all prerequisite evidence required to detect the condition is present and the condition was detected;
- `unknown`: the rule is representable, but required evidence is missing, stale, conflicting, incomparable, or insufficient; or
- `unsupported`: the evaluator cannot represent or execute the rule for that scope or evidence shape.

`clear` is not the absence of a diagnostic. A gate may use `clear` only from an explicit evaluation record. Missing rule evaluations, missing scope evaluations, duplicate evaluation identities, and conflicting evidence identities make the evaluation artifact incomplete and prevent a passing gate.

A rule-evaluation record must contain:

- a deterministic evaluation identity plus a stable rule key and rule version;
- the evaluation outcome and the exact application scope;
- a severity selected by the review profile;
- a category and human-readable explanation when the outcome is not `clear`;
- source anchors and plan-node or artifact references when available;
- the plan, planning-context, profile, and canonical evidence-snapshot identities against which it was derived;
- the condition observed, the missing or unacceptable prerequisite when the result is `unknown`, and any unsupported-analysis reason;
- source evidence references with their owner-issued basis, authority, assurance, scope, coverage, and diagnostics preserved;
- an impact classification of `none`, `potential`, `measured`, or `unknown`;
- a repair class of `informational`, `manual-review`, or `safe-suggestion`; and
- freshness and invalidation information for every non-static input.

The record must not define a second assurance scale or upgrade source evidence. Any assurance summary is a projection over linked owner-issued records and must retain their scope and coverage. The record must not claim a cost, cardinality, safety property, target behavior, or semantic equivalence not present in its evidence. A `measured` impact must link to the observation identity, workload scope, and execution environment. A `potential` impact must state the prerequisite evidence that would make it measurable. `unknown` and `unsupported` are valid terminal results and must not be rewritten as `clear` or a passing result.

Rule keys and versions are stable public identifiers. A change that materially changes a rule's condition, application scope, evidence requirements, or implication must use a new rule version or key. Evaluation identities are derived from the rule key and version, application scope, plan identity, review-profile identity, canonical evidence-snapshot identity, evaluator version, and evaluation-context identity; they must not be used as compatibility aliases for the rule itself.

### Evidence and authority

Diagnostics may consume authored plan facts, Prism explain artifacts, adapter capability and coverage records, declared semantic profiles, plan diffs, constraint and verification evidence, imported bridge evidence, and execution observations. Each input retains the authority and assurance assigned by the RFC that owns it.

The diagnostic layer must not create relational lineage, make a target capability claim, or upgrade an imported or attested artifact to verified evidence. It may report a mismatch, missing mapping, stale observation, or unsupported rule. A rule that depends on target behavior must identify the target profile and capability or coverage evidence it used.

Source anchors are compiler-owned evidence. A rule-evaluation record must derive every source anchor from the canonical source symbol identity defined by Incan RFC 120, projected through the shared codegraph of Incan RFC 106, and must preserve the staleness signalled by that projection rather than assuming an anchor remains valid. IncQL must not define an independent identity scheme for source locations. An anchor that cannot be resolved against current compiler facts makes its evaluation `unknown`; it must not be reported as a finding located at a guessed position.

### Required rule family

This RFC requires a bounded rule family whose evidence and consequences are precisely defined. Required rule categories are:

- a selected plan requires a capability absent from the declared target profile;
- a target-specific pushdown opportunity is rejected because required coverage or semantic-profile evidence is absent;
- a repeated logical subplan is detected, but sharing or materialization is not recommended unless the required legality and lifecycle evidence exists;
- a plan diff changes an evidence-backed source, schema, lineage, or target-coverage assumption that a review profile marks as material; and
- an observed regression is reported only when semantically comparable runs, workload identity, environment scope, and measurement provenance are present.

The exact rule keys, prerequisites, and consequence vocabulary must be published with the profile. Generic textual rules such as "avoid SELECT star" are outside this rule family unless an IncQL surface and evidence contract make them meaningful.

### Review profiles and gates

A review profile is a versioned, immutable declaration of:

- enabled rule keys and compatible rule versions;
- severity thresholds and whether a threshold is advisory or blocking;
- permitted evidence classes, freshness limits, and target scope;
- whether `unknown` or `unsupported` is permitted, reported, or blocking for each rule; and
- which waiver authorities and scopes it accepts.

A gate evaluates one complete review evaluation artifact against its profile and a canonical snapshot of applicable review waivers. It must return `pass`, `advisory`, `blocked`, or `inconclusive`. `inconclusive` is required when the evaluation set is incomplete or the profile demands evidence that is absent, stale, unsupported, conflicting, or not comparable; it must not be emitted as `pass`.

The gate must be deterministic for identical plan identity, profile identity, canonical evidence-snapshot identity, evaluator version, evaluation-context identity, and canonical review-waiver-snapshot identity. Evidence and waiver input order must not change either snapshot identity or the gate result; the evaluator must canonicalize and reject duplicate or conflicting identities according to the published rule and waiver contracts. A profile may be selected by CI, an editor, or an agent, but those callers must not change the result by injecting opaque private state.

### Waivers

A review waiver is a separate decision record, never a mutation of the evaluation, diagnostic, or source evidence. It must identify the rule key and version, evaluation identity, affected plan, artifact, source, or target scope, review-profile identity, rationale, responsible approving authority when required by the profile, and expiry or deterministic invalidation condition.

A review waiver must not apply when the referenced rule version, plan identity, target profile, semantic profile, application scope, or evidence precondition has materially changed. The gate must expose both the original evaluation and the applied waiver. A review waiver changes only the review decision permitted by its profile; it cannot turn `unsupported` or `unknown` into `clear`, `proved`, `measured`, or verified evidence, and it is not a verification waiver under RFC 042.

### Suggestions

A diagnostic may provide a safe suggestion only when it is a non-semantic presentation or inspection action. A suggestion that changes authored plan structure, execution placement, materialization, a target binding, or policy must be `manual-review` and must name the evidence needed to validate it. Applying a suggestion is outside this RFC and must create a new plan or artifact identity for review.

## Design details

### Syntax

This RFC introduces no required IncQL authoring syntax. The first public surface is an inspection and CI-oriented review artifact. A future source-level annotation must be specified separately and must not be required to use review profiles.

### Semantics

Review evaluations and diagnostics are projections over immutable plan and evidence snapshots. They do not participate in typechecking, plan equivalence, optimizer legality, or execution. Prism may expose facts that make an evaluation possible, but the review evaluator must neither add alternatives to the memo nor override the selected plan.

### Interaction with other IncQL surfaces

RFCs 007, 008, and 066 own semantic planning, target-aware selection, and adaptive re-entry. RFC 032 owns observations; RFC 033 owns adapter coverage; RFC 037 owns plan-diff inputs; RFC 040 owns semantic profiles; RFC 045 owns constraint and verification-aware planning; and RFC 047 owns the semantic evidence graph. This RFC consumes their records through stable references and does not merge their authority or semantics.

Imported artifacts under RFC 038 may seed a review only as imported evidence. In particular, a transformation manifest or run result cannot establish a Prism plan fact merely because names appear to match.

### Compatibility / migration

Existing plans and evidence remain valid. Review evaluation is additive and must be off unless a caller selects a review profile. Profiles, rule versions, evaluator versions, evidence snapshots, and review waivers are versioned so a repository can adopt tighter gates intentionally. A profile change must produce a new profile identity.

## Alternatives considered

### Put review rules directly in Prism

Rejected. Prism owns legal alternative construction and selection. Review severity, waiver scope, and CI behavior are a different concern and would make planning less portable.

### Emit unstructured warnings from each adapter

Rejected. Adapter-local messages lose cross-target consistency, evidence identity, waiver semantics, and a stable interface for agents and CI.

### Treat all missing evidence as a warning

Rejected. Some profiles must fail closed. `inconclusive` preserves the distinction between a clean result and an unevaluated one.

### Adopt a generic code-quality rule format

Rejected. IncQL needs plan, semantic-profile, target, and observation references rather than a text-file-oriented lint model.

## Drawbacks

The result model adds concepts—assurance, impact, freshness, profile, and waiver—that teams must learn. The initial rule family will deliberately be small, and noisy diagnostics will still require curation. Deterministic gates also require teams to maintain comparable workload and target evidence when they want to block on measured performance.

## Layers affected

- **IncQL specification** — derived diagnostic, review-profile, gate, and waiver semantics must remain distinct from planning and execution semantics.
- **IncQL library package** — inspection APIs must expose stable diagnostic records, profile evaluation, and evidence references without requiring a hosted service.
- **Execution / interchange** — adapters and observation providers must expose only the capability, coverage, and measurement facts they own; callers must supply comparable evidence explicitly.
- **Documentation** — rule catalogs and profiles must state prerequisites, assurance, impact meanings, and waiver behavior without overstating performance claims.

## Unresolved questions

- Which initial diagnostic keys have enough specified evidence and test corpus to become blocking in a reference profile?
- What canonical identity and lifecycle should review profiles and waiver records use across packages and CI systems?
- Which evidence freshness defaults are conservative enough for local, cluster, and continuous execution without making every review inconclusive?
- Should a future source annotation allow an author to request a review profile, or should profile selection remain entirely with callers and project policy?

<!-- Rename this section to "Design Decisions" once all questions have been resolved. An RFC cannot move from Draft to Planned until no unresolved questions remain. -->
