/**
 * `output-style` widget (session family).
 *
 * Renders the active host output style from `ctx.stdin.outputStyle`
 * (already parsed by the adapter from `output_style.name`). Known values
 * include `default`, `explanatory`, `learning`; an unknown future style is
 * passed through unchanged.
 *
 * The unremarkable `default` style is hidden by default to keep the
 * statusline quiet in the common case; set `showDefault: true` to surface
 * it. Hidden when `outputStyle` is absent. Pure `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import type { WidgetContext } from "../../types.js";

interface OutputStyleOptions {
  readonly label?: string;
  /** Show the `default` style instead of hiding it (default: false). */
  readonly showDefault?: boolean;
}

export const outputStyleWidget = defineWidget<OutputStyleOptions>(
  "output-style",
  (ctx: WidgetContext, settings): Cell => {
    const style = ctx.stdin.outputStyle;
    if (!style) return { text: "", hidden: true };
    if (style === "default" && settings.options.showDefault !== true) {
      return { text: "", hidden: true };
    }
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${style}` };
  },
);
