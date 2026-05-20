# Install

`agentline` is the standalone Claude Code statusline CLI, published to npm
as `@agentline/cli`. Installing it is two steps:

1. put the `agentline` binary on `PATH`,
2. point Claude Code's `statusLine` setting at it.

The blessed path is `npm i -g @agentline/cli && agentline install`.
`agentline install` wires the Claude Code `statusLine` setting in your
global `~/.claude/settings.json` (backing up any prior value);
`agentline doctor --fix` handles the same repair step if you prefer to
wire manually. The manual recipe at the bottom of this page does the same
thing by hand if you would rather not run a command.

## Install paths are equivalent

`--from-source` and the registry path produce **identical runtime
state**. Both run the same `scripts/install.sh`, which:

1. installs a global `agentline` bin (via `npm link` from the checkout,
   or `npm install -g @agentline/cli`),
2. seeds `~/.config/agentline/config.json` (preserved if present),
3. seeds shipped themes,
4. installs skill files into `~/.claude/agents/`,
5. wires `statusLine` into `~/.claude/settings.json`,
6. writes the install manifest.

The only difference is the bytes inside the bin — local checkout vs.
published tarball. `settings.json`, `config.json`, themes, manifest,
and state cache are byte-identical. Pick whichever is convenient.

## Requirements

- Node.js **20 LTS or newer** (the binary is pure JavaScript; no native
  build step).
- macOS, Linux, or Windows under Git Bash / WSL. Native PowerShell is
  out of scope for v0.1.0.
- Claude Code installed and run at least once (so `~/.claude/settings.json`
  exists). If it does not, `agentline doctor --fix` will create it.

## One-command install

The shortest path:

```bash
npm install -g @agentline/cli
agentline doctor --fix
```

`doctor --fix` creates `~/.claude/settings.json` if it's missing,
seeds the user config + themes, and writes a working `statusLine`
entry. It's idempotent — re-running on a configured tree is a no-op.

For a checkout-based install (used during development):

```bash
bash scripts/install.sh
```

What it does, in order:

1. Verifies `node --version` is at least `v20.0.0`.
2. Runs `npm install -g @agentline/cli@<pinned>` (or `npm link` from the
   current checkout when `--from-source` is passed).
3. Copies `templates/default.config.json` to
   `${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json` if no user
   config exists yet. Existing config is left untouched.
4. Copies the four shipped themes (`vscode-dark`, `vscode-light`,
   `claude-code-dark`, `claude-code-light`) into the same directory's
   `themes/` subfolder.
5. Writes a `statusLine` entry into `~/.claude/settings.json` if and
   only if the key is currently unset. To overwrite a foreign value,
   pass `--force`. The entry's `refreshInterval` is set from the
   `refreshInterval` config key (default `5` seconds); a configured `0`
   omits the field so Claude Code stays event-driven only.

Every filesystem write is atomic (write-temp, `fsync`, `rename`). Re-running
`install.sh` on a tree it already installed is a byte-for-byte no-op.

### Flags

| Flag            | Behaviour                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--dry-run`     | Print every action that would be taken; touch nothing.                                                            |
| `--force`       | Back-compat alias; the default already overwrites a foreign `statusLine` (after backing it up).                   |
| `--from-source` | `npm link` from the current checkout instead of installing the published tarball. Intended for repo contributors. |
| `-h`, `--help`  | Show the script's own usage.                                                                                      |

### Environment overrides

| Variable            | Effect                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| `CLAUDE_CONFIG_DIR` | Overrides the parent of the agentline config directory. Default: `~/.config`.          |
| `AGENTLINE_BIN`     | Read by `doctor.sh` and other wrappers to pick a specific bin. Useful in tests and CI. |

## How agentline syncs with Claude Code

agentline has **one config file, globally**. There is no project
layer; a `.agentline.json` in the cwd is silently ignored. The chain is
one-directional:

```
Claude Code event (new prompt, model switch, etc.)
   │
   ▼
~/.claude/settings.json → statusLine.command
   │
   ▼
agentline render
   ├── reads  ${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json
   ├── reads  stdin (the session JSON Claude Code pipes in)
   ├── reads  ${CLAUDE_CONFIG_DIR:-~/.config}/agentline/themes/*.json
   ├── writes ${CLAUDE_CONFIG_DIR:-~/.config}/agentline/state/last-stdin.json
   └── writes ${CLAUDE_CONFIG_DIR:-~/.config}/agentline/state/last-render.json
   │
   ▼
ANSI to stdout → Claude Code paints it
```

Practical consequences:

- `agentline edit` from any worktree / cwd mutates the **same** global
  `config.json`. Running the editor in worktree A and worktree B shares
  config.
- The `cwd`, `workspace`, and `git_worktree` strings that show up in the
  rendered statusline come from the **stdin payload** Claude Code sends
  per session, not from any per-project file. Per-worktree branch
  names just work without configuration.
- Config edits take effect on the next prompt — Claude Code re-runs
  `statusLine.command` per event. No watcher, no reload.
- If `statusLine.command` points at a missing bin, Claude Code keeps
  painting the last cached frame from `state/last-render.json`. The
  symptom is "edits don't apply"; the cause is an orphaned wiring. See
  [troubleshooting.md](./troubleshooting.md#statusline-shows-stale-or-edits-dont-apply).

## What happens to my existing statusLine?

If `~/.claude/settings.json` already has a `statusLine` (a custom shell
command, another tool, anything), install does **not** discard it.
Before writing agentline's value, it snapshots the prior `statusLine`
to `${CLAUDE_CONFIG_DIR:-~/.config/agentline}/state/settings-backup.json`.
The snapshot includes:

- Whether `statusLine` was present at all (so uninstall knows to delete
  the key vs. write a value back).
- The full prior value (string or object form, whichever the host had).

`scripts/uninstall.sh` reads that backup and either restores the prior
`statusLine` value, or removes the key entirely if the host never had
one. Then it deletes the backup. **The host returns to its exact
pre-install state.**

The backup is written once: re-running install does not overwrite it
with agentline's own value, so even multiple installs/uninstalls
round-trip cleanly.

## Manual install

If you would rather not run the bootstrap script:

```bash
# 1. install the binary globally
npm install -g @agentline/cli

# 2. seed the user config (only if the file does not already exist)
mkdir -p "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline"
cp templates/default.config.json \
  "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json"

# 3. seed the theme directory
mkdir -p "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/themes"
cp themes/*.json \
  "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/themes/"

# 4. wire the statusLine
agentline doctor --fix
```

`agentline doctor --fix` is the documented repair surface for D01–D04
(see [doctor.md](./doctor.md)); calling it after the manual `cp` steps
adds the `statusLine` entry to `~/.claude/settings.json` for you.

## Default config

`agentline install` seeds the user config at
`${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json` from the
shipped `templates/default.config.json` (model · thinking-effort ·
git branch · changes / context % · context bar · tokens (block) /
session+weekly usage · session reset · week reset) the first time it
runs. An
existing config is preserved on subsequent runs. To start fresh,
delete the file and re-run `agentline install`.

## Verify

After install, sanity-check the wiring:

```bash
agentline version
agentline doctor
```

`doctor` exits 0 when every check passes or only emits warnings. Pass
`--strict` to make warnings exit non-zero — handy in CI. See
[doctor.md](./doctor.md) for the full check list.

To see your live statusline, restart your Claude Code session — the renderer is invoked once per prompt. For deterministic offline replay (used by goldens and CI):

```bash
agentline render --fixture path/to/payload.json
```

## CLI surface

Every subcommand responds to `-h` / `--help`. See [cli.md](./cli.md) for the complete flag-by-flag reference.

| Command               | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `agentline install`   | Wire `statusLine` and install skill files (this page).          |
| `agentline uninstall` | Restore prior `statusLine`; remove installed skills.            |
| `agentline doctor`    | Diagnose host wiring; `--fix` repairs D01–D04.                  |
| `agentline edit`      | Open the TUI editor (Ink, lazy-loaded).                         |
| `(default)`           | Read stdin, render, write to stdout (the live statusline path). |

## Uninstall

```bash
bash scripts/uninstall.sh
```

What it does:

1. Runs `npm uninstall -g @agentline/cli` (skipped if the package is not
   installed globally).
2. Removes shipped themes whose bytes still match the bundled originals.
   User-edited themes are preserved.
3. Removes the user config only if `--purge` is passed; otherwise it is
   preserved.
4. Strips the `statusLine` entry from `~/.claude/settings.json` only when
   it still points at an agentline invocation. Foreign values are left
   alone.

`install.sh` followed by `uninstall.sh` on the same host leaves no diff
against the pre-install state.

### If you remove the bin without running uninstall

`npm uninstall -g @agentline/cli` (or `npm unlink`) deletes only the
binary. `settings.json` still references the now-missing path, and
Claude Code keeps painting the cached frame from
`state/last-render.json` — the statusline looks "stuck" rather than
disappearing.

Either reinstall (`npm i -g @agentline/cli && agentline install`) or
run `agentline uninstall` from a working checkout to clean
`settings.json` and remove the orphan reference.

## Troubleshooting

- **`node: command not found`** — install Node 20+ from
  [nodejs.org](https://nodejs.org/) or your distro's package manager.
- **`EACCES` from `npm install -g`** — your global prefix is owned by
  root. Either set
  [`npm config set prefix`](https://docs.npmjs.com/cli/v10/commands/npm-config)
  to a user-writable directory, use a Node version manager (`nvm`,
  `fnm`, `volta`), or rerun the install under `sudo`.
- **statusline shows nothing** — run `agentline doctor`. Each check has
  a numeric ID (D01–D08); the report tells you what to fix.
- **statusline shows a fallback line** — the renderer is intentionally
  permissive: even if your config fails to validate, it prints a
  one-line ASCII fallback so your shell prompt is never blank. Run
  `agentline doctor --strict` to surface the underlying error.
- **a stderr "using built-in defaults" hint appears once** — that's
  the first-run nudge; it fires on a TTY when no user/project config
  exists and recommends running `agentline install`. Set
  `AGENTLINE_QUIET=1` to silence it permanently.

For anything else, open an issue:
<https://github.com/odere-pro/claude-agentline/issues>.
