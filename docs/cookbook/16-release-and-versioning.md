# 16 · Release and versioning

> **Intent:** Specify SemVer interpretation, schema versioning, changelog workflow, release-checklist, and distribution-channel policy.
> **Reads-with:** `01-vision-and-goals`, `06-data-contracts`, `17-security-and-compliance`.

## SemVer

- The project follows SemVer 2.0 strictly.
- `0.x.y` until the first stable release. **`0.1.0` is the first release with all gates green** (see `14-gates-catalogue`).
- `1.0.0` freezes the public CLI surface and the config schema.
- After `1.0.0`, any breaking change in CLI flags, config shape, or schema version requires a major bump and a deprecation window of at least one minor release with a documented migration path.

## Pre-`1.0.0` policy

- The CLI surface MAY change between `0.x` minors with a CHANGELOG note.
- The config schema MAY add fields without bumping `version` (additive); removing or restructuring fields bumps `version` and triggers the auto-migration code path.
- The widget set MAY add widgets between minors without notice; removing a widget requires a deprecation in one minor and removal in the next.

## Schema version is independent of package version

The config schema carries its own `version` integer. The two version numbers move independently:

| Scenario                                  | Package version | Schema version |
| ----------------------------------------- | --------------- | -------------- |
| Bug fix in renderer; no schema change     | `0.1.1`         | `1`            |
| New widget added; old configs still valid | `0.2.0`         | `1`            |
| Schema restructure                        | `0.3.0`         | `2`            |
| Breaking schema change post-1.0           | `2.0.0`         | `3`            |

### Migration rules

- A binary at schema version `N` reading a config at version `M < N` **auto-migrates** in-memory and writes a `.bak` of the prior config alongside the migrated one.
- A binary at schema version `N` reading a config at version `M > N` **refuses** with a structured error: "this config was written by a newer binary; upgrade the binary or downgrade the config".
- Migration code is **append-only**: once a migration step is shipped, it never changes, even if the schema evolves further. New steps stack on top.

## Tag ↔ package version

- `package descriptor`'s `version` field MUST equal the latest annotated tag of the form `vX.Y.Z` on `main`.
- Tags are signed (GPG or Sigstore).
- The release workflow refuses to publish if the descriptor version and the tag disagree.

## Changelog

- Format: **Keep a Changelog**.
- One section per release plus `[Unreleased]`.
- Entries grouped under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Each entry: `<short SHA> — <intent>: <change>`. No spec paragraph citations in changelog bullets (those belong in commit bodies and PR descriptions).

### Fragment-per-PR workflow

- Each PR that touches user-visible behaviour drops a single fragment file under `changelog/<NN>-<slug>.md`.
- Fragments are one bullet; no SHA prefix (the aggregator adds it at release time).
- An aggregator script promotes all fragments into `CHANGELOG`'s `[Unreleased]` section at release time, then archives the fragment files.
- This pattern keeps merge conflicts on the changelog at zero — by construction, each PR owns its own file.

## Release checklist

Before tagging `vX.Y.Z`:

1. All gates green on `main`.
2. The platform matrix is green on the latest commit.
3. `CHANGELOG`'s `[Unreleased]` section is promoted to `[X.Y.Z] — YYYY-MM-DD`.
4. The package descriptor's `version` is set to `X.Y.Z`.
5. README badges resolve (no 404s).
6. `<bin> doctor` exits `0` on a fresh host.
7. `<bin> install && <bin> uninstall` leaves a clean tree.
8. Release notes are drafted from the CHANGELOG.
9. The publish workflow ran successfully — package on registry passes `<install-cmd> && <bin> version`.
10. Release artefacts attached to the SCM release page (where the platform supports it): published checksum (`SHA256SUMS`), provenance attestation, source tarball.

## Distribution channels

### Primary (v0.1.0)

The language's native package registry. Examples:

- TypeScript / Node: `@<org>/<product>` on npm with `--provenance`.
- Rust: crates.io with `cargo publish`.
- Python: PyPI with `twine upload`.
- Go: tagged GitHub release + `go install`.

Whichever channel is chosen, two non-negotiables:

- **Reproducible builds.** The same source ⇒ the same artefact bytes.
- **Provenance.** Each release carries an attestation linking the artefact to the source commit it was built from (SLSA, Sigstore, or platform equivalent).

### Deferred (after v0.1.0)

- Package managers other than the primary registry (Homebrew tap, apt PPA, scoop bucket).
- Native single-file binaries distributed via SCM releases.
- `curl … | sh` installer (refused outright — supply-chain hygiene).

## Release cadence

- **Patch releases** as needed; aim for same-week response to a Sev-1 / Sev-2 bug.
- **Minor releases** roughly monthly when there is new functionality.
- **Major releases** intentional; pre-announce at least one minor release ahead.
- **Security releases** out-of-band; do not block on the regular cadence.

## Build provenance

- Every release artefact is built in CI from the tagged commit (no local-machine artefacts allowed in the publish flow).
- The CI workflow that publishes is the **only** workflow with the publish credential (issued via OIDC, never a long-lived secret).
- Pinned actions / steps by SHA, not tag.
- The same commit hash appears in: the artefact metadata, the changelog entry, the release page, and (where supported) the registry's provenance UI.

## Yanking and revocation

If a release ships with a Sev-1 bug:

1. Decide between yank-and-republish (preferred) or patch-release (when republishing would break downstream installs already pinned).
2. Yank the broken version on the registry (do not delete — yanking preserves resolvers' ability to error meaningfully).
3. Release a fixed version with a CHANGELOG entry under `Security` or `Fixed`.
4. File a security advisory if user data or trust was at risk.

## Versioning anti-patterns to avoid

- Pre-1.0 breaking changes without a CHANGELOG entry.
- Schema version bumps without a migration step.
- Tag-only changes (a tag pointing at a different commit than what was tested).
- "Re-publishing" the same version with different contents.
- Long-lived `[Unreleased]` sections (release more often).

## Skill-file lifecycle

The shipped subagent skill files under `agents/` (see `04 · State surfaces` and `08 · Shipped agent skills`) are **byte-coupled to the package version**, and the install / uninstall lifecycle deliberately leans on that coupling.

### Adding a skill file

- Drop it under `agents/<product>-<slug>.md` with a YAML frontmatter `description:` (the host's dispatch contract) and a body that follows the length envelope from `15 · Shipped skill files`.
- The installer copies every file in `agents/` whose name matches the shipped prefix; no registry change is required.
- A changelog fragment under `Added` notes the new dispatch surface.

### Editing a skill file

- Edit in place. The new bytes become the canonical "shipped" content for the next release.
- Users who already installed the prior version keep their on-disk copy at the **previous** bytes. The byte-match check at uninstall therefore stops matching for them until they reinstall.
- An `Added` / `Changed` changelog entry tells those users what changed; they can re-run `<bin> install --force` (or `<bin> reset`) to take the new content.

### Removing a skill file

- Delete the file from `agents/` and add a `Removed` entry to the changelog.
- The installer no longer ships it, so new installs do not place it.
- Existing installs keep the file on disk; `uninstall` will not delete it because the byte-match check fails against a file the current shipped set does not contain. Users have to remove it manually or pass `--purge`.

### Why byte-match, not a manifest

A manifest file listing every shipped skill file would let `uninstall` delete files that no longer exist in `agents/`. We avoided it for two reasons: it doubles the chances of drift (now the manifest can disagree with the directory), and it tempts the installer into deleting **edited** user content. Byte-matching is conservative: it preserves anything the user touched, at the cost of leaving stale files on disk after a `Removed` release.

### Future gate (out of scope at v0.1)

A gate that fails when a skill file's SHA changes within a point release (e.g. `0.1.0` → `0.1.1`) would tighten the contract: skill files would then only change on minor / major bumps. This is a reasonable v0.2 ask; the current contract is the trust floor.
