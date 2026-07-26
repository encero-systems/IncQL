"""Structural contracts for the public IncQL learning system."""

from __future__ import annotations

from pathlib import Path
import unittest

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS_ROOT = REPO_ROOT / "docs"

AUDIENCE_ROUTES = {
    "language/quickstart.md": "Ten-minute",
    "language/explanation/from_sql.md": "SQL",
    "language/explanation/from_spark.md": "Spark",
    "language/explanation/what_incql_is.md": "is not",
}

GUIDE_CONTRACT_HEADINGS = (
    "## When to use this",
    "## Before you begin",
    "## Verify the result",
    "## Current support and failure boundaries",
    "## Reference",
)


def _read(relative_path: str) -> str:
    return (DOCS_ROOT / relative_path).read_text(encoding="utf-8")


class LearningSystemContractTests(unittest.TestCase):
    """Keep routes, guide contracts, and capability truth aligned."""

    def test_audience_routes_exist_and_name_their_reader_bridge(self) -> None:
        for relative_path, required_text in AUDIENCE_ROUTES.items():
            with self.subTest(path=relative_path):
                page = DOCS_ROOT / relative_path
                self.assertTrue(page.is_file(), f"missing audience route: {relative_path}")
                self.assertIn(required_text, page.read_text(encoding="utf-8"))

    def test_every_task_guide_uses_the_standard_contract(self) -> None:
        guide_root = DOCS_ROOT / "language" / "how-to"
        guides = sorted(path for path in guide_root.glob("*.md") if path.name != "README.md")
        self.assertTrue(guides, "no task guides were discovered")
        for guide in guides:
            with self.subTest(guide=guide.name):
                text = guide.read_text(encoding="utf-8")
                positions = [text.find(heading) for heading in GUIDE_CONTRACT_HEADINGS]
                self.assertNotIn(-1, positions, f"{guide.name} does not satisfy the guide contract")
                self.assertEqual(
                    positions,
                    sorted(positions),
                    f"{guide.name} guide-contract headings are out of order",
                )

    def test_capability_dependent_guides_state_limits_before_code(self) -> None:
        expected_limits = {
            "language/how-to/variant_payloads.md": "DataFusion",
            "language/how-to/typed_hll_sketches.md": "DataFusion",
            "language/how-to/approximate_metrics.md": "DataFusion",
        }
        for relative_path, limit_text in expected_limits.items():
            with self.subTest(path=relative_path):
                text = _read(relative_path)
                self.assertIn(limit_text, text)
                self.assertLess(
                    text.index(limit_text),
                    text.index("```incan"),
                    f"{relative_path} must state adapter limits before its first example",
                )

    def test_navigation_exposes_the_route_first_information_architecture(self) -> None:
        config = yaml.safe_load((REPO_ROOT / "mkdocs.yml").read_text(encoding="utf-8"))
        nav_text = repr(config["nav"])
        for label in (
            "Ten-minute quickstart",
            "From SQL",
            "From Spark and DataFrame APIs",
            "What IncQL is and is not",
            "Start and connect",
            "Transform and query",
            "Inspect and trust",
            "Advanced and capability-dependent",
            "Runtime and I/O",
            "Interchange and adapter authoring",
            "Backend capability matrix",
        ):
            with self.subTest(label=label):
                self.assertIn(label, nav_text)

    def test_docs_map_routes_by_reader_and_intent(self) -> None:
        docs_map = _read("docs_map.md")
        for heading in (
            "## Choose by background",
            "### I know SQL",
            "### I know Spark or DataFrame APIs",
            "### I know databases or query engines",
            "### I build Incan applications",
            "## Choose by intent",
            "## Specialist tracks",
        ):
            with self.subTest(heading=heading):
                self.assertIn(heading, docs_map)

    def test_capability_matrix_covers_known_current_boundaries(self) -> None:
        matrix = _read("language/reference/capabilities.md")
        for truth in (
            "DataStream",
            "future work",
            "typed variant",
            "rejected",
            "DataFusion",
            "CSV",
            "Parquet",
            "Arrow",
            "observations",
        ):
            with self.subTest(truth=truth):
                self.assertIn(truth, matrix)

    def test_landing_page_does_not_present_roadmap_capabilities_as_current(self) -> None:
        landing = _read("index.md")
        for unsupported_claim in (
            "Run it anywhere",
            "cost-based optimizations",
            "Smart optimizer",
            "<strong>DuckDB</strong>",
            "<strong>Spark</strong>",
            "Other Substrait consumers",
            "Python, Rust, JS",
            "Polars, Ibis, DataFusion",
            "Airflow, dbt, custom",
        ):
            with self.subTest(claim=unsupported_claim):
                self.assertNotIn(unsupported_claim, landing)

        for implemented_boundary in (
            "Query blocks",
            "Carrier methods",
            "Prism evidence",
            "DataFusion today",
            "Portable Substrait plan",
            "Explicit adapter seam",
        ):
            with self.subTest(boundary=implemented_boundary):
                self.assertIn(implemented_boundary, landing)

    def test_quickstart_is_wired_into_docs_change_detection(self) -> None:
        docs_workflow = (REPO_ROOT / ".github" / "workflows" / "docs.yml").read_text(encoding="utf-8")
        self.assertIn('"examples/quickstart/**"', docs_workflow)

    def test_custom_header_keeps_mobile_navigation_reachable(self) -> None:
        header = _read("overrides/partials/header.html")
        self.assertIn('type="button"', header)
        self.assertIn('aria-controls="__drawer"', header)
        self.assertIn("data-site-nav-toggle", header)
        self.assertIn('aria-label="Open navigation"', header)

    def test_landing_assets_are_local_and_responsive(self) -> None:
        landing = _read("index.md")
        theme = _read("stylesheets/prismplane.css")
        stylesheets = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (DOCS_ROOT / "stylesheets").glob("*.css")
        )

        self.assertIn("prismplane-hero-light.webp", landing)
        self.assertIn('width="1672" height="941"', landing)
        self.assertIn("semantic-convergence-wide.webp", theme)
        self.assertNotIn("fonts.googleapis.com", stylesheets)

        for relative_path in (
            "shared/fonts/manrope-latin.woff2",
            "shared/fonts/manrope-latin-ext.woff2",
            "shared/fonts/outfit-latin.woff2",
            "shared/fonts/outfit-latin-ext.woff2",
            "shared/prismplane/prismplane-hero-light.webp",
            "shared/prismplane/semantic-convergence-wide.webp",
        ):
            with self.subTest(path=relative_path):
                self.assertTrue((DOCS_ROOT / relative_path).is_file())


if __name__ == "__main__":
    unittest.main()
