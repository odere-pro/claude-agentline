/**
 * Tests for the pure `readColumns` reader behind `useTerminalWidth`.
 * The effectful hook (resize subscription → React re-render) is covered
 * by the rendered editor / manual resize check; here we lock down the
 * width-resolution contract that keeps the preview box consistent with
 * the render path's fallback.
 */
import { describe, expect, it } from "vitest";

import { FALLBACK_WIDTH } from "../render/width.js";

import { readColumns } from "./use-terminal-width.js";

describe("readColumns", () => {
  it("returns the stream columns when a positive integer", () => {
    expect(readColumns({ columns: 137 })).toBe(137);
  });

  it("falls back when the source is undefined", () => {
    expect(readColumns(undefined)).toBe(FALLBACK_WIDTH);
  });

  it("falls back when columns is missing, zero, negative, or non-integer", () => {
    expect(readColumns({})).toBe(FALLBACK_WIDTH);
    expect(readColumns({ columns: 0 })).toBe(FALLBACK_WIDTH);
    expect(readColumns({ columns: -10 })).toBe(FALLBACK_WIDTH);
    expect(readColumns({ columns: 80.5 })).toBe(FALLBACK_WIDTH);
  });
});
