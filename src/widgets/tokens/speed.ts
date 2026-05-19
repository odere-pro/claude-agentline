/**
 * `token-speed` widget (§7.3). Renders the input and output rolling
 * rates together as `↓<input>/s ↑<output>/s` (arrow before value,
 * single-space separator), mirroring the `tokens` / `git-ahead-behind`
 * convention. Rolling window (default 60 s) is configured via
 * `options.windowSec`; hides when the snapshot is unavailable.
 */

import { rollingSpeed } from "../../data/tokens/index.js";
import { defineWidget } from "../widget.js";
import { formatSpeed } from "./format.js";
import { resolveGlyphs } from "./options.js";

interface TokenSpeedOptions {
  readonly label?: string;
  readonly windowSec?: number;
  readonly inputGlyph?: string;
  readonly outputGlyph?: string;
}

const DEFAULT_WINDOW_SEC = 60;

function windowMs(opt: number | undefined): number {
  if (typeof opt !== "number" || !Number.isFinite(opt) || opt <= 0) {
    return DEFAULT_WINDOW_SEC * 1000;
  }
  return Math.min(Math.max(opt, 1), 3600) * 1000;
}

export const tokenSpeedWidget = defineWidget<TokenSpeedOptions>("token-speed", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const speed = rollingSpeed({
    events: snapshot.events,
    now: snapshot.now,
    windowMs: windowMs(settings.options.windowSec),
  });
  const { inGlyph, outGlyph } = resolveGlyphs(settings.options);
  const body = `${inGlyph}${formatSpeed(speed.inputPerSec)} ${outGlyph}${formatSpeed(speed.outputPerSec)}`;
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${body}` };
});
