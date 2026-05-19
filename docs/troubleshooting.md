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

## Statusline shows stale data, or edits don't apply

Symptom: `agentline edit` writes new widgets, the editor preview is
correct, but the live statusline shows the **previous** layout and
never updates.

Cause: `~/.claude/settings.json`'s `statusLine.command` points at a bin
that no longer exists (common after `npm uninstall -g @agentline/cli`,
`npm unlink`, or a Homebrew node prefix change). Claude Code keeps
painting the last cached frame from `state/last-render.json` instead of
re-rendering.

Diagnose:

```bash
agentline doctor              # D02 reports the broken command path
which agentline               # should resolve; if not, the bin is gone
```

Or check directly:

```bash
jq -r '.statusLine.command' ~/.claude/settings.json    # what is wired
ls -la "$(jq -r '.statusLine.command' ~/.claude/settings.json | awk '{print $1}')"
```

Fix: reinstall the bin and re-wire in one step:

```bash
npm install -g @agentline/cli && agentline install     # registry
# or, from a checkout:
node dist/cli.mjs install --from-source
```

Both paths produce identical runtime state — see
[install.md](./install.md#install-paths-are-equivalent).

---

## Statusline frozen / time widgets not advancing while idle

Symptom: the layout is correct, but time-varying widgets (session
duration, rate-limit countdown, git state from background subagents,
token totals) stay frozen while the session sits idle. They only jump
forward when you send the next prompt.

Cause: the statusline refresh interval is disabled (`refreshInterval`
is `0`, so `statusLine.refreshInterval` is absent from
`~/.claude/settings.json` and Claude Code only re-runs the command on
events).

Fix: set a non-zero interval and re-sync the host wiring:

```bash
agentline config refresh 5    # re-run every 5 seconds (the default)
agentline doctor --fix        # or repair D09 from the configured value
```

`agentline config refresh` with no argument prints the current value.
Restart Claude Code after wiring so the new `statusLine` setting is
picked up.

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
