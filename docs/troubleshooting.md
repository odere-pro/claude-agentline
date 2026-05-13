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

Run `agentline doctor` to check colour-depth detection and the active theme. If the issue looks like a palette problem, switch to a simpler theme by editing the config:

```jsonc
// ~/.config/agentline/config.json
{ "theme": "vscode-dark" }
```

To strip colour entirely, set `NO_COLOR=1` in your shell environment and restart Claude Code. agentline honours [`NO_COLOR`](https://no-color.org). See [themes.md](./themes.md#truecolor-and-degraded-terminals) for colour-depth details.

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

D03 in `agentline doctor --strict` validates the config. agentline reads a single global config at `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json` (see [config.md](./config.md#file-locations)):

```bash
agentline config init --preset default     # scaffold a valid user config
agentline config schema --write /tmp/      # dump the schema for manual inspection
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

The embedded pricing table is refreshed monthly. Upgrade when D07 fires.

---

## Powerline chevrons show as `>` / `<`

Nerd Font missing. D05 prints the platform-specific install command when it fires.

---

## Reset or uninstall

```bash
agentline config init --force --preset default    # reset config → see config.md#cli-commands
agentline uninstall [--purge]              # full uninstall → see install.md#uninstall
```
