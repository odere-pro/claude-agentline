/**
 * Tests for the `project-dir` widget (session family).
 *
 * Renders the basename of the launch directory from
 * `ctx.stdin.projectDir`. Distinct from `project` (git repo name) and
 * `cwd-path` (full current dir): this is the dir the host started in.
 * Hidden when absent.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { projectDirWidget } from "./project-dir.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(stdinOverrides: Partial<StdinPayload> = {}): WidgetContext {
  return {
    stdin: { ...baseStdin, ...stdinOverrides },
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-01-15T12:00:00Z"),
    env: {},
  };
}

describe("project-dir widget", () => {
  it("hides when projectDir is absent", () => {
    const cell = projectDirWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("renders the basename of the launch dir", () => {
    const cell = projectDirWidget.render(makeCtx({ projectDir: "/srv/work/my-repo" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("my-repo");
  });

  it("handles a trailing separator", () => {
    const cell = projectDirWidget.render(makeCtx({ projectDir: "/srv/work/my-repo/" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("my-repo");
  });

  it("can render the full path when full option is set", () => {
    const cell = projectDirWidget.render(makeCtx({ projectDir: "/srv/work/my-repo" }), {
      options: { full: true },
      rawValue: false,
    });
    expect(cell.text).toBe("/srv/work/my-repo");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = projectDirWidget.render(makeCtx({ projectDir: "/srv/work/my-repo" }), {
      options: { label: "dir:" },
      rawValue: false,
    });
    expect(cell.text).toBe("dir:my-repo");
  });

  it("rawValue suppresses the label", () => {
    const cell = projectDirWidget.render(makeCtx({ projectDir: "/srv/work/my-repo" }), {
      options: { label: "dir:" },
      rawValue: true,
    });
    expect(cell.text).toBe("my-repo");
  });
});
