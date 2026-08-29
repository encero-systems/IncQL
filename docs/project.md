# Project

Everything about IncQL itself: the decisions behind it, how it is built and released, and how to contribute one.

<div class="incql-hub" markdown>

<article class="incql-hub__card incql-hub__card--wide" markdown>
<p class="incql-section-kicker">Design records</p>

## Why IncQL is shaped this way

Normative design lives in **RFCs**; longer-form exploration lives in **whitepapers**. Both are durable records, not current-state documentation — for what the package does today, use [Reference][reference].

<div class="incql-hub__links" markdown>
[**RFCs** <span>Numbered, normative design decisions and their status</span>][rfcs]
[**Whitepapers** <span>Longer-form exploration beyond a single decision</span>][whitepapers]
[**Design records overview** <span>How the two fit together</span>][design-records]
</div>
</article>

<article class="incql-hub__card" markdown>
<p class="incql-section-kicker">Build and release</p>

## How it is put together

<div class="incql-hub__links" markdown>
[**Contributor architecture** <span>System boundaries mapped to modules, build commands, and the compiler seam</span>][contributor-architecture]
[**Docs map** <span>Compact inventory of the documentation set</span>][docs-map]
[**Release notes** <span>Shipped, user-visible changes</span>][release-notes]
</div>
</article>

<article class="incql-hub__card" markdown>
<p class="incql-section-kicker">Contribute</p>

## How to add to it

<div class="incql-hub__links" markdown>
[**Writing RFCs** <span>The design-record workflow and formatting contract</span>][writing-rfcs]
[**RFC template** <span>Start a new record from the canonical shape</span>][rfc-template]
[**Prismplane docs theme** <span>The site's visual and authoring conventions</span>][theme]
[**CONTRIBUTING guide** <span>Setup, testing, pull requests, and release hygiene</span>][contributing]
</div>
</article>

</div>

Looking for how to *use* IncQL rather than how it is made? Start at [Learn][learn], answer a specific question in [Guides][guides], or look up an exact contract in [Reference][reference].

<!-- References -->
[contributing]: https://github.com/encero-systems/IncQL/blob/main/CONTRIBUTING.md
[contributor-architecture]: contributing/architecture.md
[design-records]: design_records.md
[docs-map]: docs_map.md
[guides]: language/how-to/README.md
[learn]: language/README.md
[reference]: language/reference/README.md
[release-notes]: release_notes/v0_1.md
[rfc-template]: rfcs/TEMPLATE.md
[rfcs]: rfcs/README.md
[theme]: contributing/prismplane_docs_theme.md
[whitepapers]: whitepapers/README.md
[writing-rfcs]: contributing/writing_rfcs.md
