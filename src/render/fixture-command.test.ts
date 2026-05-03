import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseRenderArgs, runRenderCommand } from "./fixture-command.js";

const NO_FLAGS = { noColor: false, noUnicode: false } as const;

describe("parseRenderArgs", () => {
  it("zero shape on no args", () => {
    expect(parseRenderArgs([])).toEqual({ accessibility: NO_FLAGS });
  });

  it("--fixture <path>", () => {
    expect(parseRenderArgs(["--fixture", "/x.json"])).toMatchObject({ fixture: "/x.json" });
    expect(parseRenderArgs(["--fixture=/y.json"])).toMatchObject({ fixture: "/y.json" });
  });

  it("--config <path>", () => {
    expect(parseRenderArgs(["--config", "/cfg.json"])).toMatchObject({
      configPath: "/cfg.json",
    });
  });

  it("--frozen-clock <iso>", () => {
    expect(parseRenderArgs(["--frozen-clock", "2026-05-01T00:00:00Z"])).toMatchObject({
      frozenClockISO: "2026-05-01T00:00:00Z",
    });
  });

  it("--width <n>", () => {
    expect(parseRenderArgs(["--width", "120"])).toMatchObject({ width: 120 });
    expect(() => parseRenderArgs(["--width", "0"])).toThrow(/positive integer/);
    expect(() => parseRenderArgs(["--width", "abc"])).toThrow(/positive integer/);
  });

  it("--no-color sets accessibility flag", () => {
    expect(parseRenderArgs(["--no-color"])).toMatchObject({
      accessibility: { noColor: true, noUnicode: false },
    });
  });

  it("--ascii sets both noColor and noUnicode", () => {
    expect(parseRenderArgs(["--ascii"])).toMatchObject({
      accessibility: { noColor: true, noUnicode: true },
    });
  });

  it("rejects unknown args", () => {
    expect(() => parseRenderArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("rejects flags without values", () => {
    expect(() => parseRenderArgs(["--fixture"])).toThrow(/requires a path/);
    expect(() => parseRenderArgs(["--frozen-clock"])).toThrow(/ISO timestamp/);
  });
});

describe("runRenderCommand", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-render-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("reads the fixture and replays through the renderer", async () => {
    const fixture = join(tmp, "f.json");
    writeFileSync(fixture, JSON.stringify({ model: "claude-opus-4-7" }));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { fixture, accessibility: { noColor: true, noUnicode: false } },
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("Opus 4.7");
  });

  it("returns 1 on missing fixture file", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { fixture: "/no-such-file.json", accessibility: NO_FLAGS },
    });
    expect(code).toBe(1);
  });

  it("falls back to stdin when no fixture is supplied", async () => {
    const stdin = Readable.from([
      Buffer.from(JSON.stringify({ model: "claude-haiku-4-5" })),
    ]);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { accessibility: { noColor: true, noUnicode: false } },
      stdin,
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("Haiku 4.5");
  });

  it("returns 1 on empty stdin", async () => {
    const stdin = Readable.from([]);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { accessibility: { noColor: true, noUnicode: false } },
      stdin,
    });
    expect(code).toBe(1);
  });
});
