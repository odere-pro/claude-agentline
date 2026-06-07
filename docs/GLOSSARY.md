# Glossary

Canonical vocabulary for the `agentline` project. When a term here conflicts
with a comment, doc, or identifier elsewhere in the repo, this file wins —
update the other artefact, not this one.

---

## Core product terms

### `agentline`

> The CLI binary and npm package (`@odere-pro/agentline`).

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

**Used in:** performance rules, gate-13, gate-19, `src/render/render/`.

---

### `render pipeline`

> The full sequence: parse stdin → load config → resolve theme →
> render widgets → compose lines → encode ANSI → write stdout.

**Used in:** architecture docs, `src/render/render/pipeline/pipeline.ts`.  
**Distinct from:** "render path" (pipeline = the whole chain; path = the hot measurable segment).

---

### `one-syscall write`

> The render path accumulates the complete ANSI frame into a single buffer and
> emits it with exactly one `write` syscall before exiting — implemented by
> `writeOnce` in `src/render/render/write/write.ts`. No incremental writes are
> permitted; interleaved partial writes produce torn lines in the host UI.

**Used in:** `src/render/render/write/write.ts`, `src/render/render/CLAUDE.md`,
`SOFTWARE-3-0.md` (§ "Powerline, adapted for agents"), gate-pass contract for
the render path.

---

### `cold start`

> Process-start-to-first-byte latency. Must be ≤ 120 ms p95.

**Used in:** gate-13, spec §1.2 N2.

---

### `agent-operable`

> The Software 3.0 property of the product: an LLM agent can install,
> configure, theme, and troubleshoot agentline using only natural language,
> the user's terminal, and the artefacts the repo ships — without a human
> in the loop. The product achieves this not by containing an agent but by
> providing stable input contracts, scriptable CLI verbs, seeded skill files,
> per-group `CLAUDE.md` briefings, and authoritative vocabulary.

**Used in:** `SOFTWARE-3-0.md` (thesis definition), `CLAUDE.md`.  
**Distinct from:** "contains an agent" — agentline's hot path contains no LLM;
the property is about what an external agent can _do with_ the product.

---

## Widget terms

### `widget`

> The atomic render unit: a `type` string, optional style keys
> (`fg`, `bg`, `bold`, `italic`), optional `options`, and optional `id`.

**Used in:** `config.lines[]`, `src/widgets/`, all widget docs.

---

### `widget type`

> The kebab-case string identifier for a widget, e.g. `git-branch`,
> `tokens`, `session-weekly-usage`.

**Used in:** `WidgetConfig.type`, widget catalog keys, `agentline config widget` commands.

---

### `widget family`

> One of the five named groups that organise built-in widgets:
> `session`, `tokens`, `context`, `rate-limits`, `git`.

**Used in:** `WidgetMeta.family` (code), `WIDGET_FAMILIES` (constant),
`src/widgets/<family>/` directories, picker group browser, and the
per-row family badge in the flat-search overlay.  
**Note:** Earlier code spelled this as `WidgetCategory` / `WIDGET_CATEGORIES` /
`CATEGORY_COLOR` / `.category`. The TypeScript surface is now aligned with the
user-facing term **family**.

---

### `variant`

> A named preset of widget `options` that switches a widget's display style.
> Example: `current-session-reset-timer` has variants `at-24h`, `at-12h`, `at-seconds`.

**Used in:** `WidgetVariant`, picker step 3, `agentline config widget` update verb.  
**Distinct from:** `widget type` (what the widget is) and `options` (raw config).

---

### `widget catalog`

> The static metadata table `WIDGET_CATALOG` keyed by widget type.
> Contains: human name, description, family, and variants.

**Used in:** `src/widgets/families/catalog.ts`, the TUI picker, `agentline config widget catalog`.  
**Distinct from:** "widget registry" (runtime render-function map).

---

### `widget registry`

> The runtime `WidgetRegistry` instance that maps `type` → `WidgetDef`
> (the render function). Populated by `registerAllBuiltins()`.

**Used in:** `src/widgets/registry/registry.ts`, the render pipeline.  
**Distinct from:** "widget catalog" (static metadata, not render functions).

---

## Built-in widget types (34 total)

All types are kebab-case strings. Source of truth: `src/widgets/families/catalog.ts`.

### Session family (17)

| Type               | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `model`            | Active model id (e.g. Sonnet 4.6)                          |
| `version`          | Claude Code version                                        |
| `thinking-effort`  | Thinking-effort tier: low, medium, or high                 |
| `thinking-enabled` | Whether extended thinking is on (complements effort)       |
| `plan`             | Active plan for the current session                        |
| `project`          | Project name — git repo or working-directory folder        |
| `project-dir`      | Launch-directory name (distinct from the git repo name)    |
| `cwd-path`         | Current working-directory path, home-collapsed/truncatable |
| `added-dirs`       | Count of extra workspace roots added via /add-dir          |
| `agent-name`       | Active subagent persona name                               |
| `clock`            | Current time of day (24h or 12h)                           |
| `output-style`     | Active output style (e.g. explanatory, learning)           |
| `vim-mode`         | Active vim mode (NORMAL, INSERT, …)                        |
| `session-id`       | Short session id                                           |
| `account-email`    | Logged-in account email                                    |
| `session-duration` | Host-reported session elapsed time (e.g. 12m 30s)          |
| `lines-changed`    | Host-reported lines added and removed this session         |

### Tokens family (4)

| Type            | Description                                            |
| --------------- | ------------------------------------------------------ |
| `tokens`        | Input ↓ + output ↑ subtotals for the chosen reset axis |
| `tokens-cached` | Cached-token subtotal (prompt-cache hits)              |
| `token-speed`   | Input ↓ + output ↑ tokens per second (rolling window)  |
| `cost-usd`      | Host-reported session cost in USD (e.g. $1.23)         |

### Context family (2)

| Type                 | Description                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| `context-percentage` | Percentage of the model's context window used, plus the window (`37% · 200k`) |
| `context-200k-flag`  | Badge when the prompt exceeds the 200k-token threshold                        |

### Rate-limits family (3)

| Type                          | Description                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `session-weekly-usage`        | Combined session + weekly usage % from the host                                                                  |
| `current-session-reset-timer` | Countdown to the next session reset; wall-clock variants (`at-24h`, `at-12h`, `at-seconds`) via `options.format` |
| `week-limit-timer`            | Countdown to the next weekly reset; wall-clock variants (`at-day-time`, `at-24h`, `at-12h`) via `options.format` |

### Git family (8)

| Type               | Description                                 |
| ------------------ | ------------------------------------------- |
| `git-branch`       | Current branch, or short SHA when detached  |
| `git-worktree`     | Basename of the current worktree            |
| `git-changes`      | Staged, unstaged, and untracked file counts |
| `git-conflicts`    | Merge-conflict file count                   |
| `git-ahead-behind` | Commits ahead of and behind upstream        |
| `git-upstream`     | Upstream branch, e.g. `origin/main`         |
| `git-origin-repo`  | Repo segment of the origin remote URL       |
| `git-pr`           | PR for HEAD's branch (opt-in network)       |

---

## Config terms

### `config`

> The user's `config.json` at
> `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`.
> The single source of truth; there is no per-project layer.

**Used in:** all config docs, `src/data/config/`.

---

### `config template`

> A shipped config file in `templates/` used to seed the user config.
> Three templates are provided: `default` (balanced three-line layout),
> `minimal` (single-line, lean), and `power` (four-line, showcasing
> breadth). `agentline install` seeds from `default`; `agentline config
init --preset <name>` lets you choose any template. `agentline reset`
> always reseeds from `default`.

**Used in:** `templates/`, `src/data/config/init/`, install flow.  
**Distinct from:** "theme preset" (a shipped theme JSON, not a config).  
**Formerly called:** "preset" or "init preset" — retired terms; the CLI
flag is `--preset` but in prose and docs always say "config template".

---

### `env override`

> An `AGENTLINE_<DOTPATH>` environment variable that overrides any config
> leaf at render time without editing the config file.
> Example: `AGENTLINE_THEME=vscode-dark`.

**Used in:** `src/data/config/env/env.ts`, spec §4.

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

---

### `powerline`

> Optional rendering mode that replaces padding/separator with chevron
> glyphs and computes colour transitions between adjacent segments.
> Enabled via `config.powerline.enabled: true`.

**Used in:** `PowerlineConfig`, `src/render/powerline/`, config docs.

---

### `reset axis`

> The boundary at which a token, speed, or rate-limit widget resets its
> accumulator. One of: `session`, `block`, `day`, `week`, `model`, `effort`.

**Used in:** `ResetAxis`, widget `options.reset`, spec §8.4, `src/data/tokens/`.

---

### `value separator`

> The configurable `config.global.valueSeparator` (default `·`, U+00B7
> MIDDLE DOT) rendered between two sub-values _inside_ a single widget,
> e.g. `65k · 1M`, `52% · weekly 33%`, `↓150 · ↑45`.

**Used in:** `GlobalConfig.valueSeparator`, intra-widget renderers, config docs.  
**Distinct from:** `separator` (`config.global.separator`, default `|`), which divides whole widgets from each other.

---

## Theme terms

### `theme`

> A JSON file that maps semantic role names to terminal colour values.
> Referenced by `config.theme: "<name>"`.

**Used in:** `Theme`, `src/data/theme/`, `themes/`, config docs.

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

**Used in:** `themes/*.json`, `src/data/theme/`, theme schema.

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

| Role | Used by                                         |
| ---- | ----------------------------------------------- |
| `fg` | default foreground when no widget colour is set |
| `bg` | default background                              |

**Distinct from:** `fg`/`bg` per-widget overrides in `WidgetConfig`.

---

### `colour depth`

> The renderer's detected ANSI capability level:
> `truecolor` (24-bit), `256` (8-bit palette), `16` (named colours), or `none`.

**Used in:** `ColourDepth`, `src/render/render/colour-depth/colour-depth.ts`, gate-16.

---

## TypeScript types

Public types exported from `src/`. Source of truth over any doc that lists them.

| Type                     | File                                     | Description                                                      |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------- |
| `AgentlineConfig`        | `src/data/config/types.ts`               | Top-level config shape                                           |
| `PartialAgentlineConfig` | `src/data/config/types.ts`               | Partial version for merging                                      |
| `GlobalConfig`           | `src/data/config/types.ts`               | `config.global` block                                            |
| `LineConfig`             | `src/data/config/types.ts`               | Single line (array of `WidgetConfig`)                            |
| `WidgetConfig`           | `src/data/config/types.ts`               | Per-widget config entry                                          |
| `PowerlineConfig`        | `src/data/config/types.ts`               | `config.powerline` block                                         |
| `PowerlineCaps`          | `src/data/config/types.ts`               | Start/end cap glyphs                                             |
| `PowerlineGlyphs`        | `src/data/config/types.ts`               | Chevron glyph overrides                                          |
| `TerminalWidthConfig`    | `src/data/config/types.ts`               | Width detection settings                                         |
| `RawColour`              | `src/data/config/types.ts`               | Pre-validation colour string                                     |
| `Cell`                   | `src/widgets/types.ts`                   | Atomic render unit output                                        |
| `WidgetContext`          | `src/widgets/types.ts`                   | Render-time environment passed to each widget                    |
| `WidgetSettings`         | `src/widgets/types.ts`                   | Resolved per-widget settings                                     |
| `WidgetRender`           | `src/widgets/types.ts`                   | Widget render function signature                                 |
| `WidgetDef`              | `src/widgets/types.ts`                   | Widget contract registered in `WidgetRegistry`                   |
| `MergeMode`              | `src/core/lib/merge-mode.ts`             | `"off" \| "merge" \| "merge-no-padding"`                         |
| `Segment`                | `src/render/render/segment/segment.ts`   | ANSI-encoded output segment                                      |
| `StdinPayload`           | `src/core/stdin/index.ts`                | Parsed Claude Code statusline JSON                               |
| `Theme`                  | `src/data/theme/index.ts`                | Loaded theme with resolved palette                               |
| `ThemeRole`              | `src/data/theme/roles.ts`                | Union of valid palette role keys                                 |
| `Colour`                 | `src/data/theme/colours/colours.ts`      | Parsed colour (named / indexed / hex)                            |
| `ResetAxis`              | `src/data/tokens/aggregate/aggregate.ts` | `"session" \| "block" \| "day" \| "week" \| "model" \| "effort"` |
| `TokensSnapshot`         | `src/data/tokens/index.ts`               | Accumulated token totals                                         |
| `TokenTotals`            | `src/data/tokens/aggregate/aggregate.ts` | Token sub-totals by type                                         |
| `KeyScope`               | `src/tui/keys/bindings/bindings.ts`      | `"edit" \| "picker" \| "any"`                                    |
| `KeyBinding`             | `src/tui/keys/bindings/bindings.ts`      | Single key binding entry                                         |
| `WidgetMeta`             | `src/widgets/families/catalog-types.ts`  | Widget metadata entry in catalog                                 |
| `WidgetVariant`          | `src/widgets/families/catalog-types.ts`  | Named display variant for a widget                               |
| `WidgetFamily`           | `src/core/lib/widget-families.ts`        | Union of the 5 widget family strings                             |
| `WidgetMetaEntry`        | `src/widgets/families/catalog-types.ts`  | `WidgetMeta` paired with its `type` string                       |

---

## TUI terms

### `editor`

> The Ink-based TUI opened by `agentline edit`.
> Lazy-imported so it never loads on the render path.

**Used in:** `src/tui/tui/`, `agentline edit` command, keymap docs.

---

### `picker`

> The widget-selection overlay inside the editor. Default view is the
> group browser (pick a family → in-family list). Pressing `/` switches
> to a flat search across every catalogued widget with a family badge
> on each row. Widgets with catalogued variants drill into a final
> variant step.

**Used in:** `src/tui/picker/picker.ts`, `src/tui/state/state.ts`, keymap docs.

---

## i18n terms

### `en dictionary`

> The single source of truth for authored English UI text, in
> `src/core/i18n/en-dictionary.ts` (exported as `EN_DICTIONARY`). Every
> dictionary-form translator call (`t(id, vars?)` via `createDictTranslator`)
> reads its English from this map; locale tables under
> `config.translations[<lang>]` target the same ids.
>
> Catalogue-driven widget strings (`widget.<type>.name` / `.desc` /
> `.variant.<id>`) author their English in `src/widgets/families/<family>.ts`
> instead — the catalogue is itself a dictionary keyed by widget type.

**Used in:** `src/core/i18n/`, every static-id UI surface, `gate-26`.

---

### `i18n namespace`

> One of the registered id prefixes declared by `I18N_NAMESPACES` in
> `src/core/i18n/ids.ts`: `widget.`, `family.`, `footer.`, `picker.`,
> `app.`, `cmd.`. Every literal id passed to a translator call must
> begin with one of these prefixes; `gate-26` enforces this and that
> every dictionary-form id is a key in `EN_DICTIONARY`.

**Used in:** `src/core/i18n/ids.ts`, `gate-26-i18n-id-namespace.sh`.

---

## Skill terms

### `skill file`

> A markdown file under the repo's `agents/` directory with YAML
> frontmatter. The installer (`agentline install`) copies every such
> file into the host's agents directory (e.g. `~/.claude/agents/`) so
> Claude Code's existing subagent-dispatch system can route
> natural-language requests like "change my theme" to the right runbook
> via the file's `description:` line. Five files ship at v0.1:
> `agentline.md`, `agentline-onboarding.md`, `agentline-configure.md`,
> `agentline-themes.md`, `agentline-troubleshoot.md`.

**Used in:** `agents/agentline*.md`, `scripts/install.sh` (`seed_skills`),
`docs/install.md`, `docs/cookbook/04-architecture.md` (state surfaces),
`docs/cookbook/08-feature-catalogue.md` (shipped agent skills),
`docs/cookbook/16-release-and-versioning.md` (skill-file lifecycle).  
**Distinct from:** the stdin `skills` field (the host-session list of
loaded subagents) — see `host skills field` below.

---

### `host skills field`

> The `skills` array inside the host stdin JSON envelope (`06 ·
Host stdin contract`). It tells the renderer which subagents the
> host has loaded for the current session; the `skills` widget surfaces
> a cycled view of it. Not a path, not a file — purely the inbound
> session metadata.

**Used in:** `src/core/stdin/index.ts`, `src/data/session/index.ts`,
`docs/cookbook/06-data-contracts.md`.  
**Distinct from:** `skill file` (the shipped markdown files the
installer seeds).

---

### `host skill system`

> Claude Code's existing mechanism for auto-discovering subagent
> markdown files under `~/.claude/agents/` and routing to them by
> `description:` frontmatter. The product **uses** this system but does
> not implement or extend it; copying `skill file`s into the host's
> agents directory is enough to be reachable.

**Used in:** install runbook, `agents/CLAUDE.md`.  
**Distinct from:** the host's plugin system (which the product
deliberately does not use — see `agentline` is not a `plugin`).

---

## Testing terms

### `gate`

> A CI quality-check shell script at `tests/gates/gate-NN-<topic>.sh`.
> Exit 0 = pass, exit 1 = fail, exit 2 = skip.
> Numbered with intentional gaps; the set grows over time.
> `gate-22` enforces that this glossary's counts stay in sync with the code.

**Used in:** `tests/gates/`, `tests/gates/run-all.sh`, CI workflows.

---

### `fixture`

> A synthetic Claude Code stdin JSON payload used in tests and
> `agentline render`.

**Used in:** `tests/golden/`, `src/render/render/fixture/fixture-runner.ts`, `src/commands/doctor/fixture.ts`.

---

### `golden test`

> A render output snapshot stored in `tests/golden/<scenario>/`.
> Any output change must be deliberate and committed with the snapshot update.

**Used in:** `tests/golden/`, `tests/gates/gate-12-render-determinism.sh`.

---

### `unit test`

> A `*.test.ts` file co-located with the module it tests under `src/`.

**Used in:** all `src/**/*.test.ts` files.

---

### `integration test`

> A test under `tests/integration/` or co-located under `src/tui/` that exercises
> multiple modules together.

**Used in:** `tests/integration/`, `src/tui/`.

---

### `frozen clock`

> A deterministic `Clock` implementation that returns a fixed instant rather
> than the wall clock, making renders byte-reproducible across time zones and
> CI runners. In-process: `frozenClock(iso)` exported from
> `src/test-helpers/clock/clock.ts` (which re-exports from
> `src/widgets/clock/clock.ts`). On the bin: `--frozen-clock <iso>` flag
> accepted by `agentline render` via `src/render/render/fixture/fixture-command.ts`.

**Used in:** `src/test-helpers/clock/clock.ts`,
`src/render/render/fixture/fixture-runner.ts`,
`src/render/render/fixture/fixture-command.ts`, golden tests,
`src/render/render/CLAUDE.md` (D-006).  
**Distinct from:** `realClock` (returns `Date.now()`).

---

### `render cache`

> The on-disk record of the last successful stdout bytes, stored at
> `src/data/state/render-cache/`. An agent or diagnostic tool can read the
> current statusline output without re-running the render; the `agentline doctor`
> command uses it for introspection.

**Used in:** `src/data/state/render-cache/render-cache.ts`,
`SOFTWARE-3-0.md` (§ "Powerline, adapted for agents"), `src/data/state/CLAUDE.md`.

---

### `cold-start budget`

> The process-start-to-first-byte ceiling enforced by gate-13. The default
> ceiling is `${AGENTLINE_BENCH_BUDGET_MS:-120}` ms p95 on the reference
> host; do not hard-code a number here — the authoritative value lives in
> `tests/gates/gate-13-cold-start-budget.sh` and the bench harness at
> `scripts/bench/cold-start.mjs`. Gate-13 defaults to informational mode on
> shared CI runners; it is strict only when `AGENTLINE_BENCH_STRICT=1`.

**Used in:** `tests/gates/gate-13-cold-start-budget.sh`,
`scripts/bench/cold-start.mjs`, `docs/cookbook/14-gates-catalogue.md`.  
**Distinct from:** `cold start` (the latency metric itself, defined above with
its ≤ 120 ms p95 target); `cold-start budget` is the gate-enforced ceiling
on that metric.

---

## Agentic engineering terms

### `surface map`

> The parity-checked `| Surface | Human on-ramp | Agent on-ramp |` table in
> `SOFTWARE-3-0.md`. Each row names one operable surface of the product and
> documents the canonical entry path for a human contributor and for an LLM
> agent. A row is complete when both on-ramps are filled in; a missing
> on-ramp is treated as a defect (see `parity rule`).

**Used in:** `SOFTWARE-3-0.md`.

---

### `human on-ramp`

> The entry path a human contributor follows to reach and operate a
> product surface — typically a prose doc, a CLI `--help` flag, or a TUI
> overlay. Documented in the `Human on-ramp` column of the surface map.

**Used in:** `SOFTWARE-3-0.md` surface map.  
**Distinct from:** `agent on-ramp` (the machine-readable counterpart).

---

### `agent on-ramp`

> The entry path an LLM agent follows to reach and operate a product
> surface — typically a machine-readable artefact such as a `--json` verb,
> a skill file `description:` frontmatter, or a `CLAUDE.md` briefing.
> Documented in the `Agent on-ramp` column of the surface map.

**Used in:** `SOFTWARE-3-0.md` surface map, `agents/CLAUDE.md`.  
**Distinct from:** `human on-ramp` (the prose counterpart).

---

### `parity rule`

> The surface-map invariant: a surface row is a defect if either its
> `human on-ramp` or its `agent on-ramp` is absent. Both on-ramps must be
> defined for the surface to be considered complete.

**Used in:** `SOFTWARE-3-0.md` surface map.  
**Distinct from:** the gate-20/21/22 "parity" checks (README↔catalogue widget
count parity and glossary self-consistency) — those are vocabulary and count
alignment checks; this rule governs surface completeness in the agentic
engineering sense.

---

### `context-planner`

> A hand-authored table that maps each task in a roadmap item to the repo
> paths that must be read before the task begins. Acceptance criterion: every
> cited path exists, is non-empty, and has been reviewed. The word "minimum"
> is intentionally absent — the table is a reads-pointer, not a reads-lower-
> bound (which would be unfalsifiable per plan D9).

**Used in:** `.claude/` dev tooling, team-brief planning artefacts.  
**Distinct from:** a task list (which lists _what_ to do) and a design doc
(which explains _why_); the context-planner records _what to read first_.

---

### `dispatch contract`

> The `description:` field in the YAML frontmatter of a shipped skill file
> (`agents/*.md`). Claude Code's host skill system reads this field to route
> natural-language user requests to the matching file; the field is therefore
> both documentation and a functional routing key. Changes to a skill file's
> `description:` change which requests the host dispatches to it.

**Used in:** `agents/agentline*.md` frontmatter, `agents/CLAUDE.md`,
`docs/cookbook/08-feature-catalogue.md`,
`docs/cookbook/15-documentation-set.md`,
`docs/cookbook/16-release-and-versioning.md`.  
**Distinct from:** the `name:` frontmatter field (human label, not used for
dispatch) and the body of the skill file (the runbook text).

---

## Retired terms

Do not use these in new code, docs, or comments. Update any occurrence you find.

| Retired term                                                  | Use instead                    | Reason                                                                                                                        |
| ------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| "preset" (for init configs)                                   | "config template"              | Ambiguous with theme preset; init presets were removed                                                                        |
| "config preset" / "init preset"                               | "config template"              | Same as above                                                                                                                 |
| "category" (for widget grouping)                              | "family"                       | Replaced everywhere — in docs, agents, and TypeScript                                                                         |
| "config layer" (implying 3 layers)                            | "user config" + "env override" | Project-config layer was removed; only 2 layers remain                                                                        |
| "options sheet" (TUI)                                         | —                              | Removed in editor redesign; nothing replaced it                                                                               |
| "focus" (init template name)                                  | —                              | Removed; `default`, `minimal`, and `power` are the shipped config templates                                                   |
| `agentline config theme`                                      | —                              | Subcommand retired; edit `config.theme` directly or use `agentline edit`                                                      |
| `agentline init`                                              | `agentline config init`        | The bare `init` verb is not in the CLI; use `agentline config init [--preset <name>]`                                         |
| "glyph mode" / `config.glyphs` / "widget glyph" / `GlyphMode` | —                              | Top-level Nerd Font glyph layer removed; it never rendered reliably across terminals. Powerline chevron glyphs are unaffected |
