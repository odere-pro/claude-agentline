/**
 * `vim-mode` widget (session family).
 *
 * Renders the editor's active vim mode from `ctx.stdin.vimMode` (already
 * parsed and lower-cased by the adapter from the host's nested
 * `vim: { mode }` block, or the legacy flat `vim_mode` key). Known values
 * are `normal`, `insert`, `visual`, `visual line`; the value is upper-cased
 * back to the familiar vim indicator (NORMAL / INSERT / …) and an unknown
 * future mode is passed through upper-cased rather than hidden.
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
