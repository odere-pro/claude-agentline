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

import type { AgentlineConfig } from "../data/config/types.js";
import type { Translator } from "../core/i18n/index.js";
import type { GitState } from "../data/git/index.js";
import type { ResolvedSessionFields } from "../data/session/index.js";
import type { PlanSnapshot } from "../data/session/plan/plan.js";
import type { StdinPayload } from "../core/stdin/index.js";
import type { Theme } from "../data/theme/index.js";
import type { TokensSnapshot } from "../data/tokens/index.js";
import type { Colour } from "../data/theme/colours/colours.js";
import type { Clock } from "./clock/clock.js";
import type { MergeMode } from "../core/lib/merge-mode.js";

export type { MergeMode } from "../core/lib/merge-mode.js";

/**
 * Display ceiling for percentage widgets. Shared by `context-percentage`
 * and `session-weekly-usage` so a host value above 100% (rare but
 * possible) renders as `999%` rather than `1234%`, preserving column width.
 */
export const MAX_DISPLAY_PERCENTAGE = 999;

// ─── Cell: the render unit ──────────────────────────────────────────────────

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
   * State-signal marker. A widget sets `signal: true` when its `fg`
   * encodes meaning (git clean/dirty, token/context threshold, effort
   * level) rather than being a generic accent. `renderWidget` keeps a
   * signal cell's own `fg` instead of substituting the family accent,
   * so the state stays readable. Consumed internally only — never
   * copied onto the emitted cell / segment / ANSI.
   */
  readonly signal?: boolean;
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
   * Resolves a widget's user-facing strings by id against the configured
   * language. Built once per render tick by `buildWidgetContext`, so the
   * live render and the editor preview translate identically. Optional:
   * ad-hoc contexts (tests) omit it and widgets fall back to English via
   * `identityTranslator`.
   */
  readonly t?: Translator;
  /**
   * Identity fields resolved from `stdin.user.*` with auth-file fallback
   * (§7.2.1). Resolved once per render tick by `loadSessionFields`;
   * widgets MUST NOT do filesystem I/O during `render()`.
   */
  readonly session?: ResolvedSessionFields;
  /**
   * Transcript-derived token / context snapshot (§7.3, §7.4).
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
  /**
   * Active-plan snapshot (§7.2). Resolved once per render tick by
   * `loadPlanSnapshot`; widgets MUST NOT list the plans directory
   * during `render()`. Absent when there is no active plan.
   */
  readonly plan?: PlanSnapshot;
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
