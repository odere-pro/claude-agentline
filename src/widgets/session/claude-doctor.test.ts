import { describe, expect, it } from "vitest";

import { makeClaudeHealth, makeWidgetContext } from "../../test-helpers/index.js";
import { claudeDoctorWidget } from "./claude-doctor.js";

const render = (ctxOverrides = {}, settings = { options: {}, rawValue: false }) =>
  claudeDoctorWidget.render(makeWidgetContext(ctxOverrides), settings);

describe("claude-doctor widget", () => {
  it("hides when the claude-health snapshot is absent", () => {
    expect(render().hidden).toBe(true);
  });

  it("hides when the snapshot reports unavailable", () => {
    expect(render({ claudeHealth: { available: false } }).hidden).toBe(true);
  });

  it("hides when doctor could not be parsed (null)", () => {
    expect(render({ claudeHealth: makeClaudeHealth({ doctor: null }) }).hidden).toBe(true);
  });

  it("hides when doctor is healthy (no issues, no warnings)", () => {
    const claudeHealth = makeClaudeHealth({ doctor: { status: "ok", issues: 0, warnings: 0 } });
    expect(render({ claudeHealth }).hidden).toBe(true);
  });

  it("renders warning count with the warning role", () => {
    const claudeHealth = makeClaudeHealth({ doctor: { status: "warn", issues: 0, warnings: 2 } });
    const cell = render({ claudeHealth });
    expect(cell.text).toBe("claude ⚠2");
    expect(cell.signal).toBe(true);
  });

  it("renders both counts when issues and warnings are present", () => {
    const claudeHealth = makeClaudeHealth({ doctor: { status: "fail", issues: 1, warnings: 2 } });
    const cell = render({ claudeHealth });
    expect(cell.text).toBe("claude ✗1 ⚠2");
  });

  it("suppresses the label when rawValue is true", () => {
    const claudeHealth = makeClaudeHealth({ doctor: { status: "warn", issues: 0, warnings: 3 } });
    expect(render({ claudeHealth }, { options: {}, rawValue: true }).text).toBe("⚠3");
  });
});
