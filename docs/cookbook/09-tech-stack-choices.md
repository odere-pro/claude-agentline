# 09 · Tech stack choices

> **Intent:** For each engineering role the implementation must fill, state the **capability** the tool must provide, the **constraints** it must satisfy, and the **tradeoffs** to weigh. **No recommended stack** — the reader picks.
> **Reads-with:** `03-non-functional-requirements`, `10-tradeoffs-and-decisions`.

The reference repository fills these roles with one specific stack (TypeScript / Node ≥20 / Ink / Vitest / AJV / tsup / ESLint+Prettier / GitHub Actions). That choice is documented in the repo's `docs/plan/SPEC-vX.Y.Z.md`. **Do not copy it without checking that the same tradeoffs apply to your context.** The cookbook below is the basis for choosing.

---

## Runtime

**Capability needed.** Read binary stdin without buffering surprises; spawn child processes; perform unbounded JSON parse; provide a single distributable artefact (one runtime install **or** one static binary).

**Constraints.**

- Cold-start budget reachable on the implementer's reference host. The 120 ms class is achievable in compiled languages; interpreted languages need lazy-import discipline (or AOT compilation).
- Cross-platform: macOS, Linux, Windows. WSL/Git-Bash counts on Windows.
- LTS-supported with a clear schedule.

**Tradeoffs to weigh.**

- Compiled languages: best cold start, larger build matrix, ship a binary per platform.
- Managed runtimes (Node, Bun, Deno, JVM, CLR): single artefact per language, runtime install required, watch the import graph carefully.
- Interpreted languages (Python, Ruby): excellent ergonomics, hardest cold-start story; consider AOT or lazy-import.

---

## Language

**Capability needed.** Static types or a disciplined typing convention; sum types or equivalent for the cell / colour / error variants; pattern matching nice-to-have.

**Constraints.**

- Test ecosystem must support frozen-clock injection and byte-exact stdout comparison.
- Stable LTS with no impending breaking changes within v0.1's lifetime.

**Tradeoffs.**

- Type system strength vs. ecosystem maturity: prefer strong typing where it doesn't cost a battle-tested ecosystem.
- Concurrency model is largely irrelevant on the render path (sequential) but matters for the watcher mode.

---

## Packaging

**Capability needed.** Reproducible build → upload to the language's primary registry; exact-pin runtime deps; signed releases with provenance; no postinstall side-effects outside the package install dir.

**Constraints.**

- Provenance / signing supported (Sigstore, OIDC-issued cosign, signed tarball).
- `--dry-run` install path must match real install byte-for-byte (gate 10).
- The publish workflow must be triggered only by a tag push.

**Tradeoffs.**

- Single-language registry (npm, PyPI, crates.io, RubyGems): widest reach for that language's users; users on other stacks need a side-channel.
- Universal binaries (GitHub Releases, Homebrew tap): broader reach; more release-engineering effort. v0.1 defers these.

---

## Schema validator

**Capability needed.** Validate against JSON Schema 2020-12 (or draft-07 minimum); report path-rooted errors; allow custom keyword extensions.

**Constraints.**

- Custom keyword to enforce the reset-axis constraint (mixed axes ⇒ schema error).
- Validator import / instantiation cost must not dominate cold start.
- Schemas are embedded at build time; the validator MUST NOT fetch remote schemas at runtime.

**Tradeoffs.**

- Generic JSON Schema validators (AJV, jsonschema): wide compatibility, larger footprint.
- Code-generated validators (e.g. from the schema to language-specific structs): smaller footprint, less flexibility.

---

## TUI framework

**Capability needed.** Build the editor UI; render to alt-screen; deterministic input handling that can be golden-tested.

**Constraints.**

- MUST be importable on demand only — see `04-architecture`. The cookbook gate `render-no-tui-import` enforces this.
- MUST render to an alt-screen buffer so the editor leaves the user's scrollback intact on exit.
- MUST expose a deterministic input pipeline (or be wrappable in one) so editor tests are reproducible.

**Tradeoffs.**

- Reconciler frameworks (Ink, Textual): rich component model, larger cold-import cost.
- Direct curses-style libraries (Ratatui, BubbleTea-immediate-mode style): smaller footprint, more code per feature.

---

## Test runner

**Capability needed.** Run unit tests with frozen-clock injection; compare byte-exact stdout (including ANSI escapes); produce machine-readable output for CI.

**Constraints.**

- Snapshot testing or equivalent for goldens.
- Parallel test execution with isolation (each test gets a clean cwd if needed).
- Coverage reporting hits 80% gate (per the user's global rules).

---

## Lint / format

**Capability needed.** Enforce style rules; format code on demand; runnable as a precommit gate.

**Constraints.**

- Configurable to forbid specific patterns (e.g. "no top-level import of the TUI framework from render-path files").
- Fast enough to run on every save.

---

## CI provider

**Capability needed.** Per-platform matrix (macOS × Linux × Windows × at least two runtime versions); OIDC-issued signing for releases; scheduled workflows for runtime-version skew checks.

**Constraints.**

- Pin actions / steps by SHA, not tag.
- Per-workflow least-privilege permissions (`permissions: read-all` at workflow level, escalations per job).
- Concurrency cancellation on superseded PR pushes.

**Tradeoffs.**

- Hosted CI (GitHub Actions, GitLab CI): zero infra cost, vendor lock-in for OIDC integration.
- Self-hosted: more control, more ops burden, must implement signing infrastructure independently.

---

## Bundler (only if the language requires one)

**Capability needed.** Compile/bundle the source into one self-contained artefact per CLI verb so the render path's import graph is provably small.

**Constraints.**

- Tree-shake aggressively; the render-path bundle MUST NOT include the TUI framework.
- Produce an ESM-compatible artefact when targeting Node-class runtimes.
- Sourcemaps for debuggability (optional, but cheap).

---

## Picking the stack — a checklist

When you finalise your stack, write a one-page decision in your repo's plan dir noting:

1. Each role's chosen tool.
2. Which non-functional requirement was most at risk under this choice.
3. The workaround you used (lazy import / AOT compile / native binary / etc.).
4. The substitute you would fall back to if the chosen tool turned out wrong.

Keep this document — `10-tradeoffs-and-decisions` belongs to the cookbook; the stack decisions belong to your repo.
