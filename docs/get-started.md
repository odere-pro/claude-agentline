# Get started

You will have `agentline` rendering in Claude Code in about two minutes. Follow the five steps below.

---

## Step 1 — Review the CLI

Check what commands are available before touching anything:

```bash
agentline --help
```

Or use `npx` to try it without installing:

```bash
npx @agentline/cli --help
npx @agentline/cli preview           # render a sample bar right now
npx @agentline/cli preview --all-themes  # compare all four shipped themes
```

The `preview` command renders without a live Claude Code session. It is the fastest way to see what agentline looks like on your terminal.

---

## Step 2 — Install

### From npm (recommended)

```bash
npm install -g @agentline/cli
agentline install
```

`agentline install` wires the binary into your **current project's** `.claude/settings.json` by default and prompts whether to also wire it globally into `~/.claude/settings.json`.

Flags:

| Flag           | Effect                                                              |
| -------------- | ------------------------------------------------------------------- |
| `--global`     | Wire into `~/.claude/settings.json` without prompting               |
| `--local-only` | Wire the local project only; suppress the global prompt             |
| `--force`      | Overwrite an existing `statusLine` that does not point at agentline |
| `--dry-run`    | Print every action that would be taken; touch nothing               |

### From source (development checkout)

```bash
git clone https://github.com/odere-pro/claude-agentline
cd claude-agentline
npm install && npm run build
node dist/cli.mjs install --from-source
```

`--from-source` runs `npm link` so `agentline` appears on your PATH. After that point, use the CLI directly:

```bash
agentline install --from-source
```

---

## Step 3 — Init and doctor

Scaffold a project config and verify the wiring:

```bash
agentline init --preset default --scope project
agentline doctor
```

`agentline init` writes `.claude/agentline.json` in the current directory. The `default` preset includes model, git-branch, context, tokens, cost, and clock — a good starting point.

If `doctor` shows warnings, run:

```bash
agentline doctor --fix
```

`--fix` auto-repairs D01–D04 (settings file, statusLine wiring, user config, missing themes). Other checks are informational only. See [doctor.md](./doctor.md) for the full check list.

---

## Step 4 — See it in action

Restart your Claude Code session. The statusline appears at the bottom of the terminal.

You do not need an active session to preview — run this at any time:

```bash
agentline preview                    # sample bar with active config
agentline preview --all-themes       # one bar per shipped theme, stacked
agentline preview --theme vscode-dark  # pin a single theme
```

---

## Step 5 — Next steps

| What to do next                       | Where to look                              |
| ------------------------------------- | ------------------------------------------ |
| Change widgets or layout              | [config.md](./config.md)                   |
| Pick or author a theme                | [themes.md](./themes.md)                   |
| Browse all 53 available widgets       | [widgets.md](./widgets.md)                 |
| Use the interactive TUI config editor | [keymap.md](./keymap.md)                   |
| Understand health checks in detail    | [doctor.md](./doctor.md)                   |
| Something is broken                   | [troubleshooting.md](./troubleshooting.md) |
