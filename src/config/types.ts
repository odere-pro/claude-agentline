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

import type { Colour } from "../theme/colours.js";

/**
 * @deprecated Pre-validation colour alias retained for compatibility
 * with external consumers of the config barrel. New code should use
 * `Colour` from `../theme/colours.js` (or `import { Colour } from
 * "../theme/index.js"`).
 */
export type RawColour = string;

export interface WidgetConfig {
  type: string;
  id?: string;
  fg?: Colour | null;
  bg?: Colour | null;
  bold?: boolean;
  italic?: boolean;
  rawValue?: boolean;
  merged?: "off" | "merge" | "merge-no-padding";
  hidden?: boolean;
  options?: Record<string, unknown>;
}

export interface LineConfig {
  widgets: WidgetConfig[];
}

export interface GlobalConfig {
  padding: number;
  separator: string;
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
}>;
