/**
 * Colour primitives shared by themes and widgets.
 *
 * Per §4.6 a colour is one of:
 *   - a named ANSI colour (8 base + bright variants)
 *   - a 256-colour index encoded as `colour:NNN` (0..255)
 *   - a truecolor hex `#RRGGBB`
 *
 * This module is allocation-light and synchronous: the render hot
 * path validates and parses colours without I/O (§1.2 N3).
 */

export const NAMED_COLOURS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "bright-black",
  "bright-red",
  "bright-green",
  "bright-yellow",
  "bright-blue",
  "bright-magenta",
  "bright-cyan",
  "bright-white",
] as const;

export type NamedColour = (typeof NAMED_COLOURS)[number];

export type Indexed256Colour = `colour:${number}`;
export type HexColour = `#${string}`;

export type Colour = NamedColour | Indexed256Colour | HexColour;

const NAMED_SET: ReadonlySet<string> = new Set<string>(NAMED_COLOURS);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const INDEXED_RE = /^colour:(\d{1,3})$/;

export type ParsedColour =
  | { kind: "named"; value: NamedColour }
  | { kind: "indexed"; index: number }
  | { kind: "hex"; r: number; g: number; b: number };

export class ColourParseError extends Error {
  constructor(public readonly input: unknown) {
    super(`agentline: invalid colour value: ${JSON.stringify(input)}`);
    this.name = "ColourParseError";
  }
}

export function isColour(value: unknown): value is Colour {
  if (typeof value !== "string") return false;
  if (NAMED_SET.has(value)) return true;
  if (HEX_RE.test(value)) return true;
  const m = INDEXED_RE.exec(value);
  if (!m) return false;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 0 && n <= 255;
}

export function parseColour(value: unknown): ParsedColour {
  if (typeof value !== "string") throw new ColourParseError(value);
  if (NAMED_SET.has(value)) return { kind: "named", value: value as NamedColour };
  if (HEX_RE.test(value)) {
    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);
    return { kind: "hex", r, g, b };
  }
  const m = INDEXED_RE.exec(value);
  if (m) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= 0 && n <= 255) return { kind: "indexed", index: n };
  }
  throw new ColourParseError(value);
}
