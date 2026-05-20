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

import type { WidgetConfig } from "../../data/config/types.js";
import type { Colour } from "../../data/theme/colours/colours.js";
import { widgetMeta, type WidgetFamily } from "../families/catalog.js";
import type { Cell, MergeMode } from "../cell/cell.js";
import { HIDDEN_CELL } from "../cell/cell.js";
import type { WidgetContext } from "../types.js";
import { createThemeFactory } from "../families/family-factory.js";
import { type ResolvedFamilyIdentity } from "../families/family-identity.js";
import type { WidgetRegistry } from "../registry/registry.js";
import type { WidgetDef } from "../widget.js";

/**
 * Family identity (glyph + accent colour) for a widget `type`, with the
 * user's `config.families` override layered over the built-in defaults
 * and the glyph degraded for the host. An unregistered type belongs to
 * no family, so it gets no glyph and no accent — `undefined`.
 */
export function widgetIdentityFor(
  type: string,
  ctx: Pick<WidgetContext, "env" | "config">,
): ResolvedFamilyIdentity | undefined {
  const family: WidgetFamily | undefined = widgetMeta(type)?.family;
  if (family === undefined) return undefined;
  return createThemeFactory({ env: ctx.env }, ctx.config?.families).forFamily(family);
}

/**
 * Prefix the family glyph. Every widget carries its family glyph with
 * no per-type opt-out — skipped only for the unavoidable cases: hidden
 * / empty cells and types with no family identity (an unregistered
 * type). Applied before `applyOverrides` so padding, Powerline and
 * width math all see the glyphed text. Survives `rawValue` — the glyph
 * is family identity, not the widget's label.
 */
function prefixGlyph(cell: Cell, identity: ResolvedFamilyIdentity | undefined): Cell {
  if (cell.hidden || cell.text.length === 0 || identity === undefined) {
    return cell;
  }
  return { ...cell, text: `${identity.glyph} ${cell.text}` };
}

/**
 * Fg precedence: explicit `config.fg` > a state-signal cell's own
 * `fg` (git clean/dirty, token/context threshold, effort) > the family
 * accent > whatever `fg` the cell carried. Family colour is the single
 * source of truth for a non-signal widget's accent.
 */
function resolveFg(
  cell: Cell,
  config: WidgetConfig,
  identity: ResolvedFamilyIdentity | undefined,
): Colour | undefined {
  if (config.fg !== undefined && config.fg !== null) return config.fg;
  if (cell.signal) return cell.fg;
  return identity?.colour ?? cell.fg;
}

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

function applyOverrides(cell: Cell, config: WidgetConfig, identity?: ResolvedFamilyIdentity): Cell {
  const merged: MergeMode = config.merged ?? cell.merged ?? "off";
  const fg = resolveFg(cell, config, identity);
  /*
   * `cell.signal` is read by `resolveFg` and then dropped — it is an
   * internal precedence hint, never encoded onto the emitted cell.
   * The editor preview resolves colour through this same path, so
   * preview and live render agree.
   */
  const next: Cell = {
    text: cell.text,
    merged,
    ...(fg !== undefined ? { fg } : {}),
    ...(config.bg !== undefined && config.bg !== null
      ? { bg: config.bg }
      : cell.bg !== undefined
        ? { bg: cell.bg }
        : {}),
    ...(config.bold !== undefined
      ? { bold: config.bold }
      : cell.bold !== undefined
        ? { bold: cell.bold }
        : {}),
    ...(config.italic !== undefined
      ? { italic: config.italic }
      : cell.italic !== undefined
        ? { italic: cell.italic }
        : {}),
    ...(cell.hidden !== undefined ? { hidden: cell.hidden } : {}),
    ...(cell.flex === true ? { flex: true } : {}),
    ...(typeof cell.href === "string" && cell.href.length > 0 ? { href: cell.href } : {}),
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
  const identity = widgetIdentityFor(config.type, ctx);
  return applyOverrides(prefixGlyph(cell, identity), config, identity);
}

/**
 * Label-only render for the `agentline edit` preview when there's no
 * cached stdin to drive a real render. Returns a `Cell` whose text is
 * the widget's `type` — so the preview shows e.g. `tokens`,
 * `git-branch`, … in place of fake demo values. Per-widget colour and
 * style overrides still apply so a user can see how their cosmetic
 * choices land. `hidden: true` widgets short-circuit, matching
 * `renderWidget`.
 */
export function renderWidgetLabel(config: WidgetConfig, identity?: ResolvedFamilyIdentity): Cell {
  if (config.hidden === true) return HIDDEN_CELL;
  const labelCell: Cell = { text: config.type };
  const prefixed = identity ? prefixGlyph(labelCell, identity) : labelCell;
  const fg = resolveFg(labelCell, config, identity);
  const next: Cell = {
    text: prefixed.text,
    merged: config.merged ?? "off",
    ...(fg !== undefined ? { fg } : {}),
    ...(config.bg !== undefined && config.bg !== null ? { bg: config.bg } : {}),
    ...(config.bold !== undefined ? { bold: config.bold } : {}),
    ...(config.italic !== undefined ? { italic: config.italic } : {}),
  };
  return Object.freeze(next);
}
