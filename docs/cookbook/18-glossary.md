# 18 · Glossary

> **Intent:** Canonical vocabulary template. Each entry: term, one-line definition, where it's used, "distinct from" clarifier when nearby terms collide.
> **Reads-with:** every other cookbook chapter.
> **Stance.** When a comment, doc, or identifier conflicts with the glossary, the glossary wins. Update the other artefact, not this one.

Implementers MAY add terms; they MUST NOT redefine terms below without superseding the entry (and updating every callsite).

---

## Core product terms

### `product`

The CLI binary and its source repository. Refer to it by its product name (e.g. `agentline` in the reference implementation). In stack-agnostic prose, "the product".

### `host application`

The coding-agent CLI whose statusline this product renders. Sometimes "the host". Distinct from "host" in the OS sense (the user's machine), which the cookbook calls "host machine".

### `statusline`

The one-line prompt area the host application exposes for an external renderer. **Distinct from** the binary name; the binary renders into the statusline.

### `render path`

The hot path from receiving stdin to writing stdout. **Distinct from** "render pipeline".

### `render pipeline`

The full sequence of stages within the render path: parse stdin → load config → resolve theme → render widgets → compose → powerline → encode → write. **Distinct from** "render path" (the pipeline is the chain; the path is the hot measurable segment).

### `cold start`

Wall-clock time from process start to the first byte on stdout. Subject to budget `N2`.

### `cold path`

The set of modules reachable only from non-render verbs (the editor, the watcher mode init). MUST NOT be imported transitively from the render path.

### `hot path`

Synonym for "render path" in import-graph contexts (e.g. "no TUI on the hot path"). Used interchangeably with "render path" in `04-architecture` and gate-19.

---

## Widget terms

### `widget`

The atomic render unit. A `type` string, optional style keys, optional `options`. Each widget is a pure function `(context, options) → cell`.

### `cell`

The unit produced by a widget. Carries `text`, optional `fg`/`bg`/`bold`/`italic`, plus `hidden`, `flex`, `raw`, `merged` flags. The composer consumes cells.

### `family`

A logical grouping of related widgets (session, tokens, context, rate-limits, git, time, custom). Surfaced in the editor's three-step picker as the first step.

### `reset axis`

The boundary at which an accumulator widget resets its count: `session`, `block`, `day`, `week`, `model`, `effort`. Declared per-widget under `options.reset`. Mixed-axis aggregation is forbidden.

### `block`

A reusable unit of time, anchored to the first event hour of a billing cycle. Typically 5 hours in the host application.

### `transcript`

The host application's JSONL ledger of API calls for the session. Read once per render tick by the transcript resolver. Subject to size cap and sandbox.

### `snapshot`

The frozen result of an I/O resolver, computed once per tick and consumed by widgets without re-reading. Examples: token snapshot, git snapshot.

---

## Configuration terms

### `config`

The merged in-memory configuration that drives a render. Built from defaults → user file → env vars → CLI flags.

### `user config`

The on-disk JSON file at `${HOST_CONFIG_DIR}/<product>/config.json`. **Distinct from** "config" (which is the merged in-memory result).

### `default config`

The shipped JSON template (`templates/default.config`) copied into place by `install` when no user config exists. **Distinct from** "compiled defaults" (built into the bin and used as the bottom layer of the merge).

### `compiled defaults`

The layer-0 config baked into the binary. Used when no user config exists and as the bottom of the merge when one does.

### `layered merge`

The four-layer config build: defaults → user file → env vars → CLI flags. Each layer is parsed, reserved-key stripped, validated, and merged before the next.

### `theme`

A named JSON file declaring a palette by role plus optional Powerline glyph overrides. Distinct from "config" — the config picks a theme by name; the theme provides the colours.

### `role`

A semantic colour slot in a theme palette (`accent`, `info`, `success`, `warning`, `danger`, `muted`, `git-clean`, `git-dirty`, etc.). Widgets refer to colours by role, not by hex.

---

## Editor terms

### `editor`

The TUI verb (`<bin> edit`). Cold path; lazy-imports the TUI framework.

### `picker`

The editor's three-step widget-chooser scope: family → widget → variant. The third step is skipped for widgets without catalogued variants.

### `variant`

A pre-configured combination of a widget's options that the catalogue advertises (e.g. `tokens-total reset:session`, `tokens-total reset:block`). Surfaced as the third step of the picker.

### `scope`

One of `edit` or `picker`. The keymap binds actions per-scope; the footer shows bindings for the current scope.

---

## Build and release terms

### `gate`

A shell-orchestrated whole-product invariant check under `tests/gates/`. Stable numeric IDs.

### `golden`

A recorded fixture scenario for byte-exact render comparison. Lives under `tests/golden/`.

### `fixture`

A scenario directory containing `stdin.json`, `config.json`, `clock.txt`, `expected.ansi`. Used by goldens and by the `<bin> render --fixture` verb.

### `frozen clock`

A pinned wall-clock value injected via the render context. Makes time-sensitive widgets deterministic in tests.

### `schema version`

An integer in the user config. Independent of the package version. The binary migrates older schemas and refuses newer ones.

### `changelog fragment`

A single-bullet markdown file under `changelog/<NN>-<slug>.md`, dropped by each user-visible PR. Aggregated into `CHANGELOG`'s `[Unreleased]` at release time.

### `provenance`

A signed attestation linking a published artefact to the source commit it was built from. Required for every release.

---

## Anti-terms

Terms the cookbook deliberately does **not** define because they would mislead.

### `plugin`

The product is **not** a plugin of the host application. Do not use "plugin" in product prose. Use "CLI" or "renderer".

### `framework`

The product is not a framework. Widgets are built-in; there is no plugin ABI.

### `dashboard`

Implies persistent on-screen state. The product renders one line per host prompt refresh; it is not a dashboard.

### `daemon`

The product may run a watcher (F15), but it is not a daemon (no PID files, no long-lived server interface).

---

## Adding a term

If a term appears in more than one doc or source file, it belongs here. To add:

1. Pick a kebab-case heading.
2. Write a one-line definition.
3. Add "Used in:" — list the docs and source paths.
4. Add "Distinct from:" if a nearby term invites confusion.

When in doubt, prefer a short concrete definition over a long abstract one.
