<main class="incql-launch" markdown="1">
<section class="incql-hero" markdown="1">
<div class="incql-hero__copy" markdown="1">
<p class="incql-eyebrow">One semantic model. Multiple ways to think.</p>

<h1 id="write-typed-logic-inspect-the-plan-control-execution">Write typed logic.<br>Inspect the <span class="incql-gradient-text">plan</span>.<br>Control <span class="incql-gradient-text">execution</span>.</h1>

<p class="incql-hero__intro">IncQL gives Incan programs two relational authoring forms—SQL-familiar query blocks and typed carrier methods—over one Prism-backed plan. Inspect that plan locally, then cross an explicit Session boundary to the current DataFusion adapter.</p>

<div class="incql-actions">
<a class="incql-button incql-button--primary" href="language/">Start learning IncQL</a>
<a class="incql-button" href="language/how-to/inspect_plan_lineage/">See a plan before it runs</a>
</div>

</div>

<div class="incql-hero__visual" aria-label="Prism refracts data logic into inspectable typed plan layers.">
<picture>
<source srcset="shared/prismplane/prismplane-hero-light.webp" type="image/webp">
<img src="shared/prismplane/prismplane-hero-light.png" width="1672" height="941" decoding="async" fetchpriority="high" alt="A glass prism refracting data logic into layered plan stages.">
</picture>
</div>
</section>

<section class="incql-showcase" markdown="1">
<div class="incql-showcase__code" markdown="1">
<p class="incql-showcase__label">Reading paid orders from a CSV</p>

```incan
import pub::incql  # (1)!
from pub::incql import LazyFrame, Session, SessionError, desc

model Order:  # (2)!
    order_id: int
    customer_id: str
    status: str
    amount: float

model PaidOrder:  # (3)!
    order_id: int
    amount: float

def paid_orders(
    mut session: Session,  # (4)!
) -> Result[LazyFrame[PaidOrder], SessionError]:  # (5)!
    orders: LazyFrame[Order] = session.read_csv("orders", "orders.csv")?  # (6)!
    paid: LazyFrame[PaidOrder] = query {  # (7)!
        FROM orders
        WHERE .status == "paid"
        SELECT
            .order_id as order_id,
            .amount as amount,
        ORDER BY desc(.amount)
    }
    return Ok(paid)
```

1.  **Two imports, doing different jobs.** `import pub::incql` activates IncQL's vocabulary — it is what lets `query { }` parse as syntax at all. The `from ... import` line brings in the names this program uses. A program with a query block needs both.
2.  **`model` is an ordinary Incan record type** — not an IncQL construct. It declares a row's fields and their types in source, so the schema is something written down rather than something the file reveals at runtime.
3.  **The output shape gets a name too.** Projecting to `PaidOrder` is what keeps the result typed. Without it you would be back to "some rows with some columns".
4.  **`mut` means this call changes the Session.** Incan is explicit about mutation, and registering a source mutates the registry — so you can see, at the call site, that something was written to.
5.  **`Result` and `?` are Incan's failure path.** There are no exceptions: a read that can fail returns `Result`, and `?` hands the failure to the caller. Nothing fails invisibly.
6.  **`LazyFrame[Order]` is a carrier that knows its row type — and has not run.** `LazyFrame` is the deferred one; `DataFrame[T]` is its eager sibling and `DataStream[T]` the unbounded one. The `[Order]` is what later clauses are checked against. Nothing in the arguments implies the row type, so it has to be given: either by this annotation, or explicitly as `session.read_csv[Order](...)`.
7.  **The query block is typed against that carrier.** `.status` resolves against `Order`'s fields, so this is checked relational logic, not a string handed to an engine.

</div>

<div class="incql-showcase__notes" markdown="1">
<p class="incql-section-kicker">What this buys you</p>

<article markdown="1">
### Mistakes surface before anything runs

Three lines would do this elsewhere. Those three cannot tell you `amount` is still a `float`.

[Dataset carriers](language/reference/dataset_carriers.md)
</article>

<article markdown="1">
### Switch surface without a rewrite

The equivalent `LazyFrame` method chain resolves the same names and produces the same plan.

[Query blocks](language/reference/query_blocks.md)
</article>

<article markdown="1">
### You decide when data moves

Nothing runs until `collect(...)`. Until then the plan is inspectable and lowers to Substrait.

[Execution context](language/reference/execution_context.md)
</article>

<p class="incql-showcase__hint">Click any <span class="incql-annot-hint">+</span> to see what a line does.</p>
</div>
</section>

<section class="incql-convergence-section" markdown="1">
<div class="incql-diagnosis" markdown="1">
## The problem with data logic today

Teams lose time to expression, semantics drift, and opaque pipelines that lock them to engines.

<div class="incql-friction-list">
<article>
<h3>Too many ways to express logic</h3>
<p>SQL, DataFrames, pipelines, and notebooks each carry their own shape.</p>
</article>

<article>
<h3>Different semantics and behaviors</h3>
<p>Small rewrites can change meaning before anyone sees the plan.</p>
</article>

<article>
<h3>Hard to inspect and debug</h3>
<p>You see results, but not the logic, lineage, or rechecking behavior.</p>
</article>

<article>
<h3>Tied to specific engines</h3>
<p>Porting usually means rewriting logic and revalidating behavior.</p>
</article>
</div>
</div>

<div class="incql-semantic-map" aria-label="Different authoring surfaces converging into IncQL's typed relational model, evidence, and runtime boundaries.">
<div class="incql-map-heading">
<h2><span class="incql-gradient-text">IncQL</span> is the unifying layer</h2>
<p>Two implemented authoring forms. One typed plan. One explicit runtime boundary.</p>
</div>

<div class="incql-map-body">
<div class="incql-map-sources" aria-label="Authoring surfaces">
<article>
<span>Q</span>
<div><strong>Query blocks</strong><p>SQL-familiar clauses</p></div>
</article>
<article>
<span>API</span>
<div><strong>Carrier methods</strong><p>Typed relational calls</p></div>
</article>
<article>
<span>Lazy</span>
<div><strong>LazyFrame plans</strong><p>Deferred by design</p></div>
</article>
<article>
<span>T</span>
<div><strong>Typed models</strong><p>Intended row shape</p></div>
</article>
</div>

<div class="incql-map-core">
<img src="shared/brand/incql-logo-header.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
</div>

<div class="incql-map-targets" aria-label="Plan, evidence, and runtime boundaries">
<article>
<span class="incql-target-icon"><img src="shared/icons/vector-polyline.svg" alt="" aria-hidden="true"></span>
<span class="incql-target-copy"><strong>Prism evidence</strong><small>Inspect locally</small></span>
</article>
<article>
<span class="incql-target-icon"><img src="shared/icons/database-cog-outline.svg" alt="" aria-hidden="true"></span>
<span class="incql-target-copy"><strong>DataFusion</strong><small>Current adapter</small></span>
</article>
<article>
<span class="incql-target-icon"><img src="shared/icons/file-tree-outline.svg" alt="" aria-hidden="true"></span>
<span class="incql-target-copy"><strong>Substrait</strong><small>Portable plan</small></span>
</article>
<article>
<span class="incql-target-icon"><img src="shared/icons/vector-polyline.svg" alt="" aria-hidden="true"></span>
<span class="incql-target-copy"><strong>Adapter contract</strong><small>Explicit extension seam</small></span>
</article>
</div>
</div>
</div>
</section>

<section class="incql-process" markdown="1">
<div class="incql-section-heading incql-process-heading" markdown="1">
## How <span class="incql-gradient-text">IncQL</span> works

Author in the surface that fits the task. IncQL keeps the semantics attached as the work moves from intent to execution.
</div>

<div class="incql-process-stage" aria-label="Five IncQL stages moving from authoring intent through Prism inspection to portable execution.">
<div class="incql-process-rail">
<article class="incql-step-card incql-step-card--author">
<header class="incql-step-card__title">
<span>01</span>
<h3>Author</h3>
</header>
<p>Express relational intent in an implemented, checked Incan surface.</p>
<ul class="incql-process-list">
<li>Query blocks</li>
<li>Carrier methods</li>
<li>Typed models</li>
<li>Registered sources</li>
</ul>
</article>

<article class="incql-step-card incql-step-card--compile">
<header class="incql-step-card__title">
<span>02</span>
<h3>Compile</h3>
</header>
<p>Lower authoring intent into a typed relational model and Substrait plan.</p>
<div class="incql-mini-code" markdown="1">

```incan
model Order:
    id: int
    status: str
    region: str
```

</div>
<p class="incql-tag-row">Substrait</p>
</article>

<article class="incql-step-card incql-step-card--prism">
<header class="incql-step-card__title">
<span>03</span>
<h3>Prism</h3>
</header>
<p>IncQL's semantic core makes the compiler's decisions visible.</p>
<ul class="incql-process-list">
<li>Schema flow</li>
<li>Lineage</li>
<li>Projections</li>
<li>Filters</li>
<li>Optimizer choices</li>
</ul>
</article>

<article class="incql-step-card incql-step-card--optimize">
<header class="incql-step-card__title">
<span>04</span>
<h3>Optimize</h3>
</header>
<p>Apply narrow, semantics-preserving canonical rewrites while retaining authored origins.</p>
<ul class="incql-process-list">
<li>Aggregate</li>
<li>Filter</li>
<li>Project</li>
<li>Scan</li>
</ul>
<p class="incql-tag-row">Canonical rewrites</p>
</article>

<article class="incql-step-card incql-step-card--execute">
<header class="incql-step-card__title">
<span>05</span>
<h3>Execute</h3>
</header>
<p>Bind through Session and run the supported plan on the current adapter.</p>
<ul class="incql-process-list">
<li>DataFusion</li>
<li>Collect</li>
<li>Write</li>
<li>Observe</li>
</ul>
</article>
</div>
</div>
</section>

<section class="incql-prism-visible" markdown="1">
<div class="incql-section-heading" markdown="1">
<p class="incql-section-kicker">Inspect before execution</p>

## Prism makes the compiler <span class="incql-gradient-text">visible</span>

IncQL plans are not opaque strings handed to a backend engine. Prism exposes the typed model and evidence before execution.
</div>

<div class="incql-prism-board" markdown="block">
<div class="incql-code-card" markdown="block">
<div class="incql-feature-card__header">
<span class="incql-feature-card__step">01</span>
<div><strong>Your query</strong><small>Authoring intent</small></div>
</div>

```incan
query {
    FROM orders
    WHERE .status == "paid"
    GROUP BY .region
    SELECT
        .region as region,
        sum(.amount) as total
}
```
</div>

<div class="incql-plan-card" markdown="block">
<div class="incql-feature-card__header incql-feature-card__header--prism">
<span class="incql-feature-card__step incql-feature-card__step--prism">02</span>
<div><strong>Prism inspection</strong><small>Typed relational model</small></div>
<span class="incql-feature-card__status">Inspectable</span>
</div>

```text
Source(orders)
  Filter(status == paid)
  Aggregate(group: region)
  Project(region, total)
```

<div class="incql-evidence-strip" aria-label="Prism evidence available before execution">
<span><strong>Schema</strong> flow</span>
<span><strong>Lineage</strong> attached</span>
<span><strong>Choices</strong> visible</span>
</div>
</div>

<div class="incql-engine-card" markdown="block">
<div class="incql-feature-card__header">
<span class="incql-feature-card__step">03</span>
<div><strong>Runtime boundary</strong><small>Current and portable contracts</small></div>
</div>

<ul class="incql-engine-targets">
<li><img src="shared/icons/database-cog-outline.svg" alt="" aria-hidden="true"><span>DataFusion today</span></li>
<li><img src="shared/icons/vector-polyline.svg" alt="" aria-hidden="true"><span>Portable Substrait plan</span></li>
<li><img src="shared/icons/link-variant.svg" alt="" aria-hidden="true"><span>Explicit adapter seam</span></li>
<li><img src="shared/icons/chart-timeline-variant.svg" alt="" aria-hidden="true"><span>Typed observations</span></li>
</ul>
</div>
</div>
</section>

<section class="incql-surfaces" markdown="1">
<div class="incql-surfaces__copy" markdown="1">
<p class="incql-section-kicker">Semantic convergence</p>

## Two authoring styles. One typed plan.

Use checked query clauses or typed carrier calls. Both build deferred relational intent.
</div>

<div class="incql-surface-demo" markdown="1">
<div class="incql-surface-tabs" data-incql-surface-tabs>
<div class="incql-surface-labels" role="tablist" aria-label="Implemented IncQL authoring styles">
<button type="button" id="incql-surface-tab-query" role="tab" aria-selected="true" aria-controls="incql-surface-panel-query">Query blocks</button>
<button type="button" id="incql-surface-tab-methods" role="tab" aria-selected="false" aria-controls="incql-surface-panel-methods" tabindex="-1">Carrier methods</button>
</div>

<div id="incql-surface-panel-query" class="incql-surface-panel" role="tabpanel" aria-labelledby="incql-surface-tab-query" tabindex="0" markdown="1">

```incan
query {
    FROM orders
    WHERE .status == "paid"
    ORDER BY desc(.amount)
    LIMIT 20
}
```

</div>

<div id="incql-surface-panel-methods" class="incql-surface-panel" role="tabpanel" aria-labelledby="incql-surface-tab-methods" tabindex="0" markdown="1">

```incan
preview = (
    orders
        .filter(eq(col("status"), "paid"))
        .order_by([desc(col("amount"))])
        .limit(20)
)
```

</div>
</div>
</div>

<div class="incql-surface-bridge" aria-hidden="true">
<img src="shared/brand/incql-logo-header.png" alt="" loading="lazy" decoding="async">
<span>One semantic model</span>
</div>

<div class="incql-same-plan" markdown="1">
<div class="incql-same-plan__heading">
<span>Prism</span>
<h3>Equivalent Prism intent</h3>
</div>

<ol class="incql-plan-list">
<li><strong>Source</strong><span>Read the same typed relation.</span></li>
<li><strong>Filter</strong><span>Apply the same predicate semantics.</span></li>
<li><strong>Order</strong><span>Keep descending amount order attached.</span></li>
<li><strong>Limit</strong><span>Return the same preview window.</span></li>
</ol>
</div>
</section>

<section class="incql-trust" markdown="1">
<article class="incql-trust__card incql-trust__card--confidence" markdown="1">
<div class="incql-trust__mark" aria-hidden="true"><img src="shared/icons/shield-check-outline.svg" alt=""></div>
<p class="incql-section-kicker">Confidence by construction</p>

## Built for trust

- Static typing and schema flow for confidence
- Prism for deep visibility before execution
- Deterministic, backend-neutral semantics
- Reproducible, testable, observable evidence
</article>

<article class="incql-trust__card incql-trust__card--developer" markdown="1">
<div class="incql-trust__mark" aria-hidden="true"><img src="shared/icons/code-braces-box.svg" alt=""></div>
<p class="incql-section-kicker">A surface developers can own</p>

## Engineered for developers

- Familiar when you know SQL or lazy DataFrame APIs
- Powerful when governance matters
- Extensible, open, and community-driven
- Designed for humans and AI agents
</article>
</section>

<section class="incql-final-cta" markdown="1">
<div class="incql-final-cta__brand" aria-hidden="true">
<img class="incql-final-cta__mark" src="shared/brand/incql-logo-header.png" alt="" loading="lazy" decoding="async">
</div>

<div class="incql-final-cta__copy" markdown="1">
<p class="incql-section-kicker">Start with inspectable data logic</p>

## Ready to experience IncQL?

Start with the guided introduction, choose a route for your background, or jump straight into the reference.
</div>

<div class="incql-actions">
<a class="incql-button incql-button--primary" href="language/">Get started</a>
<a class="incql-button" href="docs_map/">Choose your route</a>
</div>
</section>
</main>
