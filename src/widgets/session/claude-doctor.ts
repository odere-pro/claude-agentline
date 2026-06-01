/**
 * `claude-doctor` widget (§7.2). Surfaces the issue / warning counts from
 * the host `claude doctor` run, reading the off-path claude-health snapshot.
 * Hidden when the cache is unpopulated, when `claude doctor` could not be
 * parsed, or when it reported a clean bill of health — so the widget only
 * appears when there is something worth flagging.
 *
 * `claude doctor` is spawned and parsed off the render path (in the
 * refresher); this widget just reads the precomputed summary, keeping it a
 * pure `(ctx, settings) → Cell`.
 */

import { resolveRole } from "../../data/theme/index.js";
import type { Cell } from "../cell/cell.js";
import { defineWidget } from "../widget.js";

interface Options {
  readonly label?: string;
}

const ISSUE_GLYPH = "✗";
const WARNING_GLYPH = "⚠";

export const claudeDoctorWidget = defineWidget<Options>("claude-doctor", (ctx, settings): Cell => {
  const h = ctx.claudeHealth;
  const doctor = h && h.available ? h.doctor : null;
  if (!doctor) return { text: "", hidden: true };
  if (doctor.issues === 0 && doctor.warnings === 0) return { text: "", hidden: true };

  const parts: string[] = [];
  if (doctor.issues > 0) parts.push(`${ISSUE_GLYPH}${doctor.issues}`);
  if (doctor.warnings > 0) parts.push(`${WARNING_GLYPH}${doctor.warnings}`);

  const label = settings.rawValue ? "" : (settings.options.label ?? "claude ");
  const fg = resolveRole(ctx.theme, doctor.issues > 0 ? "danger" : "warning");
  return { text: `${label}${parts.join(" ")}`, fg, signal: true };
});
