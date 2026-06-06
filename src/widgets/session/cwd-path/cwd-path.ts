/**
 * `cwd-path` widget (session family).
 *
 * Renders the session's full working-directory path from `ctx.stdin.cwd`.
 * Distinct from `project`, which renders the git repo *name* (basename
 * fallback); this widget shows the whole path.
 *
 * Hygiene: the home prefix is collapsed to `~` using the injected
 * `ctx.env.HOME` (deterministic — no `os.homedir()` call on the render
 * path), so the rendered path carries no absolute home literal and stays
 * compact. The collapse is segment-aware: a home of `<H>` collapses `<H>`
 * and `<H>/x`, but never a sibling like `<H>foo` whose extra characters
 * are not a path separator.
 *
 * Truncation: when `options.maxLength` is set and the (collapsed) path is
 * longer, it is truncated from the LEFT with a leading `…`, keeping the
 * meaningful tail (the current folder) visible.
 *
 * Hidden when `cwd` is absent or empty. Pure `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import type { WidgetContext } from "../../types.js";

interface CwdPathOptions {
  readonly label?: string;
  /** Maximum rendered width; longer paths are left-truncated with `…`. */
  readonly maxLength?: number;
}

const ELLIPSIS = "…";

/** Collapse a leading `home` segment of `path` to `~` (segment-aware). */
function collapseHome(path: string, home: string | undefined): string {
  if (!home) return path;
  const trimmedHome = home.replace(/[\\/]+$/, "");
  if (trimmedHome === "") return path;
  if (path === trimmedHome) return "~";
  if (path.startsWith(`${trimmedHome}/`)) return `~${path.slice(trimmedHome.length)}`;
  return path;
}

/** Left-truncate `text` to `max` chars, prefixing `…`; no-op when it fits. */
function leftTruncate(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  if (max <= 1) return ELLIPSIS;
  const tail = chars.slice(chars.length - (max - 1)).join("");
  return `${ELLIPSIS}${tail}`;
}

export const cwdPathWidget = defineWidget<CwdPathOptions>(
  "cwd-path",
  (ctx: WidgetContext, settings): Cell => {
    const cwd = ctx.stdin.cwd;
    if (!cwd) return { text: "", hidden: true };

    const collapsed = collapseHome(cwd, ctx.env.HOME);
    const maxLength = settings.options.maxLength;
    const shown =
      typeof maxLength === "number" && maxLength > 0
        ? leftTruncate(collapsed, maxLength)
        : collapsed;

    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${shown}` };
  },
);
