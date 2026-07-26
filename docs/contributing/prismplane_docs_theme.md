# Prismplane docs theme

Prismplane is IncQL's documentation visual language: optical planning surfaces, transparent schema panes, refracted rails, and structure-first decoration. The source inspiration is the local prototype at `/Users/danny/Development/encero/prototypes/incql-prismplane-v6/`; that prototype is a design handoff, not production site code.

IncQL is also the reference implementation for a wider Encero documentation system. Reuse should happen through stable interaction patterns, content contracts, and design tokens; product-specific names, colors, illustrations, and information architecture remain brand layers. Extract a shared package only after more than one site has proved which seams are genuinely common.

## Design rules

- Tables, code blocks, schema examples, and query snippets should carry more visual authority than decorative panels.
- Primary visuals should show IncQL product reality: source code, typed schemas, Prism plan shape, lineage, Substrait boundaries, adapter coverage, quality evidence, or similarly inspectable state.
- Avoid vague generated hero art. If a visual does not help a reader understand IncQL's data logic surface, replace it with a grounded product visual.
- Color belongs in rails, edge behavior, focus states, and signal accents; long-form prose should stay calm and readable.
- Glass effects should support inspectability. If a treatment makes text, navigation, or code harder to read, simplify it.
- IncQL should feel analytical and typed, not ceremonial. Do not copy Incan's Incapunk forged-metal tone directly.
- The landing page can be more expressive than reference pages, but ordinary Markdown pages must still look complete without local wrappers.

## Implementation model

The production theme is an ordered, explicit cascade rather than a two-file skin. Load order in `mkdocs.yml` is part of
the contract:

1. `prismplane.css` owns Material layout adaptation, landing-page structure, shared product components, and ordinary
   reading-page structure.
2. `crystalline.css` owns shared optical tokens, the global readable type scale, and common crystal material.
3. `crystal-prototype.css` owns the accepted shell primitives (`topbar`, rails, and generic crystal surfaces).
4. `crystal-architecture.css` owns the architecture story's component geometry and states.
5. `crystal-integration.css` adapts the prototype components to MkDocs-generated markup and must follow the prototype
   files it integrates.
6. `crystal-learn.css` owns the Learn landing page.
7. `crystal-book.css` owns Book navigation and book/concept-page refinements.

Page-specific files may refine shared primitives only beneath their page root. Do not add a new global override when an
existing owner can express the change, and do not reorder these files without browser QA of the landing, Learn, Book,
Architecture, RFC reader, and an ordinary reference page.

Manrope and Outfit are self-hosted under `docs/shared/fonts/` with their OFL license files. Keep the `@font-face`
declarations and global font variables in `crystalline.css`; do not reintroduce a runtime Google Fonts import in a
later stylesheet. Expressive landing imagery should ship an optimized WebP source with its original PNG as a fallback,
and content images must declare intrinsic dimensions so they do not shift the page while loading.

`docs/javascripts/crystalline.js` contains the progressive enhancement for the architecture boundary tour. Keep the
implementation in Material-friendly CSS and normal Markdown first:

- use Material navigation, search, code blocks, tables, admonitions, and task lists
- keep custom landing-page classes limited to `docs/index.md`
- avoid page-specific HTML when a normal Markdown heading, table, list, or admonition would work
- prefer editing existing CSS sections over appending late override piles
- use `mkdocs build --strict` before publishing docs changes

Use three levels of optical intensity:

- expressive crystal for landing-page heroes, primary diagrams, and selected states
- matte glass for dense readers, technical cards, and explanatory panels
- calm Material surfaces for long prose, code, tables, and reference detail

Do not add decorative corner flares or repeated glowing dots to every surface. A crystal edge, subtle internal facet, and restrained shadow are enough; dense panels should not compete with their content. Keep supporting text at a comfortable 100% browser zoom, and treat any copy that needs 125% zoom as a typography defect rather than a user preference.

Interactive optical treatments must remain progressive enhancements. The architecture path uses real buttons, tabs, reduced-motion behavior, keyboard navigation, and a fixed-height desktop inspector so changing boundaries does not shift the story below it. Hover can preview a boundary, while click makes the selection explicit and pauses the automatic tour.

Interactive documentation components follow the same split:

- source Markdown and repository metadata remain the source of truth
- a build-time, standard-library generator validates and serializes portable data
- ordinary Markdown remains visible as the no-JavaScript and failed-enhancement fallback
- JavaScript enhances that data with search, filters, keyboard behavior, and URL state
- component CSS uses local `--pp-*` tokens, so another product can substitute its brand layer without rewriting behavior

The RFC Context Reader is the first component built to this contract. Its filtering and master-detail behavior are product-neutral; IncQL supplies the RFC metadata schema, controlled tag vocabulary, assignments, and Prismplane appearance.

For a second site, start by supplying its project label, intentional RFC-number gaps, controlled tag configuration, and `--pp-docs-*` color tokens. Keep the generated-data shape and reader interaction contract unchanged first. Only extract shared files after that port demonstrates which configuration points are real rather than IncQL-specific assumptions.

The source tag catalog has a deliberately small, portable schema:

```json
{
  "definitions": {
    "planning": "Planning",
    "evidence": "Evidence"
  },
  "records": {
    "030": ["planning", "evidence"]
  }
}
```

The generator resolves those keys into each reader record as `"tags": [{"key": "planning", "label": "Planning"}]`. Keys are stable URL and data identifiers; labels are presentation text. A record must have one to three tags, with four reserved for genuinely cross-cutting program or platform RFCs.

The reader treats multiple tags as an intersection: selecting Planning and Evidence shows records that carry both. URL state uses one sorted, repeated parameter per selection (`?tag=evidence&tag=planning`), so filtering can be bookmarked, shared, and restored through browser history. Clicking a tag in the detail pane toggles that same filter; clearing tags removes every `tag` parameter. Keep this data and interaction contract stable when porting the component even if the vocabulary, typography, and colors change.

Reader controls belong to the surface they affect. Free-text search and tag facets share one stable-height search shell; selected tags become compact tokens inside that shell. Status filtering and status sorting live in the Status column header on desktop, with the same disclosure moved into the toolbar when that column is hidden on mobile. Query, status, sort, and repeated tag parameters remain bookmarkable, while open popovers stay transient and never enter history.

The desktop documentation navigation can collapse to a narrow restore rail. That preference persists across ordinary documentation pages, but it does not replace or alter Material's mobile drawer. Custom full-width pages can continue hiding the primary sidebar entirely.

## User experience target

The docs should answer a new user's first questions quickly:

1. What is IncQL?
2. Which task should I start with?
3. Where is the current API reference?
4. How do query blocks, dataset carriers, Prism, Substrait, sessions, and governance evidence fit together?

If a page cannot answer one of those questions directly, it should still make the next useful page obvious through links and navigation.
