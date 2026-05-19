# Keymap

The keymap applies to **`agentline edit`** — the Ink-based TUI editor
for your statusline configuration. It does not affect the rendered
statusline itself (which is non-interactive output).

The editor draws a two-line footer at the bottom showing every binding
for the current scope (motion on line 1, actions on line 2). The
authoritative list of default bindings lives in
[`src/keys/bindings.ts`](../src/keys/bindings.ts).

## Modes

The editor has two modes; a binding's **scope** says where it applies
(`any` applies everywhere):

- **edit** — the _live preview is the editing surface_. All three line
  slots are always rendered; the selected widget is highlighted in
  place; each row ends in a navigable **+ add widget** cell that the
  cursor walks onto and confirms to insert.
- **picker** — a drill-down opened by `a` (add), `r` (replace),
  <kbd>↵</kbd> on the +add cell, or `u` (update — same as the variant
  step only). The default view is the **group browser**: pick a family
  (`session`, `git`, …) and Enter drills into an in-family widget list
  with a live filter and per-row mini-preview. From either the group
  browser or the in-family list, press <kbd>/</kbd> to open the
  **flat-search overlay** — a single list across every catalogued
  widget with a family badge on each row. Already-placed widgets are
  hidden in every view. A widget with catalogued _variants_ (the same
  widget rendered a different way, e.g. `current-session-reset-timer`
  as short / long / clock) drills into a variant step; widgets
  without variants commit immediately. <kbd>Esc</kbd> steps back one
  level — from the variant step to wherever the widget was picked
  (without committing), from the in-family list back to the group
  browser, from search back to the group browser, and from the group
  browser back to edit mode.

Per-widget flags (`visible`, `mergeWithPrev`, `useRawValue`) are set
by editing the config file directly. There is no per-widget options
sheet in the editor.

## Default bindings

| Key                         | Scope  | Action                                                           |
| --------------------------- | ------ | ---------------------------------------------------------------- |
| <kbd>←</kbd> <kbd>→</kbd>   | edit   | move the selection within the row (incl. the trailing +add cell) |
| <kbd>↑</kbd> <kbd>↓</kbd>   | edit   | move the selection between rows                                  |
| <kbd>⇧←</kbd> <kbd>⇧→</kbd> | edit   | move the selected widget within its row                          |
| <kbd>⇧↑</kbd> <kbd>⇧↓</kbd> | edit   | move the selected widget to the adjacent row                     |
| <kbd>↵</kbd>                | edit   | +add cell → open the picker (no-op on a populated widget)        |
| <kbd>a</kbd>                | edit   | add a widget (opens the picker)                                  |
| <kbd>r</kbd>                | edit   | replace the selected widget (opens the picker)                   |
| <kbd>u</kbd>                | edit   | update — pick a different variant of the selected widget         |
| <kbd>d</kbd>                | edit   | delete the selected widget                                       |
| <kbd>S</kbd>                | edit   | save (Ctrl+S also works)                                         |
| _(type)_                    | picker | filter widgets by name or type                                   |
| <kbd>/</kbd>                | picker | open the flat search overlay from the group browser              |
| <kbd>↑</kbd> <kbd>↓</kbd>   | picker | highlight a row                                                  |
| <kbd>↵</kbd>                | picker | confirm the highlighted row and advance / commit                 |
| <kbd>Esc</kbd>              | picker | step back one level (cancels at the group view)                  |
| <kbd>q</kbd>                | any    | quit (prompts if there are unsaved changes)                      |

The editor always shows three rows so up/down navigation has somewhere
to go even on a single-line config; on save, trailing empty rows are
trimmed so the on-disk config still reflects your intent. Moving a
widget across rows lands it just before the destination row's +add
cell.

## Overrides

The `keymap` block in your config maps an **action id** to a key
binding. Action ids are listed in
[`src/keys/bindings.ts`](../src/keys/bindings.ts); an example:

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
> keys (the editor footer) but the editor's key handling is still
> wired to the built-in keys above. Honouring overrides at the input
> layer is a follow-up; until then, treat the table above as
> authoritative for what the editor responds to.

## Persistence

The TUI editor writes the config back to disk via the same atomic
recipe used by `install.sh` (write-temp, `fsync`, `rename`). Editor
watchers see one consistent state; an interrupted edit never leaves a
half-written file.

## Lazy import

`agentline edit` is the only subcommand that pulls in Ink and the TUI
runtime; no other code path imports them. The render hot path stays
small. See the discipline notes in `CLAUDE.md`.
