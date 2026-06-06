/**
 * Control-character sanitisation for the render seam.
 *
 * Host stdin and git-derived strings (branch / PR title / model display
 * name / version / output style / vim mode / session id / account email
 * / plan name) flow through widgets into the renderer verbatim. Without
 * scrubbing, an attacker who controls any of those strings can embed
 * ANSI escape bytes ("\x1b[2J", an OSC window-title spoof, a cursor
 * relocation, "\x07" BEL, etc.) that the terminal will interpret on
 * every render tick. The render hot path strips them at one seam so
 * every widget benefits automatically.
 *
 * Stripped:
 *   - C0 (`\x00`–`\x1f`): NUL through US, includes TAB, LF, CR, ESC,
 *     and all the cursor-movement / clear-screen drivers.
 *   - DEL (`\x7f`).
 *   - C1 (`\x80`–`\x9f`): some terminals re-interpret these as their
 *     7-bit equivalents (`\x9b` → CSI), so they can re-open an escape
 *     sequence on their own.
 *   - Unicode bidi / format controls (terminal-spoofing vectors):
 *       U+200E  LEFT-TO-RIGHT MARK
 *       U+200F  RIGHT-TO-LEFT MARK
 *       U+202A–U+202E  LRE, RLE, PDF, LRO, RLO (directional embeddings / overrides)
 *       U+2028  LINE SEPARATOR
 *       U+2029  PARAGRAPH SEPARATOR
 *       U+2066–U+2069  LRI, RLI, FSI, PDI (directional isolates)
 *
 * Preserved: everything else, including Unicode beyond `\xa0` — emoji,
 * Nerd-font private-use codepoints, East-Asian wide glyphs. The pure
 * functions below are safe in the render hot path (no I/O, no clock).
 */

/*
 * Build the pattern via RegExp constructor so the unicode escapes for bidi
 * characters are unambiguous in source (the regex literal form embeds them
 * as raw code-points which confuses some transformers). The `\u` notation
 * inside the string is the conventional way to spell non-printable unicode
 * ranges; oxc and tsc both handle it cleanly.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp(
  "[\x00-\x1f\x7f-\x9f" +
    "‎‏" + // LRM, RLM
    "‪-‮" + // LRE, RLE, PDF, LRO, RLO
    "  " + // line separator, paragraph separator
    "⁦-⁩" + // LRI, RLI, FSI, PDI
    "]",
  "g",
);

/**
 * Strip control characters from a widget cell's visible text. Width
 * measurement in `compose.ts` runs AFTER this so the cell width matches
 * the bytes that actually reach the terminal.
 */
export function sanitizeCellText(text: string): string {
  return text.replace(CONTROL_CHARS, "");
}

/**
 * Strip control characters from an OSC 8 link's visible label. The href
 * itself is sanitised separately by `ansi.ts:sanitiseHref` because the
 * encoder owns the wrap.
 */
export function sanitizeOscLabel(label: string): string {
  return label.replace(CONTROL_CHARS, "");
}
