# Keymap

The keymap applies to **`agentline config`** — the Ink-based TUI editor
for your statusline configuration. It does not affect the rendered
statusline itself (which is non-interactive output).

Enumerate every active binding from the running build:

```bash
agentline config keys          # human-readable table, grouped by scope
agentline config keys --json   # machine-readable: { "bindings": [{ key, action, scope, description }] }
```

The editor draws a footer with the keys for the current scope, and a
help overlay (press `?`) listing every binding grouped by scope.

## Modes

The editor has three modes; a binding's **scope** says where it applies
(`any` applies everywhere):

- **edit** — the _live preview is the editing surface_. All three line
  slots are always rendered; the selected widget is highlighted in
  place; each row ends in a navigable **+ add widget** cell that the
  cursor walks onto and confirms to insert.
- **picker** — the widget chooser, opened by `a` (insert), `r`
  (replace), or <kbd>↵</kbd> on the +add cell: a live filter over all
  built-in widgets, each row showing what it renders against a demo
  session.
- **options** — the per-widget options sheet, opened by `o` or
  <kbd>↵</kbd> on a widget: visible / hidden, the widget's own label,
  spacing to the neighbour.

## Default bindings

| Key                         | Scope   | Action                                                            |
| --------------------------- | ------- | ----------------------------------------------------------------- |
| <kbd>←</kbd> <kbd>→</kbd>   | edit    | move the selection within the row (incl. the trailing +add cell)  |
| <kbd>↑</kbd> <kbd>↓</kbd>   | edit    | move the selection between rows                                   |
| <kbd>⇧←</kbd> <kbd>⇧→</kbd> | edit    | move the selected widget within its row                           |
| <kbd>⇧↑</kbd> <kbd>⇧↓</kbd> | edit    | move the selected widget to the adjacent row                      |
| <kbd>↵</kbd>                | edit    | +add cell → open the picker; on a widget → open the options sheet |
| <kbd>a</kbd>                | edit    | add a widget (opens the picker)                                   |
| <kbd>r</kbd>                | edit    | replace the selected widget (opens the picker)                    |
| <kbd>d</kbd>                | edit    | delete the selected widget                                        |
| <kbd>o</kbd>                | edit    | open the selected widget's options sheet                          |
| <kbd>S</kbd>                | edit    | save (Ctrl+S also works)                                          |
| _(type)_                    | picker  | filter widgets by name or type                                    |
| <kbd>↑</kbd> <kbd>↓</kbd>   | picker  | highlight a widget                                                |
| <kbd>↵</kbd>                | picker  | insert / replace with the highlighted widget                      |
| <kbd>Esc</kbd>              | picker  | close the picker                                                  |
| <kbd>v</kbd>                | options | show / hide the widget                                            |
| <kbd>l</kbd>                | options | show / hide the widget's own label                                |
| <kbd>m</kbd>                | options | spacing to neighbour: full / single space / none                  |
| <kbd>Esc</kbd>              | options | close the options sheet                                           |
| <kbd>q</kbd>                | any     | quit (prompts if there are unsaved changes)                       |
| <kbd>?</kbd>                | any     | toggle the help overlay                                           |

The editor always shows three rows so up/down navigation has somewhere
to go even on a single-line config; on save, trailing empty rows are
trimmed so the on-disk config still reflects your intent. Moving a
widget across rows lands it just before the destination row's +add
cell.

## Overrides

The `keymap` block in your config maps an **action id** to a key
binding. Use `agentline config keys --json` to discover the action ids;
an example:

```json
"keymap": {
  "delete": "X",
  "add": "+",
  "save": "w"
}
```

Rules:

- One key per action; multi-key chords are not supported in v0.1.0.
- Letters are case-sensitive; map `"X"` if you want `Shift+x`.
- Unknown action ids are reported by `agentline doctor` (D03 — config
  validation) but do not block rendering.

> **Heads-up (v0.1.0):** a `keymap` override changes the _displayed_
> keys — `agentline config keys`, the editor footer, and the help
> overlay — but the editor's key handling is still wired to the
> built-in keys above. Honouring overrides at the input layer is a
> follow-up; until then, treat the table above as authoritative for what
> the editor responds to.

## Persistence

The TUI editor writes the config back to disk via the same atomic
recipe used by `install.sh` (write-temp, `fsync`, `rename`). Editor
watchers see one consistent state; an interrupted edit never leaves a
half-written file.

## Lazy import

`agentline config` is the only subcommand that pulls in Ink and the
TUI runtime; no other code path imports them. The render hot path
stays small. See the discipline notes in `CLAUDE.md`.
