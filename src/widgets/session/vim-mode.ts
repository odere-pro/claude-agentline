/**
 * `vim-mode` widget (§7.2). Format cycled by `f` in the TUI:
 *
 *   - `long`     `NORMAL` / `INSERT` / `VISUAL`   (default)
 *   - `short`    `N` / `I` / `V`
 *   - `bracket`  `[N]`
 */

import { defineWidget } from "../widget.js";

type VimFormat = "long" | "short" | "bracket";

interface VimModeOptions {
  readonly label?: string;
  readonly format?: VimFormat;
}

const VALID_FORMATS: ReadonlySet<VimFormat> = new Set<VimFormat>(["long", "short", "bracket"]);

function format(mode: string, fmt: VimFormat): string {
  const upper = mode.toUpperCase().trim();
  if (fmt === "long") return upper;
  const initial = upper.charAt(0) || "?";
  return fmt === "bracket" ? `[${initial}]` : initial;
}

export const vimModeWidget = defineWidget<VimModeOptions>("vim-mode", (ctx, settings) => {
  const mode = ctx.session?.vimMode ?? ctx.stdin.vimMode;
  if (!mode) return { text: "", hidden: true };
  const requested = settings.options.format ?? "long";
  const fmt: VimFormat = VALID_FORMATS.has(requested) ? requested : "long";
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${format(mode, fmt)}` };
});
