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

  it("emits a warning line for an unknown widget type", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "no-such-widget" }] }],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    const lines = result.split("\n");
    /*
     * First "line" is the rendered statusline (empty since the widget hides);
     * the next line carries the warning.
     */
    expect(lines.some((l) => /unknown widget type 'no-such-widget'/.test(l))).toBe(true);
  });

  it("deduplicates repeated unknown widget types", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "no-such-widget" }, { type: "no-such-widget" }] }],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    const matches = result.match(/unknown widget type 'no-such-widget'/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("caps warning lines at MAX_WARNING_LINES (6) and emits them in sorted order", () => {
    const types = Array.from({ length: 12 }, (_, i) => ({ type: `bogus-${i}` }));
    const config = { ...DEFAULT_CONFIG, lines: [{ widgets: types }] };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    const warningLines = result.split("\n").filter((l) => /unknown widget type/.test(l));
    expect(warningLines).toHaveLength(6);
    /*
     * `buildWarningLines` deduplicates + sorts the unknown types so the
     * surfaced lines stay stable across renders. Assert the sort.
     */
    const sorted = [...warningLines].sort();
    expect(warningLines).toEqual(sorted);
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
        { widgets: [{ type: "current-session-reset-timer" }] },
        { widgets: [{ type: "current-session-reset-timer" }] },
        { widgets: [{ type: "current-session-reset-timer" }] },
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
      lines: [{ widgets: [{ type: "current-session-reset-timer" }, { type: "current-session-reset-timer" }, { type: "current-session-reset-timer" }] }],
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

  it("still wraps when an explicit narrow width is supplied", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "current-session-reset-timer" }, { type: "current-session-reset-timer" }, { type: "current-session-reset-timer" }] }],
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
    expect(rows.length).toBeGreaterThan(1);
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
      lines: [{ widgets: [{ type: "current-session-reset-timer" }] }],
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
