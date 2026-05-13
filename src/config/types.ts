/**
 * Type-level mirror of `schemas/config.schema.json` (§4).
 * The schema is authoritative; these types follow it.
 */

/**
 * Pre-validation colour: any string from the config file. Validated and
 * narrowed to `Colour` (the strict union of named / 256-indexed / hex
 * forms) in `src/theme/colours.ts` before reaching the render path.
 */
export type RawColour = string;

export interface WidgetConfig {
  type: string;
  id?: string;
  fg?: RawColour | null;
  bg?: RawColour | null;
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
  overrideFg: RawColour | null;
  overrideBg: RawColour | null;
}

export interface PowerlineCaps {
  start: string;
  end: string;
}

export interface PowerlineGlyphs {
  hardRight?: string;
  softRight?: string;
  hardLeft?: string;
  softLeft?: string;
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

/**
 * Top-level glyph mode (§7.1 add-on).
 *
 *   - `off`        — render-path widgets emit text only (default; goldens
 *                    rely on this).
 *   - `nerd-font`  — when a widget has a `glyph` declared in the catalogue,
 *                    `renderWidget` prepends `<glyph><thin space>` to the
 *                    cell text. Requires a Nerd Font installed in the
 *                    user's terminal; falls back to a missing-glyph box
 *                    in plain fonts (which is exactly why it's opt-in).
 */
export type GlyphMode = "off" | "nerd-font";

export interface AgentlineConfig {
  $schema?: string;
  version: number;
  theme: string | null;
  glyphs: GlyphMode;
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
  glyphs: GlyphMode;
  lines: LineConfig[];
  global: Partial<GlobalConfig>;
  powerline: Partial<PowerlineConfig> & { caps?: Partial<PowerlineCaps>; glyphs?: PowerlineGlyphs };
  terminalWidth: Partial<TerminalWidthConfig>;
  keymap: Record<string, string>;
}>;
