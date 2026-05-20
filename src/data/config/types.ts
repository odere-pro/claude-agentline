/**
 * Type-level mirror of `schemas/config.schema.json` (§4).
 * The schema is authoritative; these types follow it.
 *
 * The colour fields below (`WidgetConfig.fg`/`bg`,
 * `GlobalConfig.overrideFg`/`overrideBg`) are typed as the strict
 * `Colour` union, not a loose `string`. The schema's `colourOrNull`
 * pattern enforces the same set at runtime, and `validateConfig`
 * re-checks with `isColour` post-AJV (belt-and-braces against schema
 * drift). The render path therefore consumes typed colours — no
 * boundary casts needed.
 */

import type { WidgetFamily } from "../../core/lib/widget-families.js";
import type { MergeMode } from "../../core/lib/merge-mode.js";
import type { Colour } from "../theme/colours/colours.js";

/**
 * Per-family identity override. Every field is optional — a partial
 * patch merged over the built-in `DEFAULT_FAMILY_IDENTITY` floor, so a
 * user can recolour one family without restating its glyphs.
 */
export interface FamilyIdentityConfig {
  glyph?: string;
  glyphAscii?: string;
  colour?: Colour;
}

/** `families` config block: a partial override per widget family. */
export type FamiliesConfig = Partial<Record<WidgetFamily, FamilyIdentityConfig>>;

/** `translations` config block: locale → (string id → display text). */
export type TranslationsConfig = Record<string, Record<string, string>>;

/**
 * @deprecated Pre-validation colour alias retained for compatibility
 * with external consumers of the config barrel. New code should use
 * `Colour` from `../theme/colours.js` (or `import { Colour } from
 * "../theme/index.js"`).
 */
export type RawColour = string;

/*
 * `WidgetConfig` and `widgets/types.ts:Cell` share four optional visual
 * flags by design — `bold` / `italic` / `merged` / `hidden`. `WidgetConfig`
 * is mutable config the user authors; `Cell` is the readonly render unit
 * a widget emits. `render-widget.ts` coalesces the two (`config.X ??
 * cell.X`) so the user can override an emitted flag. The literal sets are
 * kept aligned by sharing the `MergeMode` union from `core/lib/merge-mode`
 * — the other three primitives (boolean) are too small to merit a
 * dedicated interface.
 */
export interface WidgetConfig {
  type: string;
  id?: string;
  fg?: Colour | null;
  bg?: Colour | null;
  bold?: boolean;
  italic?: boolean;
  rawValue?: boolean;
  merged?: MergeMode;
  hidden?: boolean;
  options?: Record<string, unknown>;
}

export interface LineConfig {
  widgets: WidgetConfig[];
}

export interface GlobalConfig {
  padding: number;
  /** Separator between whole widgets (e.g. `|`). */
  separator: string;
  /**
   * Separator rendered between sub-values *inside* a single widget
   * (e.g. `65k · 1M`). Distinct from {@link separator}, which divides
   * whole widgets. Applied uniformly by every multi-value widget.
   */
  valueSeparator: string;
  inheritColors: boolean;
  bold: boolean;
  italic: boolean;
  minimalist: boolean;
  overrideFg: Colour | null;
  overrideBg: Colour | null;
}

export interface PowerlineCaps {
  start: string | readonly string[];
  end: string | readonly string[];
}

export interface PowerlineGlyphs {
  hardRight?: string | readonly string[];
  softRight?: string | readonly string[];
  hardLeft?: string | readonly string[];
  softLeft?: string | readonly string[];
}

export interface PowerlineConfig {
  enabled: boolean;
  theme: string | null;
  caps: PowerlineCaps;
  autoAlign: boolean;
  continueColors: boolean;
  glyphs?: PowerlineGlyphs;
}

export interface TerminalWidthConfig {
  mode: "full" | "full-minus-40" | "full-until-compact";
  compactThreshold: number;
}

export interface AgentlineConfig {
  $schema?: string;
  version: number;
  theme: string | null;
  lines: LineConfig[];
  global: GlobalConfig;
  powerline: PowerlineConfig;
  terminalWidth: TerminalWidthConfig;
  keymap: Record<string, string>;
  language: string;
  /**
   * Wall-clock re-render cadence in seconds. Mirrored into Claude
   * Code's `settings.json` `statusLine.refreshInterval` at install /
   * `config refresh` / `doctor --fix` time so time-varying widgets keep
   * advancing while the session is idle. `0` disables it (the field is
   * omitted from settings.json → Claude Code reverts to event-driven
   * updates only); `1`+ is written through.
   */
  refreshInterval: number;
  families: FamiliesConfig;
  translations: TranslationsConfig;
}

export type PartialAgentlineConfig = Partial<{
  $schema: string;
  version: number;
  theme: string | null;
  lines: LineConfig[];
  global: Partial<GlobalConfig>;
  powerline: Partial<PowerlineConfig> & { caps?: Partial<PowerlineCaps>; glyphs?: PowerlineGlyphs };
  terminalWidth: Partial<TerminalWidthConfig>;
  keymap: Record<string, string>;
  language: string;
  refreshInterval: number;
  families: FamiliesConfig;
  translations: TranslationsConfig;
}>;
