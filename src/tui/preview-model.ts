/**
 * Build the editor's interactive-preview model: a structured per-row
 * description of what to draw, with per-cell provenance tagging so the Ink
 * renderer can highlight the selected widget in place.
 *
 * Pure. No Ink, no I/O. Lives under `src/tui/` so the tsup split keeps it
 * out of `dist/cli.mjs` (§1.2 N3).
 *
 * The editor preview is a *navigation surface* over the configured widgets
 * — it doesn't try to replicate `renderFromInputs`'s flex/Powerline byte
 * output. It does honour:
 *
 *   - per-category accent colours (`CATEGORY_COLOR`) so every widget chip
 *     visually matches the group it belongs to in the picker; the user's
 *     explicit `widget.fg` override still wins. The real statusline path
 *     (`pipeline.ts`) is unaffected and keeps using the theme palette;
 *   - the same separator + padding the plain-mode composer uses
 *     (`config.global.separator`, `global.padding`, per-cell `merged`);
 *   - hidden widgets, which still appear as a dim navigable chip so a user
 *     can reach them with the arrows and toggle them back on;
 *   - a trailing "+ add widget" affordance on every row.
 */

import type { AgentlineConfig, LineConfig, WidgetConfig } from "../config/types.js";
import { previewWidget } from "./preview-fixture.js";
import { CATEGORY_COLOR, widgetMeta } from "../widgets/catalog.js";
import type { Cell } from "../widgets/cell.js";

/** A single drawable in a preview row. */
export type PreviewSlot =
  | {
      readonly kind: "widget";
      /** Index into `lines[row].widgets`. */
      readonly widgetIndex: number;
      readonly text: string;
      readonly fg?: string;
      readonly bg?: string;
      readonly bold?: boolean;
      readonly italic?: boolean;
      /** `true` for hidden widgets — the renderer dims them. */
      readonly hidden: boolean;
    }
  | {
      readonly kind: "join";
      readonly text: string;
    }
  | {
      readonly kind: "add";
      /** The grid column this add-cell occupies (== `widgets.length`). */
      readonly column: number;
    };

export interface PreviewRow {
  readonly line: number;
  readonly slots: readonly PreviewSlot[];
  /** Number of real widgets on this row; the add-cell sits at column `widgetCount`. */
  readonly widgetCount: number;
}

export interface PreviewModelProps {
  /** The full loaded config — everything except `lines` is taken from here. */
  readonly base: AgentlineConfig;
  /** The editor's current (mutable) line list. */
  readonly lines: readonly LineConfig[];
}

/**
 * Build one `PreviewRow` per line in `props.lines`. The renderer maps each
 * row 1:1 to a horizontal Ink box.
 */
export function buildPreview(props: PreviewModelProps): readonly PreviewRow[] {
  return props.lines.map((line, idx) => buildRow(idx, line, props.base));
}

function buildRow(line: number, row: LineConfig, base: AgentlineConfig): PreviewRow {
  const slots: PreviewSlot[] = [];
  for (let i = 0; i < row.widgets.length; i += 1) {
    const widget = row.widgets[i];
    if (!widget) continue;
    if (i > 0) {
      const join = computeJoin(widget, base);
      if (join.length > 0) slots.push({ kind: "join", text: join });
    }
    slots.push(renderSlot(widget, i, base.glyphs));
  }
  slots.push({ kind: "add", column: row.widgets.length });
  return { line, slots, widgetCount: row.widgets.length };
}

/**
 * Render one widget into a preview slot. Hidden widgets and self-hiding
 * widgets (no data available right now) fall back to the widget's type
 * name with `hidden: true` so the renderer dims them. The previous
 * decorative chip text (`[hidden:type]`, `[type: no data]`) treated
 * those cases as their own demo string, which is not a real demonstration
 * of what the widget renders.
 *
 * The slot's foreground colour is the widget's category accent
 * (`CATEGORY_COLOR`) by default, so every chip in the preview matches
 * the group it belongs to in the picker. User overrides on the widget
 * itself (`widget.fg`) still win; widgets whose `type` is unknown to
 * the catalogue (custom registrations) fall back to the cell's own
 * theme-resolved colour.
 */
function renderSlot(
  widget: WidgetConfig,
  idx: number,
  glyphs: AgentlineConfig["glyphs"],
): PreviewSlot {
  if (widget.hidden === true) {
    return {
      kind: "widget",
      widgetIndex: idx,
      text: widget.type,
      hidden: true,
    };
  }
  const cell: Cell = previewWidget(widget.type, widget.options, { glyphs });
  // `previewWidget` returns HIDDEN_CELL (`text: "", hidden: true`) when the
  // widget self-hides (data absent). Fall back to the widget's type name
  // so the user still sees *what* widget is there, dimmed.
  if (cell.hidden || cell.text === "") {
    return {
      kind: "widget",
      widgetIndex: idx,
      text: widget.type,
      hidden: true,
    };
  }
  const meta = widgetMeta(widget.type);
  const accent = meta ? CATEGORY_COLOR[meta.category] : undefined;
  const resolvedFg = widget.fg ?? accent ?? cell.fg;
  return {
    kind: "widget",
    widgetIndex: idx,
    text: cell.text,
    ...(resolvedFg ? { fg: resolvedFg } : {}),
    ...(widget.bg ? { bg: widget.bg } : cell.bg ? { bg: cell.bg } : {}),
    ...((widget.bold ?? cell.bold) ? { bold: true } : {}),
    ...((widget.italic ?? cell.italic) ? { italic: true } : {}),
    hidden: false,
  };
}

/**
 * Mirror of `compose.ts#computeJoin` for plain mode: `merged="merge-no-padding"`
 * emits nothing, `merge` emits a single space, `off` emits
 * `pad + separator + pad`. The editor uses the same join so the layout the
 * user sees lines up with what the real bin will print.
 */
function computeJoin(widget: WidgetConfig, base: AgentlineConfig): string {
  const merged = widget.merged ?? "off";
  if (merged === "merge-no-padding") return "";
  if (merged === "merge") return " ";
  const pad = " ".repeat(Math.max(0, base.global.padding));
  return `${pad}${base.global.separator}${pad}`;
}
