import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseThemesArgs, runThemesCommand } from "./command.js";

describe("parseThemesArgs", () => {
  it("defaults to action=table (swatch view)", () => {
    expect(parseThemesArgs([])).toEqual({ action: "table" });
  });

  it("--list selects machine-readable output", () => {
    expect(parseThemesArgs(["--list"])).toEqual({ action: "list" });
  });

  it("--show <name>", () => {
    expect(parseThemesArgs(["--show", "vscode-dark"])).toEqual({
      action: "show",
      name: "vscode-dark",
    });
    expect(parseThemesArgs(["--show=foo"])).toEqual({
      action: "show",
      name: "foo",
    });
  });

  it("rejects --show without a value", () => {
    expect(() => parseThemesArgs(["--show"])).toThrow(/requires a theme name/);
  });

  it("rejects unknown args", () => {
    expect(() => parseThemesArgs(["--bogus"])).toThrow(/unknown argument/);
  });
});

describe("runThemesCommand", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-themes-"));
    writeFileSync(
      join(tmp, "demo.json"),
      JSON.stringify({
        name: "demo",
        palette: {
          accent: "#aabbcc",
          info: "#9cdcfe",
          success: "#00ff00",
          warning: "#ffaa00",
          danger: "#ff0000",
          muted: "#888888",
          "git-clean": "#00cc00",
          "git-dirty": "#ffaa00",
          "tokens-low": "#00cc00",
          "tokens-mid": "#ffaa00",
          "tokens-high": "#ff0000",
          "bg-section": "#1e1e1e",
          "bg-emphasis": "#2d2d30",
        },
      }),
    );
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("lists themes from the builtin directory", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "list" },
      env: {},
      cwd: "/no-such-cwd",
      builtinDir: tmp,
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("demo");
  });

  it("show prints the resolved palette", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "show", name: "demo" },
      env: {},
      cwd: "/no-such-cwd",
      builtinDir: tmp,
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("theme: demo");
    expect(out).toContain("accent");
    expect(out).toContain("#aabbcc");
  });

  it("show fails for unknown theme name", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "show", name: "nope" },
      env: {},
      cwd: "/no-such-cwd",
      builtinDir: tmp,
    });
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalled();
  });

  it("show without name returns exit 2", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "show" },
      env: {},
      cwd: "/no-such-cwd",
      builtinDir: tmp,
    });
    expect(code).toBe(2);
  });

  it("table action renders a swatch row per theme", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "table" },
      env: {},
      cwd: "/no-such-cwd",
      builtinDir: tmp,
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("demo");
  });

  it("table action emits a TTY-friendly hint to stderr", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await runThemesCommand({
      args: { action: "table" },
      env: {},
      cwd: "/no-such-cwd",
      builtinDir: tmp,
    });
    const stderrOut = stderr.mock.calls.map((c) => String(c[0])).join("");
    expect(stderrOut).toContain("agentline preview --all-themes");
  });

  it("table action fails when no themes found", async () => {
    const empty = mkdtempSync(join(tmpdir(), "agentline-themes-empty-"));
    try {
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "table" },
        env: {},
        cwd: "/no-such-cwd",
        builtinDir: empty,
      });
      expect(code).toBe(1);
      expect(stderr).toHaveBeenCalled();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
