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
 *   - the **configured theme's** colours, resolved through the exact same
 *     widget render path the real statusline uses (`previewWidget` with the
 *     resolved `Theme`) and then through the bin's own colour model
 *     (`resolveColourRgb`) at the colour depth the bin would detect for
 *     this terminal. A chip's colour therefore matches what the bin
 *     prints at the palette level — including the downsampled swatch at
 *     256/16-colour — instead of Ink/chalk re-resolving a name through
 *     the terminal's palette. The user's explicit `widget.fg` override
 *     still wins. (The picker keeps its own decorative
 *     `FAMILY_COLOR` group accents — that is a list-grouping device, not a
 *     preview of rendered output.);
 *   - the same separator + padding the plain-mode composer uses
 *     (`config.global.separator`, `global.padding`, per-cell `merged`);
 *   - hidden widgets, which still appear as a dim navigable chip so a user
 *     can reach them with the arrows and toggle them back on;
 *   - a trailing "+ add widget" affordance on every row.
 */

import type { AgentlineConfig, LineConfig, WidgetConfig } from "../config/types.js";
import { honourNoColorEnv, effectiveDepth } from "../render/accessibility.js";
import { detectColourDepth, type ColourDepth } from "../render/colour-depth.js";
import { resolveColourRgb } from "../render/ansi.js";
import type { Theme } from "../theme/index.js";
import type { Colour } from "../theme/colours.js";
import { previewWidget } from "./preview-fixture.js";
import type { Cell } from "../widgets/cell.js";

/**
 * Resolve a widget {@link Colour} to the exact `#rrggbb` the render bin
 * would put on screen at `depth`, via the bin's own colour model
 * ({@link resolveColourRgb}). Returns `undefined` when the colour is
 * absent or colour is disabled (`depth === "none"`), so the slot omits it.
 *
 * This is why the preview matches the live statusline: Ink/chalk would
 * otherwise re-resolve a name like `"magenta"` through the terminal's
 * palette (washed out) and cannot render the `colour:NNN` form at all.
 */
function toHex(c: Colour | undefined, depth: ColourDepth): string | undefined {
  if (c === undefined) return undefined;
  const rgb = resolveColourRgb(c, depth);
  if (rgb === null) return undefined;
  const h = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/**
 * The colour depth the live bin would detect for this environment, with
 * the `NO_COLOR` convention applied — the same inputs `renderFromInputs`
 * uses (`src/render/pipeline.ts`). Pre-resolving slot colours to this
 * depth is what makes the preview a faithful "what prints" view.
 */
function resolveDepth(env: NodeJS.ProcessEnv): ColourDepth {
  return effectiveDepth(
    detectColourDepth({ env }),
    honourNoColorEnv({ noColor: false, noUnicode: false }, env),
  );
}

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
  /**
   * Resolved theme — the configured `config.theme` loaded to a `Theme`.
   * Threaded into `previewWidget` so every chip's colour comes from the
   * same palette the real statusline renders with. `null`/omitted falls
   * back to the compiled default palette (matching a render with no theme).
   */
  readonly theme?: Theme | null;
  /**
   * Resolved process env. Forwarded to `previewWidget` so family-glyph
   * degradation resolves through the same inputs the live render uses.
   * Omitted falls back to `{}` (deterministic for tests).
   */
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Build one `PreviewRow` per line in `props.lines`. The renderer maps each
 * row 1:1 to a horizontal Ink box.
 */
export function buildPreview(props: PreviewModelProps): readonly PreviewRow[] {
  const env = props.env ?? {};
  const depth = resolveDepth(env);
  return props.lines.map((line, idx) =>
    buildRow(idx, line, props.base, props.theme ?? null, env, depth),
  );
}

function buildRow(
  line: number,
  row: LineConfig,
  base: AgentlineConfig,
  theme: Theme | null,
  env: NodeJS.ProcessEnv,
  depth: ColourDepth,
): PreviewRow {
  const slots: PreviewSlot[] = [];
  for (let i = 0; i < row.widgets.length; i += 1) {
    const widget = row.widgets[i];
    if (!widget) continue;
    if (i > 0) {
      const join = computeJoin(widget, base);
      if (join.length > 0) slots.push({ kind: "join", text: join });
    }
    slots.push(renderSlot(widget, i, base, theme, env, depth));
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
 * The slot's foreground colour is the widget's own theme-resolved colour
 * — `previewWidget` is given the configured `Theme`, the user's `config`
 * (family identity / per-widget overrides) and `env`, so the chip shows
 * the exact colour and glyph the real statusline prints (e.g. `model`
 * resolves the theme's `accent` role). User overrides on the widget
 * itself (`widget.fg`) still win.
 */
function renderSlot(
  widget: WidgetConfig,
  idx: number,
  base: AgentlineConfig,
  theme: Theme | null,
  env: NodeJS.ProcessEnv,
  depth: ColourDepth,
): PreviewSlot {
  if (widget.hidden === true) {
    return {
      kind: "widget",
      widgetIndex: idx,
      text: widget.type,
      hidden: true,
    };
  }
  const cell: Cell = previewWidget(widget.type, widget.options, { theme, config: base, env });
  /*
   * `previewWidget` returns a label cell with `hidden: true` when the widget
   * self-hides (data absent). Carry the cell's text (family glyph + type name)
   * and fg (family accent) through so the dim stub is visually identifiable.
   * Fall back to the bare type name only when the cell text is also empty.
   */
  if (cell.hidden || cell.text === "") {
    const fg = toHex(cell.fg, depth);
    return {
      kind: "widget",
      widgetIndex: idx,
      text: cell.text.length > 0 ? cell.text : widget.type,
      ...(fg ? { fg } : {}),
      hidden: true,
    };
  }
  const fg = toHex(widget.fg ?? cell.fg, depth);
  const bg = toHex(widget.bg ?? cell.bg, depth);
  return {
    kind: "widget",
    widgetIndex: idx,
    text: cell.text,
    ...(fg ? { fg } : {}),
    ...(bg ? { bg } : {}),
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
