import { describe, it, expect } from "vitest";
import { formatText, formatJson, summariseWorst } from "./format.js";
import type { CheckResult, RunReport } from "./types.js";

const ESC = "\x1b[";

const sample: CheckResult[] = [
  { id: "D01", title: "settings present", status: "pass", message: "ok" },
  { id: "D02", title: "wired", status: "warn", message: "missing", hint: "do X" },
  { id: "D03", title: "schema", status: "fixed", message: "rewritten", fixed: true },
];

describe("summariseWorst", () => {
  it("picks fail over warn over pass", () => {
    expect(summariseWorst(sample)).toBe("warn");
    expect(
      summariseWorst([...sample, { id: "D99", title: "x", status: "fail", message: "no" }]),
    ).toBe("fail");
  });

  it("picks pass when everything passed", () => {
    expect(summariseWorst([{ id: "D01", title: "x", status: "pass", message: "ok" }])).toBe("pass");
  });
});

describe("formatText", () => {
  it("prints one line per check plus a summary", () => {
    const report: RunReport = { results: sample, worst: "warn" };
    const out = formatText(report, { tty: false, env: { NO_COLOR: "1" } });
    // Titles are padded to the widest title's length so messages align.
    expect(out).toContain("[ok] D01  settings present  ok");
    expect(out).toContain("[!!] D02  wired             missing");
    expect(out).toContain("↳ do X");
    expect(out).toContain("[fx] D03  schema            rewritten");
    expect(out).toMatch(/summary:.*1 pass/);
  });

  it("appends a `--fix` next-step hint when fail/warn rows mention it", () => {
    const fixable: CheckResult[] = [
      {
        id: "D01",
        title: "wired",
        status: "fail",
        message: "missing",
        hint: "run with --fix",
      },
    ];
    const out = formatText(
      { results: fixable, worst: "fail" },
      { tty: false, env: { NO_COLOR: "1" } },
    );
    expect(out).toContain("agentline doctor --fix");
  });

  it("colours glyphs only when stdout is a TTY and NO_COLOR is unset", () => {
    const report: RunReport = { results: sample, worst: "warn" };
    const colourised = formatText(report, { tty: true, env: {} });
    const plain = formatText(report, { tty: false, env: {} });
    expect(colourised).toContain(`${ESC}32m[ok]`);
    expect(plain).not.toContain(ESC);
  });

  it("respects NO_COLOR=1 even on a TTY", () => {
    const report: RunReport = { results: sample, worst: "warn" };
    const out = formatText(report, { tty: true, env: { NO_COLOR: "1" } });
    expect(out).not.toContain(ESC);
  });
});

describe("formatJson", () => {
  it("emits structured JSON with worst + checks", () => {
    const report: RunReport = { results: sample, worst: "warn" };
    const parsed = JSON.parse(formatJson(report));
    expect(parsed.worst).toBe("warn");
    expect(parsed.checks).toHaveLength(3);
    expect(parsed.checks[0]).toEqual({
      id: "D01",
      title: "settings present",
      status: "pass",
      message: "ok",
    });
    expect(parsed.checks[1].hint).toBe("do X");
    expect(parsed.checks[2].fixed).toBe(true);
  });
});
