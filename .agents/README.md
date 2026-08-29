# Agent resources

Skills and reference material for AI agents working on **IncQL**.

`.claude/skills` is a symlink to `.agents/skills`, which is how Claude Code
discovers them. The same wiring exists in the Incan repository.

## Provenance

These skills were copied from `incan/.agents/skills` so IncQL has the same
workflows available. They are **copies, not symlinks**, precisely so they can
diverge: several still assume an Incan checkout and need adapting before their
guidance is correct here.

Known to reference Incan-only concerns — `cargo`, `crates/`, clippy, rustc, or
`workspaces/docs-site`:

`bump-rfc` · `create-plan` · `create-pr-description` ·
`orchestrate-parallel-work` · `ralph-loop` · `review` · `review-and-fix` ·
`review-docs-claims` · `review-incan-source-quality` · `review-orchestrate` ·
`review-rfc` · `review-scope` · `start-work` · `test` · `write-rfc`

The IncQL equivalents are usually `make ci` (`fmt-check`, `test-style`,
`vocab-companion-test`, `bake`, `registry-metadata`, `build`, `test`) rather
than `cargo test` and clippy, and `docs/rfcs/` rather than
`workspaces/docs-site/docs/RFCs/`. `review-incan-source-quality` is about the
Rust compiler workspace and has no IncQL counterpart today.

Until a skill is adapted, treat its Incan-specific steps as guidance to
translate, not instructions to follow literally. `AGENTS.md` remains
authoritative where the two conflict.

## Conventions these encode

- Commit subjects: `<type> - <short description> (<#issue>)`. IncQL's history
  also uses `docs` as a type, which the Incan standard does not list.
- PR bodies follow `.github/pull_request_template.md`.

## Not copied

`learnings.md` and `test-suite.md` stayed in the Incan repository. Both are
about the Rust compiler workspace — its test orchestration and its
implementation history — and would be misleading here.
