/**
 * `Widget` contract (§7.1).
 *
 * A widget is identified by `type` (the string used in `config.lines[].widgets[].type`)
 * and exposes a synchronous `render(ctx, settings)` function returning a `Cell`.
 * Settings include the per-widget options block plus the `rawValue` flag
 * (§5.3) so widgets that emit a label can suppress it without callers
 * having to mutate options.
 *
 * Widgets MUST be pure — no I/O, no host-state mutation, no reading of
 * wall-clock time outside `ctx.clock` (§1.2 N5, N6, N7). The widget
 * surface itself is render-path safe; widgets that need filesystem
 * access (auth-file fallbacks, JSONL transcript reads) cache eagerly
 * before `render` is called.
 */

import type { Cell } from "./cell.js";
import type { WidgetContext } from "./context.js";

export interface WidgetSettings<TOptions = unknown> {
  readonly options: TOptions;
  readonly rawValue: boolean;
}

export type WidgetRender<TOptions = unknown> = (
  ctx: WidgetContext,
  settings: WidgetSettings<TOptions>,
) => Cell;

export interface WidgetDef<TOptions = unknown> {
  readonly type: string;
  readonly render: WidgetRender<TOptions>;
}

export function defineWidget<TOptions = unknown>(
  type: string,
  render: WidgetRender<TOptions>,
): WidgetDef<TOptions> {
  if (typeof type !== "string" || type.trim() === "") {
    throw new Error("agentline: widget type must be a non-empty string");
  }
  return Object.freeze({ type, render });
}
