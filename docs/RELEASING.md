# Releasing `@odere-pro/agentline`

The release pipeline is automated. To cut version `X.Y.Z`, push an annotated
`vX.Y.Z` tag from `main` — the [`release.yml`](../.github/workflows/release.yml)
workflow handles everything from that point: tag↔version check, full gate
suite, `npm publish --provenance`, GitHub Release with tarball + `SHA256SUMS`.

## One-time setup (already done for the org)

- npm account that maintains the `@odere-pro` scope.
- GitHub repo secret `NPM_TOKEN` (npm Automation or granular token scoped
  to `@odere-pro/agentline` with publish rights). Stored at
  `Settings → Secrets and variables → Actions`.

## Cut a release

From a clean `main` with the changes you want to ship already merged:

1. **Bump the version** in two places (keep them in lock-step):
   - `package.json` → `"version": "X.Y.Z"`
   - `src/version.ts` → `AGENTLINE_VERSION = "X.Y.Z"`

2. **Update `CHANGELOG.md`**: rename the existing `## [Unreleased]` heading
   to `## [X.Y.Z] — YYYY-MM-DD`, and add a fresh empty `## [Unreleased]`
   block above it. The workflow extracts the `## [X.Y.Z]` block verbatim as
   the GitHub Release body.

3. **Format**:

   ```bash
   npx prettier --write package.json CHANGELOG.md
   ```

4. **Verify locally** (same bar the workflow runs):

   ```bash
   pnpm install --frozen-lockfile
   pnpm run build
   pnpm test
   pnpm run typecheck
   pnpm run lint
   bash tests/gates/run-all.sh
   npm pack --dry-run        # inspect tarball contents
   ```

5. **Commit, push, tag**:

   ```bash
   git add package.json src/version.ts CHANGELOG.md
   git commit -m "chore(release): prepare vX.Y.Z"
   git push origin main
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```

6. **Watch the workflow**:

   ```bash
   gh run watch
   ```

   On success: the npm package page lists `X.Y.Z` with a provenance badge,
   and a GitHub Release `vX.Y.Z` appears with `odere-pro-agentline-X.Y.Z.tgz`
   plus `SHA256SUMS` attached.

## What the workflow enforces

- Tag `vX.Y.Z` must match `package.json#version` exactly. Mismatches abort
  before any publish.
- The `## [X.Y.Z]` block must exist in `CHANGELOG.md`. Missing blocks abort
  the release-notes step.
- `pnpm install --frozen-lockfile` must succeed — lockfile drift blocks
  the release.
- Lint, type-check, tests, and the full `tests/gates/run-all.sh` suite must
  all pass.

## If something goes wrong

- **Tag pushed by accident with the wrong version**: delete the remote tag
  (`git push --delete origin vX.Y.Z`), fix the version-bump commit, push
  the corrected tag. The workflow's concurrency key is the tag ref, so a
  re-pushed tag is allowed to re-run.
- **`npm publish` fails after the tag passed validation**: the workflow
  uploads the tarball, `SHA256SUMS`, and `RELEASE_NOTES.md` as a workflow
  artefact named `release-vX.Y.Z`. Inspect, then re-push the tag once the
  underlying issue is fixed.
- **Published a bad version**: within 72 hours `npm unpublish
@odere-pro/agentline@X.Y.Z` works; after that, ship `X.Y.Z+1` with the fix.

## Out of scope

- Manual `npm publish` from a developer machine. The token lives only in
  Actions and provenance attestation requires the OIDC issuer GitHub
  Actions provides — laptop publishes can't reproduce it.
- semantic-release / changesets. We hand-curate `CHANGELOG.md` because the
  per-chapter narrative matters more than tooling magic.
