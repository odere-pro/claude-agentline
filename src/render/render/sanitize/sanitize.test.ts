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

describe("sanitizeCellText — bidi control characters", () => {
  it("strips U+202E RIGHT-TO-LEFT OVERRIDE from a branch name", () => {
    // U+202E is the classic terminal-spoofing vector
    const branch = `main‮evil`;
    expect(sanitizeCellText(branch)).toBe("mainevil");
  });

  it("strips the full bidi override set U+202A–U+202E", () => {
    const chars = "‪‫‬‭‮";
    expect(sanitizeCellText(`x${chars}y`)).toBe("xy");
  });

  it("strips Unicode bidi isolates U+2066–U+2069", () => {
    const chars = "⁦⁧⁨⁩";
    expect(sanitizeCellText(`x${chars}y`)).toBe("xy");
  });

  it("strips LRM (U+200E) and RLM (U+200F)", () => {
    const chars = "‎‏";
    expect(sanitizeCellText(`x${chars}y`)).toBe("xy");
  });

  it("strips line separator U+2028 and paragraph separator U+2029", () => {
    const chars = "  ";
    expect(sanitizeCellText(`x${chars}y`)).toBe("xy");
  });

  it("preserves CJK and emoji — bidi strip must not affect legitimate wide chars", () => {
    const input = "feat: 中文 🚀 branch";
    expect(sanitizeCellText(input)).toBe(input);
  });

  it("is idempotent on a clean string containing CJK", () => {
    const input = "中文";
    expect(sanitizeCellText(sanitizeCellText(input))).toBe(input);
  });
});
