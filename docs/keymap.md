# Keymap

The keymap applies to **`agentline config`** — the Ink-based TUI editor
for your statusline configuration. It does not affect the rendered
statusline itself (which is non-interactive output).

To enumerate every active binding from the running build (once the
`keys` subcommand is wired):

```bash
agentline keys          # human-readable
agentline keys --json   # machine-readable, includes widget scopes
```

## Default bindings

| Key                       | Context         | Action                                                  |
| ------------------------- | --------------- | ------------------------------------------------------- |
| <kbd>↑</kbd> <kbd>↓</kbd> | list            | navigate                                                |
| <kbd>←</kbd> <kbd>→</kbd> | widget          | change type                                             |
| <kbd>a</kbd>              | list            | add widget                                              |
| <kbd>d</kbd>              | widget          | delete                                                  |
| <kbd>r</kbd>              | widget          | toggle raw value                                        |
| <kbd>m</kbd>              | widget          | cycle merge mode (`off` → `merge` → `merge-no-padding`) |
| <kbd>h</kbd>              | widget          | toggle hidden                                           |
| <kbd>l</kbd>              | git widgets     | toggle clickable IDE link (VS Code / Cursor / IntelliJ) |
| <kbd>t</kbd>              | widget          | toggle title / label                                    |
| <kbd>p</kbd>              | widget          | cycle display variant                                   |
| <kbd>s</kbd>              | widget          | toggle compact / short form                             |
| <kbd>v</kbd>              | widget          | invert / cycle inversion                                |
| <kbd>e</kbd>              | widget          | edit inline value                                       |
| <kbd>u</kbd>              | context widgets | toggle used-vs-remaining                                |
| <kbd>f</kbd>              | widget          | cycle format                                            |
| <kbd>n</kbd>              | widget          | toggle Nerd Font glyph                                  |
| <kbd>w</kbd>              | widget          | edit window / width                                     |
| <kbd>Space</kbd>          | separator       | cycle character                                         |
| <kbd>Esc</kbd>            | any             | back                                                    |

Bindings with a non-`any` context are only active when the cursor is
on a widget of that scope.

## Overrides

The `keymap` block in your config is a flat object that maps an action
name to a key binding. Use `agentline keys --json` to discover the
canonical action names; an example:

```json
"keymap": {
  "widget.delete": "x",
  "widget.toggleHidden": "?",
  "list.add": "+"
}
```

Rules:

- One key per action; multi-key chords are not supported in v0.1.0.
- Letters are case-sensitive; map `"X"` if you want `Shift+x`.
- Reserved keys (`Esc`, `Enter`, arrow keys when navigating a list)
  cannot be overridden — `agentline config` would become unusable.
- Unknown action names are reported by `agentline doctor` (D03 — config
  validation) but do not block rendering.

When a binding conflict is detected — two actions mapped to the same
key in the same context — the editor refuses to start and points at
the offending key. Resolve it in the config and retry.

## Persistence

The TUI editor writes the config back to disk via the same atomic
recipe used by `install.sh` (write-temp, `fsync`, `rename`). Editor
watchers see one consistent state; an interrupted edit never leaves a
half-written file.

## Lazy import

`agentline config` is the only subcommand that pulls in Ink and the
TUI runtime; no other code path imports them. The render hot path
stays small. See the discipline notes in `CLAUDE.md`.
