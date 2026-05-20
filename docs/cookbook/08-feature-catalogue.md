# 08 · Feature catalogue

> **Intent:** Enumerate the user-facing surface: every widget family, every shipped theme, every CLI verb, every doctor check.
> **Reads-with:** `02-functional-requirements`, `07-component-specs`.

---

## Widget families

Five families, each producing one cell per widget. The exact widget set may evolve; the family structure is stable.

### Session (~7 widgets)

Surface state from the host stdin payload.

| Type              | Renders                                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `model`           | Active model id (mapped to display name).                                                                                                                                                                                                        |
| `version`         | Host version.                                                                                                                                                                                                                                    |
| `session-id`      | Short session id; toggleable hide.                                                                                                                                                                                                               |
| `account-email`   | Logged-in email; auth-file fallback. Mask modes available.                                                                                                                                                                                       |
| `thinking-effort` | Effort tier; semantic colour grade.                                                                                                                                                                                                              |
| `skills`          | Skills loaded for this session; cycled display (count / list / last). Reads the inbound stdin `skills` field — **distinct** from the agent-skill files the installer copies into the host's agents directory (see `Shipped agent skills` below). |

### Tokens (~3 widgets)

`tokens` / `tokens-cached` declare `options.reset` ∈ {`session`, `block`, `day`, `week`, `model`, `effort`}; mixed-axis aggregation forbidden. `token-speed` uses `options.windowSec` instead.

| Type            | Renders                                             |
| --------------- | --------------------------------------------------- |
| `tokens`        | Input ↓ + output ↑ subtotals (`↓<in> · ↑<out>`)     |
| `tokens-cached` | Cached subtotal (prompt-cache hits)                 |
| `token-speed`   | Input ↓ + output ↑ tokens/sec over a rolling window |

### Context (3 widgets)

Token usage against the model's context window. Each widget appends the
model's context-window size as a postfix (e.g. `200k`, `1M`).

| Type                 | Renders                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `context-length`     | Raw token count + window (`45.2k · 200k`).                              |
| `context-percentage` | Used / window, colour-graded green→yellow→red, + window (`37% · 200k`). |
| `context-bar`        | Visual bar in the context family accent + window (`████░░░░ · 200k`).   |

### Rate limits (~5 widgets)

Track the host's current-session / weekly quota, mirroring the host's
usage-limits screen.

| Type                          | Renders                                  |
| ----------------------------- | ---------------------------------------- |
| `session-weekly-usage`        | Session + weekly % — `52% · weekly 33%`. |
| `current-session-reset-timer` | Countdown to next session reset.         |
| `current-session-reset-at`    | Wall-clock of next session reset.        |
| `week-limit-timer`            | Countdown to next weekly reset.          |
| `weekly-reset-at`             | Wall-clock of next weekly reset.         |

### Git (~10 widgets)

Read the working tree implied by stdin `cwd`.

| Type               | Renders                                          |
| ------------------ | ------------------------------------------------ |
| `git-branch`       | Branch name (detached HEAD shows short SHA).     |
| `git-changes`      | `+N · -M` aggregate.                             |
| `git-untracked`    | Untracked file count.                            |
| `git-ahead-behind` | `↑N · ↓M`; hidden when even.                     |
| `git-conflicts`    | Conflict count; hidden at zero.                  |
| `git-sha`          | Short SHA.                                       |
| `git-worktree`     | Worktree name when inside one.                   |
| `git-origin-repo`  | Remote repo identifier.                          |
| `git-upstream`     | Upstream ref.                                    |
| `git-pr`           | PR identifier — opt-in only; not on render path. |

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

| Verb            | Purpose                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(no args)_     | Read stdin, render, exit. Default behaviour wired into host `statusLine`.                                                                                                         |
| `render`        | Same as no-args. `--fixture <path>` and `--config <path>` flags supported.                                                                                                        |
| `install`       | Wire `statusLine`, seed config, copy themes, copy shipped subagent skill files into the host's agents directory. `--force`, `--dry-run`, `--from-source`.                         |
| `uninstall`     | Reverse install. Removes skill files only when their bytes still match the shipped originals. `--purge` also removes user config, custom themes, and any user-edited skill files. |
| `doctor`        | Diagnose. `--fix`, `--json`, `--strict`.                                                                                                                                          |
| `edit`          | Open the TUI editor. Cold path; lazy-imports the TUI framework.                                                                                                                   |
| `config schema` | Print or write the JSON Schema. `--write <dir>`.                                                                                                                                  |
| `config widget` | Scriptable: `add`, `remove`, `move`, `replace`, `set-option`, `list`, `catalog`.                                                                                                  |
| `version`       | Print version and build metadata.                                                                                                                                                 |
| `update-check`  | Compare local version to registry; gated to its own verb.                                                                                                                         |

---

## Doctor checks

Ordered D01 → D08. Each: probe, outcome, repair (with `--fix`).

| ID  | Probe                                                              | Repair                                      |
| --- | ------------------------------------------------------------------ | ------------------------------------------- |
| D01 | Host settings file exists at the canonical path.                   | Create with default skeleton.               |
| D02 | `statusLine.command` resolves to a working invocation of this bin. | Rewrite to the canonical invocation.        |
| D03 | User config exists and matches the schema.                         | Migrate, or write defaults if missing.      |
| D04 | All themes referenced by config are installed.                     | Copy from the package's embedded theme set. |
| D05 | `git` binary is on PATH (when any git widget is enabled).          | None — report only.                         |
| D06 | The resolved global config directory is writable (or creatable).   | None — report only.                         |
| D07 | Update-check cache (read-only) reports a newer release.            | None — report only.                         |
| D08 | Render dry-run on an embedded fixture matches a stored snapshot.   | None — report only.                         |

---

## Default config widget list

The shipped default config arranges three lines, ordered identity →
capacity → budget:

```text
line 1  model · thinking-effort · git-branch · git-changes
line 2  context-percentage · context-bar · tokens
line 3  session-weekly-usage · current-session-reset-timer · week-limit-timer
```

`tokens` uses `reset: block`. The default theme is `claude-code-dark`
with Powerline disabled. No personal data (e.g. `account-email`) ships
in the default. There is exactly one shipped template
(`templates/default.config.json`); `agentline reset` restores it.

---

## Shipped agent skills

The installer also seeds **five subagent skill files** into the host's agents directory (e.g. `~/.claude/agents/`) so the host's coding agent can dispatch to them by name when a user asks about agentline. Each file is markdown with a YAML frontmatter `description:` that the host uses as the dispatch contract.

| File                        | Dispatch contract (`description:`)                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `agentline.md`              | Top-level entry: installing, configuring, theming, troubleshooting, doctor. Delegates to the four sub-skills. |
| `agentline-onboarding.md`   | Just-installed tour. Use when the user asks "what now?" or "how do I customize this?".                        |
| `agentline-configure.md`    | Layout, widgets, presets, theme, env-var overrides. Covers the TUI editor and the `config widget` CLI.        |
| `agentline-themes.md`       | Theme picker, palette roles, custom-theme authoring, colour-depth degradation.                                |
| `agentline-troubleshoot.md` | Doctor interpretation, symptom-by-symptom runbooks, reset/wipe procedures.                                    |

These files are **not** a host plugin. The product remains a CLI; the host's existing subagent-discovery system is what makes them reachable. See `04-architecture · State surfaces` for lifecycle and `16-release-and-versioning · Skill-file lifecycle` for the upgrade contract.
