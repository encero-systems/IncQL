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
  - IncQL RFC 040 (interoperability semantic profiles)
  - IncQL RFC 045 (constraint evidence and verification-aware planning)
  - IncQL RFC 047 (semantic evidence graph and agent query surface)
  - IncQL RFC 066 (Prism relational reasoning and shared-work optimization)
- **Issue:** —
- **RFC PR:** [IncQL #109](https://github.com/encero-systems/IncQL/pull/109)
- **Written against:** Incan v0.5-era IncQL
- **Shipped in:** —

## Summary

This RFC defines a deterministic diagnostic and review-gate layer over IncQL plans and their evidence. It turns a bounded set of known, evidence-backed conditions into reviewable findings with stable identities, explicit assurance, source and plan anchors, and scoped waivers. It does not make diagnostics part of relational semantics, and it does not let a warning become a performance fact unless the supplied evidence supports that claim.

## Motivation

Prism needs to explain why a legal plan was selected, and IncQL needs to expose execution observations, adapter coverage, plan diffs, and verification evidence. Those capabilities are necessary but not sufficient for a human or CI review decision. A reviewer needs a concise answer to different questions: what condition was detected, why it matters, which evidence supports it, whether the impact is measured or only possible, and whether a deliberate exception is still valid.

Without a dedicated contract, every UI, agent, and CI integration will invent its own severity, remediation text, and waiver behavior. That would blur warnings with optimizer legality, cause cross-target comparisons to overclaim, and make a stale suppression look like a current decision. IncQL needs one public review projection that remains subordinate to the plan, evidence, and execution owners.

## Goals

- Define a stable, machine-readable diagnostic record for plan-review findings.
- Require every finding to retain its evidence, authority, scope, freshness, and assurance.
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

The names are illustrative. The result is not a second optimizer. It is a collection of findings such as "a required projection is not realizable by this target" or "the selected plan repeats an expensive subplan, but no materialization evidence was supplied." Each result says whether that is a proven planning fact, a target-coverage fact, a potential concern, or a measured observation.

A team may waive a finding only through a separately reviewable decision that names the diagnostic key, the affected plan or artifact identity, the evidence scope, and an expiry or invalidation rule. Removing a line of text from a configuration file must not silently turn a blocking finding into a passing review.

## Reference-level explanation (precise rules)

### Diagnostic records

A plan diagnostic is a derived, immutable record. It must contain:

- a stable diagnostic key and versioned rule identifier;
- a severity selected by the review profile;
- a category and human-readable explanation;
- source anchors and plan-node or artifact references when available;
- the plan, planning-context, and evidence identities against which it was derived;
- the condition observed, the required missing fact when the result is `unknown`, and any unsupported-analysis reason;
- an assurance classification of `derived`, `attested`, `measured`, `unknown`, or `unsupported`;
- an impact classification of `none`, `potential`, `measured`, or `unknown`;
- a repair class of `informational`, `manual-review`, or `safe-suggestion`; and
- freshness and invalidation information for every non-static input.

The record must not claim a cost, cardinality, safety property, target behavior, or semantic equivalence not present in its evidence. A `measured` impact must link to the observation identity, workload scope, and execution environment. A `potential` impact must state the prerequisite evidence that would make it measurable. `unknown` and `unsupported` are valid terminal results and must not be rewritten as a passing result.

Diagnostic keys are stable public identifiers. A change that materially changes a rule's condition, its evidence requirements, or its implication must use a new rule version or key rather than silently repurposing a suppression.

### Evidence and authority

Diagnostics may consume authored plan facts, Prism explain artifacts, adapter capability and coverage records, declared semantic profiles, plan diffs, constraint and verification evidence, imported bridge evidence, and execution observations. Each input retains the authority and assurance assigned by the RFC that owns it.

The diagnostic layer must not create relational lineage, make a target capability claim, or upgrade an imported or attested artifact to verified evidence. It may report a mismatch, missing mapping, stale observation, or unsupported rule. A rule that depends on target behavior must identify the target profile and capability or coverage evidence it used.

### Initial rule family

The first implementation must support only rules whose evidence and consequence are precisely defined. Candidate initial rules are:

- a selected plan requires a capability absent from the declared target profile;
- a target-specific pushdown opportunity is rejected because required coverage or semantic-profile evidence is absent;
- a repeated logical subplan is detected, but sharing or materialization is not recommended unless the required legality and lifecycle evidence exists;
- a plan diff changes an evidence-backed source, schema, lineage, or target-coverage assumption that a review profile marks as material; and
- an observed regression is reported only when semantically comparable runs, workload identity, environment scope, and measurement provenance are present.

The exact rule keys, prerequisites, and consequence vocabulary must be published with the profile. Generic textual rules such as "avoid SELECT star" are outside the first family unless an IncQL surface and evidence contract make them meaningful.

### Review profiles and gates

A review profile is a versioned, immutable declaration of:

- enabled diagnostic keys and compatible rule versions;
- severity thresholds and whether a threshold is advisory or blocking;
- permitted evidence classes, freshness limits, and target scope;
- whether `unknown` or `unsupported` is permitted, reported, or blocking for each rule; and
- which waiver authorities and scopes it accepts.

A gate evaluates one plan or artifact snapshot against one profile. It must return `pass`, `advisory`, `blocked`, or `inconclusive`. `inconclusive` is required when the profile demands evidence that is absent, stale, unsupported, or not comparable; it must not be emitted as `pass`.

The gate must be deterministic for identical plan identity, profile identity, ordered evidence identities, and evaluator version. A profile may be selected by CI, an editor, or an agent, but those callers must not change the result by injecting opaque private state.

### Waivers

A waiver is a separate decision record, never a mutation of the diagnostic. It must identify the diagnostic key and version, the affected plan, artifact, source, or target scope, the review-profile identity, a rationale, the responsible approving authority when required by the profile, and an expiry or deterministic invalidation condition.

A waiver must not apply when the referenced rule version, plan identity, target profile, semantic profile, or evidence precondition has materially changed. The gate must expose both the original diagnostic and the applied waiver. No waiver can turn `unsupported` or `unknown` into `proved`, `measured`, or verified evidence.

### Suggestions

A diagnostic may provide a safe suggestion only when it is a non-semantic presentation or inspection action. A suggestion that changes authored plan structure, execution placement, materialization, a target binding, or policy must be `manual-review` and must name the evidence needed to validate it. Applying a suggestion is outside this RFC and must create a new plan or artifact identity for review.

## Design details

### Syntax

This RFC introduces no required IncQL authoring syntax. The first public surface is an inspection and CI-oriented review artifact. A future source-level annotation must be specified separately and must not be required to use review profiles.

### Semantics

Diagnostics are projections over immutable plan and evidence snapshots. They do not participate in typechecking, plan equivalence, optimizer legality, or execution. Prism may expose facts that make a diagnostic possible, but the diagnostic engine must neither add alternatives to the memo nor override the selected plan.

### Interaction with other IncQL surfaces

RFCs 007, 008, and 066 own semantic planning, target-aware selection, and adaptive re-entry. RFC 032 owns observations; RFC 033 owns adapter coverage; RFC 037 owns plan-diff inputs; RFC 040 owns semantic profiles; RFC 045 owns constraint and verification-aware planning; and RFC 047 owns the semantic evidence graph. This RFC consumes their records through stable references and does not merge their authority or semantics.

Imported artifacts under RFC 038 may seed a review only as imported evidence. In particular, a transformation manifest or run result cannot establish a Prism plan fact merely because names appear to match.

### Compatibility / migration

Existing plans and evidence remain valid. Diagnostics are additive and must be off unless a caller selects a review profile. Profiles, rule versions, and waivers are versioned so a repository can adopt tighter gates intentionally. A profile change must produce a new profile identity.

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
