# Plan v0.1.0: `agentline` — Claude Code statusline CLI

> **Clean-room rule:** Every requirement, schema, file path, identifier, and gate in this document is normative for v0.1.0. No example configurations, transcripts, or sample renderings appear in this spec; they belong to `tests/golden/` and `docs/`.

---

## 0. Distribution model and naming

### 0.1 Model

`agentline` ships as a published npm package `@agentline/cli` exposing the `agentline` bin (pure JS, no native modules). It is a standalone CLI: it reads Claude Code's statusline JSON contract from stdin and writes ANSI-styled output to stdout. Wiring into Claude Code is **consumer-side** — `scripts/install.sh` writes the bin invocation into the `statusLine` key of `~/.claude/settings.json`.

agentline is **not** a Claude Code plugin. It does not ship `.claude-plugin/plugin.json`, slash commands, hooks, agents, skills, rules, powers, or any other plugin artefact. Repos that integrate agentline are free to author such artefacts on top, but they live outside this package.

### 0.2 Name

**Locked: `agentline`.** Kebab-clean, 10 characters, no overlap with existing Anthropic/Claude trademarks, and no published npm/PyPI/crates.io package as of the freeze date. License **MIT**.

### 0.3 Distribution channels (v0.1.0)

| #   | Channel | Artefact                                                                                            | Status  |
| --- | ------- | --------------------------------------------------------------------------------------------------- | ------- |
| 1   | npm     | `@agentline/cli` (pure JS; `bin: { agentline: dist/cli.mjs }`); entry point `npx -y @agentline/cli` | Primary |

Homebrew tap, GitHub Releases native binaries, and curl-installer are explicitly deferred (§13).

---

## 1. Requirements

### 1.1 Functional

- **F1.** A single bin `agentline` reads JSON from stdin (the Claude Code statusline contract), reads merged configuration (§4), renders one or more lines of styled text, and writes them to stdout. Exit code is `0` on success and `1` on unrecoverable error; non-zero exit MUST still produce a one-line ASCII fallback on stdout so the host UI is never blank.
- **F2.** Configuration is JSON, schema-versioned, and merged from two layers (§4): the user config file, then `AGENTLINE_*` env-var overrides. There is no per-project config layer (a `.agentline.json` in the cwd is ignored).
- **F3.** A line is an ordered list of widgets (§7). A widget is one of: built-in (§7.2–§7.7) or `separator` (§7.8.1).
- **F4.** Widgets render with optional foreground colour, background colour, bold, italic, raw-value mode, and merge mode (§5.4). Each widget MAY be hidden by configuration (§4.6).
- **F5.** Powerline mode (§5.1) replaces inter-widget separators with chevron glyphs and computes adjoining colours.
- **F6.** Content is left-aligned by default; layout primitives may emit flex-true cells that expand to fill the remaining horizontal width across all flex slots equally.
- **F7.** Token and rate-limit accumulators are bucketed by a declared `reset` axis (§8.4). Mixed axes never silently combine.
- **F8.** Git widgets read the working tree implied by the stdin `cwd` field; they MUST NOT shell out to anything other than `git`, and MUST tolerate non-git directories with a hidden render.
- **F9.** Session info widgets read every field the Claude Code stdin contract exposes (§7.2) and fall back to local auth files where the field is unavailable (§7.2.1).
- **F10.** A TUI editor (`agentline edit`) lets users add, reorder, recolour, and toggle widgets with live preview; configuration changes persist atomically (write-temp-then-rename).
- **F11.** A doctor command (`agentline doctor [--fix]`) inspects host prerequisites, the wired settings entry, and the merged config; `--fix` repairs documented misconfigurations.
- **F12.** A render dry-run (`agentline render --fixture <path>`) reproduces a line from a recorded stdin fixture; output is byte-identical to a real render under the same config.
- **F13.** _(retired)_ The editor's keymap is surfaced in the TUI footer; there is no CLI surface for enumerating bindings.
- **F14.** A schema command (`agentline config schema [--write]`) prints (or writes to disk) the JSON Schema for the configuration.
- **F15.** A live config-reload loop watches all files in the merged config set; changes apply within one render tick without dropping in-flight stdin reads.

### 1.2 Non-functional

- **N1.** **Implementation language.** TypeScript ≥5.4 compiled to ESM JavaScript targeting Node ≥20 LTS. No native modules; pure JS dependencies only. Distributed exclusively as the npm package `@agentline/cli` whose `bin` field exposes `agentline`.
- **N2.** **Cold-start budget.** ≤120 ms wall-clock p95 from `node` process start to first byte on stdout for a 5-widget single-line config when the package is globally installed (or when npx's tarball cache is warm). Cold-cache `npx -y` is explicitly out of scope of this budget; the install docs steer users to `npm i -g` when the warm path matters.
- **N3.** **Steady-state render budget.** ≤25 ms p95 per render tick on a 2023 reference machine. The TUI editor and Ink are NEVER imported on the render path; they load only when `agentline edit` runs (§9.1).
- **N4.** **Memory budget.** Resident set ≤80 MB during a 24-hour interactive session.
- **N5.** **No remote calls.** No network I/O at render time. Update checks (if any) are gated to a separate command.
- **N6.** **No mutation of host state.** The render path never writes to disk, environment, or settings. No artefact in the published tarball contains `/Users/`, `/home/`, or `~/.claude/` literals.
- **N7.** **Deterministic output.** Same stdin + same config + same wall-clock-frozen renders byte-identical bytes; non-determinism is confined to time-based widgets (block/weekly timers) and explicitly tagged.
- **N8.** **Accessibility.** `--no-color`, `--no-unicode`, and `--ascii` produce equivalent semantic output and degrade truecolor to 256 to 16 colours by detection.
- **N9.** **CLI spec conformance.** The repository satisfies every gate enumerated in §11 of this document.
- **N10.** **No ambient state.** Every config-derived behaviour MUST be reproducible from the merged config snapshot stored on disk.
- **N11.** **Dependency hygiene.** Runtime dependencies pinned by exact version in `package.json`. No `^` or `~` ranges for runtime deps; dev deps may use `^`. Total runtime dependency tree audited against `npm audit --omit=dev` in CI; high-severity advisories block merge.

### 1.3 Self-dogfood

- **S1.** The repository's own contributors install `agentline` from `scripts/install.sh` and use it as their statusline. Configuration files committed under `examples/` reflect actual maintainer use.

### 1.4 Operational budgets

- **O1.** **Stdin parse budget.** 4 ms p95 for a 32 KB stdin payload. Larger payloads are truncated at 256 KB and a `truncated` marker is emitted.
- **O2.** **External command timeout (custom widgets).** Default 250 ms; per-widget overridable up to 2 000 ms. Timeouts render the widget's `onError` placeholder.
- **O3.** **JSONL transcript cache.** Keyed by `(transcript_path, mtime, size)`; entries evicted after 5 hours or 32 MB total, whichever first. Per-file reads are capped at **16 MB** (oversize transcripts render dependent widgets as empty / hidden). `transcript_path` MUST resolve under the user's `~/.claude` tree; reads outside that root are refused so a malformed stdin payload cannot be turned into an arbitrary-file-read primitive. Tests may override the allowed root with `AGENTLINE_TRANSCRIPT_ROOT`.
- **O4.** **Schema migration.** When the on-disk schema version is older than the binary's, the binary auto-migrates and writes a backup to `<config>.bak`. Older binaries refuse newer schemas with a structured error.

### 1.5 Compatibility

- **C1.** Targets the Claude Code statusline JSON contract as documented in `docs/install.md`. The bin tolerates unknown fields (§8.1) so future-compatible payloads do not break older agentline versions.
- **C2.** Bash 3.2 (macOS default) and Bash 5+ for shell scripts. Powershell support is out of scope for v0.1.0; on Windows, scripts run under Git Bash or WSL.
- **C3.** Node ≥20 LTS is the only runtime requirement on the host. Bun and Deno are not blocked but are not tested in CI for v0.1.0.

---

## 2. Repository folder layout

```text
agentline/
├── .github/
│   ├── workflows/                     § 11.1
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── .gitignore
├── .editorconfig
├── .markdownlint.jsonc
├── docs/
│   ├── plan/
│   │   ├── SPEC-v0.1.0.md             this document
│   │   ├── PR-PLAN.md
│   │   └── PR-CONVENTIONS.md
│   ├── install.md
│   ├── config.md
│   ├── widgets.md
│   ├── themes.md
│   ├── keymap.md
│   └── doctor.md
├── examples/                          dogfood configs (§ 1.3)
├── schemas/
│   └── config.schema.json             § 4.7
├── scripts/
│   ├── install.sh                     § 10
│   ├── doctor.sh
│   ├── uninstall.sh
│   └── lib/common.sh
├── templates/
│   ├── default.config.json
│   └── minimal.config.json
├── tests/
│   ├── gates/
│   │   ├── lib/
│   │   ├── gate-01-doctor.sh
│   │   ├── gate-02-no-absolute-paths.sh
│   │   ├── gate-03-shellcheck.sh
│   │   ├── gate-05-markdown.sh
│   │   ├── gate-06-trademark.sh
│   │   ├── gate-07-roundtrip-clean.sh
│   │   ├── gate-08-roundtrip-userdata.sh
│   │   ├── gate-09-install-twice-idempotent.sh
│   │   ├── gate-10-dry-run-parity.sh
│   │   ├── gate-11-config-schema.sh
│   │   ├── gate-12-render-determinism.sh
│   │   ├── gate-13-cold-start-budget.sh
│   │   ├── gate-14-no-network-at-render.sh
│   │   ├── gate-15-platform-matrix.sh
│   │   ├── gate-16-accessibility-fallbacks.sh
│   │   ├── gate-17-keymap-coverage.sh
│   │   └── run-all.sh
│   └── golden/                        § 11.3 renderer snapshots
├── themes/
│   └── *.json                         § 5.6
├── src/                               TypeScript source tree (§9)
│   ├── cli.ts                         entry point referenced by package.json#bin
│   ├── render/                        render pipeline (§8)
│   ├── config/                        layered loader, schema validation (§4)
│   ├── widgets/                       built-in widget implementations (§7)
│   ├── powerline/                     Powerline transform (§5.1)
│   ├── theme/                         theme loader & colour resolution (§5.4)
│   ├── stdin/                         Claude Code stdin contract parser (§8.1)
│   ├── git/                           git invocation + parser (§7.6)
│   ├── tokens/                        token accumulators, pricing table (§7.3, §8.5)
│   ├── session/                       session-info field resolvers + auth fallback (§7.2)
│   ├── tui/                           Ink editor; lazy-loaded (§1.2 N3)
│   ├── doctor/                        diagnostics + autofix (§9.2)
│   ├── keys/                          keymap registry (§5.5)
│   └── schema/                        JSON Schema embedder (§4.7)
├── dist/                              compiled JS (gitignored; produced by build)
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsup.config.ts                     or equivalent bundler config
├── CHANGELOG.md
├── CLAUDE.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE
├── README.md
├── SECURITY.md
└── SUPPORT.md
```

Any deviation from this tree at PR-merge time MUST be justified in a single line under README's "Layout" section.

Notably absent (by design — §0.1): `.claude-plugin/`, `.mcp.json`, `agents/`, `commands/`, `hooks/`, `powers/`, `rules/`, `skills/`. agentline is a CLI, not a plugin.

---

## 3. Published package (`package.json`)

| Key               | Type             | Constraint                                                                                                             |
| ----------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `name`            | string           | `@agentline/cli`                                                                                                       |
| `version`         | string           | SemVer; matches the latest `vX.Y.Z` git tag on `main`                                                                  |
| `description`     | string           | ≤200 chars; one sentence; no marketing                                                                                 |
| `author`          | object \| string | `{ name, email, url }` or canonical `"name <email> (url)"` form; email reachable                                       |
| `homepage`        | URL              | repo URL                                                                                                               |
| `repository`      | object           | `{ type: "git", url }`                                                                                                 |
| `license`         | string           | SPDX `MIT`; matches `LICENSE`                                                                                          |
| `keywords`        | string[]         | 3–10 lowercase entries; no duplicates; MUST include `claude-code` and `statusline`                                     |
| `engines`         | object           | `{ "node": ">=20" }`                                                                                                   |
| `type`            | string           | `module` (ESM)                                                                                                         |
| `bin`             | object           | `{ "agentline": "dist/cli.mjs" }`                                                                                      |
| `files`           | string[]         | Allowlist of published artefacts: `dist/`, `schemas/`, `themes/`, `templates/`, `LICENSE`, `README.md`, `CHANGELOG.md` |
| `dependencies`    | object           | Exact versions only (no `^` / `~` / `latest`); per §1.2 N11                                                            |
| `devDependencies` | object           | `^` ranges permitted                                                                                                   |
| `scripts`         | object           | At minimum `build`, `test`, `lint`, `typecheck`, `prepublishOnly` (runs `build`)                                       |
| `publishConfig`   | object           | `{ "access": "public", "provenance": true }`                                                                           |

Forbidden:

- Hardcoded absolute paths in any field.
- Unbounded version ranges in `dependencies`.
- `latest` in any version specifier.
- `postinstall` scripts that touch the host filesystem outside the package install directory.
- Publishing files outside the `files` allowlist (`.npmignore` is not used; `files` is authoritative).

---

## 4. Configuration

### 4.1 Layered merge order

agentline is configured globally only. Layered top-to-bottom (later
overrides earlier):

1. Built-in defaults (compiled into the bin).
2. User config: `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`.
3. Environment variables prefixed `AGENTLINE_` (dot-path, e.g. `AGENTLINE_GLOBAL_PADDING=2`).
4. Command-line flags.

There is no per-project config layer. A `.agentline.json` in the cwd
is silently ignored by the loader; the editor and any programmatic
mutator always read from and write to the user config.

**Prototype-pollution defence.** Every JSON-parse boundary that feeds
into the merged config — the user file (handled inside `mergeAll`),
the env layer's `AGENTLINE_X='{"…":…}'` decoder, and the
`agentline render --config` fixture path — drops own-keys named
`__proto__`, `constructor`, or `prototype` recursively before the
result reaches AJV. AJV's strict top-level (`additionalProperties:
false`) is the primary line of defence; the recursive strip closes the
gap at carve-outs like `widgets[].options` and `palette` where
`additionalProperties: true`.

### 4.2 Top-level schema

| Key             | Type   | Default   | Notes                                            |
| --------------- | ------ | --------- | ------------------------------------------------ |
| `$schema`       | string | URL       | JSON Schema URL (§4.7)                           |
| `version`       | int    | `1`       | Schema version; bin auto-migrates older versions |
| `theme`         | string | `null`    | Named theme from `themes/` (§5.6)                |
| `lines`         | array  | `[ {…} ]` | Ordered statusline lines (§4.3)                  |
| `global`        | object | `{…}`     | Global render options (§4.4)                     |
| `powerline`     | object | `{…}`     | Powerline options (§5.1)                         |
| `terminalWidth` | object | `{…}`     | Width-detection mode (§4.5)                      |
| `keymap`        | object | `{}`      | Keybinding overrides (§5.5)                      |

### 4.3 Lines

```text
lines: [ { widgets: Widget[] } ]
```

A line MUST contain at least one widget. Lines render top-to-bottom in declaration order. The number of lines is bounded only by terminal height; the renderer truncates beyond available rows and emits a `truncated` warning to stderr.

### 4.4 `global`

| Key             | Type         | Default | Notes                                                                         |
| --------------- | ------------ | ------- | ----------------------------------------------------------------------------- |
| `padding`       | int          | `1`     | Spaces between widgets in non-Powerline mode                                  |
| `separator`     | string       | `\|`    | Default inter-widget separator                                                |
| `inheritColors` | bool         | `false` | If `true`, a widget without explicit colour inherits from the previous widget |
| `bold`          | bool         | `false` | Apply bold globally                                                           |
| `italic`        | bool         | `false` | Apply italic globally                                                         |
| `minimalist`    | bool         | `false` | Strip widget labels globally (per-widget `rawValue` still wins)               |
| `overrideFg`    | colour\|null | `null`  | Force foreground colour                                                       |
| `overrideBg`    | colour\|null | `null`  | Force background colour                                                       |

### 4.5 `terminalWidth`

| Key                | Type | Default         | Notes                                                         |
| ------------------ | ---- | --------------- | ------------------------------------------------------------- |
| `mode`             | enum | `full-minus-40` | One of `full`, `full-minus-40`, `full-until-compact`          |
| `compactThreshold` | int  | `60`            | Columns below which the renderer switches to compact line set |

### 4.6 Widget shape

```text
{
  "type": "<widget-type>",            // required
  "id":   "<arbitrary>",              // optional, for keymap targeting
  "fg":   "<colour>" | null,          // optional
  "bg":   "<colour>" | null,          // optional
  "bold": bool,                        // optional
  "italic": bool,                      // optional
  "rawValue": bool,                    // optional, default false
  "merged": "off"|"merge"|"merge-no-padding", // optional, default "off"
  "hidden": bool,                      // optional, default false
  "options": { … widget-specific … }   // optional
}
```

`<colour>` is one of:

- A named colour: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, plus their `bright-*` variants.
- A 256-colour index: `"colour:NNN"` where `0 ≤ NNN ≤ 255`.
- A truecolor hex: `"#RRGGBB"`.

Any other value is a schema error.

### 4.7 JSON Schema

`schemas/config.schema.json` is the canonical source of truth. The bin embeds this schema at build time and validates the merged config on load. `agentline config schema --write <dir>` writes the schema to disk so editors can pick it up; the schema's `$id` is a stable URL under the project's homepage.

### 4.8 Defaults shipped

`templates/default.config.json` is the config installed by `scripts/install.sh` (and the `agentline install` CLI) when no user config exists. Its widget list is documented in §7.10.

### 4.9 Atomic writes

Every persisted config write follows write-to-temp + `fsync` + `rename`. Editor watchers MUST observe one consistent state.

---

## 5. Visual & theming

### 5.1 Powerline mode

| Key              | Type         | Default | Notes                                                                                    |
| ---------------- | ------------ | ------- | ---------------------------------------------------------------------------------------- |
| `enabled`        | bool         | `false` | Master toggle                                                                            |
| `theme`          | string\|null | `null`  | Optional override of `config.theme` for Powerline-only colours                           |
| `caps.start`     | string       | `""`    | Glyph at line start; empty means none                                                    |
| `caps.end`       | string       | `""`    | Glyph at line end                                                                        |
| `autoAlign`      | bool         | `false` | Pad earlier lines so widget columns align across lines                                   |
| `continueColors` | bool         | `false` | Carry the trailing background colour across line breaks                                  |
| `glyphs`         | object       | `{…}`   | Override the default chevron set; keys: `hardRight`, `softRight`, `hardLeft`, `softLeft` |

When `enabled` is `true`:

- Inter-widget `separator` and `padding` are ignored; chevrons are inserted instead.
- Adjoining colours are computed: `glyph.fg = prev.bg`, `glyph.bg = next.bg`.
- Without a Nerd Font installed, the bin falls back to ASCII chevrons (`>`, `<`); set `AGENTLINE_GLYPHS=ascii` to force this regardless of the host font.

### 5.2 Widget merging

Per-widget `merged` field:

| Value              | Behaviour                                                         |
| ------------------ | ----------------------------------------------------------------- |
| `off`              | Default: padding + separator on each side                         |
| `merge`            | One space between this widget and the previous one; no separator  |
| `merge-no-padding` | Zero space between this widget and the previous one; no separator |

### 5.3 Raw value mode

When `rawValue: true`, the widget renders only its value, suppressing any built-in label. Equivalent to setting `options.label = ""` for widgets that expose a `label` option.

### 5.4 Theming

A theme is a JSON file with two keys:

```text
{
  "$schema": "https://…/theme.schema.json",
  "name":    "<kebab-case-name>",
  "palette": { "<role>": "<colour>", … },
  "powerline": { "caps.start": "…", "caps.end": "…" }
}
```

Roles consumed by built-in widgets are listed in §7.9. A widget without an explicit colour falls back to the role colour; in the absence of a theme, role defaults defined in code apply.

### 5.5 Hot-keys

The TUI editor (`agentline edit`) renders a two-line footer showing every binding in the active scope. Default keymap (override-able via `config.keymap`):

| Key      | Scope  | Action                                                           |
| -------- | ------ | ---------------------------------------------------------------- |
| `← →`    | edit   | move the selection within the row (incl. the trailing +add cell) |
| `↑ ↓`    | edit   | move the selection between rows                                  |
| `⇧← ⇧→`  | edit   | move the selected widget within its row                          |
| `⇧↑ ⇧↓`  | edit   | move the selected widget to the adjacent row                     |
| `↵`      | edit   | +add cell → open the picker (no-op on a populated widget)        |
| `a`      | edit   | add a widget (opens the picker)                                  |
| `r`      | edit   | replace the selected widget (opens the picker)                   |
| `u`      | edit   | update — pick a different variant of the selected widget         |
| `d`      | edit   | delete the selected widget                                       |
| `S`      | edit   | save (Ctrl+S also works)                                         |
| `(type)` | picker | type to filter widgets by name or type (step 2)                  |
| `↑ ↓`    | picker | highlight a row                                                  |
| `↵`      | picker | confirm the highlighted row and advance / commit                 |
| `Esc`    | picker | step back one level (cancels at step 1)                          |
| `q`      | any    | quit (prompts if there are unsaved changes)                      |

Scopes mirror the editor's modes — `edit` (the live preview is the editing
surface — every row ends in a navigable "+ add widget" cell) and `picker`
(the three-step widget chooser: pick a group → pick a widget → pick a
variant; widgets without catalogued variants skip step 3 and commit
straight from step 2). Per-widget flags (`visible`, `mergeWithPrev`,
`useRawValue`) are set by editing the config file directly — there is
no TUI options-sheet overlay. The editor's two-line footer shows every
binding for the current scope; the authoritative table lives in
`src/keys/bindings.ts`.

### 5.6 Theme presets shipped at v0.1.0

| #   | Theme               | Tone                                    |
| --- | ------------------- | --------------------------------------- |
| 1   | `vscode-dark`       | dark, neutral (VS Code Default Dark+)   |
| 2   | `vscode-light`      | light, neutral (VS Code Default Light+) |
| 3   | `claude-code-dark`  | dark, warm (Claude brand)               |
| 4   | `claude-code-light` | light, warm (Claude brand)              |

Theme files live under `themes/` and are copied to `${CLAUDE_CONFIG_DIR}/agentline/themes/` by `install.sh`.

---

## 6. Reserved

§6 is intentionally empty. Earlier drafts of this spec defined a Claude Code slash command and a default-on PreToolUse hook in this section; both were removed when v0.1.0 was scoped to a CLI-only distribution (§0.1). Subsequent section numbers (§7 onward) are preserved to keep PR and gate citations stable.

---

## 7. Widgets

### 7.1 Widget contract

Every widget is declared in code as a TypeScript class implementing:

```text
render(ctx: Context, opts: Options): Cell
```

`Cell` is the unit consumed by the renderer (string + colour pair + flags). A widget MUST be pure with respect to its inputs (`ctx` carries stdin payload, merged config, clock, theme).

### 7.2 Session widgets

| Type              | Field source                                   | Notes                                                    |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `model`           | `stdin.model`                                  | Maps id → display name                                   |
| `version`         | `stdin.version` or `claude --version` fallback |                                                          |
| `session-id`      | `stdin.sessionId`                              | Truncated to 8 chars; `h` toggles hide                   |
| `session-name`    | `stdin.sessionName`                            | Empty hides by default                                   |
| `account-email`   | `stdin.user.email` ∨ `~/.claude/auth.json`     | Mask modes: `none`, `domain`, `localpart`                |
| `thinking-effort` | `stdin.thinkingEffort`                         | One of `low`, `medium`, `high`, `xhigh`; semantic colour |
| `skills`          | `stdin.skills`                                 | Display: count, list, last; cycled by `v`                |

#### 7.2.1 Auth-file fallback

When stdin omits a field, the bin reads `${CLAUDE_CONFIG_DIR}/auth.json` (or platform equivalent) read-only. Failure renders the field as hidden, never errors. The reader caps file size at **64 KB**; an oversize file (e.g. a symlink to `/dev/zero`) is treated as an unreadable auth file — same hidden-field behaviour as the missing-file case — so the render budget (§1.2 N3) is not blown.

### 7.3 Token widgets

| Type            | Reset axis                                           | Notes                                       |
| --------------- | ---------------------------------------------------- | ------------------------------------------- |
| `tokens-input`  | `session`\|`block`\|`day`\|`week`\|`model`\|`effort` | Sum from JSONL `message.usage.input_tokens` |
| `tokens-output` | same                                                 |                                             |
| `tokens-cached` | same                                                 |                                             |
| `tokens-total`  | same                                                 | Sum of the three                            |
| `input-speed`   | rolling window (s)                                   | Default 60 s                                |
| `output-speed`  | same                                                 |                                             |
| `total-speed`   | same                                                 |                                             |

The reset axis is declared in `options.reset` and defaults to `session`.

### 7.4 Context widgets

| Type                        | Notes                                                      |
| --------------------------- | ---------------------------------------------------------- |
| `context-length`            | Raw token count                                            |
| `context-percentage`        | Used / window; colour grades green→yellow→red at 60 / 80 % |
| `context-percentage-usable` | Same metric against `0.8 × window`                         |
| `context-bar`               | Visual bar; width set by `options.width` (default 12)      |

### 7.5 Rate-limit widgets

| Type                 | Notes                                               |
| -------------------- | --------------------------------------------------- |
| `session-usage`      | 5-h block; cycle display: percent / bar / short bar |
| `block-reset-timer`  | Countdown to next block reset                       |
| `block-reset-at`     | Wall-clock of next block reset                      |
| `weekly-reset-timer` | Countdown to next weekly reset                      |
| `weekly-reset-at`    | Wall-clock of next weekly reset                     |

### 7.6 Git widgets

| Type               | Output        | Notes                                          |
| ------------------ | ------------- | ---------------------------------------------- |
| `git-branch`       | branch name   | Detached HEAD shows `(SHA)`; OSC-8 link toggle |
| `git-changes`      | `+N -M`       | Aggregate insertions & deletions               |
| `git-staged`       | count         |                                                |
| `git-unstaged`     | count         |                                                |
| `git-untracked`    | count         |                                                |
| `git-ahead-behind` | `↑N ↓M`       | `h` hides when even                            |
| `git-conflicts`    | `⚡N`         | Hidden when zero                               |
| `git-sha`          | short SHA     |                                                |
| `git-worktree`     | worktree name | When inside a worktree                         |
| `git-origin-repo`  | remote repo   | Toggle IDE link                                |
| `git-upstream`     | upstream ref  |                                                |
| `git-pr`           | PR identifier | Opt-in network — see §7.8                      |

Git widgets call `git -C <cwd> …`; CRLF and Windows path normalisation handled (§8.6).

### 7.7 Time widgets

| Type             | Notes                              |
| ---------------- | ---------------------------------- |
| `clock`          | Local time, format configurable    |
| `uptime-session` | Time since session start           |
| `uptime-block`   | Time since current 5-h block start |

### 7.8 Custom widgets

#### 7.8.1 `separator`

```text
{ "type": "separator", "options": { "char": "\|" } }
```

Renders one character; `Space` in TUI cycles `\| - , · ␣`.

### 7.9 Widget roles (theme palette keys)

`accent`, `info`, `success`, `warning`, `danger`, `muted`, `git-clean`, `git-dirty`, `tokens-low`, `tokens-mid`, `tokens-high`, `bg-section`, `bg-emphasis`. Themes MUST define every role; missing roles fall back to compiled defaults.

### 7.10 Default config widget list (one line)

`model · thinking-effort · git-branch · git-changes · context-percentage · tokens-total · session-usage · block-reset-timer · clock`.

The default config makes `tokens-total` and `session-usage` use `reset: block`. Theme is `claude-code-dark` under Powerline-disabled mode.

---

## 8. Engine internals (normative constraints, not implementation details)

### 8.1 Stdin ingestion

The bin reads stdin until EOF or 256 KB, whichever first. The payload is the Claude Code statusline JSON contract; unknown fields are preserved untouched. A malformed payload renders an ASCII error line and exits 1.

### 8.2 Render pipeline

Order of operations per tick:

1. Detect terminal width (env `COLUMNS`, ioctl, fallback 80).
2. Apply `terminalWidth.mode`.
3. For each line: compute widget cells; resolve colours; resolve theme roles; apply Powerline transform; expand flex separators; truncate to width.
4. Encode to ANSI escape sequences appropriate for detected colour depth.
5. Write to stdout in one syscall.

### 8.3 Colour-depth detection

`COLORTERM=truecolor` ⇒ 24-bit. Else `TERM` lookup ⇒ 256-colour or 16-colour. `--no-color` forces ANSI off.

### 8.4 Reset axes

| Axis      | Boundary                          | Notes                                 |
| --------- | --------------------------------- | ------------------------------------- |
| `session` | Session start                     | Resets when `stdin.sessionId` changes |
| `block`   | 5 h, anchored to first event hour |                                       |
| `day`     | Local midnight                    |                                       |
| `week`    | Local Monday 00:00                |                                       |
| `model`   | Model id boundary                 | Aggregates per `stdin.model`          |
| `effort`  | Thinking-effort tier              | Aggregates per `stdin.thinkingEffort` |

A widget MUST declare its axis; mixed-axis sums are not supported.

### 8.5 Pricing table

`src/tokens/pricing.ts` embeds a versioned price table keyed by model id. The table version is reported by `agentline doctor` and refreshed by maintainers as part of releases; the bin never fetches prices at runtime.

### 8.6 Platform handling

| OS      | Notes                                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | UTF-8 by default; no special handling                                                                                                                       |
| Linux   | Same                                                                                                                                                        |
| Windows | Sets console mode to UTF-8 via `chcp 65001` shim or stdout encoding override; normalises `\\` to `/` for display; git invocations honour `-C` and trim CRLF |

---

## 9. CLI surface

### 9.1 Subcommands

Top-level surface — intentionally flat. The default no-arg path is the render-on-stdin contract; every other verb is a top-level command (no nested `config <sub>` dispatcher).

| Command                             | Purpose                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `agentline` (no args)               | Read stdin, render, exit. Default behaviour wired into `statusLine`       |
| `agentline render`                  | Same as no-args; `--fixture <path>` and `--config <path>` flags supported |
| `agentline install`                 | Wire `statusLine` + install agentline skill files                         |
| `agentline uninstall [--purge]`     | Reverse install; restore prior `statusLine` from backup                   |
| `agentline doctor [--fix] [--json]` | Diagnose and (optionally) repair                                          |
| `agentline edit`                    | TUI editor (Ink); writes config atomically. Lazy-imports Ink only here.   |
| `agentline version`                 | Print version + build metadata                                            |

### 9.2 Doctor checks

Doctor runs every check in order and prints a structured report. `--fix` attempts the documented repair; otherwise it only reports.

| ID  | Check                                                             | Auto-fix                                                       |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| D01 | `~/.claude/settings.json` exists                                  | Create with default skeleton                                   |
| D02 | `statusLine.command` resolves to a working `agentline` invocation | Rewrite to `npx -y @agentline/cli` or absolute global bin path |
| D03 | User config exists and matches schema                             | Migrate or write defaults                                      |
| D04 | All themes referenced by config are installed                     | Copy from package's embedded theme set                         |
| D05 | Git binary on PATH (when any git widget is enabled)               | None; report only                                              |
| D06 | Pricing table is fresher than `now − 90 days`                     | None; report only                                              |
| D07 | `CLAUDE_CONFIG_DIR` (if set) points to a writable directory       | None; report only                                              |
| D08 | Custom-command widgets resolve their `cmd` to an executable       | None; report only                                              |
| D09 | Render dry-run on an embedded fixture matches a stored snapshot   | None; report only                                              |

### 9.3 Exit codes

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| 0    | Success                                                        |
| 1    | Unrecoverable error (fallback line still printed for `render`) |
| 2    | Configuration error (schema/parse)                             |
| 3    | Doctor finding (only when `doctor` is run with `--strict`)     |

---

## 10. Lifecycle scripts

| Script                  | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/install.sh`    | Idempotent. Verifies Node ≥20. Runs `npm i -g @agentline/cli@<pinned>` (or `npm link` when run from a checked-out repo with `--from-source`). Copies `templates/default.config.json` to `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json` if absent. Copies `themes/*.json` to the same directory's `themes/` subfolder. Wires `statusLine` into `~/.claude/settings.json` if `statusLine` is unset, using `npx -y @agentline/cli` as the command (or the global bin path when global install succeeded); refuses to overwrite existing user values without `--force`. Supports `--dry-run`. |
| `scripts/doctor.sh`     | Read-only wrapper over `agentline doctor`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `scripts/uninstall.sh`  | Idempotent. Runs `npm uninstall -g @agentline/cli` (skipped if absent). Removes config files copied by `install.sh`. Preserves user-edited config (detected via SHA mismatch with the shipped template); only removes the user config if `--purge` is passed. Refuses to delete unrelated files. Removes the `statusLine` entry from `~/.claude/settings.json` only if it still points at agentline.                                                                                                                                                                                               |
| `scripts/lib/common.sh` | Shared helpers: logging, OS detection, Node version check, `set -Eeuo pipefail`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Constraints: no `rm -rf "$VAR"` without guards; no remote one-off package executors.

---

## 11. Testing & CI

### 11.1 Workflows

| Workflow             | Triggers                   | Purpose                                                                                                |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `gates.yml`          | push, pull_request         | Run `tests/gates/run-all.sh` on the matrix                                                             |
| `install-matrix.yml` | push, pull_request         | Roundtrip `install.sh` ↔ `uninstall.sh` on every supported host (Node ≥20 only)                        |
| `release.yml`        | tag push (`v*`)            | `npm publish` `@agentline/cli` with provenance (`--provenance`); attach `SHA256SUMS` to GitHub Release |
| `pricing-skew.yml`   | scheduled monthly + manual | Compare embedded pricing table to a maintained reference                                               |
| `node-skew.yml`      | scheduled weekly + manual  | Smoke-run the published bin against current Node 20 / 22 LTS lines                                     |

Every workflow pins actions by SHA, sets `permissions: read-all`, uses `concurrency:` cancellation, and uploads machine-readable artefacts on failure.

### 11.2 Mandatory gates

Every gate ID below is a file `tests/gates/gate-NN-<topic>.sh`; orchestrated by `tests/gates/run-all.sh`. Exit contract: `0` pass, `1` fail, `2` skipped.

| Gate | Topic                                                                                                                   | Source            |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 01   | `scripts/doctor.sh` exits 0 on healthy host                                                                             | this spec §9.2    |
| 02   | No `/Users/`, `/home/`, `~/.claude/` literals in shipped artefacts                                                      | this spec §1.2 N6 |
| 03   | All `*.sh` pass `shellcheck -x`                                                                                         | this spec §10     |
| 05   | `markdownlint-cli2` + `prettier --check` over `*.md`                                                                    | this spec §11.1   |
| 06   | No third-party trademark misuse (allowlist)                                                                             | this spec §0.2    |
| 07   | Roundtrip clean: `install.sh && uninstall.sh` leaves no diff                                                            | this spec §10     |
| 08   | Roundtrip preserves user-authored content                                                                               | this spec §10     |
| 09   | Install-twice idempotent                                                                                                | this spec §10     |
| 10   | `install.sh --dry-run` matches real run                                                                                 | this spec §10     |
| 11   | `agentline config schema` round-trips against `templates/*.json`                                                        | this spec §4.7    |
| 12   | Render determinism: same fixture + frozen clock ⇒ byte-identical bytes                                                  | this spec §1.2 N7 |
| 13   | Cold-start budget on reference host (`agentline render` ≤120 ms p95 with global install)                                | this spec §1.2 N2 |
| 14   | No network at render time (verified via sandbox)                                                                        | this spec §1.2 N5 |
| 15   | Published package smoke-runs on `{macos-13, macos-14, ubuntu-22.04, ubuntu-24.04, windows-2022}` × `{Node 20, Node 22}` | this spec §1.2 N1 |
| 16   | Accessibility flags produce semantically equivalent output                                                              | this spec §1.2 N8 |
| 17   | Keymap coverage: every documented binding is present in the compiled `dist/keys.mjs` (`DEFAULT_KEY_BINDINGS`)           | this spec §5.5    |

Gates dropped vs earlier drafts: plugin-manifest validity, YAML frontmatter, and `hooks/hooks.json` validity — none apply to a CLI-only distribution (§0.1).

### 11.3 Golden tests

`tests/golden/<scenario>/`:

```text
stdin.json          recorded statusline payload
config.json         active config
clock.txt           frozen wall-clock for determinism
expected.ansi       byte-exact stdout
```

`gate-12-render-determinism.sh` iterates every scenario.

---

## 12. Versioning, license, support

### 12.1 SemVer

`0.x.y` until first stable. `0.1.0` is the first release with all gates green. `1.0.0` freezes the public CLI surface and config schema; breaking changes after that require a major bump and a one-minor-release deprecation window.

### 12.2 Tag ↔ package version

`package.json#version` MUST equal the latest `vX.Y.Z` annotated tag on `main`. Tags are GPG- or Sigstore-signed.

### 12.3 Changelog

Keep a Changelog format. `[Unreleased]` accumulates between tags; entries grouped `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security` and reference a commit SHA or PR number.

### 12.4 License

`MIT`. Same SPDX identifier in `LICENSE` and `package.json#license`. Copyright line `2026 <holder>`.

### 12.5 Contribution model

`CONTRIBUTING.md` covers: dev bootstrap (`npm i && npm run build && bash tests/gates/run-all.sh`), branch naming (per `PR-CONVENTIONS.md`), Conventional Commits, gate command, PR template expectations.

`CODE_OF_CONDUCT.md` adopts Contributor Covenant 2.1 verbatim.

`SECURITY.md` declares the disclosure channel (private GitHub advisory) and SLA (acknowledge in 5 business days).

---

## 13. Out of scope at v0.1.0

- Distribution as a Claude Code plugin (`.claude-plugin/plugin.json`, slash commands, hooks, agents, skills, rules, powers, MCP servers). agentline is CLI-only at v0.1.0; consumer repos may layer plugin artefacts on top.
- Native binaries / GitHub Releases tarballs.
- Homebrew tap.
- `curl … | sh` installer.
- Bun / Deno officially supported runtimes.
- Powershell-native install scripts.
- Remote update checks.
- Telemetry of any kind.
- Per-tenant pricing tables.
- Plugin marketplace listing automation.
- Custom widget plugins via dynamic libraries / WASM (deferred to v0.3.0).

---

## 14. Release checklist

Before tagging `v0.1.0`:

1. All §11 gates green on `main`.
2. `CHANGELOG.md` `[Unreleased]` promoted to `[0.1.0] – YYYY-MM-DD`.
3. `package.json#version` set to `0.1.0`.
4. README badges resolve.
5. `docs/install.md` works on a fresh host.
6. `scripts/doctor.sh` exits 0 on a healthy host.
7. `install.sh && uninstall.sh` leaves a clean tree.
8. Release notes drafted from CHANGELOG.
9. `npm publish --provenance` succeeds; the published tarball passes `npm pack && npm i -g <tarball> && agentline version`.
