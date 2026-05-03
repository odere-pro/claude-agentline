# Install

`agentline` is the standalone Claude Code statusline CLI, published to npm
as `@agentline/cli`. Installing it is two steps:

1. put the `agentline` binary on `PATH`,
2. point Claude Code's `statusLine` setting at it.

The blessed path is `npm i -g @agentline/cli && agentline doctor --fix`.
The bundled `scripts/install.sh` is the developer / from-source equivalent.
The manual recipe at the bottom of this page does the same thing by hand
if you would rather not run a script.

## Try it before you install

```bash
npx @agentline/cli preview
```

That renders a sample bar straight to your terminal — no install, no
config, no host session. Add `--all-themes` to compare the four shipped
looks side-by-side, `--minimal` or `--default` to preview the shipped
templates, or `--theme <name>` to pin a single theme. See
[the CLI surface](#cli-surface) for the full flag list.

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
   pass `--force`.

Every filesystem write is atomic (write-temp, `fsync`, `rename`). Re-running
`install.sh` on a tree it already installed is a byte-for-byte no-op.

### Flags

| Flag            | Behaviour                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--dry-run`     | Print every action that would be taken; touch nothing.                                                            |
| `--force`       | Overwrite an existing `statusLine` value even when it does not point at agentline.                                |
| `--from-source` | `npm link` from the current checkout instead of installing the published tarball. Intended for repo contributors. |
| `-h`, `--help`  | Show the script's own usage.                                                                                      |

### Environment overrides

| Variable             | Effect                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------- |
| `CLAUDE_CONFIG_DIR`  | Overrides the parent of the agentline config directory. Default: `~/.config`.          |
| `CLAUDE_PROJECT_DIR` | Used by `agentline init --scope project` to decide where `.agentline.json` lives. Default: `$PWD`. |
| `AGENTLINE_BIN`      | Read by `doctor.sh` and other wrappers to pick a specific bin. Useful in tests and CI. |

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

## Per-project init

To pin a project to a smaller config (for example, in a repo where you
want only model + git on the statusline):

```bash
agentline init --preset minimal      # smaller line, project-scoped
agentline init --preset focus        # model + git + context + clock
agentline init --preset power        # everything: tokens, cost, limits
agentline init --scope user          # write to user config instead
```

Available presets: `minimal | default | focus | power`. The default
scope is `project`, which writes
`${CLAUDE_PROJECT_DIR:-$PWD}/.agentline.json`. Project config is
layered on top of user config (§4.1 of the spec): only the keys you
set override the user defaults.

`agentline init` refuses to overwrite an existing target unless
`--force` is passed, so re-running it on a configured tree is safe.

The shipped `scripts/init.sh` remains as a thin compatibility shim for
the install script lifecycle (gate 04 covers its idempotency); for new
projects, prefer `agentline init` directly.

## Verify

After install, sanity-check the wiring:

```bash
agentline version
agentline doctor
```

`doctor` exits 0 when every check passes or only emits warnings. Pass
`--strict` to make warnings exit non-zero — handy in CI. See
[doctor.md](./doctor.md) for the full check list.

To preview your live statusline at any time:

```bash
agentline preview                     # uses your saved config (or default template)
agentline preview --config .agentline.json   # preview a specific config
agentline preview --all-themes        # one render per shipped theme
```

`agentline render --fixture path/to/payload.json` is also available for
replaying a recorded stdin payload (used by goldens and CI).

## CLI surface

Every subcommand responds to `-h` / `--help`:

| Command             | Purpose                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `agentline preview` | Render a sample bar (no install, no stdin). Headline command.                    |
| `agentline init`    | Scaffold a config from a preset. See flag table below.                           |
| `agentline config`  | Edit configuration in the TUI (Ink, lazy-loaded).                                |
| `agentline doctor`  | Diagnose host wiring; `--fix` repairs D01–D04.                                   |
| `agentline themes`  | List installed themes; `--show <name>` prints a palette.                         |
| `agentline keys`    | List active keymap bindings (`--json` for scripting).                            |
| `agentline schema`  | Print or `--write <dir>` the config JSON Schema.                                 |
| `agentline render`  | Replay a recorded stdin payload (goldens, fixtures).                             |
| `(default)`         | Read stdin, render, write to stdout (the live statusline path).                  |

`agentline init` flags:

| Flag              | Effect                                                                      |
| ----------------- | --------------------------------------------------------------------------- |
| `--preset <name>` | One of `minimal`, `default`, `focus`, `power`. Default: `default`.          |
| `--scope <where>` | `user` writes the user config; `project` (default) writes `.agentline.json`. |
| `--target <path>` | Explicit override; takes precedence over `--scope`.                         |
| `--force`         | Overwrite an existing target.                                               |
| `--minimal`       | Deprecated alias for `--preset minimal`.                                    |

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

## Troubleshooting

- **`node: command not found`** — install Node 20+ from
  [nodejs.org](https://nodejs.org/) or your distro's package manager.
- **`EACCES` from `npm install -g`** — your global prefix is owned by
  root. Either set
  [`npm config set prefix`](https://docs.npmjs.com/cli/v10/commands/npm-config)
  to a user-writable directory, use a Node version manager (`nvm`,
  `fnm`, `volta`), or rerun the install under `sudo`.
- **statusline shows nothing** — run `agentline doctor`. Each check has
  a numeric ID (D01–D10); the report tells you what to fix.
- **statusline shows a fallback line** — the renderer is intentionally
  permissive: even if your config fails to validate, it prints a
  one-line ASCII fallback so your shell prompt is never blank. Run
  `agentline doctor --strict` to surface the underlying error.
- **a stderr "using built-in defaults" hint appears once** — that's
  the first-run nudge; it fires on a TTY when no user/project config
  exists and recommends `agentline init`. Set `AGENTLINE_QUIET=1` to
  silence it permanently.

For anything else, open an issue:
<https://github.com/odere-pro/claude-agentline/issues>.
