# CLAUDE.md — `tests/gates`

## Scope

The repo's quality-gate suite: numbered shell scripts (`gate-NN-<slug>.sh`) that assert a single invariant each. The full lookup of which gate guards which invariant lives in the root CLAUDE.md "Gate map" and the spec lives in `docs/cookbook/14-gates-catalogue.md`.

- `gate-NN-<slug>.sh` — one gate per invariant, numbered.
- `run-all.sh` — runs every gate in numeric order; stops on first failure unless `--keep-going` is passed.
- `lib/common.sh` — shared helpers (`log_fail`, `skip_gate`, `repo_path`, colour helpers).
- `.tmp/gate-NN/` — per-gate scratch space (built artefacts, captured output). Safe to delete.

## Map

```
run-all.sh ──▶ for each gate-NN-*.sh in numeric order:
   ┌─ source lib/common.sh           (log_fail, skip_gate, repo_path)
   ├─ collect inputs                 (rg/grep over src/, dist/, docs/)
   ├─ assert invariant ─── pass:     exit 0
   │                        skip:    exit 2    (informational; e.g. gate-13 outside tag time)
   └─                        fail:   log_fail + exit 1

  Gate numbers are unique and monotonically allocated; gaps are fine (e.g. no gate-04).
  Each gate is idempotent and runnable standalone:
    bash tests/gates/gate-19-render-no-tui-import.sh
```

## Local setup

```sh
bash tests/gates/run-all.sh                       # whole suite, stop on first failure
bash tests/gates/run-all.sh --keep-going          # whole suite, collect every failure
bash tests/gates/gate-NN-<slug>.sh                # one gate, standalone
```

Most gates have no prerequisites. Gates that scan compiled output (e.g. `gate-13`, `gate-17`) expect `pnpm run build` to have produced `dist/` first.

## Invariants you must not break

- **Numbering is monotone and unique.** Pick the next free `NN`. Do not renumber existing gates — downstream tooling and PR descriptions reference numbers.
- **Filename pattern is `gate-NN-<slug>.sh`.** Lower-case kebab-case slug, descriptive of the invariant.
- **Exit codes are load-bearing.** `0` = pass, `1` = fail, `2` = skip (informational, e.g. environment lacks the prerequisite). Never use other exit codes.
- **Idempotent and order-independent.** A gate must not depend on another gate's side effects. Two gates must produce the same result whether run together or alone, in any order.
- **Sources `lib/common.sh` for output.** Use `log_fail`, `skip_gate`, and the colour helpers — direct `echo`/`printf` to stderr from a gate breaks the suite's unified output format.
- **Owning cookbook chapter cited in the gate header comment.** Each gate's top-of-file comment cites the owning section of `docs/cookbook/` (e.g. `§4.7`, `§14`). This is the only durable link between the assertion and its rationale.
- **No network, no external services.** Gates run in CI and locally with no network access. A gate that needs network must `skip_gate` with a reason.
- **Strict vs informational.** A gate that measures a budget (e.g. `gate-13` cold-start) may be informational on CI and strict at tag time. Document the mode in the header comment; do not silently downgrade an existing gate.
- **Scratch in `.tmp/gate-NN/`.** Per-gate artefacts go there. Never write outside `.tmp/` and never assume a prior gate left state behind.

## Adding a new gate

1. Pick the next free `NN` (gaps are fine; do not renumber).
2. Create `gate-NN-<slug>.sh`, mark executable.
3. Header comment: one-line purpose, owning cookbook section (e.g. `§14`), strict/informational mode.
4. `source "$(dirname "$0")/lib/common.sh"`.
5. Add a row to `docs/cookbook/14-gates-catalogue.md` with pass/fail/skip conditions.
6. Add a row to the root `CLAUDE.md` "Gate map" with the typical failure mode.
7. Run `bash tests/gates/run-all.sh` to confirm the new gate cooperates with the suite.

## How to test this area

- `bash tests/gates/run-all.sh` — full suite.
- `bash tests/gates/<gate>.sh` — standalone.
- `gate-03-shellcheck.sh` — lints every shell script under `tests/gates/` and `scripts/`; a new gate's shellcheck issues surface here.

## When in doubt

Owning chapter: `docs/cookbook/14-gates-catalogue.md` (per-gate spec) and `13-testing-strategy.md` (where gates sit in the wider test pyramid).
