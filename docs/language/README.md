<div class="page-layout learn-layout incql-learn-shell">
  <aside class="docs-rail learn-rail crystal-surface" aria-label="Learn sections">
    <div class="rail-heading">
      <img src="../shared/icons/flash-outline.svg" alt="">
      <span><small>Documentation</small><strong>Learn IncQL</strong></span>
    </div>

    <nav class="rail-nav" aria-label="Learn navigation">
      <a class="is-active" href="./" aria-current="page">
        <span>Overview</span>
        <small>Choose your path</small>
      </a>
      <a href="#choose-by-background">
        <span>Starting points</span>
        <small>Choose by background</small>
      </a>
      <a href="tutorials/book/">
        <span>The IncQL Book</span>
        <small>One guided project</small>
      </a>
      <a href="#mental-models">
        <span>Mental models</span>
        <small>Carriers and context</small>
      </a>
    </nav>

    <section class="rail-section" aria-labelledby="learn-continue-label">
      <p id="learn-continue-label">Continue into</p>
      <a href="how-to/"><img src="../shared/icons/table-check.svg" alt="">Guides</a>
      <a href="reference/"><img src="../shared/icons/file-tree-outline.svg" alt="">Reference</a>
      <a href="../architecture/"><img src="../shared/icons/source-branch.svg" alt="">Architecture</a>
    </section>

    <div class="rail-note">
      <span class="health-light"></span>
      <div><strong>Guided system path</strong><small>9 chapters · 4 parts</small></div>
    </div>
  </aside>

  <main class="content learn-content">
    <header class="page-intro learn-intro">
      <div>
        <p class="eyebrow">Learn · complete system path</p>
        <h1>Learn IncQL</h1>
        <p class="lede">Follow one piece of data logic from typed input to evidence you can use.</p>
      </div>
      <nav class="intro-actions" aria-label="Learn shortcuts">
        <a href="how-to/">Open guides</a>
        <a href="reference/">Browse reference</a>
      </nav>
    </header>

    <section class="pp-learn-hero crystal-surface" aria-labelledby="learn-book-title">
      <div class="pp-learn-hero__copy">
        <p class="pp-learn-kicker">One project · every important boundary</p>
        <h2 id="learn-book-title">From typed input to evidence you can use</h2>
        <p>Build a small order-analysis project, keep its plan deferred, inspect what Prism understands, run it through DataFusion, and retain structured evidence about the attempt.</p>
        <p>The core chapters accumulate into one runnable example. Every chapter ends with a result you can verify before moving on.</p>
        <div class="pp-learn-hero__actions">
          <a class="incql-button incql-button--primary" href="quickstart/">Run the ten-minute quickstart</a>
          <a class="pp-learn-query-link" href="tutorials/book/">Start the IncQL Book <span aria-hidden="true">→</span></a>
        </div>
        <p class="pp-learn-hero__meta"><strong>1 runnable quickstart</strong><span>9 book chapters</span><span>4 audience bridges</span></p>
      </div>

      <div class="pp-learn-journey" aria-label="The path followed by the tutorial">
        <img class="pp-learn-journey__art" src="../shared/prismplane/prismplane-hero-light.png" alt="A prism refracting one input into stacked system layers">
        <div class="pp-learn-receipt crystal-surface">
          <p class="pp-learn-receipt__label">The path you will trace</p>
          <ol>
            <li><span>Input</span><strong>CSV + intended row model</strong></li>
            <li><span>Plan</span><strong>Prism-backed LazyFrame</strong></li>
            <li><span>Run</span><strong>Session + DataFusion</strong></li>
            <li><span>Evidence</span><strong>Inspection, coverage, quality</strong></li>
            <li><span>Decision</span><strong>Caller-owned write</strong></li>
          </ol>
        </div>
      </div>
    </section>

    <section class="pp-learn-routes" id="choose-by-background" aria-labelledby="learn-background-title">
      <header class="learn-section-heading">
        <div>
          <p class="eyebrow">Choose by background</p>
          <h2 id="learn-background-title">Begin with the concepts you already know</h2>
        </div>
        <p>Each route translates familiar ideas first, then converges on the same typed system path, task Guides, and exact Reference.</p>
      </header>

      <div class="pp-learn-route-grid pp-learn-route-grid--audiences">
        <a class="pp-learn-route-card pp-learn-route-card--guides crystal-surface" href="explanation/from_sql/">
          <span class="pp-learn-route-card__icon"><img src="../shared/icons/code-braces-box.svg" alt=""></span>
          <span class="pp-learn-route-card__copy">
            <small>I know relational SQL</small>
            <strong>Start from clauses and schemas</strong>
            <span>Translate tables, clauses, joins, execution, and current SQL differences before opening the query-block tutorial.</span>
          </span>
          <b aria-hidden="true">→</b>
        </a>

        <a class="pp-learn-route-card pp-learn-route-card--reference crystal-surface" href="explanation/from_spark/">
          <span class="pp-learn-route-card__icon"><img src="../shared/icons/table-check.svg" alt=""></span>
          <span class="pp-learn-route-card__copy">
            <small>I know Spark or DataFrame APIs</small>
            <strong>Start from lazy transformations</strong>
            <span>Map sessions, carriers, transformations, actions, observations, and the current streaming boundary.</span>
          </span>
          <b aria-hidden="true">→</b>
        </a>

        <a class="pp-learn-route-card pp-learn-route-card--architecture crystal-surface" href="explanation/what_incql_is/">
          <span class="pp-learn-route-card__icon"><img src="../shared/icons/database-cog-outline.svg" alt=""></span>
          <span class="pp-learn-route-card__copy">
            <small>I know databases or query engines</small>
            <strong>Start from ownership boundaries</strong>
            <span>See what IncQL owns, what an adapter owns, and why IncQL is not storage, transactions, or a general SQL server.</span>
          </span>
          <b aria-hidden="true">→</b>
        </a>

        <a class="pp-learn-route-card pp-learn-route-card--guides crystal-surface" href="quickstart/">
          <span class="pp-learn-route-card__icon"><img src="../shared/icons/flash-outline.svg" alt=""></span>
          <span class="pp-learn-route-card__copy">
            <small>I build Incan applications</small>
            <strong>Run one result in ten minutes</strong>
            <span>Resolve the local package, register a CSV, build checked deferred work, collect it, and verify the evidence.</span>
          </span>
          <b aria-hidden="true">→</b>
        </a>
      </div>
    </section>

    <section class="pp-learn-routes" aria-labelledby="learn-routes-title">
      <header class="learn-section-heading">
        <div>
          <p class="eyebrow">Choose by intent</p>
          <h2 id="learn-routes-title">Choose the route that matches your task</h2>
        </div>
        <p>Use the book for a connected journey, or enter the documentation exactly where your current question begins.</p>
      </header>

      <div class="pp-learn-route-grid">
        <a class="pp-learn-route-card pp-learn-route-card--guides crystal-surface" href="how-to/">
          <span class="pp-learn-route-card__icon"><img src="../shared/icons/table-check.svg" alt=""></span>
          <span class="pp-learn-route-card__copy">
            <small>Do a task</small>
            <strong>Guides</strong>
            <span>Start with an outcome such as inspecting lineage, observing quality, or writing a result.</span>
          </span>
          <b aria-hidden="true">→</b>
        </a>

        <a class="pp-learn-route-card pp-learn-route-card--reference crystal-surface" href="reference/">
          <span class="pp-learn-route-card__icon"><img src="../shared/icons/file-tree-outline.svg" alt=""></span>
          <span class="pp-learn-route-card__copy">
            <small>Look something up</small>
            <strong>Reference</strong>
            <span>Find current types, signatures, operators, records, and behavior contracts.</span>
          </span>
          <b aria-hidden="true">→</b>
        </a>

        <a class="pp-learn-route-card pp-learn-route-card--architecture crystal-surface" href="../architecture/">
          <span class="pp-learn-route-card__icon"><img src="../shared/icons/source-branch.svg" alt=""></span>
          <span class="pp-learn-route-card__copy">
            <small>Understand the system</small>
            <strong>Architecture</strong>
            <span>Follow typed intent through Prism, Substrait, Session, execution, and evidence.</span>
          </span>
          <b aria-hidden="true">→</b>
        </a>
      </div>
    </section>

    <section class="pp-learn-models crystal-surface" id="mental-models" aria-labelledby="mental-models-title">
      <header class="learn-section-heading">
        <div>
          <p class="eyebrow">Two recurring questions</p>
          <h2 id="mental-models-title">Build the right mental model</h2>
        </div>
        <p>These explanations establish the ownership boundaries that recur throughout the book.</p>
      </header>

      <div class="pp-learn-concepts">
        <a href="explanation/dataset_carriers/">
          <img src="../shared/icons/table-check.svg" alt="">
          <span><small>Data state</small><strong>Dataset carriers</strong><span>Deferred, materialized, bounded, and unbounded data—and why only <code>LazyFrame[T]</code> owns Prism state today.</span></span>
          <b aria-hidden="true">→</b>
        </a>
        <a href="explanation/execution_context/">
          <img src="../shared/icons/database-cog-outline.svg" alt="">
          <span><small>Runtime ownership</small><strong>Execution context</strong><span>What a <code>Session</code> owns, when a plan reaches a backend, and where observations enter the flow.</span></span>
          <b aria-hidden="true">→</b>
        </a>
      </div>

      <aside class="pp-learn-boundary-note">
        <img src="../shared/icons/shield-check-outline.svg" alt="">
        <p><strong>The book keeps its boundaries visible.</strong> The project uses IncQL as a local path dependency and DataFusion as the implemented backend. The model parameter records the intended row shape; the Session discovers the CSV schema. Full CSV-to-model compatibility validation is not implemented yet.</p>
      </aside>
    </section>
  </main>
</div>
