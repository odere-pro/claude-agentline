/**
 * Control-character sanitisation contract for the render seam.
 *
 * Pinned because a regression here re-opens the ANSI-injection class of
 * bugs against every widget that emits host- or git-derived text.
 */
import { describe, expect, it } from "vitest";

import { sanitizeCellText, sanitizeOscLabel } from "./sanitize.js";

describe("sanitizeCellText", () => {
  it("strips the C0 control range (NUL through US) and DEL", () => {
    const input = `clean\x00x\x01y\x07z\x0aA\x0dB\x1bC\x1fD\x7fE`;
    expect(sanitizeCellText(input)).toBe("cleanxyzABCDE");
  });

  it("strips C1 controls (0x80–0x9f) — some terminals decode \\x9b as CSI", () => {
    const csi = "";
    const input = `evil${csi}2J`;
    expect(sanitizeCellText(input)).toBe("evil2J");
  });

  it("preserves printable ASCII, Unicode, emoji, and Nerd-font private-use glyphs", () => {
    const input = `branch · main 🌿 ${String.fromCodePoint(0xe0a0)}`;
    expect(sanitizeCellText(input)).toBe(input);
  });

  it("returns the empty string when the input is wholly control characters", () => {
    expect(sanitizeCellText("\x00\x01\x1b\x7f")).toBe("");
  });

  it("is idempotent on a clean string", () => {
    const input = "model: claude-sonnet-4.6";
    expect(sanitizeCellText(sanitizeCellText(input))).toBe(input);
  });
});

describe("sanitizeOscLabel", () => {
  it("applies the same control-character policy to OSC 8 visible labels", () => {
    const input = `PR #42 \x07\x1b]0;evil\x07`;
    expect(sanitizeOscLabel(input)).toBe("PR #42 ]0;evil");
  });
});
