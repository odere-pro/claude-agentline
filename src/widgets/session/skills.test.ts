import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { skillsWidget } from "./skills.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(
  session: ResolvedSessionFields = {},
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-01-15T00:00:00Z"),
    env: {},
    session,
    ...overrides,
  };
}

describe("skills widget", () => {
  it("hides when skills is empty", () => {
    const cell = skillsWidget.render(makeCtx({ skills: [] }), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when skills is absent from session", () => {
    const cell = skillsWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders count variant by default", () => {
    const cell = skillsWidget.render(
      makeCtx({ skills: ["tdd", "refactor", "review"] }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("3");
  });

  it("count variant renders cardinality correctly", () => {
    const cell = skillsWidget.render(
      makeCtx({ skills: ["a", "b", "c", "d", "e"] }),
      { options: { variant: "count" }, rawValue: false },
    );
    expect(cell.text).toBe("5");
  });

  it("list variant joins names with comma by default", () => {
    const cell = skillsWidget.render(
      makeCtx({ skills: ["a", "b", "c"] }),
      { options: { variant: "list" }, rawValue: false },
    );
    expect(cell.text).toBe("a, b, c");
  });

  it("list variant respects custom listSeparator", () => {
    const cell = skillsWidget.render(
      makeCtx({ skills: ["a", "b", "c"] }),
      { options: { variant: "list", listSeparator: " | " }, rawValue: false },
    );
    expect(cell.text).toBe("a | b | c");
  });

  it("last variant returns the last skill", () => {
    const cell = skillsWidget.render(
      makeCtx({ skills: ["a", "b", "c"] }),
      { options: { variant: "last" }, rawValue: false },
    );
    expect(cell.text).toBe("c");
  });

  it("falls back to count for unknown variant", () => {
    const cell = skillsWidget.render(
      makeCtx({ skills: ["x", "y"] }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { options: { variant: "unknown" as any }, rawValue: false },
    );
    expect(cell.text).toBe("2");
  });

  it("renders custom label when set", () => {
    const cell = skillsWidget.render(
      makeCtx({ skills: ["tdd"] }),
      { options: { label: "skills:" }, rawValue: false },
    );
    expect(cell.text).toBe("skills:1");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = skillsWidget.render(
      makeCtx({ skills: ["a"] }),
      { options: { label: "s:" }, rawValue: false },
    );
    const noLabel = skillsWidget.render(
      makeCtx({ skills: ["a"] }),
      { options: { label: "s:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("s:1");
    expect(noLabel.text).toBe("1");
  });

  it("single skill count is 1", () => {
    const cell = skillsWidget.render(
      makeCtx({ skills: ["only-one"] }),
      { options: { variant: "count" }, rawValue: false },
    );
    expect(cell.text).toBe("1");
  });
});
