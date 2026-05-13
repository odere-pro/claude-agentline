/**
 * `renderWidget` — apply per-widget config flags to the cell a
 * widget produces.
 *
 *   `hidden: true`         short-circuits to `HIDDEN_CELL`
 *   `fg` / `bg`            override the widget's colours when set
 *   `bold` / `italic`      override the widget's style flags when set
 *   `merged`               wins over the widget's merge mode (defaults to `off`)
 *   `rawValue`             passed through `WidgetSettings` so the
 *                          widget itself can suppress its label
 *
 * The widget's own output is treated as the default; explicit config
 * always wins. This matches §4.6 + §5.2 + §5.3 — config is the user's
 * voice, the widget's output is its preference.
 */

import type { WidgetConfig } from "../config/types.js";
import type { Colour } from "../theme/colours.js";
import { widgetGlyph } from "./catalog.js";
import type { Cell, MergeMode } from "./cell.js";
import { HIDDEN_CELL } from "./cell.js";
import type { WidgetContext } from "./context.js";
import type { WidgetRegistry } from "./registry.js";
import type { WidgetDef } from "./widget.js";

export class WidgetTypeMissingError extends Error {
  constructor(public readonly type: string) {
    super(`agentline: no widget registered for type "${type}"`);
    this.name = "WidgetTypeMissingError";
  }
}

export interface RenderWidgetOptions {
  /** Throw on unknown widget type. Default: false (returns HIDDEN_CELL). */
  readonly strict?: boolean;
}

/**
 * Plain space (U+0020) between glyph and value. The earlier thin
 * space (U+2009) rendered fractional-width in monospace terminals and
 * collided with the width-2 Nerd-Font PUA glyphs, leaving the cell
 * looking kerned. A regular space lines up cleanly with the value.
 */
const GLYPH_SEPARATOR = " ";

function applyGlyph(text: string, type: string, ctx: WidgetContext): string {
  if (ctx.config.glyphs !== "nerd-font") return text;
  if (text.length === 0) return text;
  const glyph = widgetGlyph(type);
  if (!glyph) return text;
  return `${glyph}${GLYPH_SEPARATOR}${text}`;
}

function applyOverrides(cell: Cell, config: WidgetConfig, ctx: WidgetContext): Cell {
  const merged: MergeMode = config.merged ?? cell.merged ?? "off";
  // Glyph mode prepends the catalogue glyph + a thin space when
  // `config.glyphs === "nerd-font"`. Skipped on flex separators (their
  // text is the fill character, not a label) and empty cells.
  const text = cell.flex === true ? cell.text : applyGlyph(cell.text, config.type, ctx);
  // The config layer's `Colour` is a loose `string` alias validated against
  // the JSON Schema; the cell layer's `Colour` is the strict union the
  // encoder consumes. Cast at the boundary because validation already
  // guaranteed the shape.
  const next: Cell = {
    text,
    merged,
    ...(config.fg !== undefined && config.fg !== null
      ? { fg: config.fg as Colour }
      : cell.fg !== undefined
        ? { fg: cell.fg }
        : {}),
    ...(config.bg !== undefined && config.bg !== null
      ? { bg: config.bg as Colour }
      : cell.bg !== undefined
        ? { bg: cell.bg }
        : {}),
    ...(config.bold !== undefined ? { bold: config.bold } : cell.bold !== undefined ? { bold: cell.bold } : {}),
    ...(config.italic !== undefined ? { italic: config.italic } : cell.italic !== undefined ? { italic: cell.italic } : {}),
    ...(cell.hidden !== undefined ? { hidden: cell.hidden } : {}),
    ...(cell.flex === true ? { flex: true } : {}),
  };
  return Object.freeze(next);
}

export function renderWidget(
  registry: WidgetRegistry,
  config: WidgetConfig,
  ctx: WidgetContext,
  options: RenderWidgetOptions = {},
): Cell {
  if (config.hidden === true) return HIDDEN_CELL;
  const def: WidgetDef | undefined = registry.get(config.type);
  if (!def) {
    if (options.strict) throw new WidgetTypeMissingError(config.type);
    return HIDDEN_CELL;
  }
  const cell = def.render(ctx, {
    options: config.options ?? {},
    rawValue: config.rawValue ?? false,
  });
  if (cell.hidden) return HIDDEN_CELL;
  return applyOverrides(cell, config, ctx);
}

/**
 * Label-only render for the `agentline edit` preview when there's no
 * cached stdin to drive a real render. Returns a `Cell` whose text is
 * the widget's `type` — so the preview shows e.g. `tokens-input`,
 * `git-branch`, … in place of fake demo values. Per-widget colour and
 * style overrides still apply so a user can see how their cosmetic
 * choices land. `hidden: true` widgets short-circuit, matching
 * `renderWidget`.
 */
export function renderWidgetLabel(config: WidgetConfig): Cell {
  if (config.hidden === true) return HIDDEN_CELL;
  const next: Cell = {
    text: config.type,
    merged: config.merged ?? "off",
    ...(config.fg !== undefined && config.fg !== null ? { fg: config.fg as Colour } : {}),
    ...(config.bg !== undefined && config.bg !== null ? { bg: config.bg as Colour } : {}),
    ...(config.bold !== undefined ? { bold: config.bold } : {}),
    ...(config.italic !== undefined ? { italic: config.italic } : {}),
  };
  return Object.freeze(next);
}
