/**
 * Widget system type definitions (§7.1).
 *
 * Central module for all widget-related types: Cell (the render unit),
 * WidgetDef/WidgetRender (the contract), WidgetSettings (per-widget options),
 * and WidgetContext (the render environment).
 *
 * This module is the single source of truth for the widget contract.
 * Other modules (cell.ts, widget.ts, context.ts) re-export for backwards compatibility.
 */

import type { AgentlineConfig } from "../config/types.js";
import type { GitState } from "../git/index.js";
import type { ResolvedSessionFields } from "../session/index.js";
import type { StdinPayload } from "../stdin/index.js";
import type { Theme } from "../theme/index.js";
import type { TokensSnapshot } from "../tokens/index.js";
import type { Colour } from "../theme/colours.js";
import type { Clock } from "./clock.js";

// ─── Cell: the render unit ──────────────────────────────────────────────────

export type MergeMode = "off" | "merge" | "merge-no-padding";

export interface Cell {
  readonly text: string;
  readonly fg?: Colour;
  readonly bg?: Colour;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly merged?: MergeMode;
  readonly hidden?: boolean;
  /**
   * Flex marker (§7.8.2). The `flex-separator` widget emits a cell
   * with `flex: true` so the render pipeline can recognise the slot
   * and expand it to fill remaining width. Other widgets MUST NOT
   * set this flag.
   */
  readonly flex?: boolean;
  /**
   * OSC 8 hyperlink target. When set and the colour depth is not
   * `"none"`, the encoder wraps `text` in `ESC]8;;URL\\ESC\\` /
   * `ESC]8;;\\ESC\\` so the visible label becomes clickable in
   * OSC-8-capable terminals. The URL is excluded from width math —
   * `codePointLength` only sees `text` (the visible label).
   */
  readonly href?: string;
}

export const HIDDEN_CELL: Cell = Object.freeze({ text: "", hidden: true });

export function plainCell(text: string): Cell {
  return Object.freeze({ text });
}

export function isHidden(cell: Cell): boolean {
  return Boolean(cell.hidden);
}

// ─── WidgetContext: the render environment ────────────────────────────────

export interface WidgetContext {
  readonly stdin: StdinPayload;
  readonly config: AgentlineConfig;
  readonly theme: Theme | null;
  readonly clock: Clock;
  readonly env: NodeJS.ProcessEnv;
  /**
   * Identity fields resolved from `stdin.user.*` with auth-file fallback
   * (§7.2.1). Resolved once per render tick by `loadSessionFields`;
   * widgets MUST NOT do filesystem I/O during `render()`.
   */
  readonly session?: ResolvedSessionFields;
  /**
   * Transcript-derived token / cost / context snapshot (§7.3, §7.4).
   * Resolved once per render tick by `loadTokensSnapshot`; widgets
   * MUST NOT read the JSONL transcript themselves during `render()`.
   */
  readonly tokens?: TokensSnapshot;
  /**
   * Git working-tree snapshot (§7.6). Resolved once per render tick
   * by `loadGitSnapshot`; widgets MUST NOT shell out to git from
   * `render()`. `available: false` means cwd was missing or not
   * inside a git repo and every git widget hides.
   */
  readonly git?: GitState;
}

// ─── Widget contract ────────────────────────────────────────────────────────

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

/**
 * Erase a typed widget def's option-type parameter so it can sit in a
 * shared `readonly WidgetDef<unknown>[]` family array. `WidgetRender<T>`
 * takes `WidgetSettings<T>` in input position (contravariant), so TS
 * rightly refuses to widen `WidgetDef<MyOptions>` to `WidgetDef<unknown>`
 * implicitly. At runtime the registry only ever calls the render with
 * settings whose `options` shape matches the widget's expected `TOptions`
 * (the config schema is validated before dispatch), so the cast is sound
 * in practice. Confining the cast to this one helper keeps every family
 * `index.ts` free of inline `as` noise.
 */
export function eraseWidget<TOptions>(def: WidgetDef<TOptions>): WidgetDef<unknown> {
  return def as unknown as WidgetDef<unknown>;
}
