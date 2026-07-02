# 06 · Data contracts

> **Intent:** Specify every JSON shape that crosses a system boundary, in stack-agnostic terms.
> **Reads-with:** `04-architecture`, `07-component-specs`, `17-security-and-compliance`.

Each contract: **name**, **purpose**, **version key**, **top-level keys**, **strictness**, **forbidden keys**, **migration rule**.

---

## Host stdin contract

**Purpose.** The host application's payload, delivered on stdin each render.

**Version key.** Not under our control; the host owns this shape. The implementer pins to the documented version and tolerates unknown fields (forward-compat).

**Top-level keys (typical).**

The **Raw key** column is the verbatim top-level JSON key the host sends; the **Key** column is the friendly name agentline exposes (the adapter normalises snake_case → camelCase and flattens nested blocks). `gate-29` parses the Raw key column and asserts it equals the set of top-level keys agentline actually consumes (`scripts/check-host-contract.mjs`).

| Key                 | Raw key               | Type    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`             | `model`               | object  | `{ id, display_name }` — keep `id` as the active model id; `display_name` is the host's friendly label. A flat string is accepted for back-compat with older docs                                                                                                                                                                                                                                                                                                                                  |
| `sessionId`         | `session_id`          | string  | Stable per session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `sessionName`       | `session_name`        | string  | User-chosen label (may be empty)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `version`           | `version`             | string  | Host version                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `cwd`               | `cwd`                 | string  | Working directory the host is running in; falls back to `workspace.current_dir`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `transcript_path`   | `transcript_path`     | string  | Path to JSONL transcript file (subject to sandbox)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `thinkingEffort`    | `effort`              | object  | `{ level }` — `low` / `medium` / `high` / `xhigh` / `max` (widget also recognises `ultracode`, a forward-compat tier the host does not yet emit — ultracode mode reports `xhigh`)                                                                                                                                                                                                                                                                                                                  |
| `outputStyle`       | `output_style`        | object  | `{ name }` — `default` / `explanatory` / `learning`; feeds the output-style widget                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `vimMode`           | `vim`                 | object  | `{ mode }` — uppercase editor vim mode (`NORMAL` / `INSERT` / …), lower-cased by the adapter; legacy flat `vim_mode` is read as a fallback                                                                                                                                                                                                                                                                                                                                                         |
| `agentName`         | `agent`               | object  | `{ name }` — active subagent persona; feeds the agent-name widget, hidden on the main agent                                                                                                                                                                                                                                                                                                                                                                                                        |
| `workspace`         | `workspace`           | object  | `{ current_dir, project_dir, added_dirs, git_worktree, repo }` — `project_dir` feeds the project-dir widget, `added_dirs` the added-dirs widget, `current_dir` is the `cwd` fallback, the optional nested `repo: { host, owner, name }` feeds the `git-origin-repo` widget's host-first name and `owner/name` variant, and the optional `git_worktree` string is the preferred source for the host-first worktree name (see the `worktree` row)                                                    |
| `thinkingEnabled`   | `thinking`            | object  | `{ enabled }` — extended-thinking on/off switch; feeds the thinking-enabled widget                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `exceeds200kTokens` | `exceeds_200k_tokens` | boolean | Long-context threshold flag; feeds the context-200k-flag widget                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `user.email`        | `user`                | object  | `{ email, authMethod, org }` — identity block; `email` falls back to the auth file when the host sends no `user` block                                                                                                                                                                                                                                                                                                                                                                             |
| `rate_limits`       | `rate_limits`         | object  | `{ five_hour, seven_day }`, each `{ used_percentage, resets_at }` — the host's `/usage` numbers. `used_percentage` feeds the usage widgets; `resets_at` (epoch seconds) feeds the reset-timer / reset-at widgets, which fall back to a local estimate when it is absent                                                                                                                                                                                                                            |
| `context_window`    | `context_window`      | object  | Current-prompt window snapshot: `{ current_usage: { input_tokens, cache_read_input_tokens, cache_creation_input_tokens }, context_window_size, used_percentage }`. The three `current_usage` components sum to used tokens; with the window size and host-computed percentage they feed the context-window / context-percentage widgets (`adaptContextWindow`, `src/core/stdin/index.ts`)                                                                                                          |
| `cost`              | `cost`                | object  | Host-computed session-cost scalars: `{ total_cost_usd, total_duration_ms, total_api_duration_ms, total_lines_added, total_lines_removed }`. Read directly by the cost / duration / lines-changed widgets — no transcript aggregation, no reset axis (`adaptCost`, `src/core/stdin/index.ts`)                                                                                                                                                                                                       |
| `pr`                | `pr`                  | object  | Host-provided PR metadata: `{ number, url, review_state }`. `number` and `url` bridge into the git snapshot (host-first path skips the `gh` shell-out when both are present and valid); `review_state` (lower-cased by the adapter) feeds the `git-pr-review` widget. Known values: `approved`, `pending`, `changes_requested`, `draft`. Unknown future values pass through lower-cased. (`adaptPr`, `src/core/stdin/index.ts`)                                                                    |
| `worktree`          | `worktree`            | object  | Host-provided worktree metadata: `{ name, path, branch, original_cwd, original_branch }`. Only `name` is surfaced — it bridges into the git snapshot as the host-first worktree name, so the `git-worktree` widget renders without the `git rev-parse --git-dir --show-toplevel` subprocess. The nested `workspace.git_worktree` string is preferred over `worktree.name`; absent on a plain checkout and on older hosts. No new widget (issue #278). (`adaptWorktree`, `src/core/stdin/index.ts`) |
| Other host fields   |                       | …       | Preserved untouched. Host keys agentline intentionally ignores (e.g. `hook_event_name`, `skills`) are allowlisted in `scripts/check-host-contract.mjs`                                                                                                                                                                                                                                                                                                                                             |

**Strictness.** Lenient — unknown fields are preserved. Truncated above 256 KB with a `truncated` marker emitted to stderr.

**Forbidden keys at parse boundary.** `__proto__`, `constructor`, `prototype` — stripped recursively (see `05-design-patterns · Reserved-meta-key strip`).

---

## User config

**Purpose.** Persisted statusline configuration. Single global location.

**Version key.** `version` (int). The binary auto-migrates older versions; newer versions are refused with a structured error.

**Location.** `${HOST_CONFIG_DIR:-~/.config}/<product>/config.json`. There is no per-project layer.

**Top-level keys.**

| Key               | Type   | Default     | Notes                                                                                                    |
| ----------------- | ------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| `$schema`         | string | URL         | Schema URL for editor tooling                                                                            |
| `version`         | int    | `1`         | Schema version                                                                                           |
| `theme`           | string | `null`      | Named theme from the theme registry                                                                      |
| `lines`           | array  | one default | Ordered list of `{ widgets: Widget[] }`                                                                  |
| `global`          | object | defaults    | Render options: `padding`, `separator`, `inheritColors`, etc.                                            |
| `powerline`       | object | defaults    | Powerline options (see `02-functional-requirements · F5`)                                                |
| `terminalWidth`   | object | defaults    | Width-detection mode: `full`, `full-minus-N`, `full-until-compact`                                       |
| `keymap`          | object | `{}`        | Editor keymap overrides                                                                                  |
| `refreshInterval` | int    | `5`         | Statusline re-run period in seconds; `>= 0`. `0` disables, syncing the host so it re-runs on events only |

**Strictness.** Root object: `additionalProperties: false`. `widgets[].options` and `palette` are extensible (`additionalProperties: true`); the reserved-key strip applies there to close the prototype-pollution gap.

**Migration rule.** A newer binary reading an older `version` auto-migrates and writes a backup `<config>.bak`. The migration is documented in the changelog under the binary's release notes.

---

## Widget shape

**Purpose.** Each entry in `lines[].widgets[]`.

| Key        | Type   | Required | Notes                                          |
| ---------- | ------ | -------- | ---------------------------------------------- |
| `type`     | string | yes      | Registered widget id                           |
| `id`       | string | no       | Arbitrary; useful for keymap targeting         |
| `fg`       | colour | no       | Named, indexed, or hex                         |
| `bg`       | colour | no       | Same                                           |
| `bold`     | bool   | no       |                                                |
| `italic`   | bool   | no       |                                                |
| `rawValue` | bool   | no       | Suppress built-in label                        |
| `merged`   | enum   | no       | `off` / `merge` / `merge-no-padding`           |
| `hidden`   | bool   | no       | Render as empty                                |
| `options`  | object | no       | Widget-specific. `additionalProperties: true`. |

**Colour values:**

- Named: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, plus `bright-*` variants.
- 256-colour index: `"colour:NNN"` where `0 ≤ NNN ≤ 255`.
- 24-bit hex: `"#RRGGBB"`.

Anything else is a schema error.

---

## Theme

**Purpose.** Named palette mapping role → colour.

```text
{
  "$schema":   URL,
  "name":      string,           // kebab-case
  "palette":   { role: colour, … },
  "powerline": { glyph keys: string, … }
}
```

**Roles** consumed by built-in widgets: `accent`, `info`, `success`, `warning`, `danger`, `muted`, `git-clean`, `git-dirty`, `tokens-low`, `tokens-mid`, `tokens-high`, `bg-section`, `bg-emphasis` (required), plus the optional `effort-ultracode` (ultracode's signature colour). Themes MUST define every required role; optional roles — and any omitted role — fall back to compiled defaults.

**Strictness.** Root: `additionalProperties: false`. `palette` is extensible.

---

## Fixture (for golden tests)

**Purpose.** Reproduce a render byte-exactly for regression testing.

A scenario directory contains:

| File            | Contents                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------- |
| `stdin.json`    | Recorded host stdin payload                                                                   |
| `config.json`   | Active config                                                                                 |
| `clock.txt`     | Frozen wall-clock value (ISO 8601 UTC)                                                        |
| `git.json`      | _Optional._ Static `GitState` injected via `--git` so git widgets render (no real `git`/`gh`) |
| `expected.ansi` | Byte-exact expected stdout (including ANSI escapes)                                           |

`<bin> render --fixture <dir>/stdin.json` reproduces the line (`--fixture` takes the payload file, not the directory; add `--git <dir>/git.json` to inject a static git snapshot). The gate iterates every scenario.

---

## Auth file (fallback for session widgets)

**Purpose.** Read-only fallback when the host stdin payload omits identity fields (`accountEmail`, `loginMethod`, `orgSlug`).

**Sources, in precedence order.**

1. **Legacy auth file** — `${HOST_CONFIG_DIR}/auth.json`. Flat object with `email` / `authMethod` / `orgSlug` string keys. Size cap: 64 KB. Wins per-field when present (back-compat).
2. **Host primary config `oauthAccount`** — the host's main config file (`${HOST_CONFIG_DIR}/.claude.json` when `CLAUDE_CONFIG_DIR` is set, else `~/.claude.json`; note this is a _sibling_ of the config dir, not inside it). Modern hosts no longer ship a plaintext auth file, so this is the only source on current installs. The `oauthAccount` block supplies `emailAddress` → email, `organizationName` → org, and an implied `oauth` login method. Size cap: 4 MB (this file grows with per-project history).

**Read mode.** Read-only, single bounded synchronous read per render tick, never throws. Missing / oversize / malformed / symlink-to-special-device inputs are treated as unreadable and the dependent widget renders as hidden. Only a handful of scalar identity fields are extracted; the rest of the (potentially large) file is ignored.

**Sandboxing.** Paths resolve from `CLAUDE_CONFIG_DIR` / the home directory only — no caller-supplied path is followed.

---

## Transcript file (token widgets)

**Purpose.** JSONL ledger of host API calls — each line is one event (request metadata, token counts, session boundary, model switch, block reset).

**Location.** Whatever the host's `transcript_path` field on stdin points to.

**Read mode.** Read-only, cached by `(path, mtime, size)`. Per-file cap: 16 MB. Oversize files render dependent widgets as hidden.

**Sandboxing.** MUST resolve under the host's config root. The env var `<PRODUCT>_TRANSCRIPT_ROOT` overrides for tests.

---

## Backup metadata (install / uninstall)

**Purpose.** Capture the prior host-state value so `uninstall` can restore byte-for-byte.

```text
{
  "version":   int,
  "wrote_at":  ISO 8601 UTC,
  "host":      string,             // host application id
  "prior":     <prior value>,      // original `statusLine` value, or null if unset
  "checksum":  "sha256:<hex>"      // over the prior value's canonical JSON encoding
}
```

**Location.** `${HOST_CONFIG_DIR}/<product>/backup.json`.

**Lifecycle.** Written by `install` (first time only — refuses to overwrite without `--force`). Consumed by `uninstall` (which verifies the checksum before restoring).

---

## Machine-readable output envelope (`--json`)

**Purpose.** The agent on-ramp for the scriptable CLI verbs — a stable JSON shape on stdout
suitable for `jq`, CI pipelines, and in-session skill scripts.

**Verbs that emit it.**

| Verb                                     | Top-level key      | Shape                                                                                                                                |
| ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `agentline config widget list --json`    | `lines`            | Array of `{ line: N, widgets: [{ at: N, type: string, …widget-shape fields }] }`. The merged config is shown — exactly what renders. |
| `agentline config widget catalog --json` | `widgets`          | Array of `{ type: string, name: string, description: string, family: string }`. One entry per registered widget type.                |
| `agentline doctor --json`                | `worst` + `checks` | See "Doctor JSON shape" below.                                                                                                       |

The `set-option` subcommand accepts `--json` as an **input** flag (parse the `<value>` argument as a
JSON literal rather than a plain string); it does not emit a JSON envelope.

**Envelope rule.** Each envelope is a single JSON object whose top-level key names the noun (`lines`,
`widgets`, `checks`). The shape is strict — no extra top-level keys are added unless documented here.

Sources: `src/data/config/widget/list/list.ts` (`formatJson`),
`src/data/config/widget/catalog/catalog.ts` (`formatJson`),
`src/commands/doctor/format/format.ts` (`formatJson`).

---

### Doctor JSON shape

```text
{
  "worst":  "<status>",
  "checks": [
    {
      "id":      "D01",
      "title":   string,
      "status":  "pass" | "warn" | "fail" | "fixed" | "skip",
      "message": string,
      "hint":    string   // present only when status is "warn" or "fail"
      "fixed":   true     // present only when --fix repaired this check
    },
    …
  ]
}
```

`worst` is the highest-severity `status` value across all checks after any `--fix` pass
(`fail` > `warn` > `fixed` > `skip` > `pass`). Source: `src/commands/doctor/types.ts`
(`CheckResult`, `RunReport`) and `src/commands/doctor/run/run.ts`.

---

## Exit-code convention

**Source:** `src/cli/cli.ts` (dispatch wrapper and per-verb returns) and
`src/commands/doctor/run/run.ts` (`decideExit`).

| Code | Meaning                                                                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`  | Success. For `doctor` (without `--strict`): always `0` regardless of check results — the check detail is in the output, not the exit code.                                       |
| `1`  | Render error. Stdin parse failure or an unhandled exception on the render path.                                                                                                  |
| `2`  | Argument or dispatch error. Bad flag, unknown subcommand, or any exception thrown by a non-render verb and caught by the dispatch wrapper.                                       |
| `3`  | Doctor strict failure. Only when `agentline doctor --strict` is passed **and** at least one check finished as `warn` or `fail` (i.e. `worst` is not `pass`, `skip`, or `fixed`). |

The `--strict` flag is used by CI gates (see `tests/gates/gate-01-doctor.sh`) to make the exit
code machine-checkable. Without it, `doctor` always exits `0` so it is safe to use in pipelines
that inspect the JSON payload rather than the exit code.

---

## Universal forbidden keys

At **every JSON parse boundary** in this product (user config, env-var-encoded JSON, theme files, fixture stdin), drop own keys named:

- `__proto__`
- `constructor`
- `prototype`

Apply recursively. This is the single primitive against prototype-pollution-style attacks in runtimes where these keys are meta-keys; it is also harmless in runtimes where they aren't. The strict-schema root catches them at the top level; this recursive strip catches them inside `additionalProperties: true` carve-outs.
