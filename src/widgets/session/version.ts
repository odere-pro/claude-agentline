/**
 * `version` widget (§7.2).
 *
 * The spec mentions a `claude --version` fallback when stdin omits the
 * field; v0.1.0 deliberately omits the shell-out so the render hot
 * path stays sync and import-light (§1.2 N3). Hidden when missing.
 */

import { defineWidget } from "../widget.js";

interface VersionOptions {
  readonly label?: string;
}

export const versionWidget = defineWidget<VersionOptions>("version", (ctx, settings) => {
  const v = ctx.session?.version ?? ctx.stdin.version;
  if (!v) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "v");
  return { text: `${label}${v}` };
});
