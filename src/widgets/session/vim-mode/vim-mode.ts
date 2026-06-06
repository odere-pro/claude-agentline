/**
 * `vim-mode` widget (session family).
 *
 * Renders the editor's active vim mode from `ctx.stdin.vimMode` (already
 * parsed by the adapter from `vim_mode`). Known values are `normal`,
 * `insert`, `visual`, `replace`; the value is upper-cased to the familiar
 * vim indicator (NORMAL / INSERT / …) and an unknown future mode is passed
 * through upper-cased rather than hidden.
 *
 * Hidden when `vimMode` is absent or empty (vim mode off → nothing to
 * show). Pure `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import type { WidgetContext } from "../../types.js";

interface VimModeOptions {
  readonly label?: string;
}

export const vimModeWidget = defineWidget<VimModeOptions>(
  "vim-mode",
  (ctx: WidgetContext, settings): Cell => {
    const mode = ctx.stdin.vimMode;
    if (!mode) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${mode.toUpperCase()}` };
  },
);
