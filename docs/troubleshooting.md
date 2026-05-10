# Troubleshooting

Always start with the health check — it names which check failed and what to do:

```bash
agentline doctor          # full report
agentline doctor --fix    # auto-repair D01–D04
```

See [doctor.md](./doctor.md) for the complete check list (D01–D10).

---

## Statusline is not showing

Look for `[XX]` on D01 (settings file) or D02 (statusLine wiring):

```bash
agentline doctor
agentline doctor --fix    # repairs the wiring
agentline install         # re-wire if --fix is not enough
```

Restart Claude Code after wiring — the `statusLine` setting is read at startup.

---

## Blank or garbled output

Isolate whether the problem is Claude Code or the terminal:

```bash
agentline preview                              # renders without a live session
agentline preview --theme vscode-dark          # simpler palette
NO_COLOR=1 agentline preview                   # strip colour entirely
COLORTERM= TERM=xterm-256color agentline preview   # simulate 256-colour
```

agentline honours [`NO_COLOR`](https://no-color.org). See [themes.md](./themes.md#truecolor-and-degraded-terminals) for colour-depth details.

---

## `agentline: command not found`

```bash
which agentline && agentline version   # confirm what is on PATH
npm install -g @agentline/cli          # fix: from npm
node dist/cli.mjs install --from-source  # fix: from source checkout
```

See [install.md](./install.md) for the full install procedure.

---

## Config not loading

D03 in `agentline doctor --strict` validates the config. Project config must be at `.agentline.json` at the project root (see [config.md](./config.md#file-locations)):

```bash
agentline init --preset default --scope project   # scaffold a valid config
agentline schema --write /tmp/                    # dump the schema for manual inspection
```

---

## Config validation error

```
agentline: config error at /lines/0/widgets/2/type: must be a known widget type
```

`agentline doctor` prints a friendlier version with a file location. Look up the widget name in [widgets.md](./widgets.md).

---

## Stale pricing / D07 warning

```bash
npm install -g @agentline/cli@latest
```

The `cost` widget uses an embedded pricing table refreshed monthly. Upgrade when D07 fires.

---

## Powerline chevrons show as `>` / `<`

Nerd Font missing. D05 prints the platform-specific install command when it fires.

---

## `command` widget shows `✗`

Run `options.cmd` in your terminal directly. Common causes: binary not on PATH in the Claude Code environment, or command exceeds `timeoutMs` (default 250 ms). D09 names the offending widget.

Other less obvious causes:

- **`options.shell` was ignored.** The widget honours `shell` only when it is one of `/bin/sh`, `/bin/bash`, `/usr/bin/sh`, `/usr/bin/bash`, `/usr/local/bin/bash`, `cmd.exe`, `powershell.exe`, or `pwsh.exe`. Anything else falls back to the platform default.
- **Credential env var missing.** Variables matching `*_TOKEN`, `*_KEY`, `*_SECRET`, `*_PASSWORD`, `*_PASS`, `*_AUTH` are stripped from the subprocess environment by design — surface secrets through a different channel.
- **`options.cwd` was rejected.** It must be an absolute path that exists and is a directory; otherwise the subprocess inherits agentline's cwd.

---

## My project's `command` widget is missing / I see "dropped \`command\` widget(s) from project config" on stderr

By default, `command` widgets declared in `.agentline.json` (the project layer) are dropped before merge so cloning a hostile repo and refreshing the statusline isn't RCE-by-default. Two ways forward:

1. **Move the widget to your user config** (`${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`). User-layer `command` widgets always run.
2. **Opt in for this shell session:** export `AGENTLINE_TRUST_PROJECT_COMMAND_WIDGETS=1`. The warning stops and the project widget renders. Set it project-wide via your shell rc / direnv only after reviewing the project file.

See [widgets.md](./widgets.md) for the trust-boundary rationale.

---

## Reset or uninstall

```bash
agentline init --force --preset default    # reset config → see config.md#cli-commands
agentline uninstall [--purge]              # full uninstall → see install.md#uninstall
```
