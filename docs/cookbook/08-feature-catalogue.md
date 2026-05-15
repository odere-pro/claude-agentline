# 08 · Feature catalogue

> **Intent:** Enumerate the user-facing surface: every widget family, every shipped theme, every CLI verb, every doctor check.
> **Reads-with:** `02-functional-requirements`, `07-component-specs`.

---

## Widget families

Seven families, each producing one cell per widget. The exact widget set may evolve; the family structure is stable.

### Session (~7 widgets)

Surface state from the host stdin payload.

| Type              | Renders                                                    |
| ----------------- | ---------------------------------------------------------- |
| `model`           | Active model id (mapped to display name).                  |
| `version`         | Host version.                                              |
| `session-id`      | Short session id; toggleable hide.                         |
| `session-name`    | Session name; falls back to short id when empty.           |
| `account-email`   | Logged-in email; auth-file fallback. Mask modes available. |
| `thinking-effort` | Effort tier; semantic colour grade.                        |
| `skills`          | Skills loaded; cycled display (count / list / last).       |

### Tokens (~7 widgets)

Each declares `options.reset` ∈ {`session`, `block`, `day`, `week`, `model`, `effort`}. Mixed-axis aggregation forbidden.

| Type            | Renders                                |
| --------------- | -------------------------------------- |
| `tokens-total`  | Running total                          |
| `tokens-input`  | Input subtotal                         |
| `tokens-output` | Output subtotal                        |
| `tokens-cached` | Cached subtotal (prompt-cache hits)    |
| `input-speed`   | Input tokens/sec over a rolling window |
| `output-speed`  | Output tokens/sec                      |
| `total-speed`   | Combined throughput                    |

### Context (~4 widgets)

Token usage against the model's context window.

| Type                        | Renders                                        |
| --------------------------- | ---------------------------------------------- |
| `context-length`            | Raw token count.                               |
| `context-percentage`        | Used / window; colour-graded green→yellow→red. |
| `context-percentage-usable` | Same metric against `0.8 × window`.            |
| `context-bar`               | Visual bar; configurable width.                |

### Rate limits (~5 widgets)

Track the host's session / block / weekly quota.

| Type                 | Renders                                  |
| -------------------- | ---------------------------------------- |
| `session-usage`      | 5 h block; display cycles percent / bar. |
| `block-reset-timer`  | Countdown to next block reset.           |
| `block-reset-at`     | Wall-clock of next block reset.          |
| `weekly-reset-timer` | Countdown to next weekly reset.          |
| `weekly-reset-at`    | Wall-clock of next weekly reset.         |

### Git (~12 widgets)

Read the working tree implied by stdin `cwd`.

| Type               | Renders                                          |
| ------------------ | ------------------------------------------------ |
| `git-branch`       | Branch name (detached HEAD shows short SHA).     |
| `git-changes`      | `+N -M` aggregate.                               |
| `git-staged`       | Staged file count.                               |
| `git-unstaged`     | Unstaged file count.                             |
| `git-untracked`    | Untracked file count.                            |
| `git-ahead-behind` | `↑N ↓M`; hidden when even.                       |
| `git-conflicts`    | Conflict count; hidden at zero.                  |
| `git-sha`          | Short SHA.                                       |
| `git-worktree`     | Worktree name when inside one.                   |
| `git-origin-repo`  | Remote repo identifier.                          |
| `git-upstream`     | Upstream ref.                                    |
| `git-pr`           | PR identifier — opt-in only; not on render path. |

### Time (~3 widgets)

| Type             | Renders                          |
| ---------------- | -------------------------------- |
| `clock`          | Local time; format configurable. |
| `uptime-session` | Time since session start.        |
| `uptime-block`   | Time since current block start.  |

### Custom (~1 widget plus separator)

- `separator` — one-character separator. In the editor, `Space` cycles through a fixed character set.
- `command` (optional v0.1; sandboxed) — runs an argv-style external command with a tight default timeout; renders stdout. Useful as an escape hatch; not a plugin system.

---

## Theme presets

Four themes ship by default. The implementer MAY add more; these four MUST be present.

| Theme               | Tone                              |
| ------------------- | --------------------------------- |
| `vscode-dark`       | Dark, neutral.                    |
| `vscode-light`      | Light, neutral.                   |
| `claude-code-dark`  | Dark, warm (host-brand inspired). |
| `claude-code-light` | Light, warm.                      |

Themes live under the product's themes directory and are copied to the user's themes directory by `install`.

---

## CLI verbs (flat surface)

The CLI surface is intentionally flat — there is no nested dispatcher. The default no-arg path renders.

| Verb            | Purpose                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| _(no args)_     | Read stdin, render, exit. Default behaviour wired into host `statusLine`.             |
| `render`        | Same as no-args. `--fixture <path>` and `--config <path>` flags supported.            |
| `install`       | Wire `statusLine`, seed config, copy themes. `--force`, `--dry-run`, `--from-source`. |
| `uninstall`     | Reverse install. `--purge` also removes user config and custom themes.                |
| `doctor`        | Diagnose. `--fix`, `--json`, `--strict`.                                              |
| `edit`          | Open the TUI editor. Cold path; lazy-imports the TUI framework.                       |
| `config schema` | Print or write the JSON Schema. `--write <dir>`.                                      |
| `config widget` | Scriptable: `add`, `remove`, `move`, `replace`, `set-option`, `list`, `catalog`.      |
| `start`         | Preview the statusline using the last cached stdin.                                   |
| `version`       | Print version and build metadata.                                                     |
| `update-check`  | Compare local version to registry; gated to its own verb.                             |

---

## Doctor checks

Ordered D01 → D10. Each: probe, outcome, repair (with `--fix`).

| ID  | Probe                                                              | Repair                                                          |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| D01 | Host settings file exists at the canonical path.                   | Create with default skeleton.                                   |
| D02 | `statusLine.command` resolves to a working invocation of this bin. | Rewrite to the canonical invocation.                            |
| D03 | User config exists and matches the schema.                         | Migrate, or write defaults if missing.                          |
| D04 | All themes referenced by config are installed.                     | Copy from the package's embedded theme set.                     |
| D05 | A Nerd Font is available (when Powerline enabled).                 | Print platform-specific install instructions (or auto-install). |
| D06 | `git` binary is on PATH (when any git widget is enabled).          | None — report only.                                             |
| D07 | Embedded pricing table is fresher than `now − 90 days`.            | None — report only.                                             |
| D08 | Host config dir env var (if set) points to a writable directory.   | None — report only.                                             |
| D09 | Custom-command widgets resolve their `cmd` to an executable.       | None — report only.                                             |
| D10 | Render dry-run on an embedded fixture matches a stored snapshot.   | None — report only.                                             |

---

## Default config widget list

The shipped default config arranges one line of nine widgets:

```text
model · thinking-effort · git-branch · git-changes · context-percentage · tokens-total · session-usage · block-reset-timer · clock
```

`tokens-total` and `session-usage` use `reset: block`. The default theme is `claude-code-dark` with Powerline disabled.

A `minimal.config.json` template also ships: `model · git-branch · tokens-total · clock` — for users who want a shorter line.
