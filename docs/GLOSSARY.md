# Glossary

Canonical vocabulary for the `agentline` project. When a term here conflicts
with a comment, doc, or identifier elsewhere in the repo, this file wins —
update the other artefact, not this one.

---

## Core product terms

### `agentline`

> The CLI binary and npm package (`@agentline/cli`).

**Used in:** package name, binary name, all docs.

---

### `statusline`

> The one-line prompt area Claude Code exposes for external renderers;
> agentline reads JSON from Claude Code's stdin and writes ANSI output into it.

**Used in:** `statusLine` key in `~/.claude/settings.json`, all docs.  
**Distinct from:** the binary name `agentline`.

---

### `render path`

> The hot path from Claude Code's stdin JSON to ANSI stdout.
> Must complete in ≤ 25 ms p95.

**Used in:** performance rules, gate-13, gate-19, `src/render/`.

---

### `render pipeline`

> The full sequence: parse stdin → load config → resolve theme →
> render widgets → compose lines → encode ANSI → write stdout.

**Used in:** architecture docs, `src/render/pipeline.ts`.  
**Distinct from:** "render path" (pipeline = the whole chain; path = the hot measurable segment).

---

### `cold start`

> Process-start-to-first-byte latency. Must be ≤ 120 ms p95.

**Used in:** gate-13, spec §1.2 N2.

---

## Widget terms

### `widget`

> The atomic render unit: a `type` string, optional style keys
> (`fg`, `bg`, `bold`, `italic`), optional `options`, and optional `id`.

**Used in:** `config.lines[]`, `src/widgets/`, all widget docs.

---

### `widget type`

> The kebab-case string identifier for a widget, e.g. `git-branch`,
> `tokens-total`, `session-usage`.

**Used in:** `WidgetConfig.type`, widget catalog keys, `agentline config widget` commands.

---

### `widget family`

> One of the seven named groups that organise built-in widgets:
> `session`, `tokens`, `context`, `rate-limits`, `git`, `time`, `custom`.

**Used in:** `WidgetMeta.category` (code), `WIDGET_CATEGORIES` (constant),
`src/widgets/<family>/` directories, picker step 1.  
**Note:** TypeScript currently spells this as `WidgetCategory` / `WIDGET_CATEGORIES` /
`CATEGORY_COLOR` / `.category`. The user-facing term is **family**; aligning the
code to that name is tracked as a separate refactor.

---

### `variant`

> A named preset of widget `options` that switches a widget's display style.
> Example: `clock` has variants `time-24h`, `time-12h`, `seconds`, `date`, `datetime`.

**Used in:** `WidgetVariant`, picker step 3, `agentline config widget` update verb.  
**Distinct from:** `widget type` (what the widget is) and `options` (raw config).

---

### `widget glyph`

> The per-type Nerd Font codepoint stored in the widget catalog.
> Prepended to the widget's text when `config.glyphs` is `"nerd-font"`.

**Used in:** `WidgetMeta.glyph`, `WIDGET_GLYPHS`, `src/lib/nerd-font.ts`.  
**Distinct from:** "glyph mode" (the on/off toggle).

---

### `widget catalog`

> The static metadata table `WIDGET_CATALOG` keyed by widget type.
> Contains: human name, description, family, glyph, and variants.

**Used in:** `src/widgets/catalog.ts`, the TUI picker, `agentline config widget catalog`.  
**Distinct from:** "widget registry" (runtime render-function map).

---

### `widget registry`

> The runtime `WidgetRegistry` instance that maps `type` → `WidgetDef`
> (the render function). Populated by `registerAllBuiltins()`.

**Used in:** `src/widgets/registry.ts`, the render pipeline.  
**Distinct from:** "widget catalog" (static metadata, not render functions).

---

## Built-in widget types (42 total)

All types are kebab-case strings. Source of truth: `src/widgets/catalog.ts`.

### Session family (7)

| Type              | Description                                |
| ----------------- | ------------------------------------------ |
| `model`           | Active model id (e.g. Sonnet 4.6)          |
| `version`         | Claude Code version                        |
| `thinking-effort` | Thinking-effort tier: low, medium, or high |
| `skills`          | Skills attached to the session             |
| `session-id`      | Short session id                           |
| `session-name`    | Session name, or the short id when unset   |
| `account-email`   | Logged-in account email                    |

### Tokens family (7)

| Type            | Description                                     |
| --------------- | ----------------------------------------------- |
| `tokens-total`  | Running token total for the chosen reset axis   |
| `tokens-input`  | Input-token subtotal for the chosen reset axis  |
| `tokens-output` | Output-token subtotal for the chosen reset axis |
| `tokens-cached` | Cached-token subtotal (prompt-cache hits)       |
| `input-speed`   | Input tokens per second over the active window  |
| `output-speed`  | Output tokens per second over the active window |
| `total-speed`   | Combined token throughput per second            |

### Context family (4)

| Type                        | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `context-length`            | Tokens currently in the context window                       |
| `context-percentage`        | Percentage of the model's context window in use              |
| `context-percentage-usable` | Percentage of usable context in use (excludes output budget) |
| `context-bar`               | Tiny inline bar approximating context fill                   |

### Rate-limits family (7)

| Type                  | Description                                  |
| --------------------- | -------------------------------------------- |
| `session-usage`       | Percentage of the session quota consumed     |
| `weekly-sonnet-usage` | Weekly Sonnet model-usage percentage         |
| `weekly-opus-usage`   | Weekly Opus model-usage percentage           |
| `block-reset-timer`   | Time remaining until the next block resets   |
| `block-reset-at`      | Wall-clock time of the next block reset      |
| `weekly-reset-timer`  | Time remaining until the weekly quota resets |
| `weekly-reset-at`     | Wall-clock time of the next weekly reset     |

### Git family (12)

| Type               | Description                                 |
| ------------------ | ------------------------------------------- |
| `git-branch`       | Current branch, or short SHA when detached  |
| `git-sha`          | Short commit SHA of HEAD                    |
| `git-worktree`     | Basename of the current worktree            |
| `git-changes`      | Staged, unstaged, and untracked file counts |
| `git-staged`       | Staged-file count                           |
| `git-unstaged`     | Unstaged-file count                         |
| `git-untracked`    | Untracked-file count                        |
| `git-conflicts`    | Merge-conflict file count                   |
| `git-ahead-behind` | Commits ahead of and behind upstream        |
| `git-upstream`     | Upstream branch, e.g. `origin/main`         |
| `git-origin-repo`  | Repo segment of the origin remote URL       |
| `git-pr`           | PR for HEAD's branch (opt-in network)       |

### Time family (3)

| Type             | Description                                        |
| ---------------- | -------------------------------------------------- |
| `clock`          | Wall-clock time; `options.format` accepts strftime |
| `uptime-session` | Uptime since the Claude Code session started       |
| `uptime-block`   | Uptime of the active conversation block            |

### Custom family (2)

| Type        | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| `separator` | A single user-defined glyph (`options.char`)                 |
| `osc-link`  | Clickable OSC-8 hyperlink (terminal-supported) wrapping text |

---

## Config terms

### `config`

> The user's `config.json` at
> `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`.
> The single source of truth; there is no per-project layer.

**Used in:** all config docs, `src/config/`.

---

### `config template`

> A shipped default config file used by `agentline install` to seed the
> user config on first install. Currently only `templates/default.config.json`.

**Used in:** `templates/`, install flow.  
**Distinct from:** "theme preset" (a shipped theme JSON, not a config).  
**Formerly called:** "preset" or "init preset" — retired terms.

---

### `env override`

> An `AGENTLINE_<DOTPATH>` environment variable that overrides any config
> leaf at render time without editing the config file.
> Example: `AGENTLINE_THEME=vscode-dark`.

**Used in:** `src/config/env.ts`, spec §4.

---

### `line`

> An ordered array of widget configs in `config.lines[]`.
> Up to 3 lines stack top-to-bottom in the statusline.

**Used in:** `LineConfig`, the render pipeline, all config docs.

---

### `merged mode`

> Per-widget spacing control: `"off"` (default padding + separator),
> `"merge"` (one space, no separator), or `"merge-no-padding"` (zero space, no separator).

**Used in:** `MergeMode`, `WidgetConfig.merged`, config docs.

---

### `glyph mode`

> Top-level `config.glyphs` toggle: `"off"` (default, no icons) or
> `"nerd-font"` (prepend per-widget Nerd Font codepoints).

**Used in:** `GlyphMode`, `AgentlineConfig.glyphs`, config docs.  
**Distinct from:** "widget glyph" (the per-type codepoint itself).

---

### `powerline`

> Optional rendering mode that replaces padding/separator with chevron
> glyphs and computes colour transitions between adjacent segments.
> Enabled via `config.powerline.enabled: true`.

**Used in:** `PowerlineConfig`, `src/powerline/`, config docs.

---

### `reset axis`

> The boundary at which a token, speed, or rate-limit widget resets its
> accumulator. One of: `session`, `block`, `day`, `week`, `model`, `effort`.

**Used in:** `ResetAxis`, widget `options.reset`, spec §8.4, `src/tokens/`.

---

## Theme terms

### `theme`

> A JSON file that maps semantic role names to terminal colour values.
> Referenced by `config.theme: "<name>"`.

**Used in:** `Theme`, `src/theme/`, `themes/`, config docs.

---

### `theme preset`

> A shipped theme JSON file bundled with agentline.
> Currently only `claude-code-dark` ships; user-authored themes
> go in `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/themes/`.

**Used in:** `themes/claude-code-dark.json`, install flow, themes docs.  
**Distinct from:** "config template" (a shipped default config, not a theme).

---

### `palette`

> The `palette` key inside a theme file; a map from role names to colour values.

**Used in:** `themes/*.json`, `src/theme/`, theme schema.

---

### `role`

> A semantic palette key. Every built-in widget resolves its colour from
> a named role rather than a hardcoded value.

Required roles (must be present in every theme):

| Role          | Used by                                  |
| ------------- | ---------------------------------------- |
| `accent`      | session widgets (`model`, `version`, …)  |
| `info`        | context, tokens (low usage)              |
| `success`     | git clean state                          |
| `warning`     | context/tokens approaching their cap     |
| `danger`      | rate-limit hit, error states             |
| `muted`       | separators, labels in `minimalist` mode  |
| `git-clean`   | `git-changes` when the worktree is clean |
| `git-dirty`   | `git-changes` when the worktree is dirty |
| `tokens-low`  | token widgets (low usage)                |
| `tokens-mid`  | token widgets (medium usage)             |
| `tokens-high` | token widgets (high usage)               |
| `bg-section`  | section background areas                 |
| `bg-emphasis` | emphasis/highlight background areas      |

Optional roles (missing roles fall back to the compiled defaults):

| Role    | Used by                                         |
| ------- | ----------------------------------------------- |
| `fg`    | default foreground when no widget colour is set |
| `bg`    | default background                              |
| `clock` | `clock`, `uptime-session`, `uptime-block`       |

**Distinct from:** `fg`/`bg` per-widget overrides in `WidgetConfig`.

---

### `colour depth`

> The renderer's detected ANSI capability level:
> `truecolor` (24-bit), `256` (8-bit palette), `16` (named colours), or `none`.

**Used in:** `ColourDepth`, `src/render/colour-depth.ts`, gate-16.

---

## TypeScript types

Public types exported from `src/`. Source of truth over any doc that lists them.

| Type                     | File                           | Description                                                       |
| ------------------------ | ------------------------------ | ----------------------------------------------------------------- |
| `AgentlineConfig`        | `src/config/types.ts`          | Top-level config shape                                            |
| `PartialAgentlineConfig` | `src/config/types.ts`          | Partial version for merging                                       |
| `GlobalConfig`           | `src/config/types.ts`          | `config.global` block                                             |
| `LineConfig`             | `src/config/types.ts`          | Single line (array of `WidgetConfig`)                             |
| `WidgetConfig`           | `src/config/types.ts`          | Per-widget config entry                                           |
| `PowerlineConfig`        | `src/config/types.ts`          | `config.powerline` block                                          |
| `PowerlineCaps`          | `src/config/types.ts`          | Start/end cap glyphs                                              |
| `PowerlineGlyphs`        | `src/config/types.ts`          | Chevron glyph overrides                                           |
| `TerminalWidthConfig`    | `src/config/types.ts`          | Width detection settings                                          |
| `GlyphMode`              | `src/config/types.ts`          | `"off" \| "nerd-font"`                                            |
| `RawColour`              | `src/config/types.ts`          | Pre-validation colour string                                      |
| `Cell`                   | `src/widgets/types.ts`         | Atomic render unit output                                         |
| `WidgetContext`          | `src/widgets/types.ts`         | Render-time environment passed to each widget                     |
| `WidgetSettings`         | `src/widgets/types.ts`         | Resolved per-widget settings                                      |
| `WidgetRender`           | `src/widgets/types.ts`         | Widget render function signature                                  |
| `WidgetDef`              | `src/widgets/types.ts`         | Widget contract registered in `WidgetRegistry`                    |
| `MergeMode`              | `src/widgets/types.ts`         | `"off" \| "merge" \| "merge-no-padding"`                          |
| `Segment`                | `src/render/segment.ts`        | ANSI-encoded output segment                                       |
| `StdinPayload`           | `src/stdin/index.ts`           | Parsed Claude Code statusline JSON                                |
| `Theme`                  | `src/theme/index.ts`           | Loaded theme with resolved palette                                |
| `ThemeRole`              | `src/theme/roles.ts`           | Union of valid palette role keys                                  |
| `Colour`                 | `src/theme/colours.ts`         | Parsed colour (named / indexed / hex)                             |
| `ResetAxis`              | `src/tokens/index.ts`          | `"session" \| "block" \| "day" \| "week" \| "model" \| "effort"`  |
| `TokensSnapshot`         | `src/tokens/index.ts`          | Accumulated token totals                                          |
| `TokenTotals`            | `src/tokens/index.ts`          | Token sub-totals by type                                          |
| `KeyScope`               | `src/keys/bindings.ts`         | `"edit" \| "picker" \| "any"`                                     |
| `KeyBinding`             | `src/keys/bindings.ts`         | Single key binding entry                                          |
| `WidgetMeta`             | `src/widgets/catalog.ts`       | Widget metadata entry in catalog                                  |
| `WidgetVariant`          | `src/widgets/catalog.ts`       | Named display variant for a widget                                |
| `WidgetCategory`         | `src/widgets/catalog/types.ts` | Union of the 7 widget family strings (user-facing term: "family") |
| `WidgetMetaEntry`        | `src/widgets/catalog.ts`       | `WidgetMeta` paired with its `type` string                        |

---

## TUI terms

### `editor`

> The Ink-based TUI opened by `agentline edit`.
> Lazy-imported so it never loads on the render path.

**Used in:** `src/tui/`, `agentline edit` command, keymap docs.

---

### `picker`

> The 3-step widget-selection overlay inside the editor:
> step 1 selects a family, step 2 selects a widget type, step 3 selects a variant.

**Used in:** `src/tui/picker.ts`, `src/tui/state.ts`, keymap docs.

---

## Testing terms

### `gate`

> A CI quality-check shell script at `tests/gates/gate-NN-<topic>.sh`.
> Exit 0 = pass, exit 1 = fail, exit 2 = skip.
> Currently 13 gates ship (01–19, with intentional gaps).

**Used in:** `tests/gates/`, `tests/gates/run-all.sh`, CI workflows.

---

### `fixture`

> A synthetic Claude Code stdin JSON payload used in tests and
> `agentline start` / `agentline render`.

**Used in:** `tests/golden/`, `src/render/fixture-runner.ts`, `src/doctor/fixture.ts`.

---

### `golden test`

> A render output snapshot stored in `tests/golden/<scenario>/`.
> Any output change must be deliberate and committed with the snapshot update.

**Used in:** `tests/golden/`, gate-12 (planned).

---

### `unit test`

> A `*.test.ts` file co-located with the module it tests under `src/`.

**Used in:** all `src/**/*.test.ts` files.

---

### `integration test`

> A test under `tests/integration/` or `tests/tui/` that exercises
> multiple modules together.

**Used in:** `tests/integration/`, `tests/tui/`.

---

## Retired terms

Do not use these in new code, docs, or comments. Update any occurrence you find.

| Retired term                                  | Use instead                    | Reason                                                                    |
| --------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| "preset" (for init configs)                   | "config template"              | Ambiguous with theme preset; init presets were removed                    |
| "config preset" / "init preset"               | "config template"              | Same as above                                                             |
| "category" (user-facing, for widget grouping) | "family"                       | User-facing term is "family"; TypeScript still spells it `WidgetCategory` |
| "config layer" (implying 3 layers)            | "user config" + "env override" | Project-config layer was removed; only 2 layers remain                    |
| "options sheet" (TUI)                         | —                              | Removed in editor redesign; nothing replaced it                           |
| "focus" / "power" (init template names)       | —                              | Removed; only the `default` template ships                                |
| `agentline config theme`                      | —                              | Subcommand retired; edit `config.theme` directly or use `agentline edit`  |
| `agentline init`                              | —                              | Not in current CLI; `agentline install` seeds the config on first install |
