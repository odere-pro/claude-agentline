# 07 · Component specifications

> **Intent:** For every component on the render hot path and the cold-path verbs, define responsibility, public surface, invariants, and failure mode in stack-agnostic terms.
> **Reads-with:** `04-architecture`, `05-design-patterns`, `06-data-contracts`.

Each component entry has: **Responsibility**, **Public surface**, **Inputs**, **Outputs**, **Invariants**, **Failure mode**.

---

## Stdin reader

- **Responsibility.** Read up to 256 KB from stdin; refuse more; emit a truncation marker on stderr if hit.
- **Public surface.** One function `readStdin() → bytes`.
- **Inputs.** stdin file handle.
- **Outputs.** Raw bytes plus a "truncated" boolean.
- **Invariants.** Never blocks on a closed stdin. Never reads more than the cap. No parsing.
- **Failure mode.** Empty input → returns empty bytes; downstream parser handles.

---

## Stdin parser

- **Responsibility.** Parse the raw bytes as JSON; strip reserved meta-keys; preserve unknown fields.
- **Public surface.** `parseStdin(bytes) → HostPayload | Error`.
- **Outputs.** Either a typed payload (in statically typed stacks) or an untyped dict that conforms to the host's documented shape.
- **Invariants.** Reserved keys (`__proto__`, etc.) are stripped recursively before return.
- **Failure mode.** Malformed JSON → return an Error; render path emits ASCII fallback and exits `1`.

---

## Config loader

- **Responsibility.** Discover the four layers (defaults → user file → env vars → CLI flags), parse each, strip reserved keys, validate each parse against the schema, merge in order, validate the merged result.
- **Public surface.** `loadConfig(env, args) → MergedConfig | SchemaError`.
- **Inputs.** Env vars dict, parsed CLI args, the embedded defaults, the embedded schema.
- **Outputs.** A frozen merged config object.
- **Invariants.** Layers are merged in the order specified (no surprises). The env decoder accepts dotted paths (`<PRODUCT>_GLOBAL_PADDING=2`) and JSON-encoded values (`<PRODUCT>_POWERLINE='{"enabled":true}'`).
- **Failure mode.** Schema violation → structured error to stderr; exit `2`. Render path emits ASCII fallback.

---

## Schema validator

- **Responsibility.** Validate any object against an embedded JSON Schema.
- **Public surface.** `validate(schemaId, obj) → ok | SchemaError[]`.
- **Inputs.** The object, the schema id (`config`, `theme`, `fixture`).
- **Outputs.** OK or a list of path-rooted errors.
- **Invariants.** Schemas are embedded at build time; no runtime fetch. Reset-axis constraints are enforced via a custom keyword or equivalent.
- **Failure mode.** Returns errors; never throws.

---

## Theme resolver

- **Responsibility.** Resolve a theme name to a palette by role.
- **Public surface.** `resolveTheme(name, compiledDefaults) → Palette`.
- **Inputs.** Theme name from config, embedded default themes, user-installed themes under the product's theme directory.
- **Outputs.** A palette: `Map<Role, Colour>`, completed with compiled defaults for missing roles.
- **Invariants.** No I/O if the requested theme name is built-in. Themes loaded from disk go through the schema validator.
- **Failure mode.** Unknown theme name → fall back to compiled defaults; doctor will surface as D04.

---

## Token / transcript resolver

- **Responsibility.** Read the transcript file (if any), parse JSONL, produce a frozen snapshot keyed by reset axis.
- **Public surface.** `resolveTokens(stdinPayload, clock) → TokenSnapshot`.
- **Inputs.** Host stdin payload (for `transcript_path` and session/model/effort context), clock handle.
- **Outputs.** A snapshot with per-axis subtotals and timestamps.
- **Invariants.** Read happens exactly once per tick. Path is sandboxed under the host's config root. Per-file cap: 16 MB. Cache by `(path, mtime, size)`; LRU-bounded at 32 MB total, 5 h TTL.
- **Failure mode.** Missing or oversize file → empty snapshot; dependent widgets render hidden.

---

## Git resolver

- **Responsibility.** Run `git -C <cwd>` once per tick and snapshot every value used by git widgets.
- **Public surface.** `resolveGit(cwd) → GitSnapshot | NotAGitRepo`.
- **Inputs.** `cwd` from host stdin payload.
- **Outputs.** Branch, sha, ahead/behind, staged/unstaged/untracked counts, conflict count, upstream, worktree name, etc.
- **Invariants.** No shell-out to anything but `git`. CRLF normalised. Windows path separators normalised to `/` for display.
- **Failure mode.** Non-git directory → `NotAGitRepo`; all git widgets render hidden. Git command failure or timeout → same.

---

## Widget registry

- **Responsibility.** Map widget type strings to render functions.
- **Public surface.** `register(type, fn)`, `lookup(type) → fn | unknown`.
- **Invariants.** Populated at module load with built-ins. Test-only seam: `resetRegistry()` for isolation. Tests for "every documented widget is registered" live in `gate-keymap-coverage` and a registry-parity test.
- **Failure mode.** Lookup miss → render hidden cell; structured warning on stderr (once per session, deduped).

---

## Widget render functions

- **Responsibility.** Compute one cell from `(context, options)`.
- **Public surface.** `render(ctx, opts) → Cell` (pure).
- **Cell shape.** `{ text, fg, bg, bold, italic, flex, hidden, raw }`.
- **Invariants.** No async, no I/O, no direct wall-clock (use `ctx.clock`). No mutation of inputs or shared state.
- **Failure mode.** Any thrown error caught by the dispatcher → hidden cell.

---

## Render composer

- **Responsibility.** Turn the cells of one line into a styled string.
- **Public surface.** `composeLine(cells, width, global) → ComposedLine`.
- **Behaviour.** Applies merge mode (padding/separator), expands flex cells to fill remaining width (multiple flex cells split equally), truncates to terminal width with an ellipsis if needed.
- **Invariants.** Width-aware (East-Asian wide, emoji, ZWJ sequences). Truncation never lands inside an ANSI escape.
- **Failure mode.** Returns the best partial result; emits a warning to stderr.

---

## Powerline transform

- **Responsibility.** When enabled, replace inter-widget separators with chevron pairs; compute adjoining colours (`chevron.fg = prev.bg`, `chevron.bg = next.bg`).
- **Public surface.** `applyPowerline(line, opts) → line`.
- **Invariants.** Idempotent. No-op when disabled. Falls back to ASCII chevrons when the Nerd Font check fails (doctor warns).
- **Failure mode.** Glyph rendering issues at the terminal are out of scope; render is byte-correct.

---

## Colour-depth detector and ANSI encoder

- **Responsibility.** Detect the terminal's colour depth and emit ANSI escapes appropriate for that depth.
- **Public surface.** `detectDepth(env) → 24 | 256 | 16 | none`; `encode(line, depth) → bytes`.
- **Inputs.** `COLORTERM`, `TERM`, `--no-color` flag.
- **Outputs.** ANSI-encoded bytes.
- **Invariants.** `--no-color` always wins. Downgrade is by perceptual nearest match (24-bit → 256 cube, 256 → 16-colour mapping table).
- **Failure mode.** Unknown `TERM` → assume 16-colour.

---

## TUI editor app

- **Responsibility.** Interactive editor with live preview. Reads the user config, mutates via a reducer, persists via atomic write.
- **Public surface.** One verb entry point `<bin> edit`.
- **Cold-path discipline.** This module imports the TUI framework. It MUST NOT be imported transitively by any render-path entry point.
- **State.** Editor state machine with two scopes (`edit`, `picker`). Picker is a three-step chooser: family → widget → variant. Widgets without catalogued variants skip step 3.
- **Footer.** Two-line footer renders every binding in the active scope.
- **Persistence.** Atomic write to the user config path. Re-validates the post-edit config; refuses to save an invalid config.
- **Failure mode.** Schema-invalid edit → block save, show error in footer.

---

## Doctor

- **Responsibility.** Run checks D01–D09 in order; report; optionally apply documented repairs.
- **Public surface.** `<bin> doctor [--fix] [--json] [--strict]`.
- **Checks.** See `08-feature-catalogue` and `14-gates-catalogue · gate-01-doctor`.
- **Repairs (with `--fix`).** Settings scaffold (D01), settings wiring (D02), config defaults (D03), theme directory population (D04). Other findings are reported only.
- **Exit codes.** `0` healthy; `3` with `--strict` if any check failed.

---

## Install / uninstall scripts

- **Responsibility.** Wire the bin into the host's `statusLine` setting; seed default config and themes; reverse on uninstall.
- **Public surface.** `install [--force] [--dry-run] [--from-source]`, `uninstall [--purge]`.
- **Invariants.** Idempotent (re-running leaves state unchanged). Refuses to overwrite a foreign `statusLine` without `--force`. `--dry-run` matches the real run byte-for-byte. Every host-state mutation has a backup (see `06-data-contracts · Backup metadata`).
- **Failure mode.** Pre-existing backup → refuse without `--force`. Filesystem errors surface clearly.

---

## Update-check

- **Responsibility.** Compare local version against the package registry's latest stable release. Cache the result.
- **Public surface.** `<bin> update-check` (its own verb). Render path MUST NOT invoke this.
- **Invariants.** Never run from the render path. Cached result has a TTL; the cache file is the only state.
- **Failure mode.** Network failure → cache stays; user sees the last known result with a "stale" indicator.

---

## Live-reload watcher (optional, for F15)

- **Responsibility.** Watch every file in the merged config set; debounce events; signal the render loop to re-resolve config on the next tick.
- **Public surface.** Spawned by `<bin> render --watch` (or equivalent verb). One-shot render-and-exit implementations skip this.
- **Invariants.** Watcher and render loop share no mutable state. Communication via a one-way event channel.
- **Failure mode.** Watch handle exhaustion (some OSes cap inotify) → log to stderr; fall back to polling at a coarse interval.
