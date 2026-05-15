# 13 · Testing strategy

> **Intent:** Define the test pyramid, determinism technique, fixture format, and how-to-update procedure — independent of test runner.
> **Reads-with:** `04-architecture`, `14-gates-catalogue`.

## The pyramid

```text
                 integration
              ─────────────────
              gates (shell, whole-product)
           ───────────────────────────────
           golden (recorded fixtures, byte-exact)
       ─────────────────────────────────────────────
       unit (per-module pure functions)
```

Numbers from the reference implementation, for calibration:

| Layer       | Count                  | Runtime            | What it proves                            |
| ----------- | ---------------------- | ------------------ | ----------------------------------------- |
| Unit        | ~90 files              | < 5 s total        | Each function does what it claims.        |
| Golden      | small set (~3)         | < 1 s per scenario | The renderer is byte-stable.              |
| Gates       | ~17 + project-local ~4 | < 30 s total       | Cross-cutting invariants hold.            |
| Integration | 1                      | < 30 s             | Install/uninstall lifecycle on real disk. |

Coverage target: **80% line / branch** per the user's global rules. The 80% is across the source tree; widget render functions in particular should be ≥95% because they are pure and tiny.

---

## Determinism technique

Every test that touches time or external state goes through these injection points:

| Boundary       | Injection                                                              |
| -------------- | ---------------------------------------------------------------------- |
| Wall clock     | A `clock` handle on the render context; tests freeze it.               |
| File reads     | The transcript and auth file readers accept an explicit path argument. |
| Env vars       | Config loader takes `env: Map<string,string>` as a parameter.          |
| Stdin          | Fixtures are JSON files on disk; tests read and feed them.             |
| Terminal width | Width detector takes an explicit columns argument in tests.            |
| Colour depth   | Detector takes explicit env vars; tests override `COLORTERM`/`TERM`.   |

No test relies on the real wall clock, the real filesystem layout, or the real terminal. CI runners are not allowed to influence test outcomes.

---

## Golden fixture format

One scenario per directory:

```text
tests/golden/<scenario>/
├── stdin.json       # The recorded host stdin payload.
├── config.json      # The active config (or empty for "use defaults").
├── clock.txt        # Frozen wall-clock value (ISO 8601 UTC, one line).
└── expected.ansi    # Byte-exact expected stdout (includes ANSI escapes).
```

Suggested initial scenarios:

- `minimal` — defaults + a tiny stdin payload.
- `no-color` — same stdin, with `--no-color`, asserts ANSI-free output.
- `powerline-on` — Powerline enabled, demonstrates chevron rendering and adjoining colour math.

Add scenarios when:

- Adding a new widget family — at least one scenario per family.
- Reproducing a bug — write the scenario first, then fix.
- Exercising a new fallback (e.g. `--ascii` with East-Asian wide characters).

---

## How to update a golden intentionally

A renderer change that intentionally alters output:

1. Make the code change in the same PR.
2. Re-record the affected goldens (`<bin> render --fixture <scenario> --update`).
3. Commit the updated `expected.ansi`.
4. Add a changelog fragment under `changelog/<NN>-<slug>` describing the user-visible effect.

CI rejects PRs that change `expected.ansi` without a changelog fragment in the same PR (gate-18 enforces).

A renderer change that **does not** intend to alter output but golden tests now fail — that is a regression. Investigate; do not blindly re-record.

---

## Unit-test naming

```text
test('returns hidden cell when no transcript file is configured', () => { … })
test('throws SchemaError when reset axis is "session" but the widget aggregates "day"', () => { … })
test('falls back to ASCII chevron when Powerline is enabled and Nerd Font is missing', () => { … })
```

Test names state behaviour. The AAA pattern (Arrange / Act / Assert) is the default.

---

## Integration tests

One scripted test scenario covers the install/uninstall lifecycle on a real (but disposable) host config dir:

1. Set up a temp `$HOME` with an empty host settings file.
2. Run `<bin> install --from-source`.
3. Assert the `statusLine` setting is wired, default config is seeded, themes are copied.
4. Run `<bin> uninstall`.
5. Assert the host settings file is byte-identical to the pre-install snapshot.

This test is slow (~30 s) and is run in CI; locally, run it before opening a PR that touches install/uninstall code.

---

## What we deliberately do not test

- Real network calls — the render path is forbidden from making them; there is nothing to test.
- Real terminal rendering on a real TTY — the byte-exact golden assertion is the strongest statement we can make; how the terminal interprets those bytes is out of scope.
- Performance on every push — the cold-start budget (gate 13) runs in CI but with a relaxed threshold to account for runner variance; the strict threshold lives in the bench harness.

---

## Test-runner-agnostic conventions

- One assertion per `test()` when feasible.
- Setup goes in `beforeEach`; never in module-load side effects.
- No shared mutable state across tests; if a test uses the temp filesystem, it cleans up in `afterEach`.
- Mocks are explicit and scoped; never patch global module loaders.

---

## Continuous integration discipline

- The gate suite (`tests/gates/run-all`) runs on every push and PR.
- The platform matrix (gate 15) runs on every push and weekly.
- The cold-start benchmark (gate 13) runs on every PR with a soft threshold; hard thresholds run nightly.
- Pricing and runtime skew workflows run weekly / monthly with explicit manual triggers.
