# OpenSSF Best Practices Badge — passing-level self-assessment

This page records how `agentline` answers each criterion of the
[OpenSSF Best Practices Badge](https://www.bestpractices.dev/) **passing**
level, with a pointer to the evidence in this repository. It is the source of
truth behind the badge entry; update it whenever a criterion's evidence moves.

- **Project:** `@odere-pro/agentline` — a fast, themeable statusline for Claude Code that reads the stdin payload and writes an ANSI-styled line.
- **Implementation languages:** TypeScript, JavaScript (Node ≥ 20).
- **Last reviewed:** 2026-05-26.

Each criterion is **Met**, or **N/A** where the criterion does not apply.
Paths below are repo-relative; when filling the web form, prefix them with the
repository blob URL. Three criteria are **maintainer attestations** (activity
claims the maintainer confirms against issue/advisory history before
submitting) — see [Maintainer attestations](#maintainer-attestations).

## Cryptography: not applicable

Every `crypto_*` criterion is **N/A**. `agentline` performs no cryptography on
user data: it reads JSON from stdin and writes ANSI to stdout, stores no
passwords, and generates no cryptographic keys or nonces. The single
`node:crypto` use is `randomBytes(6)` in the atomic-write helper to pick a
collision-resistant temporary filename — not a security primitive. Release
artefacts are signed (cosign keyless + SLSA provenance), but that is delivery
pipeline tooling, not cryptography inside the produced software.

## Basics

| Criterion                   | Answer | Evidence                                                                                                                                                                       |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description_good`          | Met    | One-line description in [`README.md`](../README.md) and the `description` field of [`package.json`](../package.json).                                                          |
| `interact`                  | Met    | GitHub Issues with bug/feature/gate-failure templates ([`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/)); feedback channels in [`CONTRIBUTING.md`](../CONTRIBUTING.md). |
| `contribution`              | Met    | [`CONTRIBUTING.md`](../CONTRIBUTING.md) covers dev setup, branching, commits, PRs, tests, release.                                                                             |
| `contribution_requirements` | Met    | [`CONTRIBUTING.md`](../CONTRIBUTING.md) + [`PR-CONVENTIONS.md`](PR-CONVENTIONS.md): Conventional Commits, branch naming, PR template, required gates/tests.                    |
| `floss_license`             | Met    | MIT — [`LICENSE`](../LICENSE), `license` field in [`package.json`](../package.json).                                                                                           |
| `floss_license_osi`         | Met    | MIT is OSI-approved.                                                                                                                                                           |
| `license_location`          | Met    | [`LICENSE`](../LICENSE) at repo root; declared in [`package.json`](../package.json) and shipped in its `files` array.                                                          |
| `documentation_basics`      | Met    | [`README.md`](../README.md) + [`get-started.md`](get-started.md), [`install.md`](install.md), [`config.md`](config.md), [`troubleshooting.md`](troubleshooting.md).            |
| `documentation_interface`   | Met    | [`cli.md`](cli.md) (commands), [`widgets.md`](widgets.md) (widgets + options), [`GLOSSARY.md`](GLOSSARY.md), config schema.                                                    |
| `sites_https`               | Met    | Repo (GitHub) and registry (npm) are HTTPS-only; all URLs in [`package.json`](../package.json) are https.                                                                      |
| `discussion`                | Met    | GitHub Issues.                                                                                                                                                                 |
| `english`                   | Met    | All documentation is in English.                                                                                                                                               |
| `maintained`                | Met    | Active development — commits and releases within days of each other (v0.1.3, 2026-05-22).                                                                                      |

## Change control

| Criterion             | Answer | Evidence                                                                                                          |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `repo_public`         | Met    | Public GitHub repository with a stable URL.                                                                       |
| `repo_track`          | Met    | Full git history records every change with author, committer, and timestamp.                                      |
| `repo_interim`        | Met    | Feature branches and PRs are reviewable before each release.                                                      |
| `repo_distributed`    | Met    | git (distributed VCS).                                                                                            |
| `version_unique`      | Met    | Unique version in [`package.json`](../package.json) plus git tags v0.1.0–v0.1.3.                                  |
| `version_semver`      | Met    | Semantic Versioning; [`CHANGELOG.md`](../CHANGELOG.md) states adherence.                                          |
| `version_tags`        | Met    | Signed annotated git tags per release ([`RELEASING.md`](RELEASING.md)).                                           |
| `release_notes`       | Met    | [`CHANGELOG.md`](../CHANGELOG.md) (Keep a Changelog) plus per-PR fragments under [`changelog/`](../changelog/).   |
| `release_notes_vulns` | Met    | [`CHANGELOG.md`](../CHANGELOG.md) carries a Security section; [`SECURITY.md`](../SECURITY.md) governs disclosure. |

## Reporting

| Criterion                       | Answer            | Evidence                                                                                                                                                            |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `report_process`                | Met               | [`CONTRIBUTING.md`](../CONTRIBUTING.md) + [`.github/ISSUE_TEMPLATE/bug.md`](../.github/ISSUE_TEMPLATE/bug.md); security routed via [`SECURITY.md`](../SECURITY.md). |
| `report_tracker`                | Met               | GitHub Issues.                                                                                                                                                      |
| `report_responses`              | Met (attestation) | Maintainer acknowledges bug reports; structured templates and recent cadence. See attestations.                                                                     |
| `enhancement_responses`         | Met (attestation) | Enhancement requests handled via Issues/PRs. See attestations.                                                                                                      |
| `report_archive`                | Met               | GitHub Issues is publicly searchable and archived.                                                                                                                  |
| `vulnerability_report_process`  | Met               | [`SECURITY.md`](../SECURITY.md) publishes the GitHub private security-advisory flow (URL).                                                                          |
| `vulnerability_report_private`  | Met               | GitHub private security advisories are supported.                                                                                                                   |
| `vulnerability_report_response` | Met (attestation) | [`SECURITY.md`](../SECURITY.md) commits to a 72-hour acknowledgement; no report exceeded 14 days in the last 6 months. See attestations.                            |

## Quality

| Criterion                     | Answer | Evidence                                                                                                                                                            |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`                       | Met    | tsup build; `pnpm run build`; `prepublishOnly` build hook ([`package.json`](../package.json)).                                                                      |
| `build_common_tools`          | Met    | pnpm / tsup / esbuild / TypeScript.                                                                                                                                 |
| `build_floss_tools`           | Met    | All build tools are FLOSS (MIT / Apache-2.0).                                                                                                                       |
| `test`                        | Met    | Vitest unit + golden tests + repo gates; documented in [`testing.md`](testing.md) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).                                      |
| `test_invocation`             | Met    | `pnpm test` runs `vitest run`.                                                                                                                                      |
| `test_most`                   | Met    | Coverage thresholds (80% lines/functions/statements, 75% branches) in [`vitest.config.ts`](../vitest.config.ts); tests sit beside each source file.                 |
| `test_continuous_integration` | Met    | [`gates.yml`](../.github/workflows/gates.yml) runs tests on every push/PR across an OS × Node matrix.                                                               |
| `test_policy`                 | Met    | TDD recipe in [`testing.md`](testing.md); PR test-plan checklist in [`PR-CONVENTIONS.md`](PR-CONVENTIONS.md).                                                       |
| `tests_are_added`             | Met    | Recent feature PRs add `*.test.ts` alongside the feature.                                                                                                           |
| `tests_documented_added`      | Met    | The add-tests policy is documented in [`testing.md`](testing.md) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).                                                       |
| `warnings`                    | Met    | `tsc` strict mode plus ESLint (`eslint:recommended` + `@typescript-eslint/recommended`) — [`tsconfig.json`](../tsconfig.json), [`.eslintrc.cjs`](../.eslintrc.cjs). |
| `warnings_fixed`              | Met    | CI gates fail on lint/type errors; [`PR-CONVENTIONS.md`](PR-CONVENTIONS.md) requires green checks before merge.                                                     |
| `warnings_strict`             | Met    | `noUncheckedIndexedAccess`, `consistent-type-imports`, and additional strict flags.                                                                                 |

## Security

| Criterion                        | Answer | Evidence                                                                                                                                                                                                                                |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `know_secure_design`             | Met    | [`cookbook/17-security-and-compliance.md`](cookbook/17-security-and-compliance.md) — explicit threat model + 16 numbered invariants.                                                                                                    |
| `know_common_errors`             | Met    | Gates 02/14/19/23/24/25 ([`tests/gates/`](../tests/gates/)) plus cookbook 17 enumerate common error classes and mitigations.                                                                                                            |
| `crypto_published`               | N/A    | No cryptography on user data (see [Cryptography: not applicable](#cryptography-not-applicable)).                                                                                                                                        |
| `crypto_call`                    | N/A    | No cryptography in the produced software.                                                                                                                                                                                               |
| `crypto_floss`                   | N/A    | No cryptography in the produced software.                                                                                                                                                                                               |
| `crypto_keylength`               | N/A    | No cryptographic key lengths to configure.                                                                                                                                                                                              |
| `crypto_working`                 | N/A    | No cryptographic algorithms used.                                                                                                                                                                                                       |
| `crypto_weaknesses`              | N/A    | No cryptographic algorithms used.                                                                                                                                                                                                       |
| `crypto_pfs`                     | N/A    | No key-agreement protocols.                                                                                                                                                                                                             |
| `crypto_password_storage`        | N/A    | Stores no passwords.                                                                                                                                                                                                                    |
| `crypto_random`                  | N/A    | Generates no cryptographic keys/nonces (the only `randomBytes` use is a non-security temporary filename).                                                                                                                               |
| `delivery_mitm`                  | Met    | Delivered via npm and GitHub over HTTPS.                                                                                                                                                                                                |
| `delivery_unsigned`              | Met    | npm delivery carries lockfile integrity hashes; CI downloads (Windows shellcheck) are SHA256-pinned and verified before use ([`gates.yml`](../.github/workflows/gates.yml)).                                                            |
| `vulnerabilities_fixed_60_days`  | Met    | gate-23 `pnpm audit --prod --audit-level moderate` ([`tests/gates/gate-23-dependency-audit.sh`](../tests/gates/gate-23-dependency-audit.sh)) + dependency-review (fail on moderate) + Dependabot/Renovate; no known unpatched ≥ medium. |
| `vulnerabilities_critical_fixed` | Met    | Same controls with a rapid patch cadence.                                                                                                                                                                                               |
| `no_leaked_credentials`          | Met    | gate-24 gitleaks ([`tests/gates/gate-24-secret-scan.sh`](../tests/gates/gate-24-secret-scan.sh)) + [`secret-scan.yml`](../.github/workflows/secret-scan.yml) on every push/PR + GitHub push protection.                                 |

## Analysis

| Criterion                                | Answer | Evidence                                                                                                                                                                         |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static_analysis`                        | Met    | CodeQL (`javascript-typescript`) on push/PR/weekly ([`codeql.yml`](../.github/workflows/codeql.yml)) plus ESLint.                                                                |
| `static_analysis_common_vulnerabilities` | Met    | CodeQL default JS/TS queries (injection, XSS, prototype pollution, path traversal).                                                                                              |
| `static_analysis_fixed`                  | Met    | [`SECURITY.md`](../SECURITY.md) SLA; CodeQL on every commit; no open alerts.                                                                                                     |
| `static_analysis_often`                  | Met    | CodeQL, ESLint, gitleaks, and dependency audit all run on every commit/PR.                                                                                                       |
| `dynamic_analysis`                       | Met    | ClusterFuzzLite / Jazzer.js PR-time fuzzing ([`.clusterfuzzlite/`](../.clusterfuzzlite/), [`cflite-pr.yml`](../.github/workflows/cflite-pr.yml)) plus fast-check property tests. |
| `dynamic_analysis_unsafe`                | N/A    | Pure JS/TS — no memory-unsafe language.                                                                                                                                          |
| `dynamic_analysis_enable_assertions`     | Met    | TypeScript strict mode + ajv schema validation; coverage thresholds.                                                                                                             |
| `dynamic_analysis_fixed`                 | Met    | Fuzzing failures block PRs; crash artefacts are uploaded for triage.                                                                                                             |

## Maintainer attestations

Three criteria assert response behaviour over a time window. They depend on the
project's actual issue and advisory history, which only the maintainer can
confirm. Review these against the record before marking them Met on the form:

- `report_responses` — a majority of bug reports in the last 2–12 months were acknowledged.
- `enhancement_responses` — a majority of enhancement requests in the last 2–12 months received a response.
- `vulnerability_report_response` — every vulnerability report in the last 6 months received an initial response within 14 days (vacuously satisfied if none were received).
