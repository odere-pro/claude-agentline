/**
 * ANSI escape sequence encoder (§8.2 step 4, §8.3).
 *
 * Encodes a sequence of `Segment`s into a single string containing
 * SGR escapes that respect the detected `ColourDepth`. Truecolor
 * downgrades to 256 to 16 colours when the terminal can't render
 * the higher depth.
 *
 *   truecolor : `ESC[38;2;R;G;Bm`     fg
 *               `ESC[48;2;R;G;Bm`     bg
 *   256       : `ESC[38;5;Nm`         fg
 *               `ESC[48;5;Nm`         bg
 *   16        : `ESC[3Nm` / `ESC[9Nm` fg (basic / bright)
 *               `ESC[4Nm` / `ESC[10Nm` bg
 *   none      : segments are written as plain text (no escapes)
 *
 * The encoder emits a single SGR sequence between segments and
 * resets only when style changes (no bare `RESET` between
 * identically-styled segments) so the produced string stays
 * compact.
 */

import {
  parseColour,
  type Colour,
  type ParsedColour,
} from "../theme/colours.js";
import type { ColourDepth } from "./colour-depth.js";
import type { Segment } from "./segment.js";

export const SGR_RESET = "\x1b[0m";

// xterm 256-colour protocol structural constants. Pulled out as named
// exports so the arithmetic in rgbToAnsi256 / ansi256ToRgb reads as
// "convert via the colour cube" rather than a wall of magic numbers.
const ANSI_BASIC_COUNT = 16; // basic + bright palette occupies indices 0..15
const ANSI_BRIGHT_OFFSET = 8; // bright variant of basic colour `i` is `i + 8`
const ANSI_CUBE_BASE = 16; // 6×6×6 colour cube starts at index 16
const ANSI_CUBE_SIDE = 6; // length of each axis of the cube
const ANSI_CUBE_R_STRIDE = 36; // 6 × 6 — stride between successive R values
const ANSI_CUBE_G_STRIDE = 6; // stride between successive G values
const ANSI_CUBE_STEP = 51; // 255 / 5 — per-axis step in the cube
const ANSI_GREY_BASE = 232; // greyscale ramp starts at 232
const ANSI_GREY_TOP = 231; // last cube index when r=g=b is near-white
const ANSI_GREY_FLOOR = 16; // first cube index when r=g=b is near-black
const ANSI_GREY_OFFSET = 8; // 232 maps to grey level 8 (not 0)
const ANSI_GREY_STEP = 10; // greyscale step between successive indices
const ANSI_GREY_RAMP_DIVISOR = 247; // 255 - 8: divisor for cube greyscale interpolation
const ANSI_GREY_RAMP_STEPS = 24; // 24 levels in the greyscale ramp
const ANSI_BRIGHTNESS_MIDPOINT = 128; // perceived-brightness threshold for bright/dim flag

const NAMED_BASE_INDEX: Record<string, number> = {
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
};

const NAMED_BRIGHT_PREFIX = "bright-";

interface NamedRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly index16: number;
  readonly bright: boolean;
}

const NAMED_RGB: Readonly<Record<string, NamedRgb>> = {
  black: { r: 0, g: 0, b: 0, index16: 0, bright: false },
  red: { r: 205, g: 49, b: 49, index16: 1, bright: false },
  green: { r: 13, g: 188, b: 121, index16: 2, bright: false },
  yellow: { r: 229, g: 229, b: 16, index16: 3, bright: false },
  blue: { r: 36, g: 114, b: 200, index16: 4, bright: false },
  magenta: { r: 188, g: 63, b: 188, index16: 5, bright: false },
  cyan: { r: 17, g: 168, b: 205, index16: 6, bright: false },
  white: { r: 229, g: 229, b: 229, index16: 7, bright: false },
  "bright-black": { r: 102, g: 102, b: 102, index16: 0, bright: true },
  "bright-red": { r: 241, g: 76, b: 76, index16: 1, bright: true },
  "bright-green": { r: 35, g: 209, b: 139, index16: 2, bright: true },
  "bright-yellow": { r: 245, g: 245, b: 67, index16: 3, bright: true },
  "bright-blue": { r: 59, g: 142, b: 234, index16: 4, bright: true },
  "bright-magenta": { r: 214, g: 112, b: 214, index16: 5, bright: true },
  "bright-cyan": { r: 41, g: 184, b: 219, index16: 6, bright: true },
  "bright-white": { r: 229, g: 229, b: 229, index16: 7, bright: true },
};

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface NormalisedColour {
  readonly index256: number;
  readonly rgb: Rgb;
  readonly index16: number;
  readonly bright: boolean;
}

function normalise(parsed: ParsedColour): NormalisedColour {
  switch (parsed.kind) {
    case "named": {
      const named = NAMED_RGB[parsed.value];
      if (!named) throw new Error(`unknown named colour: ${parsed.value}`);
      const baseIndex = NAMED_BASE_INDEX[parsed.value.replace(NAMED_BRIGHT_PREFIX, "")];
      const index256 = (named.bright ? ANSI_BRIGHT_OFFSET : 0) + (baseIndex ?? 0);
      return {
        index256,
        rgb: { r: named.r, g: named.g, b: named.b },
        index16: named.index16,
        bright: named.bright,
      };
    }
    case "indexed": {
      const rgb = ansi256ToRgb(parsed.index);
      // Indices 0..15 are the named palette; map them straight onto the
      // 16-colour space (modulo strips the bright bit — the bright flag
      // is captured separately below).
      const index16 =
        parsed.index < ANSI_BASIC_COUNT
          ? parsed.index % ANSI_BRIGHT_OFFSET
          : nearest16Index(rgb);
      return {
        index256: parsed.index,
        rgb,
        index16,
        bright: parsed.index >= ANSI_BRIGHT_OFFSET && parsed.index < ANSI_BASIC_COUNT,
      };
    }
    case "hex": {
      const rgb = { r: parsed.r, g: parsed.g, b: parsed.b };
      return {
        index256: rgbToAnsi256(rgb),
        rgb,
        index16: nearest16Index(rgb),
        bright: brightnessFromRgb(rgb) >= ANSI_BRIGHTNESS_MIDPOINT,
      };
    }
  }
}

function rgbToAnsi256(rgb: Rgb): number {
  if (rgb.r === rgb.g && rgb.g === rgb.b) {
    if (rgb.r < ANSI_GREY_OFFSET) return ANSI_GREY_FLOOR;
    if (rgb.r > 255 - ANSI_GREY_OFFSET) return ANSI_GREY_TOP;
    return (
      Math.round(((rgb.r - ANSI_GREY_OFFSET) / ANSI_GREY_RAMP_DIVISOR) * ANSI_GREY_RAMP_STEPS) +
      ANSI_GREY_BASE
    );
  }
  // 6×6×6 colour cube: stride 36 on R, 6 on G, 1 on B; per-axis values
  // quantise the 0..255 range into 0..5.
  return (
    ANSI_CUBE_BASE +
    ANSI_CUBE_R_STRIDE * Math.round((rgb.r / 255) * (ANSI_CUBE_SIDE - 1)) +
    ANSI_CUBE_G_STRIDE * Math.round((rgb.g / 255) * (ANSI_CUBE_SIDE - 1)) +
    Math.round((rgb.b / 255) * (ANSI_CUBE_SIDE - 1))
  );
}

function ansi256ToRgb(index: number): Rgb {
  if (index < ANSI_BASIC_COUNT) {
    const named = Object.values(NAMED_RGB)[index];
    return named ?? { r: 0, g: 0, b: 0 };
  }
  if (index >= ANSI_GREY_BASE) {
    const grey = ANSI_GREY_OFFSET + (index - ANSI_GREY_BASE) * ANSI_GREY_STEP;
    return { r: grey, g: grey, b: grey };
  }
  const offset = index - ANSI_CUBE_BASE;
  const r = Math.floor(offset / ANSI_CUBE_R_STRIDE);
  const g = Math.floor((offset % ANSI_CUBE_R_STRIDE) / ANSI_CUBE_G_STRIDE);
  const b = offset % ANSI_CUBE_G_STRIDE;
  return { r: r * ANSI_CUBE_STEP, g: g * ANSI_CUBE_STEP, b: b * ANSI_CUBE_STEP };
}

function nearest16Index(rgb: Rgb): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 8; i++) {
    const named = Object.values(NAMED_RGB)[i]!;
    const dr = named.r - rgb.r;
    const dg = named.g - rgb.g;
    const db = named.b - rgb.b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

function brightnessFromRgb(rgb: Rgb): number {
  return Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
}

function fgEscape(c: Colour, depth: ColourDepth): string {
  const norm = normalise(parseColour(c));
  switch (depth) {
    case "truecolor":
      return `\x1b[38;2;${norm.rgb.r};${norm.rgb.g};${norm.rgb.b}m`;
    case "256":
      return `\x1b[38;5;${norm.index256}m`;
    case "16":
      return norm.bright ? `\x1b[${90 + norm.index16}m` : `\x1b[${30 + norm.index16}m`;
    case "none":
      return "";
  }
}

function bgEscape(c: Colour, depth: ColourDepth): string {
  const norm = normalise(parseColour(c));
  switch (depth) {
    case "truecolor":
      return `\x1b[48;2;${norm.rgb.r};${norm.rgb.g};${norm.rgb.b}m`;
    case "256":
      return `\x1b[48;5;${norm.index256}m`;
    case "16":
      return norm.bright ? `\x1b[${100 + norm.index16}m` : `\x1b[${40 + norm.index16}m`;
    case "none":
      return "";
  }
}

function styleKey(seg: Segment): string {
  return `${seg.fg ?? ""}|${seg.bg ?? ""}|${seg.bold ? "B" : ""}|${seg.italic ? "I" : ""}`;
}

function isStyled(seg: Segment): boolean {
  return Boolean(seg.fg || seg.bg || seg.bold || seg.italic);
}

export function encodeSegments(segments: readonly Segment[], depth: ColourDepth): string {
  if (depth === "none") {
    return segments.map((s) => s.text).join("");
  }
  let out = "";
  let lastKey = "";
  let activeStyle = false;
  for (const seg of segments) {
    if (seg.text === "") continue;
    if (!isStyled(seg)) {
      if (activeStyle) {
        out += SGR_RESET;
        activeStyle = false;
        lastKey = "";
      }
      out += seg.text;
      continue;
    }
    const key = styleKey(seg);
    if (key !== lastKey) {
      if (activeStyle) out += SGR_RESET;
      let prefix = "";
      if (seg.bold) prefix += "\x1b[1m";
      if (seg.italic) prefix += "\x1b[3m";
      if (seg.fg) prefix += fgEscape(seg.fg, depth);
      if (seg.bg) prefix += bgEscape(seg.bg, depth);
      out += prefix;
      lastKey = key;
      activeStyle = true;
    }
    out += seg.text;
  }
  if (activeStyle) out += SGR_RESET;
  return out;
}
