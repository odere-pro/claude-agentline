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
 *   - real widget colours from the resolved theme (`renderWidget`'s output);
 *   - the same separator + padding the plain-mode composer uses
 *     (`config.global.separator`, `global.padding`, per-cell `merged`);
 *   - hidden widgets, which still appear as a dim navigable chip so a user
 *     can reach them with the arrows and toggle them back on;
 *   - a trailing "+ add widget" affordance on every row.
 */

import type { AgentlineConfig, LineConfig, WidgetConfig } from "../config/types.js";
import { previewWidget } from "../render/demo-fixture.js";
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
    slots.push(renderSlot(widget, i));
  }
  slots.push({ kind: "add", column: row.widgets.length });
  return { line, slots, widgetCount: row.widgets.length };
}

/**
 * Render one widget into a preview slot. Hidden widgets are surfaced as a
 * compact `[hidden:type]` chip so the user can still reach them with the
 * arrows and toggle them back on via the options sheet.
 */
function renderSlot(widget: WidgetConfig, idx: number): PreviewSlot {
  if (widget.hidden === true) {
    return {
      kind: "widget",
      widgetIndex: idx,
      text: `[hidden:${widget.type}]`,
      hidden: true,
    };
  }
  const cell: Cell = previewWidget(widget.type, widget.options);
  // `previewWidget` returns HIDDEN_CELL (`text: "", hidden: true`) when the
  // widget self-hides (data absent). Surface that as a `(no data)` chip
  // tagged with the type so the user understands why nothing is shown.
  if (cell.hidden || cell.text === "") {
    return {
      kind: "widget",
      widgetIndex: idx,
      text: `[${widget.type}: no data]`,
      hidden: true,
    };
  }
  return {
    kind: "widget",
    widgetIndex: idx,
    text: cell.text,
    ...(widget.fg ? { fg: widget.fg } : cell.fg ? { fg: cell.fg as string } : {}),
    ...(widget.bg ? { bg: widget.bg } : cell.bg ? { bg: cell.bg as string } : {}),
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
