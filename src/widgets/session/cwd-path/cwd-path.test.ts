/**
 * Tests for the `cwd-path` widget (session family).
 *
 * TDD — failing first, then implemented. Key assertions:
 *   - renders ctx.stdin.cwd (the full working-directory path);
 *   - collapses the home prefix to `~` so shipped output carries no
 *     absolute home literal (gate-02 hygiene) and stays compact;
 *   - truncates from the left with an ellipsis when `maxLength` is set;
 *   - hides when cwd is absent.
 *
 * Distinct from `project`, which renders the git repo name (basename
 * fallback). `cwd-path` renders the full path.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { cwdPathWidget } from "./cwd-path.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(
  stdinOverrides: Partial<StdinPayload> = {},
  env: NodeJS.ProcessEnv = {},
): WidgetContext {
  return {
    stdin: { ...baseStdin, ...stdinOverrides },
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-01-15T12:00:00Z"),
    env,
  };
}

describe("cwd-path widget", () => {
  it("hides when stdin.cwd is absent", () => {
    const cell = cwdPathWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when stdin.cwd is an empty string", () => {
    const cell = cwdPathWidget.render(makeCtx({ cwd: "" }), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders the full path verbatim when no home prefix matches", () => {
    const cell = cwdPathWidget.render(
      makeCtx({ cwd: "/srv/work/repo" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("/srv/work/repo");
  });

  it("collapses the home prefix to ~ using ctx.env.HOME", () => {
    const cell = cwdPathWidget.render(
      makeCtx({ cwd: "/u/dev/code/repo" }, { HOME: "/u/dev" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("~/code/repo");
  });

  it("collapses an exact home match to ~", () => {
    const cell = cwdPathWidget.render(makeCtx({ cwd: "/u/dev" }, { HOME: "/u/dev" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("~");
  });

  it("does not collapse a partial (non-segment) home prefix match", () => {
    // HOME is /u/dev; cwd /u/developer must NOT become ~eloper
    const cell = cwdPathWidget.render(
      makeCtx({ cwd: "/u/developer/x" }, { HOME: "/u/dev" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("/u/developer/x");
  });

  it("truncates from the left with an ellipsis when maxLength is exceeded", () => {
    const cell = cwdPathWidget.render(
      makeCtx({ cwd: "/a/very/long/working/directory/path/here" }),
      { options: { maxLength: 12 }, rawValue: false },
    );
    expect(cell.text.length).toBe(12);
    expect(cell.text.startsWith("…")).toBe(true);
    expect(cell.text.endsWith("here")).toBe(true);
  });

  it("does not truncate when the path is within maxLength", () => {
    const cell = cwdPathWidget.render(
      makeCtx({ cwd: "/srv/x" }),
      { options: { maxLength: 12 }, rawValue: false },
    );
    expect(cell.text).toBe("/srv/x");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = cwdPathWidget.render(
      makeCtx({ cwd: "/srv/x" }),
      { options: { label: "cwd:" }, rawValue: false },
    );
    expect(cell.text).toBe("cwd:/srv/x");
  });

  it("rawValue suppresses the label", () => {
    const cell = cwdPathWidget.render(
      makeCtx({ cwd: "/srv/x" }),
      { options: { label: "cwd:" }, rawValue: true },
    );
    expect(cell.text).toBe("/srv/x");
  });
});
