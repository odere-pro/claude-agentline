/**
 * Colour-depth detection (§8.3).
 *
 *   COLORTERM=truecolor | 24bit  -> 24-bit truecolor
 *   TERM matches *-256color       -> 256-colour
 *   TERM xterm / screen / vt100…  -> 16-colour
 *   --no-color or NO_COLOR set    -> none (caller's responsibility)
 *   dumb terminal                 -> none
 *
 * The renderer downgrades the encoded escape sequences to fit the
 * detected depth (§1.2 N8). Detection is allocation-free and reads
 * only the env snapshot the caller supplies.
 */

export type ColourDepth = "truecolor" | "256" | "16" | "none";

export interface ColourDepthSource {
  readonly env: NodeJS.ProcessEnv;
}

const TRUECOLOR_VALUES = new Set(["truecolor", "24bit"]);

const TERM_256_PATTERNS: readonly RegExp[] = [/-256color$/i, /^xterm-kitty$/i];

const TERM_16_PATTERNS: readonly RegExp[] = [
  /^xterm/i,
  /^screen/i,
  /^tmux/i,
  /^rxvt/i,
  /^vt100$/i,
  /^vt220$/i,
  /^linux$/i,
  /^ansi$/i,
];

export function detectColourDepth(source: ColourDepthSource): ColourDepth {
  const env = source.env;
  const colorTerm = (env["COLORTERM"] ?? "").trim().toLowerCase();
  if (TRUECOLOR_VALUES.has(colorTerm)) return "truecolor";
  const term = (env["TERM"] ?? "").trim();
  if (term === "" || term.toLowerCase() === "dumb") return "none";
  if (TERM_256_PATTERNS.some((re) => re.test(term))) return "256";
  if (TERM_16_PATTERNS.some((re) => re.test(term))) return "16";
  return "16";
}
