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

## 1. Branch protection on `main` (Scorecard: Branch-Protection, Code-Review)

Enable a protection rule that requires review, blocks force-push, blocks
deletion, dismisses stale approvals, and enforces the rule for admins too.

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

Verify:

```bash
gh api repos/odere-pro/claude-agentline/branches/main/protection | jq '{
  reviews: .required_pull_request_reviews,
  force_push: .allow_force_pushes.enabled,
  deletions: .allow_deletions.enabled,
  admins: .enforce_admins.enabled
}'
```

Scorecard tiers this check. The config above satisfies:

- **Tier 1** — block force-push, block deletion.
- **Tier 2** — ≥1 reviewer, PRs required for admins, up-to-date before merge
  (`strict: true`), require approval of the most recent push.
- **Tier 3** — ≥1 status check (the `gates / …` legs, `analyze (javascript-typescript)`, …).
- **Tier 5** — dismiss stale reviews, include administrators.

To reach **Tier 4** raise `required_approving_review_count` to `2` once the
project has enough reviewers (`require_code_owner_reviews` is already on, backed
by `.github/CODEOWNERS`).

### Mandatory code review (Scorecard: Code-Review)

`required_approving_review_count: 1` + `enforce_admins: true` above makes review
mandatory for everyone, including admins. To raise the bar further, recruit a
second maintainer (ideally from a different organization) so two-person review
becomes feasible, then bump the count to `2`.

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

Then open the repo's **Security → Code scanning** view to confirm the
Branch-Protection, Code-Review, Pinned-Dependencies, Dependency-Update-Tool,
and Fuzzing findings have improved.
