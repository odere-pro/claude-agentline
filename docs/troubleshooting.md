# Troubleshooting

Always start with the health check — it names which check failed and what to do:

```bash
agentline doctor          # full report
agentline doctor --fix    # auto-repair D01–D04
```

See [doctor.md](./doctor.md) for the complete check list (D01–D09).

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
rm "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json"   # scrap the broken file
agentline install                                                # reseed the default template
```

---

## Config validation error

```
agentline: config error at /lines/0/widgets/2/type: must be a known widget type
```

`agentline doctor` prints a friendlier version with a file location. Look up the widget name in [widgets.md](./widgets.md).

---

## Stale pricing / D06 warning

```bash
npm install -g @agentline/cli@latest
```

The embedded pricing table is refreshed monthly. Upgrade when D06 fires.

---

## Powerline chevrons show as `>` / `<`

No Nerd Font is installed, so Powerline degrades to ASCII chevrons.
Install a Nerd Font (e.g. JetBrainsMono, FiraCode, Hack) from
<https://www.nerdfonts.com>, or set `AGENTLINE_GLYPHS=nerd` to force
the Nerd Font chevrons once a font is present.

---

## Reset or uninstall

```bash
rm "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json"   # reset just the config
agentline install                                                # reseed the default template
agentline uninstall [--purge]                                    # full uninstall → see install.md#uninstall
```
