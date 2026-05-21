# Security checklist (maintainer runbook)

This file covers the OpenSSF Scorecard findings that **cannot** be fixed by
committing code — they require GitHub repository settings or an external
sign-up. Run these once; most are persistent settings.

The code-fixable findings (pinned dependencies, fuzzing, CODEOWNERS,
Dependabot) are already addressed in the repository. See `docs/cookbook/` and
the workflow files under `.github/workflows/` for those.

> Replace `$GH_TOKEN` with a token that has **admin** rights on the repo.
> Never paste a literal token into a file or commit. Export it in your shell:
> `export GH_TOKEN=…` (or rely on `gh auth login`).

---

> **Solo-maintainer mode (current).** `scorecard.yml` no longer imports its
> SARIF into GitHub code scanning — several checks (Code-Review, the review
> tiers of Branch-Protection) are structurally unsatisfiable for a single
> maintainer, so mirroring them into the Security tab only yields un-actionable
> alerts. The workflow still runs with `publish_results: true`, so the public
> score and the README badge keep updating. Read the full Scorecard report at
> the [scorecard.dev viewer](https://scorecard.dev/viewer/?uri=github.com/odere-pro/claude-agentline),
> not the Security tab.

## 1. Branch protection on `main` (Scorecard: Branch-Protection, Code-Review)

### Solo-maintainer config (active)

While this is a single-maintainer project, protect history without gating your
own work: block force-push and deletion, leave admins un-enforced (so you can
always recover), and require no reviews. This earns Scorecard Branch-Protection
**Tier 1** and never blocks a direct push or a self-merge.

```bash
gh api -X PUT repos/odere-pro/claude-agentline/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false,
  "block_creations": false
}
JSON
```

Verify (force-push and deletions `false`, admins `false`, reviews `null`):

```bash
gh api repos/odere-pro/claude-agentline/branches/main/protection | jq '{
  force_push: .allow_force_pushes.enabled,
  deletions: .allow_deletions.enabled,
  admins: .enforce_admins.enabled,
  reviews: .required_pull_request_reviews
}'
```

**Code-Review (Scorecard: Code-Review) cannot pass with one maintainer.**
Scorecard credits only reviews by someone _other than_ the commit author, and
GitHub forbids approving your own PRs. That alert is dismissed in the Security
tab (`won't fix`) rather than chased — revisit it once a second maintainer
joins (see below).

### When you add a second maintainer (Tier 2+)

Once another reviewer is available (ideally from a different organization),
upgrade to a review-required rule. **This config blocks solo merges**, so do
not apply it before there is a second person to approve PRs:

```bash
gh api -X PUT repos/odere-pro/claude-agentline/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "gates / ubuntu-24.04 / node 20",
      "gates / ubuntu-24.04 / node 22",
      "gates / macos-14 / node 20",
      "gates / macos-14 / node 22",
      "gates / windows-2022 / node 20",
      "gates / windows-2022 / node 22",
      "analyze (javascript-typescript)",
      "dependency review"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

> **Contexts must match the real check-run names.** A required context that
> never reports blocks every merge indefinitely. The names above are the
> matrixed jobs that run on `pull_request`: the six `gates / <os> / node <v>`
> legs (`gates.yml`), `analyze (javascript-typescript)` (`codeql.yml`), and
> `dependency review` (`dependency-review.yml`). **Do not** add `scorecard` as
> a required check — `scorecard.yml` runs on push/schedule/`branch_protection_rule`,
> never on PRs, so requiring it would wedge every PR. Re-derive the list after
> renaming a job or matrix axis:
>
> ```bash
> gh api repos/odere-pro/claude-agentline/commits/main/check-runs \
>   --jq '.check_runs[].name' | sort -u
> ```

Scorecard tiers this check. The review-required config above satisfies:

- **Tier 1** — block force-push, block deletion.
- **Tier 2** — ≥1 reviewer, PRs required for admins, up-to-date before merge
  (`strict: true`), require approval of the most recent push.
- **Tier 3** — ≥1 status check (the `gates / …` legs, `analyze (javascript-typescript)`, …).
- **Tier 5** — dismiss stale reviews, include administrators.

To reach **Tier 4** raise `required_approving_review_count` to `2` once the
project has enough reviewers (`require_code_owner_reviews` is already on, backed
by `.github/CODEOWNERS`). Two-person review (a second maintainer, ideally from a
different organization) is also what finally lets the Code-Review check pass.

---

## 2. OpenSSF Best Practices badge (Scorecard: CII-Best-Practices)

This is an external sign-up — there is nothing to commit.

1. Sign in at <https://www.bestpractices.dev/en> (formerly
   `bestpractices.coreinfrastructure.org`) with the maintainer GitHub account.
2. Start a new project at <https://www.bestpractices.dev/en/projects/new> and
   enter the repo URL `https://github.com/odere-pro/claude-agentline`.
3. Work through the **passing** criteria. Many overlap with what this repo
   already does (HTTPS, version control, automated test suite, static analysis
   via CodeQL, secret scanning via gitleaks, a documented `SECURITY.md`).
4. Once the badge is granted, add its markdown to `README.md`:

   ```markdown
   [![OpenSSF Best Practices](https://www.bestpractices.dev/projects/<ID>/badge)](https://www.bestpractices.dev/projects/<ID>)
   ```

Even reaching the "in progress" state earns partial Scorecard credit.

---

## 3. Maintained (Scorecard: Maintained)

No action required. This check measures commit/issue activity over the last 90
days and a repo age > 90 days. It improves on its own with ongoing commits and
issue triage. Keep merging PRs and responding to issues.

---

## 4. Fuzzing → OSS-Fuzz upstream registration (Scorecard: Fuzzing)

The repository already ships an in-repo ClusterFuzzLite harness
(`.clusterfuzzlite/`) and `fast-check` property tests (`tests/fuzz/`), which
earn Scorecard fuzzing credit. To additionally register the project with the
hosted OSS-Fuzz service, follow `docs/oss-fuzz-application.md`.

---

## Status quick-check

Re-run Scorecard after completing the above:

```bash
gh workflow run scorecard.yml
gh run watch
```

Then read the score at the
[scorecard.dev viewer](https://scorecard.dev/viewer/?uri=github.com/odere-pro/claude-agentline)
to confirm the Branch-Protection, Pinned-Dependencies, Dependency-Update-Tool,
and Fuzzing checks have improved. The Security → Code scanning view no longer
receives Scorecard SARIF (see "Solo-maintainer mode" above).

### Clearing pre-existing Scorecard alerts

Any Scorecard alerts already imported into code scanning before SARIF upload was
removed stay open until dismissed. List and dismiss them once:

```bash
gh api repos/odere-pro/claude-agentline/code-scanning/alerts \
  --jq '.[] | {number, rule: .rule.id, state}'

# dismissed_reason ∈ "false positive" | "won't fix" | "used in tests"
gh api -X PATCH repos/odere-pro/claude-agentline/code-scanning/alerts/<number> \
  -f state=dismissed \
  -f dismissed_reason="won't fix" \
  -f dismissed_comment="Solo maintainer: Scorecard SARIF no longer imported (badge still published). See docs/SECURITY-CHECKLIST.md."
```
