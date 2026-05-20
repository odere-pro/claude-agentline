/**
 * Accessibility flags and the de-facto `NO_COLOR` env (§1.2 N8, §11.2 G16).
 *
 *   --no-color     suppress ANSI colour escapes (semantic output preserved)
 *   --no-unicode   strip non-ASCII glyphs from segment text
 *   --ascii        implies both --no-color and --no-unicode
 *
 * `NO_COLOR` honours the convention at <https://no-color.org/>:
 * any non-empty value disables ANSI output. Equivalent to the user
 * supplying `--no-color`.
 */

import type { ColourDepth } from "../colour-depth/colour-depth.js";
import type { Segment } from "../segment/segment.js";

export interface AccessibilityFlags {
  readonly noColor: boolean;
  readonly noUnicode: boolean;
}

export function parseAccessibilityArgs(argv: readonly string[]): AccessibilityFlags {
  let noColor = false;
  let noUnicode = false;
  for (const arg of argv) {
    if (arg === "--no-color" || arg === "--no-colour") noColor = true;
    else if (arg === "--no-unicode") noUnicode = true;
    else if (arg === "--ascii") {
      noColor = true;
      noUnicode = true;
    }
  }
  return { noColor, noUnicode };
}

export function honourNoColorEnv(
  flags: AccessibilityFlags,
  env: NodeJS.ProcessEnv,
): AccessibilityFlags {
  const value = env["NO_COLOR"];
  if (value !== undefined && value !== "") {
    return { ...flags, noColor: true };
  }
  return flags;
}

export function effectiveDepth(detected: ColourDepth, flags: AccessibilityFlags): ColourDepth {
  return flags.noColor ? "none" : detected;
}

const ASCII_FALLBACKS: ReadonlyMap<string, string> = new Map([
  ["·", "."],
  ["•", "*"],
  ["…", "..."],
  ["–", "-"],
  ["—", "-"],
  ["←", "<"],
  ["→", ">"],
  ["↑", "^"],
  ["↓", "v"],
  ["✓", "v"],
  ["✗", "x"],
  ["⚡", "!"],
  ["█", "#"],
  ["▓", "#"],
  ["▒", "="],
  ["░", "-"],
  ["", ">"],
  ["", "<"],
  ["", ">"],
  ["", "<"],
]);

export function stripNonAscii(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) {
      out += ch;
      continue;
    }
    out += ASCII_FALLBACKS.get(ch) ?? "?";
  }
  return out;
}

export function applyAccessibility(
  segments: readonly Segment[],
  flags: AccessibilityFlags,
): readonly Segment[] {
  if (!flags.noUnicode) return segments;
  return segments.map((s) => ({ ...s, text: stripNonAscii(s.text) }));
}
