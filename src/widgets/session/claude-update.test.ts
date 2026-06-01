import { describe, expect, it } from "vitest";

import { makeClaudeHealth, makeWidgetContext } from "../../test-helpers/index.js";
import { claudeUpdateWidget } from "./claude-update.js";

const render = (ctxOverrides = {}, settings = { options: {}, rawValue: false }) =>
  claudeUpdateWidget.render(makeWidgetContext(ctxOverrides), settings);

describe("claude-update widget", () => {
  it("hides when the claude-health snapshot is absent", () => {
    expect(render().hidden).toBe(true);
  });

  it("hides when the snapshot reports unavailable", () => {
    expect(render({ claudeHealth: { available: false } }).hidden).toBe(true);
  });

  it("hides when no update is needed", () => {
    const claudeHealth = makeClaudeHealth({ needsUpdate: false });
    expect(render({ claudeHealth }).hidden).toBe(true);
  });

  it("renders the latest version when an update is available", () => {
    const claudeHealth = makeClaudeHealth({ needsUpdate: true, latestVersion: "2.0.14" });
    const cell = render({ claudeHealth });
    expect(cell.hidden).toBeFalsy();
    expect(cell.text).toBe("claude↑2.0.14");
    expect(cell.signal).toBe(true);
  });

  it("respects a custom label and suppresses it when rawValue is true", () => {
    const claudeHealth = makeClaudeHealth({ latestVersion: "2.0.14" });
    expect(render({ claudeHealth }, { options: { label: "cc " }, rawValue: false }).text).toBe(
      "cc 2.0.14",
    );
    expect(render({ claudeHealth }, { options: { label: "cc " }, rawValue: true }).text).toBe(
      "2.0.14",
    );
  });
});
