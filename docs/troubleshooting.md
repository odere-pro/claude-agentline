# Troubleshooting

Start with `agentline doctor`. It runs all ten health checks and tells you exactly what is wrong:

```bash
agentline doctor          # report
agentline doctor --fix    # report + auto-repair D01–D04
agentline doctor --strict # exit non-zero on any warning (CI mode)
```

---

## Common symptoms

### Statusline is not showing

**Check:**

```bash
agentline doctor
```

Look for `[XX]` or `[!!]` on D01 (settings file) or D02 (statusLine wiring).

**Fix:**

```bash
agentline doctor --fix
```

or re-run the install:

```bash
agentline install          # wires the local project
agentline install --global # wires globally
```

Then restart Claude Code. The `statusLine` setting is read at startup.

---

### Blank or garbled output

**Check:**

```bash
agentline preview
```

If `preview` itself looks wrong, the issue is in your terminal's colour support, not Claude Code.

**Try:**

```bash
agentline preview --theme vscode-dark   # simpler palette
NO_COLOR=1 agentline preview            # disable colour entirely
COLORTERM= TERM=xterm-256color agentline preview   # simulate 256-colour mode
```

agentline honours [`NO_COLOR`](https://no-color.org). Setting `NO_COLOR=1` in your Claude Code environment will produce a plain-text bar.

---

### Wrong binary called

**Check:**

```bash
which agentline
agentline version
```

**Fix:**

If the path is wrong or `agentline: command not found`:

```bash
# From npm
npm install -g @agentline/cli

# From source
node dist/cli.mjs install --from-source
```

---

### Config file not loading

**Check:**

```bash
agentline doctor --strict
```

D03 validates the user config. The project config path must be exactly `.claude/agentline.json` in the project root (not `.agentline.json` at the root, not anywhere else).

**Config file locations:**

| Scope   | Path                              |
| ------- | --------------------------------- |
| User    | `~/.config/agentline/config.json` |
| Project | `.claude/agentline.json`          |

**Fix:**

```bash
# Scaffold a valid project config
agentline init --preset default --scope project

# Or validate manually
agentline schema --write /tmp/  # dump the schema, then check your file against it
```

---

### Config validation error

```text
agentline: config error at /lines/0/widgets/2/type: must be a known widget type
```

Run `agentline doctor` for the friendlier version, or look up the widget name in [widgets.md](./widgets.md).

---

### Pricing table is stale (D07 warning)

The `cost` widget uses a pricing table embedded at build time. D07 warns when it is older than 90 days.

**Fix:** upgrade `@agentline/cli`:

```bash
npm install -g @agentline/cli@latest
```

---

### Powerline chevrons show as `>` / `<` (D05 warning)

agentline is using ASCII fallback because a Nerd Font is not installed.

**Fix:** Install a Nerd Font and configure your terminal emulator to use it. `agentline doctor` prints the platform-specific install command when D05 fires.

---

### `command` widget shows `✗`

The shell command in `options.cmd` failed or timed out. D09 reports which widget is at fault.

**Check:**

Run the command manually in your terminal. Common causes: the binary is not on PATH inside the Claude Code environment, or the command takes longer than `timeoutMs` (default 250 ms).

---

## Reset to defaults

There is no dedicated `reset` command. Use `init --force`:

```bash
# Reset project config to the default preset
agentline init --force --preset default --scope project

# Reset user config to the default preset
agentline init --force --preset default --scope user
```

---

## Full uninstall

```bash
agentline uninstall          # remove binary + restore settings + remove default config/themes
agentline uninstall --purge  # also remove user-edited config and themes
```

Both are idempotent. Add `--dry-run` to preview the actions before running.

---

## Doctor check reference

| ID  | Description                                            | Auto-fix |
| --- | ------------------------------------------------------ | -------- |
| D01 | `~/.claude/settings.json` exists                       | yes      |
| D02 | `statusLine.command` resolves to a working agentline   | yes      |
| D03 | user config present and matches schema                 | yes      |
| D04 | every theme referenced by config is installed          | yes      |
| D05 | Nerd Font installed when Powerline is enabled          | no       |
| D06 | git binary on PATH when git widgets are enabled        | no       |
| D07 | embedded pricing table fresher than 90 days            | no       |
| D08 | `CLAUDE_CONFIG_DIR` (when set) is writable             | no       |
| D09 | every `command` widget `cmd` resolves to an executable | no       |
| D10 | render dry-run matches stored snapshot                 | no       |

See [doctor.md](./doctor.md) for the full description of each check.
