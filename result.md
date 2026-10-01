# IncQL Incan 0.6.0-dev.6 migration result

Toolchain: `incan 0.6.0-dev.6`, source commit `614df3645bfd213d9f1b867acac066ed051b5542`.

Pre-amend migration commit: `e19cfbec844f20ed4cf57cd4ec551de9535112fd`. This report is included in the amended commit, whose object ID necessarily differs.

## Target results

- `$INCAN --version`: passed; printed `incan 0.6.0-dev.6`.
- Root `incan lock`: passed and wrote the canonical `oven.lock`.
- `make build-locked`: source checking first reported the obsolete monolithic Rust facet import `rust::incan_stdlib`; after migrating those imports to `rust::incan_std_core` and `rust::incan_std_async`, the target reached the expected stale-lock refusal. The root lock was then regenerated.
- `make bake`: failed in Incan's Oven compatibility publisher after the root source passed checking. The failure is the Incan defect recorded below.
- `make build`: not run; stopped at the Incan defect as instructed.
- `make test`: not run; stopped at the Incan defect as instructed.
- `make tutorial-book`: not run; stopped at the Incan defect as instructed.
- `make quickstart`: not run; stopped at the Incan defect as instructed.
- Example `incan lock` attempts: refused because dev.6 requires the root `pub::incql` provider Loaf to be baked first. The provider bake then hit the Incan defect. Legacy non-root `incan.lock` files were removed because dev.6 reads no `incan.lock`; no old-format lock was relabeled as a valid `oven.lock`.

No RFC 129 rebound-binding diagnostic was reported before the compatibility publisher failure. Test checking did not run after the defect.

## Root lock

- Path at the new commit: `oven.lock`.
- Base `b1a5c57` `incan.lock` SHA-256: `24dc985cc81332b6d8620407f8d95089a563381d296245d76d384f3463c337bb`.
- New `oven.lock` SHA-256: `c01fdc7b7b0dd1b036dc3b7f7d7ee0a6457151d6327214116849ced8691a4679`.
- Embedded Cargo projection SHA-256 before migration: `083791b01c1a67ae66aca99070c9ee48082d04307473d494376e6de7cf9a654a`.
- Embedded Cargo projection SHA-256 after migration: `083791b01c1a67ae66aca99070c9ee48082d04307473d494376e6de7cf9a654a`.

The full lock digest changed because dev.6 rewrote the compiler version, dependency fingerprint, and semantic/provider metadata. The embedded Cargo projection is byte-identical to `b1a5c57`, so the root Rust/Cargo resolution did not change.

## Incan defect

Target: `make bake`, during the Oven compatibility publisher's offline Cargo metadata step.

Exact terminal error after prefetching the generated Cargo manifest into an explicit writable `CARGO_HOME`:

```text
Oven internal compatibility publisher failed: error: failed to select a version for the requirement `async-compression = "^0.4.40"` (locked to 0.4.50)
candidate versions found which didn't match: 0.4.49, 0.4.45, 0.4.44, ...
location searched: crates.io index
required by package `datafusion-datasource v53.1.0`
    ... which satisfies dependency `datafusion-datasource = "^53.1.0"` (locked to 53.1.0) of package `datafusion v53.1.0`
    ... which satisfies dependency `datafusion = "^53"` (locked to 53.1.0) of package `incql v0.1.0 (/Volumes/Builds/incql-dev6/target/incan_lock/rust_inspect/incql-d14cbcbb41f87883)`
note: offline mode (via `--offline`) can sometimes cause surprising resolution failures
help: if this error is too confusing you may wish to retry without `--offline`
make: *** [bake] Error 1
```

Minimal reproduction from this checkout:

```sh
export INCAN=/path/to/incan-0.6.0-dev.6/bin/incan
export INCAN_HOME=$(mktemp -d)
export CARGO_HOME=$(mktemp -d)

$INCAN lock
make bake INCAN="$INCAN" || true
cargo fetch --manifest-path "$(find target/incan_lock/rust_inspect -name Cargo.toml -print -quit)"
make bake INCAN="$INCAN"
```

The explicit Cargo home contains `async-compression 0.4.50` and the rest of the generated lock's registry closure. Dev.6 calls `clear_inherited_cargo_environment` before the compatibility publisher's offline Cargo subprocess; that removes `CARGO_HOME`, so the subprocess consults the ambient default Cargo cache instead of the prepared cache. The same source path is `loaves/oven/oven_cargo_compat/src/lib.rs` in the specified Incan revision. No IncQL workaround was added.

## Open item

Incan has no released `v0.6.0-dev.6` archive. IncQL's source-build CI is pinned to commit `614df3645bfd213d9f1b867acac066ed051b5542` and expects `0.6.0-dev.6`. Any CI lane that downloads an authenticated released archive must remain on its existing released pin until a dev.6 archive and checksum exist.

## Incan 0.6 inference and const follow-up

No compiler gate was run for this follow-up because the sandbox cannot provide the prefetched crate environment and Incan #1976 remains outside IncQL. During a final report line-number lookup, shell expansion accidentally invoked `make bake`; it failed immediately at project discovery because the target still looked for `incan.toml`, before checking or building IncQL. Validation was limited to exhaustive textual searches, `git diff --check`, and review of the resulting diff.

Changed sites:

- `src/dataset/mod.incn`: line 386 now passes enclosing `T` to `prism_cursor_named_table`; lines 400, 462, 480, 498, 522, 531, 540, 549, 558, 567, and 575 now pass enclosing `T` to `_empty_type_witness`.
- `src/session/types.incn`: line 1261 now passes enclosing `T` to `_empty_type_witness`.
- `src/substrait/generator_payload.incn`: line 10 now annotates deeply immutable `_MAGIC` as `FrozenList[int]`.
- `examples/dataset_api.incn`: lines 30 and 42 now pass `Customer` and `Order`, respectively, to zero-argument generic `select` calls.
- `tests/test_dataset.incn`: line 504 now passes `Order` to the zero-argument generic `select` call.
- `tests/test_session_projection.incn`: line 677 now passes `AggregateOrder` to the zero-argument generic `select` call.
- `tests/test_prism.incn`: `prism_cursor_named_table` now receives `Order` explicitly at lines 68, 89-90, 105, 129, 150-151, 169-170, 192-193, 216-217, 238-239, 260-261, 265-267, 270, 290, 304, 320, 324, 341, 365, 384, 400, 422, 434, and 454; zero-argument generic `select` now receives `Order` explicitly at lines 107, 131, and 260.

The repository-wide audit found no remaining bare `_empty_type_witness()`, bare `prism_cursor_named_table(...)`, or zero-argument `.select()` generic calls. The other zero-argument generic functions, `row_shape_from_type` and `schema_description_for_type`, already had explicit type arguments at every call. No other `const` declaration used a mutable `list`, `dict`, or `set` annotation.
