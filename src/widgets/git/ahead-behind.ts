/**
 * `git-ahead-behind` and `git-conflicts` widgets (§7.6).
 *
 *   - `git-ahead-behind` renders `↑N ↓M`. Per spec the TUI hot-key
 *     `h` toggles hiding when the local is even with upstream; we
 *     model that as `options.hideEven` defaulting to `true`. Zero
 *     segments render as `↑0` / `↓0` only when the other side is
 *     non-zero so the widget never reads as "stale" with the same
 *     pair every tick.
 *   - `git-conflicts` renders `⚡N` and is hidden when zero
 *     (per spec, no opt-out).
 */

import { resolveRole } from "../../data/theme/index.js";
import type { Cell } from "../cell.js";
import { joinValues } from "../separator.js";
import { defineWidget } from "../widget.js";

interface AheadBehindOptions {
  readonly label?: string;
  readonly hideEven?: boolean;
  readonly aheadGlyph?: string;
  readonly behindGlyph?: string;
}

interface ConflictsOptions {
  readonly label?: string;
  readonly glyph?: string;
}

const DEFAULT_AHEAD = "↑";
const DEFAULT_BEHIND = "↓";
const DEFAULT_CONFLICT = "⚡";

export const gitAheadBehindWidget = defineWidget<AheadBehindOptions>(
  "git-ahead-behind",
  (ctx, settings): Cell => {
    const s = ctx.git && ctx.git.available ? ctx.git : null;
    if (!s) return { text: "", hidden: true };
    if (!s.upstream) return { text: "", hidden: true };
    const { ahead, behind } = s.aheadBehind;
    const hideEven = settings.options.hideEven !== false;
    if (ahead === 0 && behind === 0 && hideEven) return { text: "", hidden: true };
    const aheadGlyph = settings.options.aheadGlyph ?? DEFAULT_AHEAD;
    const behindGlyph = settings.options.behindGlyph ?? DEFAULT_BEHIND;
    const segs: string[] = [];
    if (ahead > 0) segs.push(`${aheadGlyph}${ahead}`);
    if (behind > 0) segs.push(`${behindGlyph}${behind}`);
    if (segs.length === 0) {
      segs.push(`${aheadGlyph}0`, `${behindGlyph}0`);
    }
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${joinValues(ctx, segs)}` };
  },
);

export const gitConflictsWidget = defineWidget<ConflictsOptions>(
  "git-conflicts",
  (ctx, settings): Cell => {
    const s = ctx.git && ctx.git.available ? ctx.git : null;
    if (!s) return { text: "", hidden: true };
    if (s.status.conflicts === 0) return { text: "", hidden: true };
    const glyph = settings.options.glyph ?? DEFAULT_CONFLICT;
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const fg = resolveRole(ctx.theme, "danger");
    return { text: `${label}${glyph}${s.status.conflicts}`, fg, signal: true };
  },
);
