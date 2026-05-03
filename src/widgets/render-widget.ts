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

function applyOverrides(cell: Cell, config: WidgetConfig): Cell {
  const merged: MergeMode = config.merged ?? cell.merged ?? "off";
  // The config layer's `Colour` is a loose `string` alias validated against
  // the JSON Schema; the cell layer's `Colour` is the strict union the
  // encoder consumes. Cast at the boundary because validation already
  // guaranteed the shape.
  const next: Cell = {
    text: cell.text,
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
  return applyOverrides(cell, config);
}
