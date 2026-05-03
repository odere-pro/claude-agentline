import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseRenderArgs, runRenderCommand } from "./fixture-command.js";

describe("parseRenderArgs", () => {
  it("zero shape on no args", () => {
    expect(parseRenderArgs([])).toEqual({});
  });

  it("--fixture <path>", () => {
    expect(parseRenderArgs(["--fixture", "/x.json"])).toEqual({ fixture: "/x.json" });
    expect(parseRenderArgs(["--fixture=/y.json"])).toEqual({ fixture: "/y.json" });
  });

  it("--config <path>", () => {
    expect(parseRenderArgs(["--config", "/cfg.json"])).toEqual({ configPath: "/cfg.json" });
  });

  it("rejects unknown args", () => {
    expect(() => parseRenderArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("rejects flags without values", () => {
    expect(() => parseRenderArgs(["--fixture"])).toThrow(/requires a path/);
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
    const code = await runRenderCommand({ args: { fixture } });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("claude-opus-4-7");
  });

  it("returns 1 on missing fixture file", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runRenderCommand({ args: { fixture: "/no-such-file.json" } });
    expect(code).toBe(1);
  });

  it("falls back to stdin when no fixture is supplied", async () => {
    const stdin = Readable.from([
      Buffer.from(JSON.stringify({ model: "claude-haiku-4-5" })),
    ]);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRenderCommand({ args: {}, stdin });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("claude-haiku-4-5");
  });

  it("returns 1 on empty stdin", async () => {
    const stdin = Readable.from([]);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRenderCommand({ args: {}, stdin });
    expect(code).toBe(1);
  });
});
