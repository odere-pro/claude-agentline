/**
 * Unit tests for Segment type and utilities.
 */

import { describe, it, expect } from "vitest";
import { plainSegment, type Segment } from "./segment.js";

describe("Segment", () => {
  it("creates a segment from text", () => {
    const seg = plainSegment("hello");
    expect(seg.text).toBe("hello");
    expect(seg.fg).toBeUndefined();
    expect(seg.bg).toBeUndefined();
    expect(seg.bold).toBeUndefined();
    expect(seg.italic).toBeUndefined();
  });

  it("preserves empty text", () => {
    const seg = plainSegment("");
    expect(seg.text).toBe("");
  });

  it("allows custom segments with colour and style", () => {
    const seg: Segment = {
      text: "styled",
      fg: "bright-blue",
      bg: "#FF0000",
      bold: true,
      italic: true,
    };
    expect(seg.text).toBe("styled");
    expect(seg.fg).toBe("bright-blue");
    expect(seg.bg).toBe("#FF0000");
    expect(seg.bold).toBe(true);
    expect(seg.italic).toBe(true);
  });

  it("allows segments with only foreground colour", () => {
    const seg: Segment = {
      text: "fg-only",
      fg: "cyan",
    };
    expect(seg.fg).toBe("cyan");
    expect(seg.bg).toBeUndefined();
  });

  it("allows segments with only background colour", () => {
    const seg: Segment = {
      text: "bg-only",
      bg: "colour:100",
    };
    expect(seg.bg).toBe("colour:100");
    expect(seg.fg).toBeUndefined();
  });

  it("allows segments with only bold", () => {
    const seg: Segment = {
      text: "bold-only",
      bold: true,
    };
    expect(seg.bold).toBe(true);
    expect(seg.italic).toBeUndefined();
  });

  it("allows segments with only italic", () => {
    const seg: Segment = {
      text: "italic-only",
      italic: true,
    };
    expect(seg.italic).toBe(true);
    expect(seg.bold).toBeUndefined();
  });
});
