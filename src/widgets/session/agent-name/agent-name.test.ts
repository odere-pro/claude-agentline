/**
 * Tests for the `agent-name` widget (session family).
 *
 * Renders the active subagent persona name from `ctx.stdin.agentName`.
 * Hidden when absent (the main agent reports no name).
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { agentNameWidget } from "./agent-name.js";

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

describe("agent-name widget", () => {
  it("hides when agentName is absent", () => {
    const cell = agentNameWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("renders the agent name", () => {
    const cell = agentNameWidget.render(makeCtx({ agentName: "researcher" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("researcher");
    expect(cell.hidden).toBeFalsy();
  });

  it("honours options.label when rawValue is false", () => {
    const cell = agentNameWidget.render(makeCtx({ agentName: "researcher" }), {
      options: { label: "@" },
      rawValue: false,
    });
    expect(cell.text).toBe("@researcher");
  });

  it("rawValue suppresses the label", () => {
    const cell = agentNameWidget.render(makeCtx({ agentName: "researcher" }), {
      options: { label: "@" },
      rawValue: true,
    });
    expect(cell.text).toBe("researcher");
  });
});
