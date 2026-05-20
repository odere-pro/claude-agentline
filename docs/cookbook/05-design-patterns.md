# 05 · Design patterns

> **Intent:** Catalogue the architectural patterns the implementation MUST use, with the reason each is preferred over its alternatives.
> **Reads-with:** `04-architecture`, `07-component-specs`.

Each pattern entry has: **name**, **intent**, **where it appears**, **why this over alternatives**.

---

## Pure-function widget

**Intent.** Each widget is a referentially-transparent function `(context, options) → cell`. No async, no I/O, no clock access except via the context's clock handle. No mutation of input or shared state.

**Where.** Every entry in the widget registry.

**Why.** Determinism (`03 · N7`), trivial unit testability, parallelisation-safe, golden-test friendly. The alternatives — class instances with internal state, async functions that fetch — make the cold-start budget harder and goldens flaky.

---

## Frozen snapshot for I/O resolvers

**Intent.** Each tick, every I/O-bound resource (transcript file, git working tree, host stdin payload) is read **exactly once** by a dedicated resolver into an immutable snapshot. Widgets query the snapshot; they never re-read.

**Where.** Transcript resolver, git resolver, stdin parser.

**Why.** Two reasons. First: the cold-start budget can absorb at most one or two filesystem hits per tick. Second: snapshots make widgets a function only of their context — no race against a changing file mid-tick — which is what makes golden tests byte-stable.

---

## Layered immutable config merge

**Intent.** Configuration is built by merging layers (defaults → user file → env vars → CLI flags). Each layer is parsed, the reserved-key strip is applied, and the partial result is validated against the schema before the next layer merges in. The final merged config is immutable for the tick.

**Where.** Config loader on every render and every editor save.

**Why.** Catches schema violations at the offending layer, not at the merged-result stage where they're harder to debug. Immutability prevents widget code from accidentally rewriting config.

---

## Atomic file write

**Intent.** Every persisted artefact (user config, backup, cache file) is written by writing to a sibling temp file, fsync-equivalent flush, then `rename` over the destination. The OS guarantees observers either see the prior version or the new version — never a torn write.

**Where.** Editor save, install backup write, render-cache write, stdin-cache write.

**Why.** A torn config file at the moment the user kills the editor would leave them with a broken statusline that the schema validator refuses to parse. Atomic rename moves the failure window from "every write" to "process killed between temp write and rename" — a vanishingly small window with no observable bad state.

---

## Registry by string id

**Intent.** Widgets and themes are looked up at runtime by their string id (`type: "git-branch"`, `theme: "claude-code-dark"`). The registry maps id → render function (widgets) or id → palette (themes).

**Where.** Widget dispatch, theme dispatch, doctor's "is this widget present" checks.

**Why.** Decouples the config schema from the implementation module graph. The schema validates `type` against an enum; the registry dispatches. New widgets are added by registering — no callsite changes. Alternative: tagged-union per language. That's stronger typing but produces tighter coupling between config and code; harder to add a widget without changing both sides.

---

## Schema-first contracts

**Intent.** Every artefact that gets persisted or accepted on a boundary (user config, theme files, fixture stdin) has a JSON Schema. The validator runs **before** any other code touches the parsed JSON.

**Where.** Config loader, theme loader, fixture runner, `<bin> config schema` export.

**Strictness rules.**

- The root config object is `additionalProperties: false`.
- The `palette` and `widget.options` objects are `additionalProperties: true` (extensible by user / theme author).
- Custom keywords enforce reset-axis constraints (mixed axes rejected at schema time).

**Why.** Catching schema violations at parse time gives users meaningful errors. Letting widget code "soft-handle" missing fields silently degrades the experience.

---

## Sandboxed file root

**Intent.** Any file read whose path comes from user-supplied data (the host stdin payload, the config file) MUST resolve under an allowlisted root. Reads outside the root are refused.

**Where.** Transcript reader, auth-file reader.

**Allowlist.** The host application's config directory (e.g. `~/.claude`). For tests, an env var (`<PRODUCT>_TRANSCRIPT_ROOT`) overrides.

**Why.** A malformed stdin payload setting `transcript_path: "/etc/passwd"` MUST NOT become an arbitrary-file-read primitive. Even though stdout is bytes, the attacker can observe the rendered token count to confirm a read succeeded.

---

## Reserved-meta-key strip at every JSON parse boundary

**Intent.** After parsing JSON and before handing it to anything else, walk the tree and drop own keys named `__proto__`, `constructor`, `prototype` from every object. Apply recursively, including inside `additionalProperties: true` carve-outs.

**Where.** Config loader (user file), env-var decoder (`PRODUCT_KEY='{"…":…}'`), `<bin> render --config` fixture path, theme loader.

**Why.** In some runtimes these keys are prototype-pollution vectors; in others they aren't, but the strip is cheap and applies uniformly. The strict-schema root closes most of the gap; this pattern closes the gap at the carve-outs.

---

## Reset-axis tag on accumulators

**Intent.** Every accumulator widget (token totals, cost, speed, rate-limit usage) carries a `reset` axis declared in its `options`. The renderer rejects a config that puts two accumulators with different axes into a single sum.

**Where.** Token widgets, cost widgets, speed widgets, rate-limit widgets.

**Why.** "Per-session input tokens added to per-day input tokens" is meaningless and misleading. Forcing the user to declare the axis surfaces the design choice and prevents silent footguns.

**How.** Each axis is encoded as one entry in the `AXIS_STRATEGIES` table in `src/data/tokens/aggregate/aggregate.ts` — a `Record<ResetAxis, AxisStrategy>` where each strategy bundles the event-window predicate (`filter`) with the rolling-window boundary (`windowEnd`). `Record<ResetAxis, …>` keeps the table exhaustive at compile time; the schema validator and `resolveResetAxis` both derive the accepted-axis set from the same table via `RESET_AXES`, so vocabulary stays consistent end to end. Adding an axis is a single-entry change.

---

## Capability flag for editor scopes

**Intent.** The editor's keymap binds actions to (scope, key) tuples. Scope is a small enum (`edit`, `picker`) — not a mode object with sub-state. The footer renders every binding active in the current scope.

**Where.** TUI editor, keymap registry.

**Why.** Modes-as-state pile up complexity quickly (modal editors are famous for this). A two-value scope flag plus a registry keeps the editor's surface area small and the gate `keymap-coverage` enforceable.

---

## Reversible host-state mutation

**Intent.** Every mutation `install` makes to host state has a paired backup file capturing the prior value plus a checksum. `uninstall` restores byte-for-byte and verifies the checksum.

**Where.** Host `statusLine` setting wiring, theme directory population.

**Why.** Trust. Users will not adopt a tool that "owns" their settings file. A reversible install with byte-checksumed restore turns a scary mutation into a predictable one.

---

## Lazy import (cold path isolation)

**Intent.** Heavy modules — TUI framework, schema validator JIT, watcher — are imported only inside the function of the verb that needs them. The render-path import graph stays tiny.

**Where.** Editor verb, watcher mode.

**Why.** On any runtime where import resolution costs are non-trivial (interpreted languages, JIT runtimes), a top-level `import ink` adds 30–80 ms to cold start. The lazy-import discipline keeps that cost on the cold-path verbs where it doesn't matter.

---

## One backup per host-state surface

**Intent.** The install never piles up backup history. The first install captures the prior state into a single backup file. Subsequent installs see the backup already exists and refuse to overwrite it without `--force`.

**Where.** Settings backup, theme dir backup.

**Why.** Avoids unbounded backup file growth and the question "which backup do I restore from?". Either the install succeeded once and the backup represents the pre-install state, or it didn't.
