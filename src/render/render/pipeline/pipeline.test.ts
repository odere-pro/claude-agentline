import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import { renderFromInputs, type RenderInputs } from "./pipeline.js";

const ESC = "\x1b[";

const basePayload = { raw: {}, truncated: false };

const emptyConfig = { ...DEFAULT_CONFIG, lines: [] };

function makeInputs(overrides: Partial<RenderInputs> = {}): RenderInputs {
  return {
    payload: basePayload,
    config: emptyConfig,
    theme: null,
    ...overrides,
  };
}

describe("renderFromInputs", () => {
  it("returns '\\n' when config has no lines", () => {
    const result = renderFromInputs(makeInputs());
    expect(result).toBe("\n");
  });

  it("always ends with a newline", () => {
    const result = renderFromInputs(makeInputs());
    expect(result).toMatch(/\n$/);
  });

  it("can be called twice without throwing (ensureRegistry is idempotent)", () => {
    expect(() => {
      renderFromInputs(makeInputs());
      renderFromInputs(makeInputs());
    }).not.toThrow();
  });

  it("produces no ANSI escape sequences when NO_COLOR=1", () => {
    const result = renderFromInputs(makeInputs({ env: { NO_COLOR: "1" } }));
    expect(result).not.toContain(ESC);
  });

  it("returns a string with NO_COLOR=1 and default config", () => {
    const result = renderFromInputs({
      payload: basePayload,
      config: DEFAULT_CONFIG,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a string type for empty config", () => {
    const result = renderFromInputs(makeInputs());
    expect(typeof result).toBe("string");
  });

  // ── unknown widget types are silent on the statusline (issue #311) ─────
  //
  // The type is tolerated at load, the cell is hidden, and `agentline doctor`
  // D11 is the reporting channel. Warning rows below the statusline would
  // reintroduce the variable physical-row count that #304 removed — the very
  // thing that corrupts the host's repaint accounting.

  it("hides an unknown widget type and emits no warning row", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }, { type: "no-such-widget" }] }],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    expect(result).not.toMatch(/unknown widget type/);
    expect(result).not.toMatch(/no-such-widget/);
  });

  it("an unknown widget type does not change the physical row count", () => {
    const good = { ...DEFAULT_CONFIG, lines: [{ widgets: [{ type: "model" }] }] };
    const withUnknown = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }, { type: "bogus-a" }, { type: "bogus-b" }] }],
    };
    const rows = (config: typeof good) =>
      renderFromInputs({ payload: basePayload, config, theme: null, env: { NO_COLOR: "1" } })
        .split("\n")
        .filter((l) => l.length > 0).length;
    expect(rows(withUnknown)).toBe(rows(good));
  });

  it("keeps the surviving widgets on a line whose other type is unknown", () => {
    // The retired-widget case: the user loses that cell, not the whole line.
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "no-such-widget" }, { type: "clock" }] }],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
      clock: { now: () => new Date("2026-05-17T12:00:00Z") },
    });
    // The clock renders in host-local time; assert it rendered at all.
    expect(result).toMatch(/\d{2}:\d{2}/);
    expect(result).not.toMatch(/no-such-widget/);
  });

  it("renders every configured line on its own row when width is undetected", () => {
    /*
     * Live host case: no COLUMNS, no tty, no inputs.width. The render
     * must NOT wrap against a guessed fallback and must keep every
     * configured line — the reported bug dropped line 3.
     */
    const config = {
      ...DEFAULT_CONFIG,
      lines: [
        { widgets: [{ type: "clock" }] },
        { widgets: [{ type: "clock" }] },
        { widgets: [{ type: "clock" }] },
      ],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
      clock: { now: () => new Date("2026-05-17T12:00:00Z") },
    });
    const rows = result.split("\n").filter((l) => l.length > 0);
    expect(rows).toHaveLength(3);
  });

  it("does not wrap a wide single line when width is undetected", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "clock" }, { type: "clock" }, { type: "clock" }] }],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
      clock: { now: () => new Date("2026-05-17T12:00:00Z") },
    });
    const rows = result.split("\n").filter((l) => l.length > 0);
    expect(rows).toHaveLength(1);
  });

  it("stays on one row when an explicit narrow width is supplied (issue #304)", () => {
    // A configured line never spills onto a second physical row: the host
    // paints one row per `\n`, and a varying row count is what corrupts its
    // erase-and-redraw accounting. Overflow is elided, not wrapped.
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "clock" }, { type: "clock" }, { type: "clock" }] }],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
      width: 6,
      clock: { now: () => new Date("2026-05-17T12:00:00Z") },
    });
    const rows = result.split("\n").filter((l) => l.length > 0);
    expect(rows).toHaveLength(1);
  });

  it("strips control characters injected via stdin-derived widget text", () => {
    /*
     * Threat model: a hostile Claude Code statusline payload sets
     * `model.display_name` to text containing ANSI escapes. The model
     * widget surfaces that string verbatim — without the render-seam
     * sanitiser the bytes reach the terminal and clear the screen,
     * spoof the window title, or move the cursor on every render tick.
     * The assertion below pins that none of those bytes survive.
     */
    const payload = {
      raw: {},
      truncated: false,
      modelDisplayName: "evil\x1b[2J\x07\x9btitle",
    };
    const result = renderFromInputs({
      payload,
      config: {
        ...DEFAULT_CONFIG,
        lines: [{ widgets: [{ type: "model" }] }],
      },
      theme: null,
      env: { NO_COLOR: "1" },
    });
    // The threat is the EXECUTABLE escape lead-in, not the leftover
    // printable bytes — once ESC and the C1 CSI byte are gone, `[2J`
    // is just inert text the terminal renders verbatim.
    expect(result).not.toContain("\x1b");
    expect(result).not.toContain("\x07");
    // `\x9b` is the C1 CSI byte — some terminals re-open an escape
    // sequence on it, so the seam must drop it too.
    expect(result).not.toContain("\x9b");
    // The benign neighbours of the stripped bytes survive intact.
    expect(result).toContain("evil");
    expect(result).toContain("title");
  });

  it("emits no warning lines when every widget type is known", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "clock" }] }],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    expect(result).not.toContain("unknown widget type");
  });
});
