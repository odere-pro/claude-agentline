/**
 * `output-style` widget (§7.2). Echoes `stdin.outputStyle`; hidden
 * when absent.
 */

import { defineWidget } from "../widget.js";

interface OutputStyleOptions {
  readonly label?: string;
}

export const outputStyleWidget = defineWidget<OutputStyleOptions>(
  "output-style",
  (ctx, settings) => {
    const style = ctx.session?.outputStyle ?? ctx.stdin.outputStyle;
    if (!style) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${style}` };
  },
);
