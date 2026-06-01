/**
 * `claude-update` widget (§7.2). Surfaces a hint when a newer Claude Code CLI
 * is available, reading the off-path claude-health snapshot. Hidden
 * when the cache is unpopulated or the installed CLI is already current —
 * so the widget only ever appears when there is an upgrade to take.
 *
 * The version-comparison happens off the render path (in the refresher);
 * this widget just reads the precomputed `needsUpdate` flag and the latest
 * version string, keeping it a pure `(ctx, settings) → Cell`.
 */

import { resolveRole } from "../../data/theme/index.js";
import type { Cell } from "../cell/cell.js";
import { defineWidget } from "../widget.js";

interface Options {
  readonly label?: string;
}

export const claudeUpdateWidget = defineWidget<Options>("claude-update", (ctx, settings): Cell => {
  const h = ctx.claudeHealth;
  if (!h || !h.available || !h.needsUpdate || !h.latestVersion) {
    return { text: "", hidden: true };
  }
  const label = settings.rawValue ? "" : (settings.options.label ?? "claude↑");
  const fg = resolveRole(ctx.theme, "warning");
  return { text: `${label}${h.latestVersion}`, fg, signal: true };
});
